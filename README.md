# Tinnitus Therapy

A browser-based tinnitus therapy tool that guides you through matching your tinnitus frequency and then offers multiple evidence-informed therapy approaches calibrated to that frequency.

**Live demo: [yoogie27.github.io/tinnitus_tuner](https://yoogie27.github.io/tinnitus_tuner/)**

> **Disclaimer:** This application is NOT a medical device and does NOT provide medical treatment.
> We are NOT responsible for any damage to hearing or loudspeakers.
> **Use entirely at your own risk.** Always start at the lowest volume.
> Consult a qualified audiologist for professional tinnitus care.

## Features

### Frequency Matching Wizard

A step-by-step wizard to identify your tinnitus frequency:

1. **Safety disclaimer** with risk acknowledgment
2. **Octave bracketing** — play 12 reference tones (250 Hz – 16 kHz), select the closest
3. **Fine matching** — logarithmic slider with ±0.1 / 1 / 10 / 100 Hz fine-tune buttons and beat-frequency method guidance
4. **Confirmation** — verify your matched frequency before proceeding

### 8 Therapy Approaches

All therapies are calibrated to your matched frequency. Each includes a detailed explanation, research references, adjustable parameters, and safety warnings.

| Therapy | Description |
|---|---|
| **Notched Sound** | Broadband noise with a band-stop filter at your tinnitus frequency (Okamoto et al., 2010) |
| **Narrowband Masking** | Noise centred on your tinnitus frequency with adjustable bandwidth |
| **Broadband Masking** | White / pink / brown noise for general masking and relaxation |
| **Coordinated Reset** | Four tones at Tass-protocol ratios played in random sequences to desynchronise neural activity |
| **Residual Inhibition** | Timed tone exposure (30–60 s) with auto-stop — observe the quiet period afterwards |
| **Amplitude Modulation** | Tinnitus tone with adjustable AM rate (theta / alpha range) |
| **Binaural Beats** | Stereo frequency difference for brainwave entrainment (headphones required) |
| **Phase Cancellation** | 180°-inverted signal at your tinnitus frequency (experimental) |

### Safety System

- Hard gain cap (0.45) — master volume can never exceed this
- Per-waveform attenuation (e.g. square waves at 15%, white noise at 15%)
- DynamicsCompressor brick-wall limiter after master gain
- Smooth fade-in / fade-out on all start / stop transitions
- Visual "LOUD" warning when volume is high
- Persistent disclaimers throughout the application

### Persistence

All settings (matched frequency, therapy parameters, wizard completion) are stored in browser `localStorage`. Returning users skip straight to the therapy hub.

### Advanced Mode

The original manual tuner with full oscillator controls, phase inversion, and oscilloscope visualization is preserved as "Advanced Mode" accessible from the therapy hub.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** with Tailwind CSS v4
- **Web Audio API** for all audio synthesis
- No backend — runs entirely in the browser

## Run Locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

Static output in `dist/` — deploy to any static host.

## Deployment

The app auto-deploys to GitHub Pages on push to `main` via the included GitHub Actions workflow.
