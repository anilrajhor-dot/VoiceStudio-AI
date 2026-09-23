/* =========================================================
   VoiceStudio AI — services/dubbing-service.js
   The dubbing pipeline: transcribe → translate → generate
   voice → synchronise → finalise. Each stage is its own
   function so a real backend can swap in independently
   (e.g. a dedicated transcription provider + a separate
   translation provider + a separate voice provider).
   ========================================================= */

const VSDubbingService = (() => {

  async function transcribeAudio({ fileName, language }){
    return VSApiClient.run({
      path: '/transcribe',
      payload: { fileName, language },
      simulate: async () => ({
        text: `[DEMO MODE transcript placeholder for "${fileName || 'uploaded file'}". Connect a transcription provider in Settings → API Configuration to see real text here.]`,
        detectedLanguage: language && language !== 'Auto-detect' ? language : 'English'
      }),
      minDelay: 600, maxDelay: 1100
    });
  }

  async function translateText({ text, targetLanguage }){
    return VSApiClient.run({
      path: '/translate',
      payload: { text, targetLanguage },
      simulate: async () => ({
        translatedText: `[DEMO MODE — translated into ${targetLanguage}. Connect a translation provider to generate a real translated script.]`
      }),
      minDelay: 500, maxDelay: 900
    });
  }

  async function dubAudio({ translatedText, targetVoiceId, targetLanguage }){
    const durationSec = 2.6;
    return VSApiClient.run({
      path: '/dubbing',
      payload: { translatedText, targetVoiceId, targetLanguage },
      simulate: async () => {
        const blob = await VSAudio.synthesizePlaceholderTone(durationSec, { freq: 180, variant: 3 });
        return { audioUrl: URL.createObjectURL(blob), durationSec };
      },
      minDelay: 900, maxDelay: 1600
    });
  }

  return { transcribeAudio, translateText, dubAudio };
})();
