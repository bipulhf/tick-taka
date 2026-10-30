import { useCallback, useEffect, useRef, useState } from "react";
import { api, unwrap } from "@/lib/api";
import { notify } from "@/lib/toast";
import { pickVoiceMime, sendMimeOf } from "./voice-mime";

const MAX_MS = 120_000;
/** Shorter than this, or never louder than SILENCE_DB, is treated as nothing said. */
const MIN_MS = 700;
const SILENCE_DB = -45;

export type VoiceState = "idle" | "recording" | "transcribing";

const format =
  typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia
    ? null
    : pickVoiceMime((type) => MediaRecorder.isTypeSupported(type));

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Click to talk, click again to turn the speech (Bangla, English or both) into text. */
export function useVoiceInput(onText: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  // No recorder, or the microphone was refused: the mic button goes away.
  const [available, setAvailable] = useState(format !== null);
  const session = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    began: number;
    /** Loudest level heard, in dB; null when the browser can't measure it. */
    peak: number | null;
    keep: boolean;
    stopMeter: () => void;
  } | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // The microphone already blocked for this site: don't offer it.
  useEffect(() => {
    if (!format || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        setAvailable(status.state !== "denied");
        status.onchange = () => setAvailable(status.state !== "denied");
      })
      .catch(() => {});
  }, []);

  const transcribe = async (blob: Blob, mime: string) => {
    setState("transcribing");
    try {
      const audio = await toBase64(blob);
      const { text } = await unwrap(
        api.ai.transcribe.$post({
          json: { audio, mimeType: sendMimeOf(mime, format?.send ?? "audio/webm") },
        }),
      );
      if (text) onTextRef.current(text);
      else notify("I didn't catch that. Try again a little closer.");
    } catch {
      notify("Couldn't turn that into text. Check the connection and try again.");
    } finally {
      setState("idle");
    }
  };

  const start = async () => {
    if (!format || session.current) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setAvailable(false);
      notify("Microphone access is off. Allow it in the browser's site settings to talk to Tiki.");
      return;
    }
    const recorder = new MediaRecorder(stream, {
      mimeType: format.record,
      audioBitsPerSecond: 64_000,
    });
    const current = {
      recorder,
      stream,
      chunks: [] as Blob[],
      began: Date.now(),
      peak: null as number | null,
      keep: true,
      stopMeter: () => {},
    };
    // A level meter, so a silent note isn't sent off to be transcribed.
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        const db = 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-8);
        if (db > (current.peak ?? -160)) current.peak = db;
      }, 250);
      current.stopMeter = () => {
        clearInterval(timer);
        void context.close().catch(() => {});
      };
    } catch {}
    recorder.ondataavailable = (event) => {
      if (event.data.size) current.chunks.push(event.data);
    };
    recorder.onstop = () => {
      current.stopMeter();
      for (const track of stream.getTracks()) track.stop();
      session.current = null;
      const heardNothing =
        Date.now() - current.began < MIN_MS || (current.peak !== null && current.peak < SILENCE_DB);
      if (!current.keep || current.chunks.length === 0 || heardNothing) {
        if (current.keep && heardNothing)
          notify("I didn't hear anything. Move closer to the microphone and try again.");
        setState("idle");
        return;
      }
      void transcribe(new Blob(current.chunks, { type: recorder.mimeType }), recorder.mimeType);
    };
    session.current = current;
    recorder.start(1000);
    setSeconds(0);
    setState("recording");
  };

  const finish = useCallback((keep: boolean) => {
    const current = session.current;
    if (!current) return;
    current.keep = keep;
    current.recorder.stop();
  }, []);

  // The clock while recording; long notes stop on their own so uploads stay small.
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => {
      const began = session.current?.began ?? Date.now();
      setSeconds(Math.floor((Date.now() - began) / 1000));
      if (Date.now() - began >= MAX_MS) finish(true);
    }, 250);
    return () => clearInterval(timer);
  }, [state, finish]);

  // Closing the chat mid-note drops it.
  useEffect(() => () => finish(false), [finish]);

  return {
    available,
    state,
    seconds,
    start: () => void start(),
    stop: () => finish(true),
    cancel: () => finish(false),
  };
}
