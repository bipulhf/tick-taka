import { callAi, logUsage, requireAi } from "../../ai/usage";
import type { Deps } from "../../lib/deps";

/** A sample of what the user says, so the model expects Bangla, English and app words. */
const HINT = "আজকে bKash থেকে ২৫০ টাকা খরচ। Call the bank tomorrow at 5pm.";

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\p{P}\s]+/gu, " ")
    .trim();

/**
 * On silence, speech models sometimes return the hint itself. A transcript that is
 * just the hint, or nothing readable, counts as "didn't catch that".
 */
export function cleanTranscript(text: string): string {
  const said = normalise(text);
  if (said.length < 2) return "";
  if (normalise(HINT).includes(said) || said.includes(normalise(HINT))) return "";
  return text.trim();
}

/** Speech to text for the assistant's microphone. The audio is not stored. */
export async function aiTranscribe(deps: Deps, input: { audio: string; mimeType: string }) {
  const ai = requireAi(deps, "assistant");
  const result = await callAi(() =>
    ai.transcribe({ audioBase64: input.audio, mimeType: input.mimeType, prompt: HINT }),
  );
  logUsage(deps, "assistant", "fast", result.model, result.usage);
  return { text: cleanTranscript(result.text) };
}
