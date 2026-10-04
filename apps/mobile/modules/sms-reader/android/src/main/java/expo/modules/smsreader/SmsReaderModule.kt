package expo.modules.smsreader

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsPermissionException : CodedException("READ_SMS permission has not been granted")

class SmsReaderModule : Module() {
  private var receiver: BroadcastReceiver? = null

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    Events("onSmsReceived")

    Function("hasPermission") {
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    /** Senders the background receiver may notify about; the JS side keeps it in sync with settings. */
    Function("setAllowedSenders") { senders: List<String> ->
      SmsRules.setAllowedSenders(context, senders)
    }

    /** Allowed messages that arrived after `timestamp` (ms), oldest first. OTPs are never returned. */
    AsyncFunction("getMessagesSince") { timestamp: Double, senders: List<String> ->
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw SmsPermissionException()
      }
      val allowed = senders.map(SmsRules::normalize).toSet()
      val messages = mutableListOf<Map<String, Any>>()
      context.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
        "${Telephony.Sms.DATE} > ?",
        arrayOf(timestamp.toLong().toString()),
        "${Telephony.Sms.DATE} ASC",
      )?.use { cursor ->
        val idIndex = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
        val addressIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val bodyIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val dateIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
        while (cursor.moveToNext()) {
          val sender = cursor.getString(addressIndex) ?: continue
          val body = cursor.getString(bodyIndex) ?: continue
          if (SmsRules.normalize(sender) !in allowed || SmsRules.isBlocked(body)) continue
          messages.add(
            mapOf(
              "id" to cursor.getLong(idIndex).toString(),
              "sender" to sender,
              "body" to body,
              "receivedAt" to cursor.getLong(dateIndex).toDouble(),
            ),
          )
        }
      }
      messages
    }

    OnStartObserving {
      val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
      val listener = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          for ((sender, body, receivedAt) in SmsRules.messagesFrom(intent)) {
            if (!SmsRules.isAllowed(context, sender) || SmsRules.isBlocked(body)) continue
            sendEvent("onSmsReceived", mapOf("sender" to sender, "body" to body, "receivedAt" to receivedAt.toDouble()))
          }
        }
      }
      ContextCompat.registerReceiver(context, listener, filter, ContextCompat.RECEIVER_EXPORTED)
      receiver = listener
      SmsBackgroundReceiver.appIsListening = true
    }

    OnStopObserving {
      receiver?.let { runCatching { context.unregisterReceiver(it) } }
      receiver = null
      SmsBackgroundReceiver.appIsListening = false
    }
  }
}
