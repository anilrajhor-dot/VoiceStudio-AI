/* =========================================================
   VoiceStudio AI — services/api-client.js
   Every service module (tts, voice, dubbing, podcast,
   audiobook, music) routes its network calls through here.

   - No secret API key is ever read, stored, or sent from this
     client-side file. A real deployment puts provider keys on
     the backend named by API_BASE_URL (see /api/README.md).
   - When Settings → API Configuration has no API_BASE_URL, or
     "DEMO MODE" is checked, calls are simulated locally so the
     whole interface stays testable offline.
   ========================================================= */

const VSApiClient = (() => {

  function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

  /**
   * POST JSON to `${API_BASE_URL}${path}`. Returns { ok, data, error }.
   * Never throws — callers just check `ok`.
   */
  async function post(path, payload){
    const base = VSSettings.apiBase();
    if (!base) return { ok:false, error:'No API_BASE_URL configured — running in DEMO MODE.' };
    try {
      const res = await fetch(base.replace(/\/$/,'') + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      if (!res.ok){
        return { ok:false, error: `API connection unavailable (HTTP ${res.status}).` };
      }
      const data = await res.json().catch(() => null);
      return { ok:true, data };
    } catch (e){
      return { ok:false, error: 'API connection unavailable. Please try again.' };
    }
  }

  /**
   * Run an operation in demo mode (simulated) or live mode (real backend).
   * `simulate` is an async fn returning a demo payload with { demo:true }.
   * `live` is the backend path + payload for `post`.
   */
  async function run({ path, payload, simulate, minDelay = 700, maxDelay = 1600 }){
    if (VSSettings.isDemoMode()){
      await delay(minDelay + Math.random() * (maxDelay - minDelay));
      const result = await simulate();
      return { ok:true, demo:true, data: Object.assign({ demo:true }, result) };
    }
    const res = await post(path, payload);
    if (!res.ok) return res;
    return { ok:true, demo:false, data: res.data };
  }

  return { post, run, delay };
})();
