import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { ApiError, api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";
import { CUE_AUDIO_MODE } from "@/lib/sounds";

const MAX_MS = 120_000;
/** Mono AAC at 64 kbps: clear speech, about 0.5 MB a minute. */
const VOICE = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64_000,
  isMeteringEnabled: true,
};
/** Shorter than this, or never louder than SILENCE_DB, is treated as nothing said. */
const MIN_MS = 700;
const SILENCE_DB = -45;

/** Why a note didn't become text: the limit used up, AI off, or the connection. */
function transcribeError(error: unknown): string {
  const failed = "Couldn't turn that into text.";
  // The app-wide copy for ai_error points to a form; there is none here.
  if (error instanceof ApiError && error.code === "ai_error")
    return `${failed} Try again in a moment.`;
  if (error instanceof ApiError) return `${failed} ${friendlyError(error)}`;
  return `${failed} Check the connection and try again.`;
}

export type VoiceState = "idle" | "recording" | "transcribing";

/** Tap to talk, tap again to turn the speech (Bangla, English or both) into text. */
export function useVoiceInput(onText: (text: string) => void) {
  const recorder = useAudioRecorder(VOICE);
  const { durationMillis, metering } = useAudioRecorderState(recorder, 250);
  const [state, setState] = useState<VoiceState>("idle");
  // Loudest level heard; null until the recorder reports levels (some phones never do).
  const peak = useRef<number | null>(null);
  const finishing = useRef(false);
  if (state === "recording" && typeof metering === "number" && metering > (peak.current ?? -160))
    peak.current = metering;

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      notify("Microphone access is off.", {
        label: "Settings",
        onPress: () => void Linking.openSettings(),
      });
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    peak.current = null;
    recorder.record();
    haptic.tap();
    setState("recording");
  };

  const finish = async (keep: boolean) => {
    // Once per note: a second tap on Done, or the time limit seen again on the next
    // render while the recorder stops, would transcribe it twice.
    if (state !== "recording" || finishing.current) return;
    finishing.current = true;
    try {
      await wrapUp(keep);
    } finally {
      finishing.current = false;
    }
  };

  const wrapUp = async (keep: boolean) => {
    await recorder.stop();
    // Back to cue mode, so win sounds mix with music and respect silent mode again.
    await setAudioModeAsync({ ...CUE_AUDIO_MODE, allowsRecording: false });
    const uri = recorder.uri;
    const heardNothing =
      durationMillis < MIN_MS || (peak.current !== null && peak.current < SILENCE_DB);
    if (!keep || !uri || heardNothing) {
      if (keep && heardNothing)
        notify("I didn't hear anything. Hold the phone closer and try again.");
      setState("idle");
      return;
    }
    setState("transcribing");
    try {
      const file = new File(uri);
      const audio = await file.base64();
      file.delete();
      const { text } = await unwrap(
        api.ai.transcribe.$post({ json: { audio, mimeType: "audio/mp4" } }),
      );
      if (text) onText(text);
      else notify("I didn't catch that. Try again a little closer.");
    } catch (error) {
      notify(transcribeError(error));
    } finally {
      setState("idle");
    }
  };

  // Long notes stop on their own so uploads stay small.
  useEffect(() => {
    if (state === "recording" && durationMillis >= MAX_MS) void finish(true);
  });

  return {
    state,
    seconds: Math.floor(durationMillis / 1000),
    start: () => void start(),
    stop: () => void finish(true),
    cancel: () => void finish(false),
  };
}
