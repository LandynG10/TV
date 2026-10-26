package com.grantos.tv;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * window.GrantOSNative. The page calls call(id, method, argsJson); the work runs off the UI
 * thread and the answer comes back as window.__grantosNativeResult(id, json).
 * The TypeScript side is web/src/platform/android.ts.
 */
class NativeBridge {
    private static final int MIC_PERMISSION_REQUEST = 41;
    private static final int MAX_BODY = 2 * 1024 * 1024;

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService pool = Executors.newCachedThreadPool();

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String pendingSpeech;
    private SpeechRecognizer recognizer;
    private String listenId;

    NativeBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void call(final String id, final String method, final String argsJson) {
        pool.execute(new Runnable() {
            @Override
            public void run() {
                JSONObject result;
                try {
                    JSONObject args = argsJson == null || argsJson.isEmpty() ? new JSONObject() : new JSONObject(argsJson);
                    result = dispatch(id, method, args);
                } catch (Throwable t) {
                    result = error(t.getClass().getSimpleName() + ": " + t.getMessage());
                }
                if (result != null) reply(id, result); // null = answered later (voice input).
            }
        });
    }

    private JSONObject dispatch(String id, String method, JSONObject a) throws Exception {
        switch (method) {
            case "listApps": return listApps();
            case "launchApp": return launchApp(a.optString("packageName"), a.optString("activity"));
            case "http": return http(a);
            case "udp": return udp(a);
            case "deviceInfo": return deviceInfo();
            case "speak": return speak(a.optString("text"));
            case "stopSpeaking": return stopSpeaking();
            case "voiceAvailable": return new JSONObject().put("available", SpeechRecognizer.isRecognitionAvailable(activity));
            case "listen": return listen(id);
            case "openSystemSettings": return start(new Intent(Settings.ACTION_SETTINGS));
            case "openStockHome": return openStockHome();
            default: return error("Unknown method " + method);
        }
    }

    void shutdown() {
        pool.shutdownNow();
        if (tts != null) tts.shutdown();
        if (recognizer != null) recognizer.destroy();
    }

    // ---------------------------------------------------------------- apps

    private JSONObject listApps() throws JSONException {
        PackageManager pm = activity.getPackageManager();
        Set<String> seen = new HashSet<>();
        seen.add(activity.getPackageName());
        JSONArray apps = new JSONArray();
        String[][] categories = {{Intent.CATEGORY_LEANBACK_LAUNCHER, "true"}, {Intent.CATEGORY_LAUNCHER, "false"}};
        for (String[] c : categories) {
            for (ResolveInfo info : pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(c[0]), 0)) {
                String pkg = info.activityInfo.packageName;
                if (!seen.add(pkg)) continue;
                apps.put(new JSONObject()
                        .put("packageName", pkg)
                        .put("label", info.loadLabel(pm).toString())
                        .put("activity", info.activityInfo.name)
                        .put("tv", Boolean.parseBoolean(c[1])));
            }
        }
        return new JSONObject().put("apps", apps);
    }

    /**
     * Opens an installed app directly. With an activity, that exact component; otherwise the app's
     * TV (leanback) entry point, falling back to its normal launcher entry point.
     */
    private JSONObject launchApp(String pkg, String activityName) throws JSONException {
        if (pkg == null || pkg.isEmpty()) return error("No package configured");
        PackageManager pm = activity.getPackageManager();
        try {
            pm.getPackageInfo(pkg, 0);
        } catch (PackageManager.NameNotFoundException e) {
            return error("not installed");
        }
        Intent intent;
        if (activityName != null && !activityName.isEmpty()) {
            String cls = activityName.startsWith(".") ? pkg + activityName : activityName;
            intent = new Intent(Intent.ACTION_MAIN).setComponent(new ComponentName(pkg, cls));
        } else {
            intent = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (intent == null) intent = pm.getLaunchIntentForPackage(pkg);
            if (intent == null) return error("no launchable activity in " + pkg);
        }
        return start(intent);
    }

    private JSONObject start(Intent intent) throws JSONException {
        try {
            activity.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            return new JSONObject().put("ok", true);
        } catch (ActivityNotFoundException e) {
            return error("activity not found: " + e.getMessage());
        } catch (SecurityException e) {
            return error("not allowed: " + e.getMessage());
        }
    }

    private JSONObject openStockHome() throws JSONException {
        // The guard (if on) needs to know this visit is on purpose; otherwise it would bounce back.
        activity.sendBroadcast(new Intent(HomeGuardService.ACTION_OPEN_STOCK_HOME).setPackage(activity.getPackageName()));
        if (guardEnabled()) return new JSONObject().put("ok", true);
        return start(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).setPackage(HomeGuardService.STOCK_LAUNCHER));
    }

    private boolean guardEnabled() {
        String enabled = Settings.Secure.getString(activity.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabled == null) return false;
        ComponentName guard = new ComponentName(activity, HomeGuardService.class);
        return enabled.contains(guard.flattenToString()) || enabled.contains(guard.flattenToShortString());
    }

    // ---------------------------------------------------------------- network

    /** HTTPS anywhere; plain HTTP only to the home network (Roku ECP, a local LLM). */
    private JSONObject http(JSONObject a) throws Exception {
        URL url = new URL(a.getString("url"));
        boolean https = "https".equals(url.getProtocol());
        if (!https && !("http".equals(url.getProtocol()) && Net.isPrivateHost(url.getHost()))) {
            return error("Only https, or http to the home network, is allowed").put("status", 0);
        }
        int timeout = a.optInt("timeoutMs", 5000);
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        try {
            c.setConnectTimeout(timeout);
            c.setReadTimeout(timeout);
            c.setInstanceFollowRedirects(false);
            c.setRequestMethod(a.optString("method", "GET"));
            JSONObject headers = a.optJSONObject("headers");
            if (headers != null) {
                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    c.setRequestProperty(k, headers.getString(k));
                }
            }
            if ("POST".equals(a.optString("method"))) {
                byte[] body = a.optString("body", "").getBytes("UTF-8");
                c.setDoOutput(true);
                c.setFixedLengthStreamingMode(body.length);
                OutputStream out = c.getOutputStream();
                out.write(body);
                out.close();
            }
            int status = c.getResponseCode();
            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            String body = in == null ? "" : readLimited(in);
            return new JSONObject().put("status", status).put("body", body);
        } catch (SocketTimeoutException e) {
            return new JSONObject().put("status", 0).put("body", "").put("error", "timeout");
        } catch (java.io.IOException e) {
            return new JSONObject().put("status", 0).put("body", "").put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
        } finally {
            c.disconnect();
        }
    }

    private static String readLimited(InputStream in) throws java.io.IOException {
        BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"));
        StringBuilder sb = new StringBuilder();
        char[] buf = new char[8192];
        int n;
        while ((n = r.read(buf)) > 0 && sb.length() < MAX_BODY) sb.append(buf, 0, n);
        r.close();
        return sb.toString();
    }

    /** One UDP datagram to a home-network host, optionally waiting for one reply (PS5 discovery/wake). */
    private JSONObject udp(JSONObject a) throws Exception {
        String host = a.getString("host");
        if (!Net.isPrivateHost(host)) return error("Only home-network addresses are allowed").put("reply", JSONObject.NULL);
        DatagramSocket socket = new DatagramSocket(null);
        try {
            socket.setReuseAddress(true);
            socket.bind(new InetSocketAddress(a.optInt("localPort", 0)));
            byte[] msg = a.getString("message").getBytes("UTF-8");
            socket.send(new DatagramPacket(msg, msg.length, InetAddress.getByName(host), a.getInt("port")));
            if (!a.optBoolean("expectReply")) return new JSONObject().put("reply", JSONObject.NULL);
            socket.setSoTimeout(a.optInt("timeoutMs", 2000));
            byte[] buf = new byte[2048];
            DatagramPacket packet = new DatagramPacket(buf, buf.length);
            try {
                socket.receive(packet);
                return new JSONObject().put("reply", new String(packet.getData(), 0, packet.getLength(), "UTF-8"));
            } catch (SocketTimeoutException e) {
                return new JSONObject().put("reply", JSONObject.NULL);
            }
        } catch (java.net.BindException e) {
            return error("Local UDP port " + a.optInt("localPort") + " is busy: " + e.getMessage()).put("reply", JSONObject.NULL);
        } finally {
            socket.close();
        }
    }

    // ---------------------------------------------------------------- device

    private JSONObject deviceInfo() throws JSONException {
        String fireOs = getprop("ro.build.version.name");
        String fireOsNumber = getprop("ro.build.version.fireos");
        if (!fireOsNumber.isEmpty() && !fireOs.contains(fireOsNumber)) fireOs = (fireOs.isEmpty() ? "Fire OS " : fireOs + " · ") + fireOsNumber;
        String version = "";
        try {
            version = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException ignored) {
        }
        return new JSONObject()
                .put("model", Build.MODEL)
                .put("manufacturer", Build.MANUFACTURER)
                .put("androidVersion", Build.VERSION.RELEASE)
                .put("sdkInt", Build.VERSION.SDK_INT)
                .put("fireOsVersion", fireOs)
                .put("buildId", Build.DISPLAY)
                .put("ipAddress", localIp())
                .put("appVersion", version)
                .put("homeGuardEnabled", guardEnabled())
                .put("speechRecognizer", SpeechRecognizer.isRecognitionAvailable(activity));
    }

    private static String getprop(String key) {
        try {
            Process p = new ProcessBuilder("getprop", key).redirectErrorStream(true).start();
            BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()));
            String line = r.readLine();
            r.close();
            p.waitFor();
            return line == null ? "" : line.trim();
        } catch (Exception e) {
            return "";
        }
    }

    private static String localIp() {
        try {
            ArrayList<NetworkInterface> ifs = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface nif : ifs) {
                if (!nif.isUp() || nif.isLoopback()) continue;
                for (InetAddress addr : Collections.list(nif.getInetAddresses())) {
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) return addr.getHostAddress();
                }
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    // ---------------------------------------------------------------- speech

    private JSONObject speak(final String text) throws JSONException {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (tts == null) {
                    pendingSpeech = text;
                    tts = new TextToSpeech(activity, new TextToSpeech.OnInitListener() {
                        @Override
                        public void onInit(int status) {
                            ttsReady = status == TextToSpeech.SUCCESS;
                            if (ttsReady && pendingSpeech != null) say(pendingSpeech);
                            pendingSpeech = null;
                        }
                    });
                } else if (ttsReady) {
                    say(text);
                } else {
                    pendingSpeech = text;
                }
            }
        });
        return new JSONObject().put("ok", true);
    }

    private void say(String text) {
        tts.setLanguage(Locale.getDefault());
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "grantos");
    }

    private JSONObject stopSpeaking() throws JSONException {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (tts != null) tts.stop();
            }
        });
        return new JSONObject().put("ok", true);
    }

    /** One utterance of speech to text. Answers later through reply(). */
    private JSONObject listen(final String id) throws JSONException {
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            return error("This Fire TV has no speech recognition service for apps. Type your message instead.");
        }
        if (Build.VERSION.SDK_INT >= 23 && activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_REQUEST);
                }
            });
            return error("Allow microphone access on the TV, then press the mic button again.");
        }
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (listenId != null) reply(listenId, error("Cancelled"));
                listenId = id;
                if (recognizer == null) recognizer = SpeechRecognizer.createSpeechRecognizer(activity);
                recognizer.setRecognitionListener(new Listener());
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                        .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                recognizer.startListening(intent);
            }
        });
        return null;
    }

    void onPermissionResult(int requestCode, int[] grantResults) {
        // Nothing to resume: the page asks the user to press the mic button again.
    }

    private void finishListen(JSONObject result) {
        if (listenId == null) return;
        String id = listenId;
        listenId = null;
        reply(id, result);
    }

    private class Listener implements RecognitionListener {
        @Override public void onResults(Bundle results) {
            ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            try {
                finishListen(list != null && !list.isEmpty() ? new JSONObject().put("text", list.get(0)) : error("No speech heard."));
            } catch (JSONException ignored) {
            }
        }
        @Override public void onError(int code) {
            finishListen(error(code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                    ? "No speech heard." : "Voice input failed (code " + code + ")."));
        }
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onPartialResults(Bundle partialResults) {}
        @Override public void onEvent(int eventType, Bundle params) {}
    }

    // ---------------------------------------------------------------- plumbing

    private static JSONObject error(String message) {
        try {
            return new JSONObject().put("ok", false).put("error", message);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private void reply(final String id, JSONObject result) {
        final String js = "window.__grantosNativeResult && window.__grantosNativeResult(" + JSONObject.quote(id) + "," + JSONObject.quote(result.toString()) + ")";
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(js, null);
            }
        });
    }
}
