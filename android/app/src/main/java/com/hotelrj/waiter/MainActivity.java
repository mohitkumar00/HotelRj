package com.hotelrj.waiter;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "HotelRJ_Native";
    private static final int PERMISSION_REQ_CODE = 101;
    // Standard Bluetooth Serial Port Profile (SPP) UUID used by all 58mm/80mm thermal printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private String pendingDeepLinkJson = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Enable Chrome Remote Debugging (open chrome://inspect on PC)
        WebView.setWebContentsDebuggingEnabled(true);

        // 2. Request Camera + Bluetooth permissions
        requestAppPermissions();

        // 3. Configure WebChromeClient to grant Camera/Audio for getUserMedia
        setupWebChromeClient();

        // 4. Attach JavaScript Interface to WebView
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidPrintInterface(this, webView), "AndroidPrinter");
                Log.i(TAG, "AndroidPrinter JavascriptInterface successfully attached to WebView");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to attach AndroidPrinter JavascriptInterface", e);
        }

        // 5. Check if launched via deep link (hotelrj://connect?server=...&token=...)
        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void requestAppPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> needed = new ArrayList<>();
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.CAMERA);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.BLUETOOTH_CONNECT);
                }
                if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.BLUETOOTH_SCAN);
                }
            }
            if (!needed.isEmpty()) {
                requestPermissions(needed.toArray(new String[0]), PERMISSION_REQ_CODE);
            }
        }
    }

    private void setupWebChromeClient() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        runOnUiThread(() -> {
                            try {
                                String[] resources = request.getResources();
                                boolean hasVideo = false;
                                for (String r : resources) {
                                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                                        hasVideo = true;
                                        break;
                                    }
                                }
                                if (hasVideo && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                        requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISSION_REQ_CODE);
                                    }
                                }
                                request.grant(resources);
                                Log.i(TAG, "Granted WebChromeClient permission: " + java.util.Arrays.toString(resources));
                            } catch (Exception ex) {
                                Log.e(TAG, "Error in onPermissionRequest", ex);
                            }
                        });
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to attach custom BridgeWebChromeClient", e);
        }
    }

    private void handleDeepLink(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        if ("hotelrj".equalsIgnoreCase(uri.getScheme())) {
            String server = uri.getQueryParameter("server");
            if (server == null) server = uri.getQueryParameter("host");
            if (server == null) server = uri.getQueryParameter("ip");
            String token = uri.getQueryParameter("token");

            try {
                JSONObject json = new JSONObject();
                json.put("server", server != null ? server : "");
                json.put("token", token != null ? token : "");
                pendingDeepLinkJson = json.toString();

                runOnUiThread(() -> {
                    try {
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            String script = "window.dispatchEvent(new CustomEvent('hotelrj_deeplink_sync', { detail: " + pendingDeepLinkJson + " }));";
                            webView.evaluateJavascript(script, null);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error firing deeplink event to webview", e);
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Error parsing deep link uri", e);
            }
        }
    }

    public class AndroidPrintInterface {
        private final Context context;
        private final WebView mainWebView;

        public AndroidPrintInterface(Context c, WebView wv) {
            this.context = c;
            this.mainWebView = wv;
        }

        /**
         * Checks if native bridge is alive
         */
        @JavascriptInterface
        public boolean isNativeAvailable() {
            return true;
        }

        /**
         * Returns pending deep link URI query parameters if launched via QR code / deep link
         * Returns JSON: {"server": "192.168.0.103:5050", "token": "6AC3CD44"}
         */
        @JavascriptInterface
        public String getPendingDeepLink() {
            String temp = pendingDeepLinkJson;
            pendingDeepLinkJson = null;
            return temp != null ? temp : "";
        }

        /**
         * Checks if camera permission is granted at OS level
         */
        @JavascriptInterface
        public boolean isCameraPermissionGranted() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
            }
            return true;
        }

        /**
         * Triggers native Android OS camera permission prompt
         */
        @JavascriptInterface
        public void requestCameraPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                runOnUiThread(() -> {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISSION_REQ_CODE);
                });
            }
        }

        /**
         * Returns JSON list of paired Bluetooth devices
         * Format: [{"name": "Thermal Printer", "address": "00:11:22:33:44:55"}]
         */
        @JavascriptInterface
        public String getPairedBluetoothPrinters() {
            JSONArray array = new JSONArray();
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    return array.toString();
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                        JSONObject err = new JSONObject();
                        err.put("error", "BLUETOOTH_CONNECT permission not granted");
                        array.put(err);
                        return array.toString();
                    }
                }

                Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
                if (pairedDevices != null) {
                    for (BluetoothDevice device : pairedDevices) {
                        JSONObject obj = new JSONObject();
                        obj.put("name", device.getName() != null ? device.getName() : "Unknown Device");
                        obj.put("address", device.getAddress());
                        array.put(obj);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error fetching paired Bluetooth devices", e);
            }
            return array.toString();
        }

        /**
         * Direct Bluetooth Thermal Printing via RFCOMM SPP socket.
         * Works with all 58mm and 80mm Bluetooth receipt printers.
         */
        @JavascriptInterface
        public String printBluetooth(final String deviceAddress, final String base64Data) {
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) {
                    return "{\"success\": false, \"error\": \"Bluetooth is turned OFF on this phone.\"}";
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                        return "{\"success\": false, \"error\": \"Bluetooth permission not granted.\"}";
                    }
                }

                BluetoothDevice targetDevice = null;
                Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
                if (pairedDevices != null) {
                    for (BluetoothDevice d : pairedDevices) {
                        if (deviceAddress != null && !deviceAddress.isEmpty()) {
                            if (d.getAddress().equalsIgnoreCase(deviceAddress)) {
                                targetDevice = d;
                                break;
                            }
                        } else {
                            // Pick first device with 'print' or 'pos' or 'mtp' or 'rpp' in name
                            String name = (d.getName() != null ? d.getName() : "").toLowerCase();
                            if (name.contains("print") || name.contains("pos") || name.contains("mtp") || name.contains("rpp") || name.contains("innerprinter")) {
                                targetDevice = d;
                                break;
                            }
                        }
                    }
                    // Fallback to first paired device if none matched by keyword
                    if (targetDevice == null && !pairedDevices.isEmpty() && (deviceAddress == null || deviceAddress.isEmpty())) {
                        targetDevice = pairedDevices.iterator().next();
                    }
                }

                if (targetDevice == null) {
                    return "{\"success\": false, \"error\": \"No paired thermal printer found. Pair your printer in Android Bluetooth Settings first.\"}";
                }

                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

                // Connect and write in background thread
                BluetoothDevice finalDevice = targetDevice;
                executor.execute(() -> {
                    BluetoothSocket socket = null;
                    try {
                        socket = finalDevice.createRfcommSocketToServiceRecord(SPP_UUID);
                        adapter.cancelDiscovery();
                        socket.connect();
                        OutputStream os = socket.getOutputStream();
                        os.write(bytes);
                        os.flush();
                        Thread.sleep(150);
                        socket.close();
                        Log.i(TAG, "Printed successfully to Bluetooth device: " + finalDevice.getName());
                    } catch (Exception ex) {
                        Log.e(TAG, "Failed to write to Bluetooth printer", ex);
                        if (socket != null) {
                            try { socket.close(); } catch (Exception ignored) {}
                        }
                    }
                });

                return "{\"success\": true, \"deviceName\": \"" + targetDevice.getName() + "\"}";
            } catch (Exception e) {
                Log.e(TAG, "Bluetooth print error", e);
                return "{\"success\": false, \"error\": \"" + e.getMessage() + "\"}";
            }
        }

        /**
         * Universal Android Print Spooler (PrintManager).
         * Opens the Android system printer preview dialog for 58mm / 80mm thermal receipts.
         */
        @JavascriptInterface
        public void printHtml(final String html, final String jobName) {
            runOnUiThread(() -> {
                try {
                    WebView printWebView = new WebView(context);
                    printWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                            if (printManager != null) {
                                String name = (jobName != null && !jobName.isEmpty()) ? jobName : "HotelRJ_Order";
                                PrintDocumentAdapter printAdapter = printWebView.createPrintDocumentAdapter(name);
                                PrintAttributes.Builder builder = new PrintAttributes.Builder();
                                builder.setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME);
                                builder.setMediaSize(PrintAttributes.MediaSize.UNKNOWN_PORTRAIT);
                                builder.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                                printManager.print(name, printAdapter, builder.build());
                            }
                        }
                    });
                    printWebView.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Log.e(TAG, "Error invoking Android PrintManager", e);
                }
            });
        }
    }
}
