import type { AssistantMessage } from "@tick-taka/shared/schemas/ai";

export type ReplyLanguage = "English" | "Bangla";

/** One line of a form's answer: a short label, a colon, the value. */
const ANSWER_LINE = /^[^:\n]{1,40}:\s*\S/;
/** What describeQuestion leaves in the memo of a reply that asked with a form. */
const ASKED = "asked the user with a form";
const BENGALI = /[ঀ-৿]/;
const LATIN = /[A-Za-z]/;
/** Names that read the same in either language ("my Nagad wallet", "500 taka"). */
const NEUTRAL = new Set(["taka", "tk", "bkash", "nagad", "rocket", "upay", "bdt"]);
/**
 * Common Bangla words written in Latin letters (Banglish), none of them an English
 * word a short English message would use.
 */
const BANGLISH = new Set(
  `ami amar amake amra amader tumi tomar tomake tora apni apnar apnake uni tini tar ki keno
  kothay kothai kokhon koto koyta koita kemon kivabe ekta ekti kichu kisu sob shob sobai
  na nai nei hobe hoy hoyeche hoise hoilo holo hoye ache ase achhe chilo silo thakbe thake
  korbo korbe koro koren korte korechi korsi korlam korlo korle kore koreche dao den din
  dibo diben dite nao nilam niye nibo theke jonno jnno diye shathe sathe kal kalke aj ajke
  aaj aajke porshu porsu gotokal agamikal sokal bikal raat dupur shondha shondhay bazar
  bajar khoroch khoruch khorch beton poisa lagbe lagse lagche dekhao dekhan bolo bolen
  jabo jai jao gelo geche ashbe asbe kinlam kinsi kinechi rakho rakhen mone rekho bhai vai
  apu valo bhalo kharap onek beshi besi kom ar abar ekhon tarpor er`.split(/\s+/),
);

/** "Label: value" on every line: the app's answer to one of Tiki's forms. */
export function isFormAnswer(content: string): boolean {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every((line) => ANSWER_LINE.test(line));
}

/** The language of one message's words, or null when it has none to go by ("500"). */
export function languageOf(text: string): ReplyLanguage | null {
  let bangla = 0;
  let english = 0;
  for (const raw of text.toLowerCase().split(/[\s,.!?;:()"'“”]+/)) {
    const word = raw.replace(/[^\p{L}\p{M}]/gu, "");
    if (!word || NEUTRAL.has(word)) continue;
    if (BENGALI.test(word)) bangla++;
    else if (LATIN.test(word)) {
      if (BANGLISH.has(word)) bangla++;
      else english++;
    }
  }
  if (bangla === 0 && english === 0) return null;
  return bangla > english ? "Bangla" : "English";
}

/**
 * Which language Tiki should reply in: that of the user's latest message that says
 * something in words. A form's answer (`Label: value` lines, or the message right
 * after a reply that asked with a form) is skipped: its labels are Tiki's own words,
 * so a form written in the wrong language would otherwise keep the chat in it.
 * Null when no message has words to go by.
 */
export function replyLanguage(history: AssistantMessage[]): ReplyLanguage | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message?.role !== "user") continue;
    const before = history[i - 1];
    const answer =
      isFormAnswer(message.content) ||
      (before?.role === "assistant" && before.memo?.includes(ASKED) === true);
    if (answer) continue;
    const language = languageOf(message.content);
    if (language) return language;
  }
  // Only answers so far: their words are the best there is.
  const last = [...history].reverse().find((message) => message.role === "user");
  return last ? languageOf(last.content) : null;
}
