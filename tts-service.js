/* =========================================================
   VoiceStudio AI — services/tts-service.js
   generateSpeech(): the one function the UI calls. Routes to
   POST /api/tts on a connected backend, or simulates in DEMO
   MODE. Also exposes a genuinely real browser-based preview
   via the SpeechSynthesis API (not a simulation — it's actual
   speech synthesis, just not the connected AI provider's voice).
   ========================================================= */

const VSTtsService = (() => {

  /**
   * @param {object} opts { text, language, voiceId, category, speed, pitch, volume, emotion, pauseMs }
   * @returns {Promise<{ok, demo, data:{audioUrl, blob, durationSec}, error}>}
   */
  async function generateSpeech(opts){
    const durationSec = Math.max(1.2, Math.min(12, (opts.text || '').length / 16));
    const result = await VSApiClient.run({
      path: '/tts',
      payload: opts,
      simulate: async () => {
        const blob = await VSAudio.synthesizePlaceholderTone(durationSec, { freq: 200, variant: 1 });
        return { audioUrl: URL.createObjectURL(blob), blob, durationSec };
      }
    });
    return result;
  }

  /** Real (non-demo) spoken preview using the browser's own speech engine — for quick listening only. */
  function speakPreview({ text, rate = 1, pitch = 0, volume = 1, lang = 'en-US', onEnd }){
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text || '');
    utter.rate = Math.max(0.5, Math.min(2, rate));
    utter.pitch = Math.max(0, Math.min(2, 1 + pitch/10));
    utter.volume = Math.max(0, Math.min(1, volume));
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0,2)));
    if (match) utter.voice = match;
    if (onEnd) utter.onend = onEnd;
    window.speechSynthesis.speak(utter);
    return true;
  }
  function stopPreview(){
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  return { generateSpeech, speakPreview, stopPreview };
})();
