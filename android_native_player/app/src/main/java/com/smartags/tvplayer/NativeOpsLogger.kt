package com.smartags.tvplayer

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.time.Instant

object NativeOpsLogger {
    private const val LOG_FILE_NAME = "native_ops.log"
    private const val MAX_LOG_BYTES = 512 * 1024L

    fun log(context: Context, level: String, message: String, details: JSONObject? = null) {
        runCatching {
            val file = logFile(context)
            file.parentFile?.mkdirs()
            trimIfNeeded(file)
            val line = buildString {
                append(Instant.now().toString())
                append(" [")
                append(level.uppercase())
                append("] ")
                append(message)
                if (details != null && details.length() > 0) {
                    append(" :: ")
                    append(details.toString())
                }
                append('\n')
            }
            file.appendText(line)
        }
    }

    fun readRecent(context: Context): String =
        runCatching { logFile(context).takeIf { it.exists() }?.readText() ?: "" }.getOrDefault("")

    fun logFile(context: Context): File = File(context.filesDir, LOG_FILE_NAME)

    private fun trimIfNeeded(file: File) {
        if (!file.exists() || file.length() <= MAX_LOG_BYTES) return
        val text = file.readText()
        val keepFrom = (text.length / 2).coerceAtLeast(0)
        file.writeText(text.substring(keepFrom))
    }
}
