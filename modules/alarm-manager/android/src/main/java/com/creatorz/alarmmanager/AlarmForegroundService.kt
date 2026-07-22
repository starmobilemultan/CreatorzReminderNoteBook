package com.creatorz.alarmmanager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * AlarmForegroundService
 *
 * Keeps the CPU alive while the alarm is firing. Started by AlarmReceiver
 * immediately when an alarm goes off. Ensures the system does not kill the
 * alarm before the user acknowledges it, even on aggressive OEM battery
 * management (Samsung, Xiaomi, Huawei, OnePlus).
 *
 * The service posts a minimal foreground notification (required by Android 8+
 * for any foreground service) and stops itself after the alarm is dismissed
 * or after a safety timeout of 5 minutes.
 */
class AlarmForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "creatorz_alarm_service"
        const val NOTIFICATION_ID = 9999
        const val ACTION_STOP = "com.creatorz.ALARM_SERVICE_STOP"
        const val EXTRA_TITLE = "alarm_title"
        const val EXTRA_BODY = "alarm_body"
        // Safety timeout: auto-stop after 5 minutes if user does not dismiss
        const val AUTO_STOP_MS = 5 * 60 * 1000L
    }

    private val stopRunnable = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Alarm"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: ""

        // Stop-service PendingIntent for the notification action
        val stopIntent = Intent(this, AlarmForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(body.ifEmpty { "Tap to dismiss" })
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", stopPendingIntent)
            .build()

        startForeground(NOTIFICATION_ID, notification)

        // Safety auto-stop
        android.os.Handler(mainLooper).postDelayed(stopRunnable, AUTO_STOP_MS)

        return START_STICKY
    }

    override fun onDestroy() {
        android.os.Handler(mainLooper).removeCallbacks(stopRunnable)
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Alarm Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps alarm alive until acknowledged"
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(channel)
        }
    }
}
