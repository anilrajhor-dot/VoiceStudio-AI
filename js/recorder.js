/* =========================================================
   VoiceStudio AI — recorder.js
   Thin wrapper around getUserMedia + MediaRecorder so every
   module (Voice Cloning, Audio Editor) shares one recording
   implementation: record / pause / resume / stop, duration
   ticking, and a Blob + object URL on completion.
   ========================================================= */

function createVSRecorder({ onTick, onStop, onError } = {}){
  let stream = null;
  let recorder = null;
  let chunks = [];
  let startedAt = 0;
  let elapsedBeforePause = 0;
  let tickInterval = null;
  let state = 'idle'; // idle | recording | paused | stopped

  function pickMimeType(){
    const candidates = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'];
    for (const c of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  }

  async function start(){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      onError && onError('Microphone access is not supported in this browser.');
      return null;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e){
      onError && onError('Microphone permission was denied or unavailable.');
      return null;
    }
    chunks = [];
    const mimeType = pickMimeType();
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (e){
      recorder = new MediaRecorder(stream);
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const duration = elapsedBeforePause + (Date.now() - startedAt) / 1000;
      stopTicking();
      stream && stream.getTracks().forEach(t => t.stop());
      state = 'stopped';
      onStop && onStop({ blob, url, duration });
    };
    recorder.start();
    startedAt = Date.now();
    elapsedBeforePause = 0;
    state = 'recording';
    startTicking();
    return stream;
  }

  function startTicking(){
    stopTicking();
    tickInterval = setInterval(() => {
      const elapsed = elapsedBeforePause + (Date.now() - startedAt) / 1000;
      onTick && onTick(elapsed);
    }, 200);
  }
  function stopTicking(){ if (tickInterval) clearInterval(tickInterval); tickInterval = null; }

  function pause(){
    if (state !== 'recording' || !recorder) return;
    recorder.pause();
    elapsedBeforePause += (Date.now() - startedAt) / 1000;
    state = 'paused';
    stopTicking();
  }
  function resume(){
    if (state !== 'paused' || !recorder) return;
    recorder.resume();
    startedAt = Date.now();
    state = 'recording';
    startTicking();
  }
  function stop(){
    if (!recorder || state === 'stopped' || state === 'idle') return;
    recorder.stop();
  }
  function getState(){ return state; }
  function getStream(){ return stream; }

  return { start, pause, resume, stop, getState, getStream };
}
