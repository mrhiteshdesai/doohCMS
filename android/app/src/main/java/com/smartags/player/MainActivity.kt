package com.smartags.player

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.ComponentName
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.net.Uri
import android.graphics.Color
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceResponse
import android.net.http.SslError
import android.webkit.SslErrorHandler
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.core.view.GravityCompat
import androidx.drawerlayout.widget.DrawerLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var sharedPreferences: SharedPreferences

    private lateinit var drawerLayout: DrawerLayout
    private lateinit var drawerCurrentUrl: TextView
    private lateinit var drawerStartOnBoot: SwitchCompat
    private lateinit var drawerKioskMode: SwitchCompat
    private lateinit var drawerChangeUrl: Button
    private lateinit var drawerReload: Button
    private lateinit var drawerClearCache: Button
    private lateinit var drawerExitApp: Button

    private lateinit var configContainer: LinearLayout
    private lateinit var urlInput: EditText
    private lateinit var saveButton: Button
    private lateinit var testButton: Button

    private lateinit var statusContainer: LinearLayout
    private lateinit var statusText: TextView

    private lateinit var errorContainer: LinearLayout
    private lateinit var errorText: TextView
    private lateinit var errorRetryButton: Button
    private lateinit var errorSetupButton: Button

    private var lastUrl: String? = null
    private var lastBackPressedAt: Long = 0

    private val prefsName = "SmartagsPlayer"
    private val prefsServerUrlKey = "server_url"
    private val prefsStartOnBootKey = "start_on_boot"
    private val prefsKioskModeKey = "kiosk_mode"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        drawerLayout = findViewById(R.id.drawer_layout)
        drawerCurrentUrl = findViewById(R.id.drawer_current_url)
        drawerStartOnBoot = findViewById(R.id.drawer_start_on_boot)
        drawerKioskMode = findViewById(R.id.drawer_kiosk_mode)
        drawerChangeUrl = findViewById(R.id.drawer_change_url)
        drawerReload = findViewById(R.id.drawer_reload)
        drawerClearCache = findViewById(R.id.drawer_clear_cache)
        drawerExitApp = findViewById(R.id.drawer_exit_app)

        webView = findViewById(R.id.webview)
        configContainer = findViewById(R.id.config_container)
        urlInput = findViewById(R.id.config_url_input)
        saveButton = findViewById(R.id.config_save_button)
        testButton = findViewById(R.id.config_test_button)
        statusContainer = findViewById(R.id.status_container)
        statusText = findViewById(R.id.status_text)
        errorContainer = findViewById(R.id.error_container)
        errorText = findViewById(R.id.error_text)
        errorRetryButton = findViewById(R.id.error_retry_button)
        errorSetupButton = findViewById(R.id.error_setup_button)
        sharedPreferences = getSharedPreferences(prefsName, Context.MODE_PRIVATE)

        val startOnBootEnabled = sharedPreferences.getBoolean(prefsStartOnBootKey, true)
        drawerStartOnBoot.isChecked = startOnBootEnabled
        setBootReceiverEnabled(startOnBootEnabled)

        val kioskModeEnabled = sharedPreferences.getBoolean(prefsKioskModeKey, false)
        drawerKioskMode.isChecked = kioskModeEnabled
        applyKioskMode(kioskModeEnabled)

        drawerStartOnBoot.setOnCheckedChangeListener { _, isChecked ->
            sharedPreferences.edit().putBoolean(prefsStartOnBootKey, isChecked).apply()
            setBootReceiverEnabled(isChecked)
            Toast.makeText(this, if (isChecked) "Start on boot enabled" else "Start on boot disabled", Toast.LENGTH_SHORT).show()
        }

        drawerKioskMode.setOnCheckedChangeListener { _, isChecked ->
            sharedPreferences.edit().putBoolean(prefsKioskModeKey, isChecked).apply()
            applyKioskMode(isChecked)
        }

        drawerChangeUrl.setOnClickListener {
            closeDrawer()
            showConfig(lastUrl)
        }

        drawerReload.setOnClickListener {
            closeDrawer()
            webView.reload()
        }

        drawerClearCache.setOnClickListener {
            closeDrawer()
            clearWebData()
            webView.reload()
        }

        drawerExitApp.setOnClickListener {
            closeDrawer()
            sharedPreferences.edit().putBoolean(prefsKioskModeKey, false).apply()
            drawerKioskMode.isChecked = false
            applyKioskMode(false)
            finish()
        }

        setupWebView()
        hideSystemUI()

        val savedUrl = sharedPreferences.getString(prefsServerUrlKey, null)
        if (savedUrl.isNullOrBlank()) {
            showConfig(null)
        } else {
            showPlayer(savedUrl)
        }

        saveButton.setOnClickListener {
            val url = sanitizeUrl(urlInput.text?.toString())
            if (url == null) {
                Toast.makeText(this, "Invalid URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            sharedPreferences.edit().putString(prefsServerUrlKey, url).apply()
            showPlayer(url)
        }

        testButton.setOnClickListener {
            val url = sanitizeUrl(urlInput.text?.toString())
            if (url == null) {
                Toast.makeText(this, "Invalid URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            showPlayer(url)
        }

        errorRetryButton.setOnClickListener {
            val url = lastUrl ?: sharedPreferences.getString(prefsServerUrlKey, null)
            if (url.isNullOrBlank()) {
                showConfig(null)
            } else {
                showPlayer(url)
            }
        }

        errorSetupButton.setOnClickListener {
            showConfig(lastUrl)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        WebView.setWebContentsDebuggingEnabled(true)

        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true
        webSettings.allowFileAccess = true
        webSettings.mediaPlaybackRequiresUserGesture = false
        webSettings.useWideViewPort = true
        webSettings.loadWithOverviewMode = true
        webSettings.cacheMode = WebSettings.LOAD_DEFAULT
        
        // Enable mixed content (HTTP content on HTTPS page) if necessary
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        webView.addJavascriptInterface(WebAppInterface(this), "Android")
        webView.setBackgroundColor(Color.BLACK)

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                showLoading("Loading...")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                hideLoading()
                hideError()
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    val msg = error?.description?.toString() ?: "Unknown error"
                    showError("Load error: $msg")
                }
            }

            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request?.isForMainFrame == true) {
                    val code = errorResponse?.statusCode ?: 0
                    showError("HTTP error: $code")
                }
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                handler?.cancel()
                val msg = error?.toString() ?: "SSL error"
                showError("SSL error. Check device Date/Time. ($msg)")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                request.grant(request.resources)
            }
        }

        webView.setOnLongClickListener {
            showConfig(webView.url)
            true
        }
    }

    private fun showConfig(currentUrl: String?) {
        hideLoading()
        hideError()
        configContainer.visibility = View.VISIBLE
        webView.visibility = View.GONE
        val prefill = currentUrl ?: sharedPreferences.getString(prefsServerUrlKey, null) ?: "https://cms.brandeagles.com/player"
        urlInput.setText(prefill)
        urlInput.setSelection(urlInput.text?.length ?: 0)
        drawerCurrentUrl.text = "URL: $prefill"
        hideSystemUI()
    }

    private fun showPlayer(url: String) {
        lastUrl = url
        configContainer.visibility = View.GONE
        hideError()
        webView.visibility = View.VISIBLE
        showLoading("Connecting...")
        drawerCurrentUrl.text = "URL: $url"
        webView.loadUrl(url)
        hideSystemUI()
    }

    private fun showLoading(message: String) {
        statusText.text = message
        statusContainer.visibility = View.VISIBLE
    }

    private fun hideLoading() {
        statusContainer.visibility = View.GONE
    }

    private fun showError(message: String) {
        hideLoading()
        errorText.text = message
        errorContainer.visibility = View.VISIBLE
        webView.visibility = View.GONE
        configContainer.visibility = View.GONE
        hideSystemUI()
    }

    private fun hideError() {
        errorContainer.visibility = View.GONE
    }

    private fun sanitizeUrl(raw: String?): String? {
        val input = raw?.trim().orEmpty()
        if (input.isBlank()) return null

        val withScheme = if (input.startsWith("http://", true) || input.startsWith("https://", true)) {
            input
        } else {
            "https://$input"
        }

        val uri = try { Uri.parse(withScheme) } catch (_: Exception) { return null }
        val host = uri.host
        if (host.isNullOrBlank()) return null

        val normalized = if (uri.path.isNullOrBlank() || uri.path == "/") {
            uri.buildUpon().path("/player").build().toString()
        } else {
            uri.toString()
        }

        return normalized.replace(Regex("\\s+"), "")
    }
    
    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN)
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        applyKioskMode(sharedPreferences.getBoolean(prefsKioskModeKey, false))
    }

    override fun onBackPressed() {
        if (drawerLayout.isDrawerOpen(GravityCompat.START)) {
            drawerLayout.closeDrawer(GravityCompat.START)
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastBackPressedAt <= 450) {
            drawerLayout.openDrawer(GravityCompat.START)
            lastBackPressedAt = 0
            return
        }

        lastBackPressedAt = now
        Toast.makeText(this, "Press back again for menu", Toast.LENGTH_SHORT).show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_F1) {
            toggleDrawer()
            return true
        }
        if (event != null && event.isCtrlPressed && keyCode == KeyEvent.KEYCODE_M) {
            toggleDrawer()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun toggleDrawer() {
        if (drawerLayout.isDrawerOpen(GravityCompat.START)) {
            closeDrawer()
        } else {
            drawerLayout.openDrawer(GravityCompat.START)
        }
    }

    private fun closeDrawer() {
        drawerLayout.closeDrawer(GravityCompat.START)
    }

    private fun setBootReceiverEnabled(enabled: Boolean) {
        val component = ComponentName(this, BootReceiver::class.java)
        val state = if (enabled) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        packageManager.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP)
    }

    private fun applyKioskMode(enabled: Boolean) {
        if (enabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            try {
                startLockTask()
                Toast.makeText(this, "Kiosk mode enabled", Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                Toast.makeText(this, "Kiosk mode requires screen pinning/device owner", Toast.LENGTH_LONG).show()
            }
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            try {
                stopLockTask()
            } catch (_: Exception) {
            }
        }
        hideSystemUI()
    }

    private fun clearWebData() {
        try {
            webView.clearCache(true)
            webView.clearHistory()
            webView.clearFormData()
            WebStorage.getInstance().deleteAllData()

            val cookies = CookieManager.getInstance()
            cookies.removeAllCookies(null)
            cookies.flush()
        } catch (_: Exception) {
        }
        Toast.makeText(this, "Cache cleared", Toast.LENGTH_SHORT).show()
    }
    
    // Interface for Web App to call Android functions
    inner class WebAppInterface(private val mContext: Context) {
        @JavascriptInterface
        fun getDeviceId(): String {
            return Settings.Secure.getString(mContext.contentResolver, Settings.Secure.ANDROID_ID)
        }
        
        @JavascriptInterface
        fun showToast(toast: String) {
            Toast.makeText(mContext, toast, Toast.LENGTH_SHORT).show()
        }
        
        @JavascriptInterface
        fun getAppVersion(): String {
            return try {
                val pInfo = mContext.packageManager.getPackageInfo(mContext.packageName, 0)
                pInfo.versionName
            } catch (e: Exception) {
                "Unknown"
            }
        }
    }
}
