import { VOICE_MIME_TYPES } from "@tick-taka/shared/schemas/ai";

export type VoiceMime = (typeof VOICE_MIME_TYPES)[number];

/** What MediaRecorder is asked for, in order, and the type the server is told. */
const CANDIDATES: { record: string; send: VoiceMime }[] = [
  { record: "audio/webm;codecs=opus", send: "audio/webm" },
  { record: "audio/webm", send: "audio/webm" },
  { record: "audio/mp4", send: "audio/mp4" },
  { record: "audio/mpeg", send: "audio/mpeg" },
  { record: "audio/wav", send: "audio/wav" },
];

/**
 * The first recording format this browser can make that /ai/transcribe accepts, or
 * null when there is none. Pure apart from the check it is given, so it can be tested.
 */
export function pickVoiceMime(
  isSupported: (type: string) => boolean,
): { record: string; send: VoiceMime } | null {
  for (const candidate of CANDIDATES) {
    if (
      (VOICE_MIME_TYPES as readonly string[]).includes(candidate.send) &&
      isSupported(candidate.record)
    )
      return candidate;
  }
  return null;
}

/** The format the server is told for what the recorder actually made ("audio/webm;codecs=opus"). */
export function sendMimeOf(recorded: string, fallback: VoiceMime): VoiceMime {
  const base = recorded.split(";")[0]?.trim().toLowerCase() ?? "";
  return (VOICE_MIME_TYPES as readonly string[]).includes(base) ? (base as VoiceMime) : fallback;
}
