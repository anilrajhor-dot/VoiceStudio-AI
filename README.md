# VoiceStudio AI

**Create Voices • Podcasts • Audiobooks • Dubbing • Music**

VoiceStudio AI is a provider-agnostic, browser-based AI audio creation workspace. It runs entirely client-side (HTML5 / CSS3 / vanilla ES6+), works offline as an installable PWA, and is architected so real AI providers can be plugged in behind a clean service layer without touching the interface.

---

## 1. Project structure

```
/
├── index.html
├── manifest.json
├── service-worker.js
├── README.md
│
├── css/
│   ├── style.css          # design tokens + all component styles
│   └── responsive.css     # tablet/mobile breakpoints, bottom nav
│
├── js/
│   ├── app.js              # boot + per-module event wiring
│   ├── ui.js                # navigation, toasts, modal, dashboard/project rendering
│   ├── audio.js             # waveform rendering, player binding, WAV helpers
│   ├── recorder.js          # MediaRecorder wrapper (mic recording)
│   ├── projects.js          # project + voice CRUD (localStorage)
│   ├── storage.js           # localStorage/IndexedDB layer + shared constants
│   ├── settings.js          # settings get/set, demo-mode flag, API_BASE_URL
│   └── services/
│       ├── api-client.js        # shared fetch helper + demo-mode simulation
│       ├── tts-service.js       # generateSpeech()
│       ├── voice-service.js     # cloneVoice(), generateCharacterVoice()
│       ├── dubbing-service.js   # transcribeAudio(), translateText(), dubAudio()
│       ├── podcast-service.js   # generateOutline(), generateScript(), generatePodcastAudio()
│       ├── audiobook-service.js # splitIntoChapters(), generateChapterAudio(), combineChapters()
│       └── music-service.js     # generateMusic(), generateLyrics()
│
├── assets/
│   ├── icons/               # PWA icons (SVG + PNG, generated placeholders)
│   └── images/
│
└── api/
    └── README.md             # backend contract for connecting real AI providers
```

## 2. Running locally

No build step is required.

1. Open `index.html` directly in a modern browser, **or**
2. Serve the folder with any static file server for full PWA behaviour (service workers require `http://` / `https://`, not `file://`):
   ```bash
   npx serve .
   # or
   python3 -m http.server 8080
   ```
3. Visit the local URL, click **Start Creating**, and explore every module. The app runs in **DEMO MODE** by default — no AI provider is required to test the interface.

## 3. Deploying to GitHub Pages

1. Push this folder to a GitHub repository (root, or a `docs/` folder).
2. In the repo, go to **Settings → Pages**, choose the branch/folder, and save.
3. GitHub Pages serves static files only — it cannot host the `/api` backend. Deploy that separately (see below) and point **Settings → API Configuration → API_BASE_URL** at it.

## 4. Connecting a backend

This app never puts secret API keys in client-side code. Instead:

1. Stand up a small backend (Node/Express, Python/FastAPI, Cloudflare Workers, etc.) that exposes the endpoints listed in `api/README.md`.
2. Store your real provider keys (speech, voice cloning, transcription, translation, music) as backend environment variables/secrets — never in this repository.
3. In the app, go to **Settings → API Configuration**, set `API_BASE_URL` to your backend's base URL, and uncheck **Run in DEMO MODE**.
4. Every service module (`js/services/*.js`) will now call your backend instead of simulating results.

## 5. Connecting real AI providers

Each service module exposes one clean function per capability (`generateSpeech`, `cloneVoice`, `transcribeAudio`, `translateText`, `generateMusic`, `generatePodcastAudio`, …). To swap providers:

- Implement the matching endpoint in your backend (see `api/README.md` for the expected request/response shape).
- No frontend code changes are required — the UI only ever talks to `VSApiClient`, which talks to your `API_BASE_URL`.
- You can mix providers freely: one provider for speech, another for translation, another for music, etc.

---

## WHAT IS FUNCTIONAL NOW (in the browser, with no backend)

- Full navigation across every module, responsive from desktop to mobile (bottom nav + off-canvas sidebar)
- Dashboard with live stats and recent projects, pulled from local storage
- Real microphone recording (Web Audio API + MediaRecorder) with a live waveform, used in Voice Cloning and the Audio Editor
- A genuinely working Text-to-Speech **preview** using the browser's built-in `speechSynthesis` engine
- Project management: create, rename, duplicate, delete, search, filter, sort — persisted in `localStorage` (metadata) and `IndexedDB` (audio blobs)
- Voice library: save cloned and character voices locally, preview and delete them
- Audiobook manuscript splitting into chapters (pure client-side text processing)
- Audio Editor timeline UI: import, record, trim/cut/split/merge/fade controls, volume, speed, background-music slot, export of whatever is loaded
- PWA installability (manifest + service worker), dark/light theme, offline app-shell caching
- Every AI-generation action (Generate Speech, Clone Voice, Dub, Podcast script/audio, Audiobook chapter audio, Music, Character voice, Lyrics) works end-to-end in **DEMO MODE**: it returns a real, playable placeholder audio clip (a short synthesized tone rendered locally) and clearly labeled demo text, so the whole workflow — including error states — can be tested with no backend at all. Demo output is never presented as real AI-generated content.

## WHAT REQUIRES AN AI API / BACKEND

- Real synthesized speech in a connected provider's voices (beyond the local browser-preview)
- Actual voice cloning from a sample (creating a genuinely new synthetic voice)
- Real speech-to-text transcription and text translation for dubbing
- AI-written podcast outlines/scripts, AI-generated character voice audio, and AI-composed music/lyrics
- PDF/DOCX text extraction for the Audiobook Studio (currently `.txt` and pasted text work fully client-side)
- Noise reduction in the Audio Editor (currently a labeled placeholder toggle)
- Cloud sync / multi-device storage, accounts, subscriptions, payments, and an admin/usage dashboard (the app is architected for these — see `api/README.md` — but none are implemented client-side, by design)

---

## Safety & responsible use

- Voice cloning requires an explicit consent checkbox before any clone request is sent.
- Character voices are for fictional use; the app is not designed to imitate a real, identifiable person without authorization.
- Generated music is never labeled royalty-free, commercial-use-clear, or unlimited unless your connected provider's own license actually says so.
- No fake success states: every generation action either shows a clearly labeled DEMO MODE result or a real result — never a success message with nothing behind it.
