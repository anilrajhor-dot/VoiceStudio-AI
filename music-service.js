/* =========================================================
   VoiceStudio AI — services/music-service.js
   generateMusic() and generateLyrics(). Demo output is never
   labelled royalty-free or commercially clear — that claim
   depends entirely on whichever provider is actually connected.
   ========================================================= */

const VSMusicService = (() => {

  async function generateMusic(opts){
    const durationSec = Math.min(12, Math.max(2, (opts.duration || 60) / 10));
    return VSApiClient.run({
      path: '/music',
      payload: opts,
      simulate: async () => {
        const blob = await VSAudio.synthesizePlaceholderTone(durationSec, { freq: 130 + (opts.tempo||100)/2, variant: 0 });
        return { audioUrl: URL.createObjectURL(blob), durationSec, licenseNote: 'DEMO MODE placeholder — no license implied. A connected provider\'s own terms govern real generated tracks.' };
      },
      minDelay: 1200, maxDelay: 2000
    });
  }

  async function generateLyrics(opts){
    return VSApiClient.run({
      path: '/music/lyrics',
      payload: opts,
      simulate: async () => ({
        lyrics:
`[Intro]
A quiet start, a thought about ${opts.topic || 'today'}...

[Verse 1]
Every step forward starts with a name,
${opts.topic || 'this moment'} lighting up the frame.

[Chorus]
We rise, we try, we carry on,
${opts.mood || 'hopeful'} hearts before the dawn.

[Verse 2]
Somewhere between the doubt and the plan,
There's a version of us who understands.

[Bridge]
Hold this feeling, let it grow,
This is ${opts.genre || 'the sound'} we chose to know.

[Chorus]
We rise, we try, we carry on,
${opts.mood || 'hopeful'} hearts before the dawn.

— DEMO MODE lyrics. Connect a language provider in Settings → API Configuration for fully AI-written lyrics.`
      })
    });
  }

  return { generateMusic, generateLyrics };
})();
