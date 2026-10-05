"""Makes the app's sound cues (assets/sounds/*.wav) from scratch: soft bell tones, no samples.

Run from apps/mobile:  python3 scripts/make-sounds.py assets/sounds
"""
import math, wave, array, sys
SR = 22050
# Bell/marimba voice: slightly inharmonic partials, each decaying faster than the last.
PARTIALS = [(1.0, 1.0, 1.0), (2.0, 0.32, 0.55), (3.01, 0.12, 0.35), (4.07, 0.05, 0.25)]

def render(notes, seconds, peak=0.6):
    n = int(SR * seconds)
    buf = [0.0] * n
    for start, freq, tau, amp in notes:
        s0 = int(start * SR)
        for i in range(s0, n):
            t = (i - s0) / SR
            attack = min(1.0, t / 0.004)
            v = 0.0
            for mult, a, tmul in PARTIALS:
                v += a * math.exp(-t / (tau * tmul)) * math.sin(2 * math.pi * freq * mult * t)
            buf[i] += amp * attack * v
    # fade the last 30 ms so nothing clicks
    fade = int(0.03 * SR)
    for k in range(fade):
        buf[n - 1 - k] *= k / fade
    top = max(abs(x) for x in buf) or 1.0
    return [x / top * peak for x in buf]

def save(name, samples):
    data = array.array("h", (int(max(-1, min(1, x)) * 32767) for x in samples))
    with wave.open(name, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

out = sys.argv[1]
# pop: one short soft pluck, for "saved" and small checks.
save(f"{out}/pop.wav", render([(0, 987.77, 0.07, 1.0)], 0.22, peak=0.5))
# done: a rising two-note chime, G5 then C6.
save(f"{out}/done.wav", render([(0, 783.99, 0.16, 0.8), (0.085, 1046.5, 0.32, 1.0)], 0.75))
# celebrate: C-E-G-C arpeggio and a soft high shimmer.
save(f"{out}/celebrate.wav", render([
    (0.00, 523.25, 0.25, 0.8), (0.08, 659.25, 0.25, 0.8), (0.16, 783.99, 0.28, 0.85),
    (0.24, 1046.5, 0.55, 1.0), (0.36, 1318.5, 0.6, 0.35), (0.36, 1567.98, 0.6, 0.3),
], 1.45))
# focus: a calm bowl, C5 and G5 with a slow beat.
save(f"{out}/focus.wav", render([
    (0, 523.25, 0.9, 0.7), (0, 524.75, 0.9, 0.4), (0.02, 783.99, 0.8, 0.45),
], 2.0, peak=0.5))
