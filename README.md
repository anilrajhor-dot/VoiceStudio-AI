# VoiceStudio AI — Backend API contract

This app's frontend never calls an AI provider directly and never stores a
provider API key in client-side code. Instead, every `js/services/*.js`
module POSTs JSON to `${API_BASE_URL}<path>` (configured in **Settings →
API Configuration**). Build a small backend that implements the endpoints
below, keep your real provider keys as backend secrets, and the frontend
needs no changes.

If `API_BASE_URL` is empty, or **DEMO MODE** is checked in Settings, no
network calls are made at all — every module simulates a result locally
(see `js/services/api-client.js`).

All endpoints: `POST`, JSON in, JSON out, `Content-Type: application/json`.

---

## `POST /tts` — Text to Speech
**Request**
```json
{
  "text": "string",
  "language": "English",
  "voiceId": "v-arjun",
  "category": "Narrator",
  "speed": 1.0,
  "pitch": 0,
  "volume": 100,
  "emotion": "Neutral",
  "pauseMs": 250
}
```
**Response**
```json
{ "audioUrl": "https://.../speech.mp3", "durationSec": 12.4 }
```

## `POST /clone` — Voice Cloning
Only called after the user has confirmed consent in the UI.
**Request**: `{ "name", "description", "language" }` plus the audio sample
(recommended: accept multipart/form-data on this endpoint specifically, or
have the backend pull the sample from a short-lived upload URL).
**Response**
```json
{ "voiceId": "string", "name": "string", "description": "string", "language": "string", "previewUrl": "https://.../preview.mp3" }
```

## `POST /voice` — Character Voice generation
**Request**: `{ "name", "description", "age", "gender", "emotion", "language" }`
**Response**: `{ "voiceId", "name", "description", "language", "audioUrl", "durationSec" }`

## `POST /transcribe` — Dubbing step 1
**Request**: `{ "fileName", "language" }` (or an uploaded audio/video reference)
**Response**: `{ "text": "string", "detectedLanguage": "string" }`

## `POST /translate` — Dubbing step 2
**Request**: `{ "text", "targetLanguage" }`
**Response**: `{ "translatedText": "string" }`

## `POST /dubbing` — Dubbing step 3 (voice generation + sync)
**Request**: `{ "translatedText", "targetVoiceId", "targetLanguage" }`
**Response**: `{ "audioUrl": "string", "durationSec": number }`

## `POST /podcast/outline`
**Request**: `{ "title", "topic", "description", "duration", "language", "speakers", "audience", "style", "tone" }`
**Response**: `{ "outline": "string" }`

## `POST /podcast/script`
**Request**: same as outline, plus optional `"outline"` or existing `"script"` to revise.
**Response**: `{ "script": "string" }`

## `POST /podcast/audio`
**Request**: `{ ...podcast fields, "script" }`
**Response**: `{ "audioUrl": "string", "durationSec": number }`

## `POST /audiobook/chapter`
**Request**: `{ "title", "body", "narratorVoiceId", "language", "speed" }`
**Response**: `{ "audioUrl": "string", "durationSec": number }`

## `POST /audiobook/combine`
**Request**: `{ "chapterCount", "title", "author", "narratorVoiceId" }`
**Response**: `{ "audioUrl": "string", "durationSec": number, "title", "author" }`

## `POST /music`
**Request**: `{ "description", "genre", "mood", "tempo", "duration", "language", "vocal" }`
**Response**: `{ "audioUrl": "string", "durationSec": number, "licenseNote": "string" }`

## `POST /music/lyrics`
**Request**: `{ "topic", "language", "mood", "genre", "structure" }`
**Response**: `{ "lyrics": "string" }`

---

## Errors
Return a non-2xx status on failure. The frontend shows a generic
`"API connection unavailable."` message and offers Retry; include a `message`
field in the JSON body if you want that surfaced instead:
```json
{ "message": "Your audio file is too large." }
```

## Suggested provider mapping (swap freely)
| Capability | Example providers |
|---|---|
| Speech / TTS | ElevenLabs, Azure Speech, Google Cloud TTS, Amazon Polly |
| Voice cloning | ElevenLabs, Resemble AI, PlayHT |
| Transcription | Whisper (OpenAI), Deepgram, Azure Speech-to-Text |
| Translation | DeepL, Google Cloud Translation, Azure Translator |
| Music generation | Suno API, Stability Audio, Google MusicLM-class APIs |
| Script/outline/lyrics text | Any LLM API |

Never claim "royalty-free" or "commercial rights" for generated music or
voices in the frontend unless the provider you connect actually grants that
in its own license — see the note in `js/services/music-service.js`.
