package com.grantos.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * The GrantOS screen: a full-screen WebView showing the React interface.
 * {@link WebAssets} serves it from https://grantos.local/ and the page calls Android
 * through {@link NativeBridge} (window.GrantOSNative).
 *
 * Structure adapted from Fire TV Web Launcher (MIT), https://github.com/pickdani/fire-tv-web-launcher
 */
public class MainActivity extends Activity {

    static final String EXTRA_RELOAD = "reload";

    private WebView webView;
    private WebAssets assets;
    private NativeBridge bridge;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        assets = new WebAssets(this);

        // Lets `chrome://inspect` on a computer connected over ADB debug the page.
        WebView.setWebContentsDebuggingEnabled(true);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#07090f"));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true); // Settings are saved in localStorage.
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setUseWideViewPort(false);
        bridge = new NativeBridge(this, webView);
        webView.addJavascriptInterface(bridge, "GrantOSNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.serve(request.getUrl());
            }

            // The String overload: API 24+ WebViews still call it by default, and it compiles against API 23.
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Stay on GrantOS: links to other sites do nothing.
                return !assets.isAllowedPage(android.net.Uri.parse(url));
            }
        });
        setContentView(webView);
        webView.loadUrl(assets.startUrl());
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        callPage("onShow");
    }

    @Override
    protected void onPause() {
        callPage("onHide");
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        bridge.shutdown();
        webView.destroy();
        super.onDestroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // scripts/ ask for a reload this way. They never force-stop the app, because Android turns
        // off an app's accessibility service when it is force-stopped.
        if (intent.getBooleanExtra(EXTRA_RELOAD, false)) {
            webView.loadUrl(assets.startUrl());
        } else {
            callPage("onHome"); // Home pressed while GrantOS is already in front.
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // A home screen must not close on Back. The page gets onBack() instead.
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) callPage("onBack");
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        bridge.onPermissionResult(requestCode, grantResults);
    }

    /** Calls window.grantos.<name>() on the page, if defined. */
    private void callPage(final String name) {
        if (webView == null) return;
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript("window.grantos && window.grantos." + name + " && window.grantos." + name + "()", null);
            }
        });
    }
}
