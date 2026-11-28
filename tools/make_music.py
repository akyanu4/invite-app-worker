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


def dhum(amp=0.55):  # low dhol stroke with a pitch bend
    t = np.arange(int(SR * 0.45)) / SR
    f = 95 * np.exp(-t * 6) + 55
    return amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)


def tak(amp=0.22):  # sharp high stroke
    t = np.arange(int(SR * 0.12)) / SR
    return amp * (0.6 * rng.standard_normal(len(t)) * np.exp(-t * 60) + np.sin(2 * np.pi * 520 * t) * np.exp(-t * 35))


def timpani(amp=0.35):
    t = np.arange(int(SR * 1.2)) / SR
    return amp * (np.sin(2 * np.pi * 73 * t) + 0.4 * np.sin(2 * np.pi * 110 * t)) * np.exp(-t * 3.5) * np.minimum(1, t * 200)


def strings(freqs, dur, amp=0.05):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 0.7)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.5 * t)
    sig = sum(sum(np.sin(2 * np.pi * f * h * vib * t + h) / h for h in (1, 2, 3, 4)) for f in freqs)
    return amp * env * sig / len(freqs)


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


if STYLE == 'romantic':
    bpm, key = 66, 69  # A minor, tender
    prog = [[-12, 0, 3, 7], [-4, 0, 3, 8], [-9, -2, 3, 7], [-5, -1, 2, 7]]  # i VI III VII (Am F C G)
    melody = [[12, 15, 14, 12, 10, 12], [8, 12, 15, 17, 15, 12], [7, 10, 12, 15, 14, 10], [7, 11, 14, 12, 11, 7]]
    beats_per_bar, pattern = 6, [0, 2, 3, 1, 2, 3]
    bright = 0.7
elif STYLE == 'royal':
    bpm, key = 72, 62  # D major, grand
    prog = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14], [7, 11, 14]]
    melody = [[12, 16, 19, 16], [17, 16, 14, 12], [14, 19, 18, 14], [12, 16, 12, 7],
              [9, 12, 16, 12], [12, 14, 17, 21], [19, 18, 16, 14], [14, 11, 7, 11]]
    beats_per_bar, pattern = 4, [0, 1, 2, 1]
    bright = 0.9
elif STYLE == 'festive':
    bpm, key = 118, 62  # D, Kafi-flavoured (b3, b7)
    prog = [[0, 7, 12], [0, 7, 12], [-2, 5, 10], [0, 7, 12]]
    melody = [[12, 14, 15, 17, 19, 17, 15, 14], [12, 15, 14, 12, 10, 12, 14, 12],
              [10, 12, 14, 15, 17, 15, 14, 10], [12, 14, 12, 10, 7, 10, 12, 12]]
    beats_per_bar, pattern = 8, [0, 1, 2, 1, 0, 1, 2, 1]
    bright = 1.2
beat = 60 / bpm / (2 if STYLE in ('party', 'festive') else 1.5 if STYLE in ('lullaby', 'romantic') else 1)
bar = beat * beats_per_bar
t, k = 0.0, 0
while t < SECS:
    chord = prog[k % len(prog)]
    section = (k // 8) % 2  # every 8 bars the melody moves up for variety
    if STYLE == 'royal':
        add(strings([midi(key - 12 + n) for n in chord], bar + 0.8, 0.06), t)
        if k % 2 == 0:
            add(timpani(), t)
    else:
        add(pad([midi(key - 12 + n) for n in chord], bar + 0.6, 0.045), t)
    for b in range(beats_per_bar):
        add(bell(midi(key - 12 + chord[pattern[b]]), 1.6, 0.11, bright * 0.6), t + b * beat)
        if k >= 2:  # melody enters after two bars
            note = melody[k % len(melody)][b % len(melody[k % len(melody)])] + (12 if section and STYLE in ('lullaby', 'romantic') else 0)
            if STYLE in ('lullaby', 'romantic') and b % 2 == 1 and section == 0:
                continue
            add(bell(midi(key + note), 2.2, 0.16, bright), t + b * beat + 0.004)
        if STYLE == 'festive' and k >= 1:  # keherwa-style dhol: dha ge na ti | na ka dhi na
            if b in (0, 3, 6):
                add(dhum(), t + b * beat)
            if b in (2, 4, 5, 7):
                add(tak(), t + b * beat)
            if b == 1:
                add(tak(0.12), t + b * beat + beat / 2)
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
