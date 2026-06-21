package com.smartags.tvplayer

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.util.Xml
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.StringReader
import kotlin.coroutines.resume
import kotlin.math.min
import kotlin.math.roundToInt
import org.xmlpull.v1.XmlPullParser

class ZonePlaybackSession(
    private val context: Context,
    private val scope: CoroutineScope,
    private val httpClient: OkHttpClient,
    private val playlist: PlaylistModel,
    private val zone: ZoneModel,
    private val widgetEnv: WidgetRuntimeEnv,
    private val screenLocation: ScreenLocationModel?,
    private val ensureDownloaded: suspend (MediaFileModel) -> Boolean,
    private val localFileFor: (MediaFileModel) -> File,
    private val isMediaQuarantined: (MediaFileModel) -> String?,
    private val onPlaybackStateChanged: (zoneId: String, state: String, mediaId: String?) -> Unit,
    private val onPlaybackProgress: (zoneId: String, mediaId: String?) -> Unit,
    private val onActiveMedia: (zoneId: String, mediaId: String?) -> Unit,
    private val onPlaybackIssue: (zoneId: String, itemId: String, media: MediaFileModel?, message: String, decoderError: String?) -> Unit,
    private val onPlaybackSuccess: (zoneId: String, mediaId: String?, playlistId: String?) -> Unit,
    private val onProofOfPlay: (mediaId: String, playlistId: String?, startedAtMs: Long, durationSeconds: Int) -> Unit
) {
    val container: FrameLayout = FrameLayout(context).apply {
        setBackgroundColor(Color.BLACK)
        clipToPadding = true
        clipChildren = true
        clipToOutline = true
    }

    private var playbackJob: Job? = null
    private var currentView: View? = null
    private var currentPlayer: ExoPlayer? = null
    private var currentPlaylistSignature: String = playlistSignature(playlist, zone)
    private val weatherCache = mutableMapOf<String, CachedWidgetData<WeatherRenderModel?>>()
    private val newsCache = mutableMapOf<String, CachedWidgetData<NewsRenderModel?>>()

    fun bindToStage(stage: FrameLayout) {
        stage.addView(container, buildLayoutParams(stage))
    }

    fun updateLayout(stage: FrameLayout) {
        container.layoutParams = buildLayoutParams(stage)
    }

    fun play() {
        val items = zone.items.sortedBy { it.order }
        if (items.isEmpty()) {
            onPlaybackStateChanged(zone.id, "WAITING_FOR_CONTENT", null)
            showFallbackCard("No items in zone")
            return
        }

        playbackJob?.cancel()
        playbackJob = scope.launch {
            var index = 0
            var consecutiveFailures = 0

            while (isActive) {
                val item = items[index % items.size]
                val ok = try {
                    when {
                        item.media != null -> playMediaItem(item)
                        item.widget != null -> playWidgetItem(item)
                        else -> playFallbackItem(item)
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (e: Exception) {
                    onPlaybackIssue(zone.id, item.id, item.media, e.message ?: "Playback failed", null)
                    false
                }

                if (ok) {
                    consecutiveFailures = 0
                } else {
                    consecutiveFailures++
                }

                if (consecutiveFailures >= items.size) {
                    onPlaybackStateChanged(zone.id, "WAITING_FOR_CONTENT", null)
                    showFallbackCard("Zone waiting for valid content")
                    delay(5000)
                    consecutiveFailures = 0
                }

                index++
            }
        }
    }

    fun stop() {
        playbackJob?.cancel()
        releasePlayer()
        onPlaybackStateChanged(zone.id, "IDLE", null)
        onActiveMedia(zone.id, null)
        currentView?.let { container.removeView(it) }
        currentView = null
    }

    fun dispose(stage: FrameLayout) {
        stop()
        stage.removeView(container)
    }

    fun replacePlaylist(newPlaylist: PlaylistModel, stage: FrameLayout) {
        currentPlaylistSignature = playlistSignature(newPlaylist, zone)
        updateLayout(stage)
        play()
    }

    private fun buildLayoutParams(stage: FrameLayout): FrameLayout.LayoutParams {
        val stageWidth = stage.width.takeIf { it > 0 } ?: stage.resources.displayMetrics.widthPixels
        val stageHeight = stage.height.takeIf { it > 0 } ?: stage.resources.displayMetrics.heightPixels

        val left = (zone.x.toFloat() / playlist.canvasWidth * stageWidth).toInt()
        val top = (zone.y.toFloat() / playlist.canvasHeight * stageHeight).toInt()
        val width = (zone.width.toFloat() / playlist.canvasWidth * stageWidth).toInt().coerceAtLeast(1)
        val height = (zone.height.toFloat() / playlist.canvasHeight * stageHeight).toInt().coerceAtLeast(1)

        return FrameLayout.LayoutParams(width, height).apply {
            marginStart = left
            topMargin = top
        }
    }

    private suspend fun playMediaItem(item: PlaylistEntryModel): Boolean {
        val media = item.media ?: return false
        isMediaQuarantined(media)?.let { reason ->
            onPlaybackIssue(zone.id, item.id, media, "Quarantined media skipped: $reason", "QUARANTINED_MEDIA")
            showTemporaryFallback("Skipping unstable media")
            onPlaybackStateChanged(zone.id, "ERROR", null)
            onActiveMedia(zone.id, null)
            return false
        }
        onPlaybackStateChanged(zone.id, "BUFFERING", media.id)
        onActiveMedia(zone.id, media.id)
        onPlaybackProgress(zone.id, media.id)

        val primaryOk = ensureDownloaded(media)
        var file = localFileFor(media)
        if (!primaryOk || !file.exists() || file.length() == 0L) {
            onPlaybackIssue(zone.id, item.id, media, "Missing media: ${media.filename}", null)
            showTemporaryFallback("Missing asset: ${media.filename}")
            onPlaybackStateChanged(zone.id, "ERROR", null)
            onActiveMedia(zone.id, null)
            return false
        }

        return if (media.mimeType.startsWith("image/")) {
            var bitmap = decodeBitmap(file)
            if (bitmap == null) {
                file.delete()
                val retryOk = ensureDownloaded(media)
                file = localFileFor(media)
                bitmap = if (retryOk) decodeBitmap(file) else null
            }

            if (bitmap == null) {
                onPlaybackIssue(zone.id, item.id, media, "Corrupt image: ${media.filename}", null)
                showTemporaryFallback("Corrupt image skipped")
                onPlaybackStateChanged(zone.id, "ERROR", null)
                onActiveMedia(zone.id, null)
                false
            } else {
                val startedAtMs = System.currentTimeMillis()
                onPlaybackStateChanged(zone.id, "PLAYING", media.id)
                showBitmap(bitmap)
                waitWithProgress(item.duration.coerceAtLeast(1) * 1000L, media.id)
                onPlaybackSuccess(zone.id, media.id, playlist.id)
                onProofOfPlay(media.id, playlist.id, startedAtMs, item.duration.coerceAtLeast(1))
                onActiveMedia(zone.id, null)
                true
            }
        } else {
            playVideo(item, media, file)
        }
    }

    private suspend fun playVideo(item: PlaylistEntryModel, media: MediaFileModel, file: File): Boolean {
        if (!file.exists() || file.length() == 0L) {
            onPlaybackIssue(zone.id, item.id, media, "Playable file missing: ${media.filename}", null)
            showTemporaryFallback("Missing playable file")
            onPlaybackStateChanged(zone.id, "ERROR", null)
            return false
        }
        val sourceUri = Uri.fromFile(file)
        val playerView = PlayerView(context).apply {
            useController = false
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL
            setBackgroundColor(Color.BLACK)
        }

        val exoPlayer = ExoPlayer.Builder(context).build()
        currentPlayer = exoPlayer
        playerView.player = exoPlayer
        exoPlayer.repeatMode = Player.REPEAT_MODE_ONE

        val factory = DefaultDataSource.Factory(context, OkHttpDataSource.Factory(httpClient))
        val mediaItem = MediaItem.fromUri(sourceUri)
        exoPlayer.setMediaSource(ProgressiveMediaSource.Factory(factory).createMediaSource(mediaItem))
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true

        onPlaybackStateChanged(zone.id, "PLAYING", media.id)
        transitionTo(playerView)

        val targetMs = item.duration.coerceAtLeast(1) * 1000L
        val startedAtMs = System.currentTimeMillis()
        val ok = suspendCancellableCoroutine<Boolean> { cont ->
            val timerJob = scope.launch {
                var remaining = targetMs
                while (remaining > 0 && cont.isActive) {
                    val chunk = min(remaining, 10_000L)
                    delay(chunk)
                    onPlaybackProgress(zone.id, media.id)
                    remaining -= chunk
                }
                if (cont.isActive) cont.resume(true)
            }
            val listener = object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    onPlaybackIssue(zone.id, item.id, media, "Video error: ${error.errorCodeName}", error.errorCodeName)
                    onPlaybackStateChanged(zone.id, "ERROR", null)
                    if (cont.isActive) {
                        cont.resume(false)
                    }
                }
            }
            exoPlayer.addListener(listener)
            cont.invokeOnCancellation {
                timerJob.cancel()
                exoPlayer.removeListener(listener)
            }
        }

        releasePlayer()
        onActiveMedia(zone.id, null)

        if (!ok) {
            if (file.exists()) file.delete()
            showTemporaryFallback("Video skipped due to playback error")
            return false
        }

        val elapsedSeconds = ((System.currentTimeMillis() - startedAtMs) / 1000L).toInt().coerceAtLeast(1)
        onPlaybackSuccess(zone.id, media.id, playlist.id)
        onProofOfPlay(media.id, playlist.id, startedAtMs, min(elapsedSeconds, item.duration.coerceAtLeast(1)))
        return true
    }

    private suspend fun playWidgetItem(item: PlaylistEntryModel): Boolean {
        val widget = item.widget ?: return false
        onPlaybackStateChanged(zone.id, "PLAYING", null)
        onActiveMedia(zone.id, null)
        onPlaybackProgress(zone.id, null)

        if (WidgetHtmlFactory.shouldUseNativeQr(widget)) {
            val ok = showQrWidget(widget)
            if (!ok) {
                onPlaybackIssue(zone.id, item.id, null, "QR widget failed", null)
                showTemporaryFallback("QR widget unavailable")
                onPlaybackStateChanged(zone.id, "ERROR", null)
                return false
            }
            waitWithProgress(item.duration.coerceAtLeast(1) * 1000L, null)
            onPlaybackSuccess(zone.id, null, playlist.id)
            return true
        }

        val weatherModel = if (widget.type.equals("WEATHER", true)) {
            loadWeatherModel(widget)
        } else {
            null
        }
        val newsModel = if (widget.type.equals("NEWS", true)) {
            loadNewsModel(widget)
        } else {
            null
        }

        val html = WidgetHtmlFactory.build(widget, widgetEnv, weatherModel, newsModel)
        val webView = WebView(context).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.mediaPlaybackRequiresUserGesture = false
            loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
        }
        transitionTo(webView)
        waitWithProgress(item.duration.coerceAtLeast(1) * 1000L, null)
        onPlaybackSuccess(zone.id, null, playlist.id)
        return true
    }

    private suspend fun playFallbackItem(item: PlaylistEntryModel): Boolean {
        onPlaybackStateChanged(zone.id, "ERROR", null)
        showTemporaryFallback("Unsupported item")
        delay(item.duration.coerceAtLeast(1) * 1000L)
        return false
    }

    private suspend fun showTemporaryFallback(message: String) {
        showFallbackCard(message)
        delay(1200)
    }

    private suspend fun waitWithProgress(durationMs: Long, mediaId: String?) {
        var remaining = durationMs
        while (remaining > 0) {
            val chunk = min(remaining, 10_000L)
            delay(chunk)
            onPlaybackProgress(zone.id, mediaId)
            remaining -= chunk
        }
    }

    private fun showFallbackCard(message: String) {
        val view = TextView(context).apply {
            setBackgroundColor(Color.BLACK)
            setTextColor(Color.WHITE)
            text = message
            gravity = android.view.Gravity.CENTER
            textSize = 16f
        }
        transitionTo(view)
    }

    private fun showBitmap(bitmap: Bitmap) {
        val imageView = ImageView(context).apply {
            scaleType = ImageView.ScaleType.FIT_XY
            setImageBitmap(bitmap)
            setBackgroundColor(Color.BLACK)
        }
        transitionTo(imageView)
    }

    private fun showQrBitmap(bitmap: Bitmap) {
        val imageView = ImageView(context).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            setImageBitmap(bitmap)
            setBackgroundColor(Color.WHITE)
            setPadding(24, 24, 24, 24)
        }
        transitionTo(imageView)
    }

    private fun transitionTo(view: View) {
        releasePlayer(exceptView = view)
        if (view.parent != null) {
            (view.parent as? FrameLayout)?.removeView(view)
        }
        view.alpha = 0f
        container.addView(view, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        view.animate().alpha(1f).setDuration(180).start()

        currentView?.let { old ->
            old.animate().alpha(0f).setDuration(150).withEndAction {
                container.removeView(old)
                if (old is WebView) {
                    old.stopLoading()
                    old.destroy()
                }
            }.start()
        }
        currentView = view
    }

    private fun releasePlayer(exceptView: View? = null) {
        currentPlayer?.release()
        currentPlayer = null

        if (currentView is PlayerView && currentView !== exceptView) {
            (currentView as PlayerView).player = null
        }
    }

    private suspend fun decodeBitmap(file: File): Bitmap? = withContext(Dispatchers.IO) {
        runCatching { BitmapFactory.decodeFile(file.absolutePath) }.getOrNull()
    }

    private suspend fun showQrWidget(widget: WidgetModel): Boolean {
        val data = qrPayload(widget.config)
        if (data.isBlank()) return false

        val bmp = withContext(Dispatchers.Default) {
            runCatching {
                val size = 768
                val hints = hashMapOf<EncodeHintType, Any>(
                    EncodeHintType.MARGIN to widget.config.optInt("qrMargin", 2)
                )
                val matrix = QRCodeWriter().encode(data, BarcodeFormat.QR_CODE, size, size, hints)
                val bg = parseColor(widget.config.optString("qrBackgroundColor", "#FFFFFF"), Color.WHITE)
                val fg = parseColor(widget.config.optString("qrForegroundColor", "#000000"), Color.BLACK)
                val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                for (x in 0 until size) {
                    for (y in 0 until size) {
                        bitmap.setPixel(x, y, if (matrix[x, y]) fg else bg)
                    }
                }
                bitmap
            }.getOrNull()
        } ?: return false

        showQrBitmap(bmp)
        return true
    }

    private fun qrPayload(config: JSONObject): String {
        val mode = config.optString("qrMode", "LINK")
        return if (mode == "VCARD") {
            buildString {
                appendLine("BEGIN:VCARD")
                appendLine("VERSION:3.0")
                config.optString("vcardFullName", "").takeIf { it.isNotBlank() }?.let { appendLine("FN:$it") }
                config.optString("vcardOrganization", "").takeIf { it.isNotBlank() }?.let { appendLine("ORG:$it") }
                config.optString("vcardTitle", "").takeIf { it.isNotBlank() }?.let { appendLine("TITLE:$it") }
                config.optString("vcardPhone", "").takeIf { it.isNotBlank() }?.let { appendLine("TEL;TYPE=CELL:$it") }
                config.optString("vcardEmail", "").takeIf { it.isNotBlank() }?.let { appendLine("EMAIL:$it") }
                config.optString("vcardWebsite", "").takeIf { it.isNotBlank() }?.let { appendLine("URL:$it") }
                config.optString("vcardAddress", "").takeIf { it.isNotBlank() }?.let { appendLine("ADR;TYPE=WORK:;;${it.replace("\n", " ")}") }
                append("END:VCARD")
            }
        } else {
            config.optString("qrContent", "")
        }
    }

    private fun parseColor(value: String, fallback: Int): Int =
        runCatching { Color.parseColor(value) }.getOrDefault(fallback)

    private fun playlistSignature(playlist: PlaylistModel, zone: ZoneModel): String =
        "${playlist.id}:${zone.id}:${zone.items.joinToString("|") {
            val mediaToken = it.media?.let(::mediaVersionToken).orEmpty()
            val widgetToken = it.widget?.let { w -> "${w.id}:${w.type}:${w.config.toString()}" }.orEmpty()
            "${it.id}:${it.duration}:$mediaToken:$widgetToken"
        }}"

    private fun mediaVersionToken(media: MediaFileModel): String =
        listOf(
            media.id,
            media.url,
            media.updatedAt ?: "",
            media.sizeBytes?.toString() ?: "",
            media.sha256 ?: "",
            media.mimeType
        ).joinToString("|")

    private suspend fun loadWeatherModel(widget: WidgetModel): WeatherRenderModel? {
        val lookup = resolveWeatherLookup(widget) ?: return null
        val apiKey = widgetEnv.weatherApiKey?.trim().orEmpty()
        if (apiKey.isBlank()) return null

        val cacheKey = when (lookup) {
            is WeatherLookup.Coordinates -> "coords:${lookup.latitude}:${lookup.longitude}"
            is WeatherLookup.Query -> "query:${lookup.query.lowercase()}"
        }
        weatherCache[cacheKey]?.takeIf { it.expiresAtMs > System.currentTimeMillis() }?.let { return it.value }

        val model = withContext(Dispatchers.IO) {
            fetchWeatherModel(lookup, apiKey)
        }
        weatherCache[cacheKey] = CachedWidgetData(
            expiresAtMs = System.currentTimeMillis() + if (model != null) 10 * 60 * 1000L else 2 * 60 * 1000L,
            value = model
        )
        return model
    }

    private suspend fun loadNewsModel(widget: WidgetModel): NewsRenderModel? {
        val feedUrls = resolveNewsFeedUrls(widget)
        if (feedUrls.isEmpty()) return null

        val maxItems = widget.config.optInt("newsItemCount", 6).coerceIn(1, 12)
        val cacheKey = "${feedUrls.joinToString("|")}|$maxItems"
        newsCache[cacheKey]?.takeIf { it.expiresAtMs > System.currentTimeMillis() }?.let { return it.value }

        val model = withContext(Dispatchers.IO) {
            fetchNewsModel(widget, feedUrls, maxItems)
        }
        newsCache[cacheKey] = CachedWidgetData(
            expiresAtMs = System.currentTimeMillis() + if (model != null) 5 * 60 * 1000L else 90 * 1000L,
            value = model
        )
        return model
    }

    private fun resolveWeatherLookup(widget: WidgetModel): WeatherLookup? {
        val cfg = widget.config
        val lat = firstDouble(cfg, "weatherLat", "latitude", "lat")
        val lon = firstDouble(cfg, "weatherLon", "longitude", "lng")
        if (lat != null && lon != null) {
            return WeatherLookup.Coordinates(lat, lon)
        }

        firstString(cfg, "weatherLocation", "weatherCity", "location", "city")?.let {
            return WeatherLookup.Query(it)
        }

        val screenLat = screenLocation?.latitude
        val screenLon = screenLocation?.longitude
        if (screenLat != null && screenLon != null) {
            return WeatherLookup.Coordinates(screenLat, screenLon)
        }

        screenLocation?.name?.takeIf { it.isNotBlank() }?.let {
            return WeatherLookup.Query(it)
        }
        return null
    }

    private fun resolveNewsFeedUrls(widget: WidgetModel): List<String> {
        val cfg = widget.config
        val configFeeds = buildList {
            cfg.optJSONArray("newsFeedUrls")?.let { addAll(readStringArray(it)) }
            firstString(cfg, "newsFeedUrl")?.let(::add)
            firstString(cfg, "rssUrl")?.let(::add)
            firstString(cfg, "rssUrls")?.split('\n', ',', ';')
                ?.map { it.trim() }
                ?.filter { it.isNotBlank() }
                ?.let(::addAll)
        }

        return (configFeeds + widgetEnv.tenantNewsFeedUrls)
            .map { it.trim() }
            .filter { it.startsWith("http://", true) || it.startsWith("https://", true) }
            .distinct()
    }

    private fun fetchWeatherModel(lookup: WeatherLookup, apiKey: String): WeatherRenderModel? {
        val baseUrl = "https://api.openweathermap.org/data/2.5/weather".toHttpUrlOrNull() ?: return null
        val urlBuilder = baseUrl.newBuilder()
            .addQueryParameter("appid", apiKey)
            .addQueryParameter("units", "metric")

        when (lookup) {
            is WeatherLookup.Coordinates -> {
                urlBuilder.addQueryParameter("lat", lookup.latitude.toString())
                urlBuilder.addQueryParameter("lon", lookup.longitude.toString())
            }
            is WeatherLookup.Query -> {
                urlBuilder.addQueryParameter("q", lookup.query)
            }
        }

        val body = httpGetText(urlBuilder.build().toString()) ?: return null
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
        val main = json.optJSONObject("main") ?: return null
        val weather = json.optJSONArray("weather")?.optJSONObject(0)
        val wind = json.optJSONObject("wind")

        val temp = main.optDouble("temp", Double.NaN).takeIf { !it.isNaN() } ?: return null
        val high = main.optDouble("temp_max", Double.NaN).takeIf { !it.isNaN() }
        val low = main.optDouble("temp_min", Double.NaN).takeIf { !it.isNaN() }
        val humidity = main.optInt("humidity", -1).takeIf { it >= 0 }
        val windSpeed = wind?.optDouble("speed", Double.NaN)?.takeIf { !it.isNaN() }

        val locationName = json.optString("name").takeIf { it.isNotBlank() }
            ?: (lookup as? WeatherLookup.Query)?.query
            ?: screenLocation?.name
            ?: "Weather"
        val description = weather?.optString("description")
            ?.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
            ?.takeIf { it.isNotBlank() }
            ?: "Current conditions"

        return WeatherRenderModel(
            locationName = locationName,
            temperatureText = formatTemperature(temp),
            description = description,
            highLowText = if (high != null || low != null) "H ${high?.let(::formatTemperature) ?: "--"} / L ${low?.let(::formatTemperature) ?: "--"}" else null,
            humidityText = humidity?.let { "Humidity $it%" },
            windText = windSpeed?.let { "Wind ${"%.1f".format(it)} m/s" }
        )
    }

    private fun fetchNewsModel(widget: WidgetModel, feedUrls: List<String>, maxItems: Int): NewsRenderModel? {
        val titles = linkedSetOf<String>()
        var feedTitle: String? = null

        for (url in feedUrls) {
            val xml = httpGetText(url) ?: continue
            val parsed = parseNewsFeed(xml, maxItems - titles.size)
            if (feedTitle.isNullOrBlank()) {
                feedTitle = parsed.title
            }
            titles.addAll(parsed.items)
            if (titles.size >= maxItems) {
                break
            }
        }

        val items = titles.take(maxItems)
        if (items.isEmpty()) return null

        return NewsRenderModel(
            title = firstString(widget.config, "newsTitle") ?: feedTitle ?: "News",
            items = items
        )
    }

    private fun parseNewsFeed(xml: String, maxItems: Int): ParsedFeed {
        if (maxItems <= 0) return ParsedFeed(null, emptyList())

        return runCatching {
            val parser = Xml.newPullParser()
            parser.setInput(StringReader(xml))

            var eventType = parser.eventType
            var currentText: String? = null
            var feedTitle: String? = null
            var currentItemTitle: String? = null
            var inItem = false
            var inEntry = false
            val items = mutableListOf<String>()

            while (eventType != XmlPullParser.END_DOCUMENT && items.size < maxItems) {
                when (eventType) {
                    XmlPullParser.START_TAG -> when (parser.name.lowercase()) {
                        "item" -> {
                            inItem = true
                            currentItemTitle = null
                        }
                        "entry" -> {
                            inEntry = true
                            currentItemTitle = null
                        }
                    }
                    XmlPullParser.TEXT -> currentText = parser.text
                    XmlPullParser.END_TAG -> when (parser.name.lowercase()) {
                        "title" -> {
                            val value = currentText?.trim().orEmpty()
                            if (value.isNotBlank()) {
                                if (inItem || inEntry) {
                                    currentItemTitle = value
                                } else if (feedTitle.isNullOrBlank()) {
                                    feedTitle = value
                                }
                            }
                        }
                        "item" -> {
                            currentItemTitle?.takeIf { it.isNotBlank() }?.let(items::add)
                            inItem = false
                            currentItemTitle = null
                        }
                        "entry" -> {
                            currentItemTitle?.takeIf { it.isNotBlank() }?.let(items::add)
                            inEntry = false
                            currentItemTitle = null
                        }
                    }
                }
                eventType = parser.next()
            }

            ParsedFeed(feedTitle, items)
        }.getOrElse { ParsedFeed(null, emptyList()) }
    }

    private fun httpGetText(url: String): String? {
        val request = runCatching { Request.Builder().url(url).get().build() }.getOrNull() ?: return null
        return runCatching {
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@use null
                response.body?.string()
            }
        }.getOrNull()
    }

    private fun readStringArray(array: JSONArray): List<String> = buildList {
        for (i in 0 until array.length()) {
            array.optString(i).takeIf { it.isNotBlank() }?.let(::add)
        }
    }

    private fun firstString(json: JSONObject, vararg keys: String): String? =
        keys.firstNotNullOfOrNull { key -> json.optString(key).takeIf { it.isNotBlank() } }

    private fun firstDouble(json: JSONObject, vararg keys: String): Double? =
        keys.firstNotNullOfOrNull { key ->
            when (val value = json.opt(key)) {
                is Number -> value.toDouble()
                is String -> value.toDoubleOrNull()
                else -> null
            }
        }

    private fun formatTemperature(value: Double): String = "${value.roundToInt()}C"

    private sealed interface WeatherLookup {
        data class Coordinates(val latitude: Double, val longitude: Double) : WeatherLookup
        data class Query(val query: String) : WeatherLookup
    }

    private data class ParsedFeed(
        val title: String?,
        val items: List<String>
    )

    private data class CachedWidgetData<T>(
        val expiresAtMs: Long,
        val value: T
    )
}
