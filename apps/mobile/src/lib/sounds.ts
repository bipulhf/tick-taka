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

const players = new Map<SoundName, AudioPlayer>();
let modeSet = false;

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
  try {
    if (!modeSet) {
      modeSet = true;
      // Never pause someone's music for a chime, and stay quiet when the phone is on silent.
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
    }
    // A big win drowns out the smaller cue it arrived with.
    if (name === "celebrate")
      for (const other of ["done", "pop"] as const) players.get(other)?.pause();
    const cue = player(name);
    void cue.seekTo(0).then(() => cue.play());
  } catch {
    // A missing cue is never worth an error on screen.
  }
}

/** Loads the cues ahead of the first win so the first one isn't late. */
export function preloadSounds(): void {
  for (const name of Object.keys(SOURCES) as SoundName[]) player(name);
}
