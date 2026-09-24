/* =========================================================
   VoiceStudio AI — services/podcast-service.js
   Outline → script → audio, for a 1–4 speaker episode.
   ========================================================= */

const VSPodcastService = (() => {

  async function generateOutline(opts){
    return VSApiClient.run({
      path: '/podcast/outline',
      payload: opts,
      simulate: async () => ({
        outline:
`1. Cold open — why "${opts.topic || 'this topic'}" matters to ${opts.audience || 'the audience'}
2. Introductions (${opts.speakers || 2} speaker${(opts.speakers||2) > 1 ? 's' : ''})
3. Main discussion: three key points about ${opts.topic || 'the topic'}
4. Listener take-away / practical next step
5. Close and sign-off

[DEMO MODE outline — connect a language provider in Settings → API Configuration for AI-written outlines tailored to "${opts.title || 'your episode'}".]`
      })
    });
  }

  async function generateScript(opts){
    const twoHost = Number(opts.speakers) >= 2;
    return VSApiClient.run({
      path: '/podcast/script',
      payload: opts,
      simulate: async () => ({
        script: twoHost
? `HOST 1: Welcome back — today we're talking about ${opts.topic || 'today\'s topic'}.
HOST 2: I've been looking forward to this one. Where should we start?
HOST 1: Let's start with why it matters for ${opts.audience || 'our listeners'}...
HOST 2: That's a great point. [DEMO MODE script — connect a language provider for a fully AI-written conversation.]`
: `NARRATOR: Welcome back — today we're talking about ${opts.topic || 'today\'s topic'}. [DEMO MODE script placeholder.]`
      })
    });
  }

  async function generatePodcastAudio(opts){
    const durationSec = Math.min(10, Math.max(2, (opts.script || '').length / 60));
    return VSApiClient.run({
      path: '/podcast/audio',
      payload: opts,
      simulate: async () => {
        const blob = await VSAudio.synthesizePlaceholderTone(durationSec, { freq: 150, variant: 0 });
        return { audioUrl: URL.createObjectURL(blob), blob, durationSec };
      },
      minDelay: 1000, maxDelay: 1800
    });
  }

  return { generateOutline, generateScript, generatePodcastAudio };
})();
