/* =========================================================
   VoiceStudio AI — services/audiobook-service.js
   Splits manuscript text into chapters (local, deterministic —
   no AI call needed) and generates narration per chapter via
   the connected TTS provider, or a DEMO MODE placeholder.
   ========================================================= */

const VSAudiobookService = (() => {

  /** Purely local text splitting — works with or without a backend. */
  function splitIntoChapters(text){
    if (!text || !text.trim()) return [];
    // Split on explicit "Chapter N" headings if present, else on blank-line blocks of ~800 words.
    const chapterHeadingRe = /(^|\n)\s*(chapter\s+\d+[^\n]*)/gi;
    if (chapterHeadingRe.test(text)){
      const parts = text.split(chapterHeadingRe).filter(Boolean);
      const chapters = [];
      for (let i=0;i<parts.length;i++){
        if (/^chapter\s+\d+/i.test(parts[i].trim())){
          const title = parts[i].trim();
          const body = (parts[i+1] || '').trim();
          chapters.push({ title, body });
          i++;
        }
      }
      if (chapters.length) return chapters;
    }
    const words = text.trim().split(/\s+/);
    const wordsPerChapter = 350;
    const chapters = [];
    for (let i=0;i<words.length;i+=wordsPerChapter){
      const body = words.slice(i, i+wordsPerChapter).join(' ');
      chapters.push({ title: `Chapter ${chapters.length+1}`, body });
    }
    return chapters;
  }

  async function generateChapterAudio({ title, body, narratorVoiceId, language, speed }){
    const durationSec = Math.min(12, Math.max(1.5, (body||'').split(/\s+/).length / 30));
    return VSApiClient.run({
      path: '/audiobook/chapter',
      payload: { title, body, narratorVoiceId, language, speed },
      simulate: async () => {
        const blob = await VSAudio.synthesizePlaceholderTone(durationSec, { freq: 190, variant: 1 });
        return { audioUrl: URL.createObjectURL(blob), blob, durationSec };
      },
      minDelay: 500, maxDelay: 1100
    });
  }

  async function combineChapters({ chapters, title, author, narratorVoiceId }){
    const totalSec = chapters.reduce((s,c) => s + (c.durationSec || 2), 0);
    return VSApiClient.run({
      path: '/audiobook/combine',
      payload: { chapterCount: chapters.length, title, author, narratorVoiceId },
      simulate: async () => {
        const blob = await VSAudio.synthesizePlaceholderTone(Math.min(12, totalSec), { freq: 170, variant: 2 });
        return { audioUrl: URL.createObjectURL(blob), blob, durationSec: totalSec, title, author };
      },
      minDelay: 900, maxDelay: 1700
    });
  }

  return { splitIntoChapters, generateChapterAudio, combineChapters };
})();
