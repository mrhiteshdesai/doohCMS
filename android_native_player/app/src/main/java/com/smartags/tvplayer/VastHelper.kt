package com.smartags.tvplayer

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.StringReader
import java.util.UUID
import java.util.concurrent.TimeUnit

data class VastFill(
    val adId: String?,
    val creativeId: String?,
    val durationSec: Int?,
    val mediaUrl: String,
    val mimeType: String,
    val impressionUrls: List<String>,
    val tracking: Map<String, List<String>>,
    val errorUrls: List<String>
)

object VastHelper {
    private const val TAG = "VastHelper"
    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    fun expandMacros(
        rawUrl: String,
        screenId: String?,
        width: Int,
        height: Int,
        lat: Double?,
        lon: Double?
    ): String {
        var url = rawUrl
        val correlator = System.currentTimeMillis().toString()
        val cacheBuster = UUID.randomUUID().toString().replace("-", "")
        val replacements = mapOf(
            "[CACHEBUSTING]" to cacheBuster,
            "[TIMESTAMP]" to correlator,
            "[SCREEN_ID]" to (screenId ?: ""),
            "[WIDTH]" to width.toString(),
            "[HEIGHT]" to height.toString(),
            "[LAT]" to (lat?.toString() ?: ""),
            "[LON]" to (lon?.toString() ?: ""),
            "[APP_BUNDLE]" to "com.smartags.tvplayer"
        )
        replacements.forEach { (k, v) -> url = url.replace(k, v, ignoreCase = true) }
        // Common GAM correlator empty param
        if (url.contains("correlator=")) {
            url = url.replace(Regex("correlator=[^&]*"), "correlator=$correlator")
        } else {
            url += if (url.contains("?")) "&correlator=$correlator" else "?correlator=$correlator"
        }
        return url
    }

    suspend fun fetchFill(
        vastUrl: String,
        timeoutMs: Long = 3000,
        depth: Int = 0
    ): VastFill? = withContext(Dispatchers.IO) {
        if (depth > 5) return@withContext null
        val xml = withTimeoutOrNull(timeoutMs) {
            val req = Request.Builder().url(vastUrl).get().build()
            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@withTimeoutOrNull null
                resp.body?.string()
            }
        } ?: return@withContext null

        parseVast(xml, timeoutMs, depth)
    }

    private suspend fun parseVast(xml: String, timeoutMs: Long, depth: Int): VastFill? {
        val factory = XmlPullParserFactory.newInstance()
        factory.isNamespaceAware = false
        val parser = factory.newPullParser()
        parser.setInput(StringReader(xml))

        var event = parser.eventType
        var adId: String? = null
        var creativeId: String? = null
        var durationSec: Int? = null
        var wrapperUrl: String? = null
        val impressionUrls = mutableListOf<String>()
        val errorUrls = mutableListOf<String>()
        val tracking = mutableMapOf<String, MutableList<String>>()
        val mediaCandidates = mutableListOf<Triple<String, String, Int>>() // url, mime, width

        var inImpression = false
        var inError = false
        var inDuration = false
        var inMediaFile = false
        var inTracking = false
        var trackingEvent: String? = null
        var mediaMime = "video/mp4"
        var mediaWidth = 0
        var inVASTAdTagURI = false

        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    when (parser.name) {
                        "Ad" -> adId = parser.getAttributeValue(null, "id")
                        "Creative" -> creativeId = parser.getAttributeValue(null, "id")
                            ?: parser.getAttributeValue(null, "AdID")
                        "Impression" -> inImpression = true
                        "Error" -> inError = true
                        "Duration" -> inDuration = true
                        "Tracking" -> {
                            inTracking = true
                            trackingEvent = parser.getAttributeValue(null, "event")
                        }
                        "MediaFile" -> {
                            inMediaFile = true
                            mediaMime = parser.getAttributeValue(null, "type") ?: "video/mp4"
                            mediaWidth = parser.getAttributeValue(null, "width")?.toIntOrNull() ?: 0
                        }
                        "VASTAdTagURI" -> inVASTAdTagURI = true
                    }
                }
                XmlPullParser.TEXT -> {
                    val text = parser.text?.trim().orEmpty()
                    if (text.isNotEmpty()) {
                        when {
                            inImpression -> impressionUrls += text
                            inError -> errorUrls += text
                            inDuration -> durationSec = parseDuration(text)
                            inTracking && !trackingEvent.isNullOrBlank() -> {
                                tracking.getOrPut(trackingEvent!!) { mutableListOf() }.add(text)
                            }
                            inMediaFile -> mediaCandidates += Triple(text, mediaMime, mediaWidth)
                            inVASTAdTagURI -> wrapperUrl = text
                        }
                    }
                }
                XmlPullParser.END_TAG -> {
                    when (parser.name) {
                        "Impression" -> inImpression = false
                        "Error" -> inError = false
                        "Duration" -> inDuration = false
                        "Tracking" -> {
                            inTracking = false
                            trackingEvent = null
                        }
                        "MediaFile" -> inMediaFile = false
                        "VASTAdTagURI" -> inVASTAdTagURI = false
                    }
                }
            }
            event = parser.next()
        }

        if (!wrapperUrl.isNullOrBlank() && mediaCandidates.isEmpty()) {
            return fetchFill(wrapperUrl!!, timeoutMs, depth + 1)
        }

        val best = mediaCandidates
            .filter { it.second.contains("mp4", true) || it.second.startsWith("video/") }
            .maxByOrNull { it.third }
            ?: mediaCandidates.firstOrNull()
            ?: return null

        return VastFill(
            adId = adId,
            creativeId = creativeId,
            durationSec = durationSec,
            mediaUrl = best.first,
            mimeType = best.second,
            impressionUrls = impressionUrls,
            tracking = tracking,
            errorUrls = errorUrls
        )
    }

    private fun parseDuration(raw: String): Int? {
        // HH:MM:SS or HH:MM:SS.mmm
        val parts = raw.trim().split(":")
        return try {
            when (parts.size) {
                3 -> {
                    val h = parts[0].toInt()
                    val m = parts[1].toInt()
                    val s = parts[2].substringBefore(".").toInt()
                    h * 3600 + m * 60 + s
                }
                1 -> parts[0].toFloat().toInt()
                else -> null
            }
        } catch (_: Exception) {
            null
        }
    }

    suspend fun fireUrls(urls: List<String>) = withContext(Dispatchers.IO) {
        urls.forEach { url ->
            runCatching {
                val req = Request.Builder().url(url).get().build()
                http.newCall(req).execute().close()
            }.onFailure { Log.w(TAG, "Tracking ping failed: $url", it) }
        }
    }

    fun toImpressionPayload(
        fill: VastFill?,
        playlistId: String?,
        item: PlaylistEntryModel,
        filled: Boolean,
        completed: Boolean,
        durationSec: Int,
        error: String? = null
    ): JSONObject {
        return JSONObject()
            .put("playlistId", playlistId)
            .put("playlistItemId", item.id)
            .put("vastAdId", fill?.adId)
            .put("creativeId", fill?.creativeId)
            .put("mediaFileUrl", fill?.mediaUrl)
            .put("fallbackMediaId", item.media?.id)
            .put("filled", filled)
            .put("completed", completed)
            .put("durationSec", durationSec)
            .put("error", error)
            .put("startedAt", java.time.Instant.now().toString())
    }
}
