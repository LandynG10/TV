package com.grantos.tv;

import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Serves https://grantos.local/ to the WebView:
 *   /user/<file>  a file from /sdcard/grantos (e.g. a wallpaper pushed with scripts/push-wallpaper.sh)
 *   /<path>       the built interface from the APK's assets/web folder
 *
 * A custom https origin (instead of file://) keeps ES modules and localStorage working normally.
 */
class WebAssets {
    static final String HOST = "grantos.local";

    private final Context context;
    private final File userDir = new File(Environment.getExternalStorageDirectory(), "grantos");

    WebAssets(Context context) {
        this.context = context;
    }

    /** /sdcard/grantos/dev-url.txt may point at a computer running `npm run dev` (see docs/DEVELOPMENT.md). */
    String startUrl() {
        String dev = readDevUrl();
        return dev != null ? dev : "https://" + HOST + "/index.html";
    }

    boolean isAllowedPage(Uri uri) {
        if (HOST.equals(uri.getHost())) return true;
        String dev = readDevUrl();
        return dev != null && uri.toString().startsWith(Uri.parse(dev).getScheme() + "://" + Uri.parse(dev).getAuthority());
    }

    private String readDevUrl() {
        File f = new File(userDir, "dev-url.txt");
        if (!f.isFile()) return null;
        try {
            byte[] data = readAll(new FileInputStream(f));
            String url = new String(data, "UTF-8").trim();
            Uri u = Uri.parse(url);
            // Only a computer on the home network may serve the page.
            if (("http".equals(u.getScheme()) || "https".equals(u.getScheme())) && Net.isPrivateHost(u.getHost())) return url;
        } catch (IOException ignored) {
        }
        return null;
    }

    WebResourceResponse serve(Uri uri) {
        if (!HOST.equals(uri.getHost())) return null; // Not ours: the WebView fetches it normally.
        String path = uri.getPath() == null ? "" : uri.getPath();
        while (path.startsWith("/")) path = path.substring(1);
        if (path.isEmpty()) path = "index.html";
        if (path.contains("..")) return notFound();
        try {
            if (path.startsWith("user/")) {
                File file = new File(userDir, path.substring(5)).getCanonicalFile();
                if (!file.getPath().startsWith(userDir.getCanonicalPath() + File.separator) || !file.isFile()) return notFound();
                return ok(mimeType(path), new FileInputStream(file));
            }
            return ok(mimeType(path), context.getAssets().open("web/" + path));
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse ok(String mime, InputStream data) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-cache");
        headers.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, data);
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    static String mimeType(String path) {
        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
        switch (ext) {
            case "html": return "text/html";
            case "css": return "text/css";
            case "js": return "application/javascript";
            case "json": return "application/json";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "gif": return "image/gif";
            case "svg": return "image/svg+xml";
            case "woff2": return "font/woff2";
            case "woff": return "font/woff";
            default: return "application/octet-stream";
        }
    }

    static byte[] readAll(InputStream in) throws IOException {
        try {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        } finally {
            in.close();
        }
    }
}
