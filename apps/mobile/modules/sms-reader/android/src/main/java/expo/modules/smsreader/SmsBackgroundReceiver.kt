package expo.modules.smsreader

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Runs while the app is closed: a new allowed transaction SMS becomes a notification
 * such as "bKash · ৳500 payment — add as expense?" with Add and Review buttons.
 * Nothing is saved here; both buttons open the SMS review panel.
 */
class SmsBackgroundReceiver : BroadcastReceiver() {
  companion object {
    /** When the app is open, the JS listener handles new messages instead. */
    @Volatile var appIsListening = false
    private const val CHANNEL = "sms-capture"
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (appIsListening) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED &&
      android.os.Build.VERSION.SDK_INT >= 33
    ) return
    ensureChannel(context)
    for ((sender, body, receivedAt) in SmsRules.messagesFrom(intent)) {
      if (!SmsRules.isAllowed(context, sender) || SmsRules.isBlocked(body)) continue
      val amount = SmsRules.amountOf(body) ?: continue
      val kind = SmsRules.describe(body)
      val suggestion = if (kind == "received") "add as income?" else if (kind == "cash out") "add as cash-out?" else "add as expense?"
      val id = (receivedAt % Int.MAX_VALUE).toInt()
      val notification = NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle("$sender · ৳$amount $kind")
        .setContentText(suggestion.replaceFirstChar { it.uppercase() })
        .setAutoCancel(true)
        .setContentIntent(open(context, id, "review", receivedAt))
        .addAction(0, "Add", open(context, id + 1, "add", receivedAt))
        .addAction(0, "Review", open(context, id + 2, "review", receivedAt))
        .build()
      runCatching { NotificationManagerCompat.from(context).notify(id, notification) }
    }
  }

  private fun open(context: Context, requestCode: Int, action: String, receivedAt: Long): PendingIntent {
    val uri = Uri.parse("ticktaka://money/sms?action=$action&receivedAt=$receivedAt")
    val intent = Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun ensureChannel(context: Context) {
    if (android.os.Build.VERSION.SDK_INT < 26) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL) == null) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL, "SMS capture", NotificationManager.IMPORTANCE_DEFAULT))
    }
  }
}
