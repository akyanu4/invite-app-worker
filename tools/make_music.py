"""
Generates original, royalty-free background music for a template (music-box / bell style).

  python tools/make_music.py <lullaby|party> <out.m4a> [seconds]

Everything is synthesised here (no samples), so the result can be shared publicly.
"""
import subprocess, sys
import numpy as np

STYLE, OUT = sys.argv[1], sys.argv[2]
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 80
SR = 44100
rng = np.random.default_rng(5)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def bell(freq, dur, amp=0.3, bright=1.0):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 3.2) * np.minimum(1, t * 400)
    tone = (np.sin(2 * np.pi * freq * t) + 0.35 * bright * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t * 4)
            + 0.18 * bright * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-t * 7)
            + 0.08 * np.sin(2 * np.pi * freq * 4.2 * t) * np.exp(-t * 10))
    return amp * env * tone


def pad(freqs, dur, amp=0.05):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.6)
    return amp * env * sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2 * t) for f in freqs) / len(freqs)


def kick(amp=0.5):
    t = np.arange(int(SR * 0.25)) / SR
    f = 110 * np.exp(-t * 18) + 45
    return amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)


def clap(amp=0.12):
    t = np.arange(int(SR * 0.18)) / SR
    return amp * rng.standard_normal(len(t)) * np.exp(-t * 28)


out = np.zeros(int(SR * (SECS + 3)))


def add(sig, at):
    i = int(at * SR)
    j = min(len(out), i + len(sig))
    if i < len(out):
        out[i:j] += sig[: j - i]


if STYLE == 'lullaby':
    bpm, key = 72, 65  # F major, gentle
    prog = [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]]  # I vi IV V
    melody = [[12, 11, 12, 16, 14, 12], [9, 12, 11, 9, 7, 4], [9, 12, 14, 17, 16, 14], [14, 12, 11, 12, 14, 11]]
    beats_per_bar, pattern = 6, [0, 1, 2, 1, 2, 1]  # 6/8 rocking arpeggio
    bright = 0.8
else:  # party / birthday
    bpm, key = 112, 67  # G major, bright
    prog = [[0, 4, 7], [7, 11, 14], [-3, 0, 4], [5, 9, 12]]  # I V vi IV
    melody = [[12, 14, 16, 19, 16, 14, 12, 14], [11, 14, 19, 18, 16, 14, 11, 14],
              [9, 12, 16, 14, 12, 9, 12, 16], [9, 12, 16, 19, 16, 14, 12, 11]]
    beats_per_bar, pattern = 8, [0, 1, 2, 1, 0, 1, 2, 1]
    bright = 1.1

beat = 60 / bpm / (2 if STYLE == 'party' else 1.5)
bar = beat * beats_per_bar
t, k = 0.0, 0
while t < SECS:
    chord = prog[k % len(prog)]
    section = (k // 8) % 2  # every 8 bars the melody moves up for variety
    add(pad([midi(key - 12 + n) for n in chord], bar + 0.6, 0.045), t)
    for b in range(beats_per_bar):
        add(bell(midi(key - 12 + chord[pattern[b]]), 1.6, 0.11, bright * 0.6), t + b * beat)
        if k >= 2:  # melody enters after two bars
            note = melody[k % len(melody)][b % len(melody[0])] + (12 if section and STYLE == 'lullaby' else 0)
            if STYLE == 'lullaby' and b % 2 == 1 and section == 0:
                continue
            add(bell(midi(key + note), 2.2, 0.16, bright), t + b * beat + 0.004)
        if STYLE == 'party' and k >= 4:
            if b % 4 == 0:
                add(kick(), t + b * beat)
            if b % 4 == 2:
                add(clap(), t + b * beat)
    t += bar
    k += 1

# soft room reverb (a few decaying echoes)
wet = np.zeros_like(out)
for d, g in ((0.031, 0.35), (0.047, 0.28), (0.071, 0.22), (0.113, 0.16), (0.173, 0.11)):
    n = int(d * SR)
    wet[n:] += out[:-n] * g
mix = out + wet
end = int(SECS * SR)
mix = mix[:end]
fade = int(3 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
mix[: int(0.5 * SR)] *= np.linspace(0, 1, int(0.5 * SR))
mix = 0.85 * mix / np.max(np.abs(mix))
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR)) * 0.97], axis=1)
pcm = (stereo * 32767).astype('<i2').tobytes()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-',
                '-c:a', 'aac', '-b:a', '160k', OUT], input=pcm, check=True)
print('wrote', OUT)
