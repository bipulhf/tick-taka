import { feedbackPrefsStore } from "./prefs";

/**
 * The phone's soft cues (apps/mobile/scripts/make-sounds.py): pop for saving or a
 * small step, done for a task or habit, celebrate for a big win, focus when a focus
 * session ends.
 */
const SOURCES = {
  pop: "sounds/pop.wav",
  done: "sounds/done.wav",
  celebrate: "sounds/celebrate.wav",
  focus: "sounds/focus.wav",
} as const;
export type SoundName = keyof typeof SOURCES;

const players = new Map<SoundName, HTMLAudioElement>();

function player(name: SoundName): HTMLAudioElement {
  let existing = players.get(name);
  if (!existing) {
    existing = new Audio(`${import.meta.env.BASE_URL}${SOURCES[name]}`);
    existing.volume = 0.5;
    players.set(name, existing);
  }
  return existing;
}

/** Plays a cue unless sounds are off in Settings. */
export function playSound(name: SoundName): void {
  if (!feedbackPrefsStore.get().sounds) return;
  // A big win drowns out the smaller cue it arrived with.
  if (name === "celebrate") players.get("done")?.pause();
  const audio = player(name);
  audio.currentTime = 0;
  // Browsers refuse sound before the first click on the page; that's fine.
  void audio.play().catch(() => {});
}
