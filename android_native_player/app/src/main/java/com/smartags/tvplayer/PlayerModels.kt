package com.smartags.tvplayer

import org.json.JSONArray
import org.json.JSONObject

data class ScreenContentModel(
    val screenId: String,
    val name: String?,
    val orientation: String?,
    val playlist: PlaylistModel?,
    val location: ScreenLocationModel?,
    val weatherApiKey: String?,
    val newsFeedUrls: List<String>
)

data class ScreenLocationModel(
    val name: String?,
    val latitude: Double?,
    val longitude: Double?
)

data class PlaylistModel(
    val id: String,
    val name: String?,
    val canvasWidth: Int,
    val canvasHeight: Int,
    val zones: List<ZoneModel>
)

data class ZoneModel(
    val id: String,
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int,
    val zIndex: Int,
    val items: List<PlaylistEntryModel>
)

data class PlaylistEntryModel(
    val id: String,
    val order: Int,
    val duration: Int,
    val media: MediaFileModel?,
    val widget: WidgetModel?
)

data class MediaFileModel(
    val id: String,
    val url: String,
    val mimeType: String,
    val filename: String,
    val duration: Int? = null,
    val sizeBytes: Long? = null,
    val updatedAt: String? = null,
    val sha256: String? = null
)

data class WidgetModel(
    val id: String,
    val type: String,
    val config: JSONObject
)

fun parseScreenContent(json: JSONObject, resolveUrl: (String) -> String): ScreenContentModel {
    val playlistObj = json.optJSONObject("playlist")
    return ScreenContentModel(
        screenId = json.optString("screenId", ""),
        name = json.optString("name", null),
        orientation = json.optString("orientation", null),
        playlist = if (playlistObj != null && playlistObj != JSONObject.NULL) parsePlaylist(playlistObj, resolveUrl) else null,
        location = parseScreenLocation(json),
        weatherApiKey = json.optString("weatherApiKey", null),
        newsFeedUrls = json.optJSONArray("newsFeedUrls")?.let { arr ->
            buildList {
                for (i in 0 until arr.length()) {
                    arr.optString(i)?.takeIf { it.isNotBlank() }?.let(::add)
                }
            }
        } ?: emptyList()
    )
}

private fun parseScreenLocation(json: JSONObject): ScreenLocationModel? {
    val locationRaw = json.opt("location")
    val locationObj = locationRaw as? JSONObject

    val latitude = when {
        json.has("latitude") -> json.optDouble("latitude", Double.NaN).takeIf { !it.isNaN() }
        locationObj?.has("lat") == true -> locationObj.optDouble("lat", Double.NaN).takeIf { !it.isNaN() }
        locationObj?.has("latitude") == true -> locationObj.optDouble("latitude", Double.NaN).takeIf { !it.isNaN() }
        else -> null
    }
    val longitude = when {
        json.has("longitude") -> json.optDouble("longitude", Double.NaN).takeIf { !it.isNaN() }
        locationObj?.has("lng") == true -> locationObj.optDouble("lng", Double.NaN).takeIf { !it.isNaN() }
        locationObj?.has("longitude") == true -> locationObj.optDouble("longitude", Double.NaN).takeIf { !it.isNaN() }
        else -> null
    }
    val name = when (locationRaw) {
        is String -> locationRaw.takeIf { it.isNotBlank() }
        is JSONObject -> listOf("address", "name", "label", "city")
            .firstNotNullOfOrNull { key -> locationRaw.optString(key).takeIf { it.isNotBlank() } }
        else -> null
    }

    return if (name != null || latitude != null || longitude != null) {
        ScreenLocationModel(name = name, latitude = latitude, longitude = longitude)
    } else {
        null
    }
}

private fun parsePlaylist(json: JSONObject, resolveUrl: (String) -> String): PlaylistModel {
    val zonesJson = json.optJSONArray("zones") ?: JSONArray()
    val zones = buildList {
        for (i in 0 until zonesJson.length()) {
            val zone = zonesJson.optJSONObject(i) ?: continue
            add(parseZone(zone, resolveUrl))
        }
    }.sortedBy { it.zIndex }

    return PlaylistModel(
        id = json.optString("id", ""),
        name = json.optString("name", null),
        canvasWidth = json.optInt("canvasWidth", 1920).coerceAtLeast(1),
        canvasHeight = json.optInt("canvasHeight", 1080).coerceAtLeast(1),
        zones = zones
    )
}

private fun parseZone(json: JSONObject, resolveUrl: (String) -> String): ZoneModel {
    val itemsJson = json.optJSONArray("items") ?: JSONArray()
    val items = buildList {
        for (i in 0 until itemsJson.length()) {
            val item = itemsJson.optJSONObject(i) ?: continue
            add(parseEntry(item, resolveUrl))
        }
    }.sortedBy { it.order }

    return ZoneModel(
        id = json.optString("id", ""),
        x = json.optInt("x", 0),
        y = json.optInt("y", 0),
        width = json.optInt("width", 0).coerceAtLeast(1),
        height = json.optInt("height", 0).coerceAtLeast(1),
        zIndex = json.optInt("zIndex", 0),
        items = items
    )
}

private fun parseEntry(json: JSONObject, resolveUrl: (String) -> String): PlaylistEntryModel {
    val mediaJson = json.optJSONObject("media")
    val widgetJson = json.optJSONObject("widget")

    return PlaylistEntryModel(
        id = json.optString("id", ""),
        order = json.optInt("order", 0),
        duration = json.optInt("duration", 10).coerceAtLeast(1),
        media = mediaJson?.let {
            MediaFileModel(
                id = it.optString("id", ""),
                url = resolveUrl(it.optString("url", "")),
                mimeType = it.optString("mimeType", ""),
                filename = it.optString("filename", it.optString("id", "")),
                duration = if (it.has("duration")) it.optInt("duration") else null,
                sizeBytes = it.optDouble("size", Double.NaN).takeIf { value -> !value.isNaN() }?.toLong(),
                updatedAt = it.optString("updatedAt", null),
                sha256 = it.optString("sha256", null)
            )
        },
        widget = widgetJson?.let {
            WidgetModel(
                id = it.optString("id", ""),
                type = it.optString("type", ""),
                config = it.optJSONObject("config") ?: JSONObject()
            )
        }
    )
}
