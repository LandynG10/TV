package com.grantos.tv;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

/**
 * Keeps GrantOS in front of the Amazon home screen (at start-up and when Home is pressed).
 *
 * Fire OS doesn't let apps replace its launcher, and handles the Home key before apps see it.
 * This service watches for Amazon's home screen to come to the front and opens GrantOS on top.
 * It only receives window-change events (package names) and key events; it cannot read the screen.
 *
 * Ported from Fire TV Web Launcher's HomeGuardService.kt (MIT),
 * https://github.com/pickdani/fire-tv-web-launcher
 */
public class HomeGuardService extends AccessibilityService {

    static final String ACTION_OPEN_STOCK_HOME = "com.grantos.tv.OPEN_STOCK_HOME";
    static final String STOCK_LAUNCHER = "com.amazon.tv.launcher";
    private static final String SYSTEM_UI = "com.android.systemui";

    /** True while the user chose to visit the Amazon home screen. */
    private boolean stockAllowed = false;

    private final BroadcastReceiver openStockHome = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            stockAllowed = true; // Set before Amazon's window opens, so there is no race.
            startActivity(new Intent(Intent.ACTION_MAIN)
                    .addCategory(Intent.CATEGORY_HOME)
                    .setPackage(STOCK_LAUNCHER)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
    };

    @Override
    protected void onServiceConnected() {
        registerReceiver(openStockHome, new IntentFilter(ACTION_OPEN_STOCK_HOME));
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(openStockHome);
        } catch (IllegalArgumentException ignored) {
        }
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || event.getPackageName() == null) return;
        String pkg = event.getPackageName().toString();
        if (STOCK_LAUNCHER.equals(pkg)) {
            if (!stockAllowed) openGrantOs();
        } else if (!SYSTEM_UI.equals(pkg)) {
            stockAllowed = false; // Overlays like the volume bar don't end a visit to Amazon home.
        }
    }

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        // Where the system does pass Home to accessibility services, handle it directly.
        if (event.getKeyCode() != KeyEvent.KEYCODE_HOME) return false;
        if (event.getAction() == KeyEvent.ACTION_UP) openGrantOs();
        return true;
    }

    @Override
    public void onInterrupt() {
    }

    private void openGrantOs() {
        startActivity(new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
    }
}
