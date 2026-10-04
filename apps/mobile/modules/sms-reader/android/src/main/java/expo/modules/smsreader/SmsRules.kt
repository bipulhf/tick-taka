package expo.modules.smsreader

import android.content.Context
import android.content.Intent
import android.provider.Telephony

/** Sender matching and quick parsing shared by the module and the background receiver. */
object SmsRules {
  private const val PREFS = "tick_taka_sms"
  private const val KEY_SENDERS = "allowed_senders"
  private val blocked = Regex("\\b(otp|code|pin|password|verification)\\b", RegexOption.IGNORE_CASE)
  private val amount = Regex("(?:tk\\.?|bdt|৳)\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)

  fun normalize(sender: String): String = sender.lowercase().filter { it.isLetterOrDigit() }

  fun allowedSenders(context: Context): Set<String> =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(KEY_SENDERS, emptySet()) ?: emptySet()

  fun setAllowedSenders(context: Context, senders: List<String>) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putStringSet(KEY_SENDERS, senders.map(::normalize).toSet())
      .apply()
  }

  fun isAllowed(context: Context, sender: String): Boolean = normalize(sender) in allowedSenders(context)

  fun isBlocked(body: String): Boolean = blocked.containsMatchIn(body)

  fun amountOf(body: String): String? = amount.find(body)?.groupValues?.get(1)

  fun describe(body: String): String {
    val text = body.lowercase()
    return when {
      Regex("cash\\s*-?\\s*out").containsMatchIn(text) -> "cash out"
      Regex("received|cash\\s*-?\\s*in|credited|deposit").containsMatchIn(text) -> "received"
      Regex("payment|paid|send money|sent|purchase|debited").containsMatchIn(text) -> "payment"
      else -> "transaction"
    }
  }

  /** Joins multipart SMS into one message per sender. */
  fun messagesFrom(intent: Intent): List<Triple<String, String, Long>> {
    val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return emptyList()
    return parts
      .filterNotNull()
      .groupBy { it.originatingAddress ?: "" }
      .map { (sender, messages) ->
        Triple(sender, messages.joinToString("") { it.messageBody ?: "" }, messages.first().timestampMillis)
      }
  }
}
