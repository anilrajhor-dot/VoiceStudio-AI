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
