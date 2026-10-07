package sk.bucala.filmy;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.JavaScriptReplyProxy;

import org.json.JSONObject;

import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String TAG = "Filmy";
    private static final String APP_URL =
            "https://appassets.androidplatform.net/assets/web/index.html";
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private MovieCopier movieCopier;
    private final ExecutorService copyWorker = Executors.newSingleThreadExecutor();
    private volatile boolean copyStopped, copyDestroyed;
    private JavaScriptReplyProxy copyReply, pickerReply;
    private String pickerId, pickerRole;
    private static final int COPY_PICKER = 7301;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableFullscreenSafely();

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        // D-pad navigation: the WebView must be focusable so TV remotes can
        // move focus into the web content.
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        setContentView(webView);
        webView.requestFocus();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        // Bundled assets use WebViewAssetLoader over HTTPS, not file://.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowFileAccessFromFileURLs(false);
            settings.setAllowUniversalAccessFromFileURLs(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        WebView.setWebContentsDebuggingEnabled(
                (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Tell the web layer to switch on D-pad/focus mode when on a TV.
                if (isTvDevice()) {
                    view.evaluateJavascript(
                        "window.__ANDROID_TV__=true;if(window.__enableTvMode)window.__enableTvMode();",
                        null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (scheme == null) return false;

                // Let WebView handle standard web URLs (incl. the appassets host)
                if (scheme.equals("http") || scheme.equals("https") || scheme.equals("file")) {
                    return false;
                }

                // Custom schemes (vlc://, smb://, intent://, portable://) → launch via Intent
                try {
                    Intent intent;
                    if (scheme.equals("intent")) {
                        intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                    } else {
                        intent = new Intent(Intent.ACTION_VIEW);
                        Uri dataUri = uri;
                        if (scheme.equals("smb") || scheme.equals("vlc")) {
                            String decoded = Uri.decode(uri.toString());
                            dataUri = Uri.parse(decoded);
                        }
                        String path = dataUri.getPath();
                        boolean isVideo = path != null && (
                            path.endsWith(".mkv") || path.endsWith(".mp4") ||
                            path.endsWith(".avi") || path.endsWith(".m4v") ||
                            path.endsWith(".mov") || path.endsWith(".wmv") ||
                            path.endsWith(".ts")  || path.endsWith(".webm"));
                        if (isVideo) {
                            intent.setDataAndType(dataUri, "video/*");
                        } else {
                            intent.setData(dataUri);
                        }
                    }
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (ActivityNotFoundException e) {
                    // scheme is "intent" for explicit-package launches (e.g. MX Player) —
                    // in that case the target package itself isn't installed, not "no
                    // app for this scheme", so the message shouldn't assume VLC.
                    String msg = scheme.equals("intent")
                        ? "Vybraná appka nie je nainštalovaná."
                        : "Žiadna appka pre " + scheme + ":// nie je nainštalovaná.";
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Log.w(TAG, "Failed to handle URL: " + uri, e);
                    Toast.makeText(MainActivity.this,
                        "Prehrávač sa nepodarilo spustiť.", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        installCopyBridge();
        webView.loadUrl(APP_URL);
    }

    private void installCopyBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        movieCopier = new MovieCopier(getContentResolver(), snapshot -> {
            final String message;
            try {
                message = new JSONObject().put("type", "progress").put("snapshot", snapshot).toString();
            } catch (Exception ignored) { return; }
            runOnUiThread(() -> {
                if (webView == null || copyDestroyed) return;
                boolean busy = movieCopier.busy();
                if (busy) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                try {
                    if (copyReply != null && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                        copyReply.postMessage(message);
                    }
                } catch (Exception ignored) { /* A reloaded page obtains the current snapshot with status. */ }
            });
        });
        WebViewCompat.addWebMessageListener(webView, "FilmyCopy",
                Collections.singleton("https://appassets.androidplatform.net"),
                (view, message, origin, mainFrame, reply) -> {
                    if (!mainFrame || !"https".equals(origin.getScheme()) ||
                            !"appassets.androidplatform.net".equals(origin.getHost()) ||
                            view.getUrl() == null || !view.getUrl().startsWith(
                                    "https://appassets.androidplatform.net/assets/web/")) return;
                    String data = message.getData();
                    if (data == null || data.length() > 1024 * 1024 || copyDestroyed) return;
                    copyReply = reply;
                    copyWorker.execute(() -> {
                        String id = "";
                        try {
                            JSONObject request = new JSONObject(data);
                            id = request.getString("id");
                            if (id.length() > 100 || copyDestroyed) return;
                            switch (request.getString("action")) {
                                case "pick":
                                    String role = request.getString("role"), pickerRequestId = id;
                                    runOnUiThread(() -> {
                                        if (!copyDestroyed) pickCopyFolder(role, pickerRequestId, reply);
                                    });
                                    return;
                                case "start":
                                    if (copyStopped) throw new IllegalStateException("Appka musí zostať otvorená.");
                                    copyResponse(reply, id, movieCopier.start(request.getJSONArray("items")));
                                    // onStop may race the queued request. Never leave a new job running in the background.
                                    if (copyStopped) movieCopier.cancel();
                                    return;
                                case "status":
                                    copyResponse(reply, id, movieCopier.status());
                                    return;
                                case "cancel":
                                    movieCopier.cancel();
                                    copyResponse(reply, id, movieCopier.status());
                                    return;
                                default:
                                    throw new IllegalArgumentException("Neplatná požiadavka.");
                            }
                        } catch (Exception error) { copyFailure(reply, id, error.getMessage()); }
                    });
                });
    }

    @SuppressWarnings("deprecation")
    private void pickCopyFolder(String role, String id, JavaScriptReplyProxy reply) {
        if (copyStopped) { copyFailure(reply, id, "Appka musí zostať otvorená."); return; }
        if (movieCopier.busy() || pickerReply != null) {
            copyFailure(reply, id, "Kopírovanie alebo výber priečinka už prebieha."); return;
        }
        if (!role.equals("source") && !role.equals("destination")) {
            copyFailure(reply, id, "Neplatný priečinok."); return;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (role.equals("destination")) intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
        pickerId = id; pickerRole = role; pickerReply = reply;
        try { startActivityForResult(intent, COPY_PICKER); }
        catch (ActivityNotFoundException error) {
            pickerReply = null;
            copyFailure(reply, id, "Na tomto zariadení nie je systémový výber priečinkov. Niektoré TV ho nemajú.");
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != COPY_PICKER || pickerReply == null || copyDestroyed) return;
        JavaScriptReplyProxy reply = pickerReply;
        String id = pickerId, role = pickerRole;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            pickerReply = null;
            try {
                copyResponse(reply, id, new JSONObject().put("ok", false).put("cancelled", true));
            } catch (Exception error) { copyFailure(reply, id, error.getMessage()); }
            return;
        }
        Uri tree = data.getData();
        copyWorker.execute(() -> {
            try {
                String name = movieCopier.setRoot(role, tree);
                copyResponse(reply, id, new JSONObject().put("ok", true).put("name", name));
            } catch (Exception error) { copyFailure(reply, id, "Priečinok sa nepodarilo sprístupniť. " + error.getMessage()); }
            finally { runOnUiThread(() -> { if (pickerReply == reply) pickerReply = null; }); }
        });
    }

    private void copyResponse(JavaScriptReplyProxy reply, String id, JSONObject result) {
        final String message;
        try { message = new JSONObject().put("id", id).put("result", result).toString(); }
        catch (Exception ignored) { return; }
        runOnUiThread(() -> {
            if (copyDestroyed || webView == null) return;
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
            try { reply.postMessage(message); }
            catch (Exception ignored) { /* The requester may have navigated away. */ }
        });
    }

    private void copyFailure(JavaScriptReplyProxy reply, String id, String error) {
        try { copyResponse(reply, id, new JSONObject().put("ok", false).put("error",
                error == null ? "Kopírovanie sa nepodarilo." : error)); }
        catch (Exception ignored) { /* JSONObject contains only strings and booleans. */ }
    }

    @Override
    protected void onStart() {
        super.onStart();
        copyStopped = false;
    }

    @Override
    protected void onStop() {
        copyStopped = true;
        if (movieCopier != null) movieCopier.cancel();
        super.onStop();
    }
    private void enableFullscreen() {
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = window.getAttributes();
            attrs.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attrs);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
            return;
        }

        window.setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void enableFullscreenSafely() {
        try {
            enableFullscreen();
        } catch (RuntimeException e) {
            Log.w(TAG, "Fullscreen mode could not be applied", e);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableFullscreenSafely();
        }
    }

    private boolean isTvDevice() {
        UiModeManager ui = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        if (ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) {
            return true;
        }
        PackageManager pm = getPackageManager();
        return pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
                || pm.hasSystemFeature(PackageManager.FEATURE_TELEVISION);
    }

    // Forward TV remote keys the WebView doesn't surface as JS key events.
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // On TV, Back should close the topmost open overlay first (an SPA has no
        // browser history), and only exit the app when nothing is open.
        if (keyCode == KeyEvent.KEYCODE_BACK && isTvDevice() && webView != null) {
            webView.evaluateJavascript("(window.__tvBack&&window.__tvBack())||false",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String consumed) {
                        if (!"true".equals(consumed)) {
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    if (webView != null && webView.canGoBack()) webView.goBack();
                                    else finish();
                                }
                            });
                        }
                    }
                });
            return true;
        }

        String action = null;
        switch (keyCode) {
            case KeyEvent.KEYCODE_GUIDE:   action = "guide"; break;
            case KeyEvent.KEYCODE_INFO:    action = "info";  break;
            case KeyEvent.KEYCODE_MENU:    action = "menu";  break;
        }
        if (action != null && webView != null) {
            webView.evaluateJavascript("window.__tvKey&&window.__tvKey('" + action + "')", null);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        copyDestroyed = true;
        copyWorker.shutdownNow();
        if (movieCopier != null) movieCopier.close();
        pickerReply = null; copyReply = null;
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
