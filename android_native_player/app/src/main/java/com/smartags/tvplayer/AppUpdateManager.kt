package com.smartags.tvplayer

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

object AppUpdateManager {
    private const val TAG = "AppUpdateManager"
    const val ACTION_INSTALL_STATUS = "com.smartags.tvplayer.ACTION_INSTALL_STATUS"
    private const val EXTRA_COMMAND_ID = "commandId"

    data class UpdateRequest(
        val commandId: String,
        val apkUrl: String,
        val sha256: String,
        val versionCode: Int,
        val versionName: String,
        val force: Boolean = false
    )

    data class Progress(
        val status: String,
        val message: String,
        val percent: Int = 0
    )

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.MINUTES)
        .writeTimeout(5, TimeUnit.MINUTES)
        .build()

    fun currentVersionCode(context: Context): Long {
        return try {
            val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
        } catch (_: Exception) {
            0L
        }
    }

    suspend fun downloadAndInstall(
        context: Context,
        request: UpdateRequest,
        onProgress: (Progress) -> Unit
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            if (!KioskPolicyManager.isDeviceOwner(context)) {
                return@withContext Result.failure(IllegalStateException("Device Owner required for silent install"))
            }

            val currentCode = currentVersionCode(context)
            if (!request.force && request.versionCode.toLong() <= currentCode) {
                return@withContext Result.failure(
                    IllegalStateException("Device already on versionCode $currentCode (target ${request.versionCode})")
                )
            }

            onProgress(Progress("DOWNLOADING", "Downloading APK…", 0))
            val apkFile = File(context.cacheDir, "ota-${request.versionCode}-${System.currentTimeMillis()}.apk")
            downloadApk(request.apkUrl, apkFile) { pct ->
                onProgress(Progress("DOWNLOADING", "Downloading APK… $pct%", pct))
            }

            onProgress(Progress("DOWNLOADING", "Verifying checksum…", 95))
            val actual = sha256(apkFile)
            if (!actual.equals(request.sha256, ignoreCase = true)) {
                apkFile.delete()
                return@withContext Result.failure(
                    IllegalStateException("APK sha256 mismatch (expected ${request.sha256}, got $actual)")
                )
            }

            if (!signingCertMatches(context, apkFile)) {
                apkFile.delete()
                return@withContext Result.failure(
                    IllegalStateException("APK signing certificate does not match installed app")
                )
            }

            onProgress(Progress("INSTALLING", "Installing update…", 98))
            installApk(context, apkFile, request.commandId)
            // PackageInstaller commits asynchronously; treat as success once session committed.
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "OTA failed", e)
            Result.failure(e)
        }
    }

    private fun downloadApk(url: String, dest: File, onPct: (Int) -> Unit) {
        val req = Request.Builder().url(url).get().build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) throw IllegalStateException("APK download failed HTTP ${resp.code}")
            val body = resp.body ?: throw IllegalStateException("Empty APK body")
            val total = body.contentLength()
            dest.outputStream().use { out ->
                body.byteStream().use { input ->
                    val buf = ByteArray(64 * 1024)
                    var read: Int
                    var done = 0L
                    while (input.read(buf).also { read = it } >= 0) {
                        out.write(buf, 0, read)
                        done += read
                        if (total > 0) {
                            onPct(((done * 90) / total).toInt().coerceIn(0, 90))
                        }
                    }
                }
            }
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            var read: Int
            while (input.read(buf).also { read = it } >= 0) {
                digest.update(buf, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun signingCertMatches(context: Context, apkFile: File): Boolean {
        return try {
            val pm = context.packageManager
            val installed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pm.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)
            }
            val apkInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pm.getPackageArchiveInfo(apkFile.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageArchiveInfo(apkFile.absolutePath, PackageManager.GET_SIGNATURES)
            } ?: return false

            val installedSigs = signingDigests(installed)
            val apkSigs = signingDigests(apkInfo)
            installedSigs.isNotEmpty() && apkSigs.any { it in installedSigs }
        } catch (e: Exception) {
            Log.w(TAG, "signingCertMatches failed", e)
            false
        }
    }

    private fun signingDigests(info: android.content.pm.PackageInfo): Set<String> {
        val out = mutableSetOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = info.signingInfo ?: return out
            val sigs = if (signingInfo.hasMultipleSigners()) {
                signingInfo.apkContentsSigners
            } else {
                signingInfo.signingCertificateHistory
            }
            sigs?.forEach { out += sha256Bytes(it.toByteArray()) }
        } else {
            @Suppress("DEPRECATION")
            info.signatures?.forEach { out += sha256Bytes(it.toByteArray()) }
        }
        return out
    }

    private fun sha256Bytes(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(bytes).joinToString("") { "%02x".format(it) }
    }

    private fun installApk(context: Context, apkFile: File, commandId: String) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)
        try {
            session.openWrite("package", 0, apkFile.length()).use { out ->
                apkFile.inputStream().use { input -> input.copyTo(out) }
                session.fsync(out)
            }

            val intent = Intent(ACTION_INSTALL_STATUS).setPackage(context.packageName)
            intent.putExtra(EXTRA_COMMAND_ID, commandId)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_MUTABLE else 0)
            val pi = PendingIntent.getBroadcast(context, sessionId, intent, flags)
            session.commit(pi.intentSender)
        } catch (e: Exception) {
            session.abandon()
            throw e
        } finally {
            runCatching { apkFile.delete() }
        }
    }

    class InstallResultReceiver(
        private val onResult: (commandId: String, success: Boolean, message: String) -> Unit
    ) : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != ACTION_INSTALL_STATUS) return
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
            val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "install status=$status"
            val commandId = intent.getStringExtra(EXTRA_COMMAND_ID) ?: ""
            val success = status == PackageInstaller.STATUS_SUCCESS
            onResult(commandId, success, message)
        }
    }

    fun registerInstallReceiver(context: Context, receiver: InstallResultReceiver) {
        val filter = IntentFilter(ACTION_INSTALL_STATUS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiver, filter)
        }
    }
}
