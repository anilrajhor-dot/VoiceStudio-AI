/* =========================================================
   VoiceStudio AI — audio.js
   Web Audio API helpers: waveform bar rendering (live from a
   MediaStream, or decorative for generated/placeholder audio),
   a reusable <audio> element + .player UI binder, and small
   formatting utilities used across every module.
   ========================================================= */

const VSAudio = (() => {

  function fmtTime(sec){
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  /** Fill a .waveform container with N bars at random-ish heights (decorative, seeded by a string so the same content looks the same). */
  function renderStaticWaveform(container, opts = {}){
    if (!container) return;
    const bars = opts.bars || 64;
    const seed = opts.seed || String(Math.random());
    let h = 0; for (let i=0;i<seed.length;i++) h = (h*31 + seed.charCodeAt(i)) >>> 0;
    const rand = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    container.innerHTML = '';
    for (let i=0;i<bars;i++){
      const bar = document.createElement('span');
      const t = i / bars;
      const envelope = Math.sin(t * Math.PI); // taper at both ends like a real clip
      const height = Math.max(3, Math.round((0.25 + rand()*0.75) * envelope * 48));
      bar.style.height = height + 'px';
      container.appendChild(bar);
    }
  }

  /** Live waveform driven by an AnalyserNode while recording. Returns a stop() function. */
  function attachLiveWaveform(container, stream, opts = {}){
    if (!container || !stream) return () => {};
    const bars = opts.bars || 48;
    container.innerHTML = '';
    container.classList.add('recording');
    const els = [];
    for (let i=0;i<bars;i++){
      const el = document.createElement('span');
      el.style.height = '4px';
      container.appendChild(el);
      els.push(el);
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = null;
    function tick(){
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / bars) || 1;
      for (let i=0;i<bars;i++){
        const v = data[i*step] || 0;
        els[i].style.height = Math.max(4, Math.round((v/255)*48)) + 'px';
      }
      raf = requestAnimationFrame(tick);
    }
    tick();
    return function stop(){
      if (raf) cancelAnimationFrame(raf);
      container.classList.remove('recording');
      try { src.disconnect(); analyser.disconnect(); ctx.close(); } catch(e){}
    };
  }

  /**
   * Wire a `.player` block (play button + track + time labels) to an
   * HTMLAudioElement. Works for recorded blobs, uploaded files, or any
   * object URL. Returns a controller with load/destroy.
   */
  function bindPlayer(playerEl, { onEnded } = {}){
    if (!playerEl) return null;
    const playBtn = playerEl.querySelector('.player-play');
    const track = playerEl.querySelector('.player-track');
    const fill = track ? track.querySelector('span') : null;
    const times = playerEl.querySelectorAll('.player-times span');
    const audio = new Audio();
    audio.preload = 'metadata';

    function setPlayIcon(playing){
      if (!playBtn) return;
      playBtn.innerHTML = playing
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }

    function updateProgress(){
      if (!audio.duration || !isFinite(audio.duration)) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      if (fill) fill.style.width = pct + '%';
      if (times.length === 2){
        times[0].textContent = fmtTime(audio.currentTime);
        times[1].textContent = fmtTime(audio.duration);
      }
    }

    playBtn && playBtn.addEventListener('click', () => {
      if (!audio.src) return;
      if (audio.paused) audio.play().catch(()=>{}); else audio.pause();
    });
    audio.addEventListener('play', () => setPlayIcon(true));
    audio.addEventListener('pause', () => setPlayIcon(false));
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('ended', () => { setPlayIcon(false); onEnded && onEnded(); });
    track && track.addEventListener('click', (e) => {
      if (!audio.duration) return;
      const rect = track.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pct * audio.duration;
    });

    return {
      audio,
      load(srcUrl){
        audio.src = srcUrl;
        if (fill) fill.style.width = '0%';
        if (times.length === 2){ times[0].textContent='0:00'; times[1].textContent='0:00'; }
      },
      setSpeed(rate){ audio.playbackRate = rate; },
      play(){ audio.play().catch(()=>{}); },
      pause(){ audio.pause(); },
      destroy(){ audio.pause(); audio.src=''; }
    };
  }

  /** Estimate a rough "audio quality" label from recorded blob size vs. duration (demo heuristic, not a real analyzer). */
  function estimateQuality(durationSec, blobBytes){
    if (!durationSec) return '—';
    const kbps = (blobBytes * 8 / 1024) / durationSec;
    if (kbps > 96) return 'Good';
    if (kbps > 40) return 'Fair';
    return 'Low — try a quieter room';
  }

  /**
   * Render a short placeholder tone to a real WAV Blob using an
   * OfflineAudioContext. Used ONLY for DEMO MODE outputs (TTS,
   * dubbing, podcast, audiobook, music, character voices) when no
   * AI provider is connected, so the player has real, playable audio
   * rather than a fake "success" with nothing behind it. The UI must
   * always label this clearly as DEMO MODE, never as real AI output.
   */
  async function synthesizePlaceholderTone(durationSec = 2, { freq = 220, variant = 0 } = {}){
    durationSec = Math.min(Math.max(durationSec, 0.6), 12); // keep demo clips short
    const sampleRate = 44100;
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OfflineCtx(1, Math.ceil(sampleRate * durationSec), sampleRate);
    const notes = [freq, freq*1.25, freq*1.5, freq*1.125];
    let t = 0;
    const step = durationSec / notes.length;
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = variant % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
      gain.gain.setValueAtTime(0.18, t + step - 0.08);
      gain.gain.linearRampToValueAtTime(0, t + step);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + step);
      t += step;
    });
    const rendered = await ctx.startRendering();
    return audioBufferToWavBlob(rendered);
  }

  function audioBufferToWavBlob(buffer){
    const numCh = buffer.numberOfChannels;
    const len = buffer.length * numCh * 2 + 44;
    const arrBuf = new ArrayBuffer(len);
    const view = new DataView(arrBuf);
    const writeStr = (o,s) => { for (let i=0;i<s.length;i++) view.setUint8(o+i, s.charCodeAt(i)); };
    writeStr(0,'RIFF'); view.setUint32(4, len-8, true); writeStr(8,'WAVE');
    writeStr(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
    view.setUint16(22,numCh,true); view.setUint32(24,buffer.sampleRate,true);
    view.setUint32(28,buffer.sampleRate*numCh*2,true); view.setUint16(32,numCh*2,true); view.setUint16(34,16,true);
    writeStr(36,'data'); view.setUint32(40, len-44, true);
    let offset = 44;
    const chData = []; for (let c=0;c<numCh;c++) chData.push(buffer.getChannelData(c));
    for (let i=0;i<buffer.length;i++){
      for (let c=0;c<numCh;c++){
        let s = Math.max(-1, Math.min(1, chData[c][i]));
        view.setInt16(offset, s < 0 ? s*0x8000 : s*0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([arrBuf], { type:'audio/wav' });
  }

  return { fmtTime, renderStaticWaveform, attachLiveWaveform, bindPlayer, estimateQuality, synthesizePlaceholderTone };
})();
