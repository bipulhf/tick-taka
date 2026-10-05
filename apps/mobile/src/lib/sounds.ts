import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import celebrateSound from "@/assets/sounds/celebrate.wav";
import doneSound from "@/assets/sounds/done.wav";
import focusSound from "@/assets/sounds/focus.wav";
import popSound from "@/assets/sounds/pop.wav";
import { feedbackPrefsStore } from "./feedback-prefs";

/**
 * Short, soft cues for finishing things (made by scripts/make-sounds.py):
 * pop for saving or a small step, done for a task or habit, celebrate for a
 * big win, focus when a focus session ends.
 */
const SOURCES = {
  pop: popSound,
  done: doneSound,
  celebrate: celebrateSound,
  focus: focusSound,
} as const;
export type SoundName = keyof typeof SOURCES;

/**
 * How cues play: alongside other audio (music never pauses for a chime) and not at
 * all when the phone is on silent. Anything that changes the audio mode, like voice
 * input, comes back to this.
 */
export const CUE_AUDIO_MODE = {
  playsInSilentMode: false,
  interruptionMode: "mixWithOthers",
} as const;

const players = new Map<SoundName, AudioPlayer>();
// Set on the first cue rather than at launch: on Android it also resets the
// speakerphone route, which shouldn't happen just because the app opened.
let modeReady: Promise<void> | null = null;

function player(name: SoundName): AudioPlayer {
  let existing = players.get(name);
  if (!existing) {
    existing = createAudioPlayer(SOURCES[name]);
    existing.volume = 0.7;
    players.set(name, existing);
  }
  return existing;
}

/** Plays a cue unless sounds are off; silent or vibrate mode on the phone also mutes it. */
export function playSound(name: SoundName): void {
  if (!feedbackPrefsStore.get().sounds) return;
  modeReady ??= setAudioModeAsync(CUE_AUDIO_MODE).catch(() => {});
  void modeReady
    .then(async () => {
      // A big win drowns out the smaller cue it arrived with.
      if (name === "celebrate")
        for (const other of ["done", "pop"] as const) players.get(other)?.pause();
      const cue = player(name);
      await cue.seekTo(0);
      cue.play();
    })
    // A missing cue is never worth an error on screen.
    .catch(() => {});
}

/** Loads the cues at startup so the first win isn't late. */
export function preloadSounds(): void {
  for (const name of Object.keys(SOURCES) as SoundName[]) player(name);
}
