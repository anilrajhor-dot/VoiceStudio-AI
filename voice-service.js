/* =========================================================
   VoiceStudio AI — services/voice-service.js
   cloneVoice() and generateCharacterVoice(). Never reports a
   successful clone unless the connected provider (or, in DEMO
   MODE, the local simulation path — clearly labeled) actually
   returns a result. No impersonation workflow: consent is
   enforced by the UI before this is ever called.
   ========================================================= */

const VSVoiceService = (() => {

  /**
   * @param {object} opts { name, description, language, sampleBlob, consentGiven }
   */
  async function cloneVoice(opts){
    if (!opts.consentGiven){
      return { ok:false, error:'Consent confirmation is required before creating a voice clone.' };
    }
    if (!opts.sampleBlob){
      return { ok:false, error:'A voice sample (recorded or uploaded) is required.' };
    }
    const result = await VSApiClient.run({
      path: '/clone',
      payload: { name: opts.name, description: opts.description, language: opts.language },
      simulate: async () => ({
        voiceId: 'clone-' + Date.now(),
        name: opts.name || 'Untitled Voice',
        description: opts.description || '',
        language: opts.language || 'English',
        category: 'Cloned',
        previewUrl: null // demo mode does not fabricate a cloned voice's audio
      })
    });
    return result;
  }

  /**
   * @param {object} opts { name, description, age, gender, emotion, language }
   */
  async function generateCharacterVoice(opts){
    const durationSec = 2.4;
    const result = await VSApiClient.run({
      path: '/voice',
      payload: opts,
      simulate: async () => {
        const blob = await VSAudio.synthesizePlaceholderTone(durationSec, { freq: 160, variant: 2 });
        return {
          voiceId: 'char-' + Date.now(),
          name: opts.name || 'Untitled Character',
          description: opts.description || '',
          language: opts.language || 'English',
          category: 'Character',
          audioUrl: URL.createObjectURL(blob), blob,
          durationSec
        };
      }
    });
    return result;
  }

  return { cloneVoice, generateCharacterVoice };
})();
