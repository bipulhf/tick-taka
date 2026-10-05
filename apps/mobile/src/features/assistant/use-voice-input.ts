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
import { api, unwrap } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";

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

export type VoiceState = "idle" | "recording" | "transcribing";

/** Tap to talk, tap again to turn the speech (Bangla, English or both) into text. */
export function useVoiceInput(onText: (text: string) => void) {
  const recorder = useAudioRecorder(VOICE);
  const { durationMillis, metering } = useAudioRecorderState(recorder, 250);
  const [state, setState] = useState<VoiceState>("idle");
  // Loudest level heard; null until the recorder reports levels (some phones never do).
  const peak = useRef<number | null>(null);
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
    if (state !== "recording") return;
    await recorder.stop();
    // Back to cue mode: win sounds stay quiet while the phone is on silent.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false });
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
    } catch {
      notify("Couldn't turn that into text. Check the connection and try again.");
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
