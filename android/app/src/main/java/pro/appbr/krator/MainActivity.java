package pro.appbr.krator;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Regular browsers refuse to load http:// media from an https:// page
 * ("mixed content") — there is no setting a website can flip to get around
 * it. A native WebView shell CAN, because the decision belongs to the app,
 * not to the page. That's the whole point of this app: IPTV streams are
 * plain http://, and this lets them load straight from the device's own
 * connection instead of needing a server-side proxy for every viewer.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
    }
}
