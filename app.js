/* =========================================================
   VoiceStudio AI — app.js
   Boots the app and wires every module's interactive behaviour.
   Each module section below is self-contained: it reads its own
   view's form fields, calls the matching service, and renders
   the result — following the same error/loading/success pattern
   throughout (see section "Error Handling" in the build brief).
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ================= Landing → App ================= */
  function enterApp(){
    document.getElementById('landing').style.display = 'none';
    document.getElementById('app-shell').style.display = 'grid';
    VSUi.navigateTo('dashboard');
  }
  document.getElementById('landing-start').addEventListener('click', enterApp);
  document.getElementById('landing-demo').addEventListener('click', enterApp);

  /* ================= Boot ================= */
  VSProjects.seedIfEmpty();
  const settings = VSSettings.get();
  VSUi.applyTheme(settings.theme || 'dark');
  vsPopulateLanguageSelect(document.getElementById('set-default-lang'), settings.defaultLanguage);
  vsPopulateVoiceSelect(document.getElementById('set-default-voice'));
  populateAllLanguageSelects();
  populateAllVoiceSelects();
  populateGenreMoodSelects();
  updateDemoPill();

  /* ================= Sidebar / Topbar / Nav ================= */
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => VSUi.navigateTo(el.dataset.view));
  });
  document.getElementById('menu-toggle').addEventListener('click', VSUi.openSidebar);
  document.getElementById('sidebar-scrim').addEventListener('click', VSUi.closeSidebar);
  document.getElementById('theme-toggle').addEventListener('click', VSUi.toggleTheme);
  document.getElementById('topbar-theme').addEventListener('click', VSUi.toggleTheme);
  document.getElementById('bn-more-btn').addEventListener('click', VSUi.openSidebar);

  function updateDemoPill(){
    const pill = document.getElementById('mode-pill');
    if (!pill) return;
    pill.style.display = VSSettings.isDemoMode() ? 'flex' : 'none';
  }

  function populateAllLanguageSelects(){
    ['tts-lang','clone-lang','dub-target-lang','pod-lang','ab-lang','mus-lang','lyr-lang','char-lang'].forEach(id => {
      vsPopulateLanguageSelect(document.getElementById(id), 'English');
    });
  }
  function populateAllVoiceSelects(){
    ['tts-voice','dub-voice','ab-narrator'].forEach(id => {
      const all = VSVoicesForSelect();
      vsPopulateVoiceSelect(document.getElementById(id), all);
    });
  }
  function VSVoicesForSelect(){
    return VS_VOICE_CATALOGUE.concat(VSProjects.allVoices().map(v => ({ id:v.id, name:v.name, category:v.category||'Custom' })));
  }
  document.addEventListener('vs:voices-changed', populateAllVoiceSelects);

  function populateGenreMoodSelects(){
    const setOpts = (id, arr) => { const el = document.getElementById(id); if (el) el.innerHTML = arr.map(x=>`<option>${x}</option>`).join(''); };
    setOpts('mus-genre', VS_GENRES); setOpts('lyr-genre', VS_GENRES);
    setOpts('mus-mood', VS_MOODS); setOpts('lyr-mood', VS_MOODS);
  }

  /* ================= New Project modal ================= */
  document.getElementById('proj-new-btn').addEventListener('click', () => VSUi.openModal('new-project-modal'));
  document.getElementById('modal-close').addEventListener('click', () => VSUi.closeModal('new-project-modal'));
  document.getElementById('new-project-modal').addEventListener('click', (e) => { if (e.target.id === 'new-project-modal') VSUi.closeModal('new-project-modal'); });
  document.getElementById('np-create').addEventListener('click', () => {
    const name = document.getElementById('np-name').value.trim() || 'Untitled project';
    const type = document.getElementById('np-type').value;
    VSProjects.create({ name, type });
    VSUi.closeModal('new-project-modal');
    document.getElementById('np-name').value = '';
    VSUi.renderProjectsView(); VSUi.renderDashboard();
    VSUi.toast('Project created','success');
  });

  /* ================= Projects view filters ================= */
  ['proj-search','proj-filter','proj-sort'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', VSUi.renderProjectsView);
    el.addEventListener('change', VSUi.renderProjectsView);
  });

  /* =========================================================
     TEXT TO SPEECH
     ========================================================= */
  (function initTts(){
    const textEl = document.getElementById('tts-text');
    const charCount = document.getElementById('tts-charcount');
    const speed = document.getElementById('tts-speed'), speedVal = document.getElementById('tts-speed-val');
    const pitch = document.getElementById('tts-pitch'), pitchVal = document.getElementById('tts-pitch-val');
    const volume = document.getElementById('tts-volume'), volumeVal = document.getElementById('tts-volume-val');
    const status = document.getElementById('tts-status');
    const player = VSAudio.bindPlayer(document.getElementById('tts-player'));
    let lastResult = null;

    VSUi.wireChipGroup(document.getElementById('tts-category'));

    function updateCount(){ charCount.textContent = textEl.value.length; }
    textEl.addEventListener('input', updateCount); updateCount();
    speed.addEventListener('input', () => speedVal.textContent = Number(speed.value).toFixed(2) + 'x');
    pitch.addEventListener('input', () => pitchVal.textContent = pitch.value);
    volume.addEventListener('input', () => volumeVal.textContent = volume.value + '%');

    document.getElementById('tts-preview').addEventListener('click', () => {
      const ok = VSTtsService.speakPreview({
        text: textEl.value, rate: Number(speed.value), pitch: Number(pitch.value), volume: Number(volume.value)/100,
        lang: document.getElementById('tts-lang').value === 'Hindi' ? 'hi-IN' : 'en-US'
      });
      status.textContent = ok ? 'Playing live preview via your browser\u2019s speech engine…' : 'Speech preview is not supported in this browser.';
    });

    document.getElementById('tts-generate').addEventListener('click', async () => {
      if (!textEl.value.trim()){ status.textContent = 'Enter some text first.'; status.className='field-hint err-text'; return; }
      setBusy(true, 'Generating speech…');
      const res = await VSTtsService.generateSpeech({
        text: textEl.value, language: document.getElementById('tts-lang').value,
        voiceId: document.getElementById('tts-voice').value, category: VSUi.activeChip(document.getElementById('tts-category')),
        speed: Number(speed.value), pitch: Number(pitch.value), volume: Number(volume.value),
        emotion: document.getElementById('tts-emotion').value, pauseMs: Number(document.getElementById('tts-pause').value)
      });
      setBusy(false);
      if (!res.ok){ showError(status, res.error || 'Unable to generate audio. Please try again.'); return; }
      lastResult = res.data;
      player.load(res.data.audioUrl);
      status.innerHTML = res.demo
        ? 'Generated a <span class="badge badge-demo">DEMO MODE</span> placeholder clip — connect a TTS provider in Settings for real AI speech.'
        : 'Speech generated successfully.';
      status.className = 'field-hint';
    });

    document.getElementById('tts-download').addEventListener('click', () => {
      if (!lastResult){ VSUi.toast('Generate speech first.','error'); return; }
      downloadBlobUrl(lastResult.audioUrl, 'voicestudio-speech.wav');
    });

    document.getElementById('tts-player-speed').addEventListener('change', (e) => player.setSpeed(Number(e.target.value)));

    document.getElementById('tts-add-project').addEventListener('click', () => {
      if (!lastResult){ VSUi.toast('Generate speech first.','error'); return; }
      VSProjects.create({ name: (textEl.value.slice(0,32)||'Speech') , type:'Speech', durationSec: lastResult.durationSec||2, audioBlob: lastResult.blob });
      VSUi.toast('Added to My Projects','success');
    });

    function setBusy(isBusy, label){
      status.textContent = isBusy ? label : status.textContent;
      status.className = 'field-hint';
      document.getElementById('tts-generate').disabled = isBusy;
    }
  })();

  /* =========================================================
     VOICE CLONING
     ========================================================= */
  (function initCloning(){
    let sampleBlob = null, sampleUrl = null, recDuration = 0;
    let vsRecorder = null, stopWaveform = null;

    VSUi.wireTabs('#view-cloning .tab-btn', 'tab', (tab) => {
      document.getElementById('clone-tab-upload').style.display = tab === 'upload' ? 'block' : 'none';
      document.getElementById('clone-tab-record').style.display = tab === 'record' ? 'block' : 'none';
    });

    VSAudio.renderStaticWaveform(document.getElementById('clone-waveform'), { seed:'clone-idle', bars:48 });

    document.getElementById('clone-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      sampleBlob = f; sampleUrl = URL.createObjectURL(f);
      recDuration = 0;
      document.getElementById('clone-download-btn').disabled = false;
      checkCloneReady();
      VSUi.toast('Voice sample loaded: ' + f.name, 'success');
    });

    const recBtn = document.getElementById('clone-record-btn');
    const pauseBtn = document.getElementById('clone-pause-btn');
    const stopBtn = document.getElementById('clone-stop-btn');
    const playBtn = document.getElementById('clone-play-btn');
    const downloadSampleBtn = document.getElementById('clone-download-btn');
    const rerecordBtn = document.getElementById('clone-rerecord-btn');
    const indicator = document.getElementById('clone-rec-indicator');
    const timeEl = document.getElementById('clone-rec-time');
    const qualityEl = document.getElementById('clone-quality');
    let previewAudio = null;

    recBtn.addEventListener('click', async () => {
      vsRecorder = createVSRecorder({
        onTick: (t) => { timeEl.textContent = VSAudio.fmtTime(t); },
        onStop: ({ blob, url, duration }) => {
          sampleBlob = blob; sampleUrl = url; recDuration = duration;
          qualityEl.textContent = 'Audio quality: ' + VSAudio.estimateQuality(duration, blob.size);
          indicator.style.visibility = 'hidden';
          playBtn.disabled = false; downloadSampleBtn.disabled = false; rerecordBtn.disabled = false;
          recBtn.disabled = false; recBtn.textContent = 'Record';
          pauseBtn.disabled = true; stopBtn.disabled = true;
          if (stopWaveform) stopWaveform();
          checkCloneReady();
        },
        onError: (msg) => VSUi.toast(msg, 'error')
      });
      const stream = await vsRecorder.start();
      if (!stream) return;
      indicator.style.visibility = 'visible';
      recBtn.disabled = true; pauseBtn.disabled = false; stopBtn.disabled = false;
      stopWaveform = VSAudio.attachLiveWaveform(document.getElementById('clone-waveform'), stream);
    });
    pauseBtn.addEventListener('click', () => {
      if (!vsRecorder) return;
      if (vsRecorder.getState() === 'recording'){ vsRecorder.pause(); pauseBtn.textContent = 'Resume'; }
      else { vsRecorder.resume(); pauseBtn.textContent = 'Pause'; }
    });
    stopBtn.addEventListener('click', () => vsRecorder && vsRecorder.stop());
    playBtn.addEventListener('click', () => {
      if (!sampleUrl) return;
      if (previewAudio) previewAudio.pause();
      previewAudio = new Audio(sampleUrl);
      previewAudio.play().catch(()=>{});
    });
    // REAL download: this is genuinely your own recorded/uploaded sample — a real file, free,
    // useful on its own even before any voice-cloning provider is ever connected.
    downloadSampleBtn.addEventListener('click', () => {
      if (!sampleUrl){ VSUi.toast('Record or upload a sample first.','error'); return; }
      const ext = sampleBlob && sampleBlob.type && sampleBlob.type.includes('webm') ? 'webm' : (sampleBlob && sampleBlob.name ? sampleBlob.name.split('.').pop() : 'webm');
      downloadBlobUrl(sampleUrl, 'voice-sample.' + ext);
    });
    rerecordBtn.addEventListener('click', () => {
      sampleBlob = null; sampleUrl = null; recDuration = 0;
      playBtn.disabled = true; downloadSampleBtn.disabled = true; rerecordBtn.disabled = true;
      timeEl.textContent = '0:00'; qualityEl.textContent = 'Audio quality: —';
      VSAudio.renderStaticWaveform(document.getElementById('clone-waveform'), { seed:'clone-idle', bars:48 });
      checkCloneReady();
    });

    const consent = document.getElementById('clone-consent');
    const createBtn = document.getElementById('clone-create-btn');
    consent.addEventListener('change', checkCloneReady);
    function checkCloneReady(){
      createBtn.disabled = !(consent.checked && sampleBlob);
    }

    renderCloneVoiceList();
    function renderCloneVoiceList(){
      const root = document.getElementById('clone-voice-list');
      const voices = VSProjects.allVoices().filter(v => v.category === 'Cloned');
      root.innerHTML = voices.length ? voices.map(VSUi.voiceCardHtml).join('')
        : `<div class="empty-state">No cloned voices yet.</div>`;
      VSUi.wireVoiceCardActions(root);
    }

    createBtn.addEventListener('click', async () => {
      const status = document.getElementById('clone-status');
      createBtn.disabled = true;
      status.textContent = 'Creating voice…'; status.className = 'field-hint';
      const res = await VSVoiceService.cloneVoice({
        name: document.getElementById('clone-name').value.trim() || 'Untitled Voice',
        description: document.getElementById('clone-desc').value.trim(),
        language: document.getElementById('clone-lang').value,
        sampleBlob, consentGiven: consent.checked
      });
      if (!res.ok){ showError(status, res.error || 'Unable to create voice. Please try again.'); createBtn.disabled = false; return; }
      const d = res.data;
      VSProjects.addVoice({ name:d.name, description:d.description, language:d.language, category:'Cloned', remoteAudioUrl:d.previewUrl });
      document.dispatchEvent(new CustomEvent('vs:voices-changed'));
      status.innerHTML = res.demo
        ? 'Voice profile created in <span class="badge badge-demo">DEMO MODE</span> — connect a voice-cloning provider in Settings to generate a real cloned-voice preview.'
        : 'Voice created successfully.';
      status.className = 'field-hint';
      renderCloneVoiceList();
      VSUi.renderVoiceStudioVoices();
      document.getElementById('clone-name').value=''; document.getElementById('clone-desc').value='';
      checkCloneReady();
    });
  })();

  /* =========================================================
     AI DUBBING
     ========================================================= */
  (function initDubbing(){
    let uploadedFileName = null;
    const originalText = document.getElementById('dub-original-text');
    const translatedText = document.getElementById('dub-translated-text');
    const player = VSAudio.bindPlayer(document.getElementById('view-dubbing').querySelector('.player'));

    document.getElementById('dub-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      uploadedFileName = f.name;
      originalText.textContent = `Loaded: ${f.name} (${(f.size/1024/1024).toFixed(2)} MB)`;
    });

    const steps = Array.from(document.querySelectorAll('#dub-steps .step-item'));
    function setStep(name, state){
      steps.forEach(s => {
        if (s.dataset.step !== name) return;
        s.classList.remove('active','done');
        if (state) s.classList.add(state);
      });
    }
    function markDone(name){ setStep(name, 'done'); }

    document.getElementById('dub-start-btn').addEventListener('click', async () => {
      if (!uploadedFileName){ VSUi.toast('Upload an audio or video file first.','error'); return; }
      steps.forEach(s => s.classList.remove('active','done'));
      const btn = document.getElementById('dub-start-btn'); btn.disabled = true;

      setStep('upload','active'); await VSApiClient.delay(400); markDone('upload');

      setStep('transcribe','active');
      const trRes = await VSDubbingService.transcribeAudio({ fileName: uploadedFileName, language: document.getElementById('dub-source-lang').value });
      if (!trRes.ok){ showToastError(trRes.error); btn.disabled=false; return; }
      originalText.textContent = trRes.data.text;
      markDone('transcribe');

      setStep('translate','active');
      const targetLang = document.getElementById('dub-target-lang').value;
      const trans = await VSDubbingService.translateText({ text: trRes.data.text, targetLanguage: targetLang });
      if (!trans.ok){ showToastError(trans.error); btn.disabled=false; return; }
      translatedText.value = trans.data.translatedText;
      markDone('translate');

      setStep('voice','active');
      const dub = await VSDubbingService.dubAudio({ translatedText: trans.data.translatedText, targetVoiceId: document.getElementById('dub-voice').value, targetLanguage: targetLang });
      if (!dub.ok){ showToastError(dub.error); btn.disabled=false; return; }
      markDone('voice');

      setStep('sync','active'); await VSApiClient.delay(500); markDone('sync');
      setStep('final','active'); await VSApiClient.delay(400); markDone('final');

      player.load(dub.data.audioUrl);
      VSProjects.create({ name: `Dubbed — ${uploadedFileName}`, type:'Dubbing', durationSec: dub.data.durationSec||3, audioBlob: dub.data.blob });
      VSUi.toast(dub.demo ? 'Dubbing complete (DEMO MODE placeholder audio).' : 'Dubbing complete.', 'success');
      btn.disabled = false;
    });

    function showToastError(msg){ VSUi.toast(msg || 'Something went wrong. Please try again.', 'error'); }
  })();

  /* =========================================================
     PODCAST STUDIO
     ========================================================= */
  (function initPodcast(){
    VSUi.wireChipGroup(document.getElementById('pod-style'));
    const scriptOut = document.getElementById('pod-script-output');
    const speakersSel = document.getElementById('pod-speakers');
    const speakerRoot = document.getElementById('pod-speaker-cards');

    function renderSpeakerCards(){
      const n = Number(speakersSel.value);
      const voices = VSVoicesForSelect();
      let html = '';
      for (let i=1;i<=n;i++){
        html += `<div class="card speaker-card">
          <div class="speaker-tag">HOST ${i}</div>
          <select class="pod-speaker-voice" data-idx="${i}">${voices.map(v=>`<option value="${v.id}">${v.name}</option>`).join('')}</select>
        </div>`;
      }
      speakerRoot.innerHTML = html;
    }
    speakersSel.addEventListener('change', renderSpeakerCards);
    renderSpeakerCards();

    function collectOpts(){
      return {
        title: document.getElementById('pod-title').value, topic: document.getElementById('pod-topic').value,
        description: document.getElementById('pod-desc').value, duration: document.getElementById('pod-duration').value,
        language: document.getElementById('pod-lang').value, speakers: speakersSel.value,
        audience: document.getElementById('pod-audience').value, style: VSUi.activeChip(document.getElementById('pod-style')),
        tone: document.getElementById('pod-tone').value
      };
    }

    document.getElementById('pod-outline-btn').addEventListener('click', async () => {
      const btn = document.getElementById('pod-outline-btn'); btn.disabled = true;
      const res = await VSPodcastService.generateOutline(collectOpts());
      btn.disabled = false;
      if (!res.ok){ VSUi.toast(res.error,'error'); return; }
      scriptOut.value = res.data.outline;
      VSUi.toast('Outline generated','success');
    });
    document.getElementById('pod-script-btn').addEventListener('click', async () => {
      const btn = document.getElementById('pod-script-btn'); btn.disabled = true;
      const res = await VSPodcastService.generateScript(collectOpts());
      btn.disabled = false;
      if (!res.ok){ VSUi.toast(res.error,'error'); return; }
      scriptOut.value = res.data.script;
      VSUi.toast('Script generated','success');
    });
    document.getElementById('pod-regen-btn').addEventListener('click', async () => {
      const res = await VSPodcastService.generateScript(Object.assign(collectOpts(), { script: scriptOut.value }));
      if (res.ok) { scriptOut.value = res.data.script; VSUi.toast('Section regenerated','success'); }
    });
    document.getElementById('pod-audio-btn').addEventListener('click', async () => {
      if (!scriptOut.value.trim()){ VSUi.toast('Generate or write a script first.','error'); return; }
      const btn = document.getElementById('pod-audio-btn'); btn.disabled = true;
      const res = await VSPodcastService.generatePodcastAudio(Object.assign(collectOpts(), { script: scriptOut.value }));
      btn.disabled = false;
      if (!res.ok){ VSUi.toast(res.error,'error'); return; }
      const proj = VSProjects.create({ name: document.getElementById('pod-title').value || 'Untitled Podcast', type:'Podcast', durationSec: res.data.durationSec||60, audioBlob: res.data.blob });
      VSUi.toast(res.demo ? 'Episode audio generated (DEMO MODE placeholder).' : 'Episode audio generated.', 'success');
      VSUi.renderDashboard();
      window._vsLastPodcastAudio = res.data.audioUrl;
    });
    document.getElementById('pod-export-btn').addEventListener('click', () => {
      if (!window._vsLastPodcastAudio){ VSUi.toast('Generate audio first.','error'); return; }
      downloadBlobUrl(window._vsLastPodcastAudio, 'podcast-episode.wav');
    });

    // REAL free listen: reads the script aloud using the browser's own voices, alternating
    // a different voice per HOST so a 2-host script actually sounds like a conversation.
    const podPauseBtn = document.getElementById('pod-pause-btn');
    const podStopBtn = document.getElementById('pod-stop-btn');
    function showPodReadingControls(){ podPauseBtn.style.display = 'inline-flex'; podPauseBtn.textContent = '⏸ Pause'; podStopBtn.style.display = 'inline-flex'; }
    function hidePodReadingControls(){ podPauseBtn.style.display = 'none'; podStopBtn.style.display = 'none'; podPauseBtn.textContent = '⏸ Pause'; }
    podPauseBtn.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused){
        window.speechSynthesis.pause(); podPauseBtn.textContent = '▶ Resume';
      } else if (window.speechSynthesis.paused){
        window.speechSynthesis.resume(); podPauseBtn.textContent = '⏸ Pause';
      }
    });
    podStopBtn.addEventListener('click', () => { window.speechSynthesis.cancel(); hidePodReadingControls(); });

    document.getElementById('pod-listen-btn').addEventListener('click', () => {
      const script = scriptOut.value.trim();
      if (!script){ VSUi.toast('Generate or write a script first.','error'); return; }
      if (!('speechSynthesis' in window)){ VSUi.toast('Speech playback isn\u2019t supported in this browser.','error'); return; }
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const voices = window.speechSynthesis.getVoices();
        const lines = script.split('\n').map(l => l.trim()).filter(Boolean);
        const hostVoiceFor = (label) => {
          const n = /HOST\s*2/i.test(label) ? 1 : 0; // HOST 1 -> voices[0], HOST 2/others -> voices[1]
          return voices[n % Math.max(1, voices.length)] || null;
        };
        let queue = lines.length ? lines : [script];
        let i = 0;
        let liveUtterance = null; // keep a live reference — Safari can garbage-collect an unreferenced utterance mid-speech
        function speakNext(){
          if (i >= queue.length) { liveUtterance = null; hidePodReadingControls(); return; }
          const line = queue[i++];
          const m = line.match(/^([A-Za-z0-9 ]+):\s*(.*)$/);
          const speaker = m ? m[1] : '';
          const text = m ? m[2] : line;
          const utter = new SpeechSynthesisUtterance(text || line);
          const v = hostVoiceFor(speaker);
          if (v) utter.voice = v;
          utter.onend = speakNext;
          utter.onerror = speakNext;
          liveUtterance = utter;
          window.speechSynthesis.speak(utter);
        }
        window.speechSynthesis.resume();
        speakNext();
        showPodReadingControls();
      }, 60);
      VSUi.toast('Reading the script aloud with your browser\u2019s voices — real audio, free, alternating by speaker.', 'info', 4000);
    });
  })();

  /* =========================================================
     AUDIOBOOK STUDIO
     ========================================================= */
  (function initAudiobook(){
    const speed = document.getElementById('ab-speed'), speedVal = document.getElementById('ab-speed-val');
    speed.addEventListener('input', () => speedVal.textContent = Number(speed.value).toFixed(2)+'x');

    /* Real client-side PDF text extraction via Mozilla's pdf.js (CDN, free, no backend). */
    let pdfjsLibPromise = null;
    function loadPdfJs(){
      if (!pdfjsLibPromise){
        pdfjsLibPromise = import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.min.mjs')
          .then((lib) => {
            lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.worker.min.mjs';
            return lib;
          });
      }
      return pdfjsLibPromise;
    }
    async function extractPdfText(file){
      const pdfjsLib = await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++){
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + '\n\n';
      }
      return text.trim();
    }

    document.getElementById('ab-file').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      const isTxt = f.type === 'text/plain' || f.name.toLowerCase().endsWith('.txt');
      if (isTxt){
        const text = await f.text();
        document.getElementById('ab-text').value = text;
        VSUi.toast('Loaded ' + f.name, 'success');
      } else if (isPdf){
        VSUi.toast('Extracting text from PDF…', 'info', 6000);
        try {
          const text = await extractPdfText(f);
          if (!text){
            VSUi.toast('No selectable text found — this PDF may be scanned images rather than real text.', 'error', 5500);
            return;
          }
          document.getElementById('ab-text').value = text;
          VSUi.toast('Extracted text from ' + f.name, 'success');
        } catch (err){
          VSUi.toast('Could not read this PDF. Try a different file, or copy/paste the text directly.', 'error', 5000);
        }
      } else {
        VSUi.toast('DOCX uploaded: ' + f.name + '. DOCX text extraction needs a connected backend — convert to PDF or TXT first, or paste text directly.', 'info', 5500);
      }
    });

    let chapters = [];
    const listRoot = document.getElementById('ab-chapter-list');
    const combineBtn = document.getElementById('ab-combine-btn');
    const abPauseBtn = document.getElementById('ab-pause-btn');
    const abStopBtn = document.getElementById('ab-stop-btn');

    function showReadingControls(){
      abPauseBtn.style.display = 'inline-flex'; abPauseBtn.textContent = '⏸ Pause';
      abStopBtn.style.display = 'inline-flex';
    }
    function hideReadingControls(){
      abPauseBtn.style.display = 'none'; abStopBtn.style.display = 'none'; abPauseBtn.textContent = '⏸ Pause';
    }
    abPauseBtn.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused){
        window.speechSynthesis.pause(); abPauseBtn.textContent = '▶ Resume';
      } else if (window.speechSynthesis.paused){
        window.speechSynthesis.resume(); abPauseBtn.textContent = '⏸ Pause';
      }
    });
    abStopBtn.addEventListener('click', () => { VSTtsService.stopPreview(); hideReadingControls(); });

    function renderChapters(){
      if (!chapters.length){ listRoot.innerHTML = `<div class="empty-state">Split your manuscript to see chapters here.</div>`; combineBtn.disabled = true; return; }
      listRoot.innerHTML = chapters.map((c,i) => `
        <div class="chapter-row" data-idx="${i}">
          <div>
            <div class="chapter-title">${VSUi.escapeHtml(c.title)}</div>
            <div class="chapter-meta">${c.body.split(/\s+/).length} words ${c.durationSec ? '· ' + VSAudio.fmtTime(c.durationSec) + ' generated' : '· not generated'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-teal ab-listen-btn" data-idx="${i}">🔊 Listen (free)</button>
            <button class="btn btn-sm ab-preview-btn" data-idx="${i}" ${c.audioUrl?'':'disabled'}>Preview</button>
            <button class="btn btn-sm ab-gen-btn" data-idx="${i}">${c.audioUrl?'Regenerate':'Generate'}</button>
            <button class="btn btn-sm btn-ghost ab-download-btn" data-idx="${i}" ${c.audioUrl?'':'disabled'}>Download</button>
          </div>
        </div>`).join('');
      listRoot.querySelectorAll('.ab-listen-btn').forEach(b => b.addEventListener('click', () => {
        const c = chapters[b.dataset.idx];
        VSTtsService.speakPreview({
          text: c.body, rate: Number(speed.value),
          lang: document.getElementById('ab-lang').value === 'Hindi' ? 'hi-IN' : 'en-US',
          onEnd: hideReadingControls
        });
        showReadingControls();
        VSUi.toast('Reading chapter aloud using your browser\u2019s built-in voice — real audio, free, no provider needed.', 'info', 4000);
      }));
      listRoot.querySelectorAll('.ab-preview-btn').forEach(b => b.addEventListener('click', () => {
        const c = chapters[b.dataset.idx]; if (c.audioUrl){ new Audio(c.audioUrl).play().catch(()=>{}); }
      }));
      listRoot.querySelectorAll('.ab-download-btn').forEach(b => b.addEventListener('click', () => {
        const c = chapters[b.dataset.idx]; if (c.audioUrl) downloadBlobUrl(c.audioUrl, c.title.replace(/\s+/g,'_')+'.wav');
      }));
      listRoot.querySelectorAll('.ab-gen-btn').forEach(b => b.addEventListener('click', () => genChapter(Number(b.dataset.idx))));
      combineBtn.disabled = !chapters.some(c => c.audioUrl);
    }

    async function genChapter(idx){
      const c = chapters[idx];
      const res = await VSAudiobookService.generateChapterAudio({
        title:c.title, body:c.body, narratorVoiceId: document.getElementById('ab-narrator').value,
        language: document.getElementById('ab-lang').value, speed: Number(speed.value)
      });
      if (!res.ok){ VSUi.toast(res.error,'error'); return; }
      chapters[idx] = Object.assign(c, res.data);
      renderChapters();
    }

    document.getElementById('ab-split-btn').addEventListener('click', () => {
      const text = document.getElementById('ab-text').value;
      chapters = VSAudiobookService.splitIntoChapters(text);
      if (!chapters.length){ VSUi.toast('Paste manuscript text or upload a .txt/.pdf file first.','error'); return; }
      renderChapters();
      VSUi.toast(`Split into ${chapters.length} chapter${chapters.length>1?'s':''}`, 'success');
    });

    document.getElementById('ab-generate-all-btn').addEventListener('click', async () => {
      if (!chapters.length){ VSUi.toast('Split into chapters first.','error'); return; }
      for (let i=0;i<chapters.length;i++) await genChapter(i);
      VSUi.toast('All chapters generated','success');
    });

    combineBtn.addEventListener('click', async () => {
      const ready = chapters.filter(c=>c.audioUrl);
      if (!ready.length){ VSUi.toast('Generate at least one chapter first.','error'); return; }
      const res = await VSAudiobookService.combineChapters({
        chapters: ready, title: document.getElementById('ab-title').value || 'Untitled Audiobook',
        author: document.getElementById('ab-author').value, narratorVoiceId: document.getElementById('ab-narrator').value
      });
      if (!res.ok){ VSUi.toast(res.error,'error'); return; }
      VSProjects.create({ name: res.data.title, type:'Audiobook', durationSec: res.data.durationSec||60, audioBlob: res.data.blob });
      VSUi.renderDashboard();
      VSUi.toast(res.demo ? 'Audiobook combined (DEMO MODE placeholder audio).' : 'Audiobook combined.', 'success');
    });

    // Clears the manuscript/chapters currently being worked on, so you can start a different book.
    // (To delete an already-saved audiobook project, use the "..." menu on its card in My Projects.)
    document.getElementById('ab-delete-btn').addEventListener('click', () => {
      if (!chapters.length && !document.getElementById('ab-text').value.trim()){
        VSUi.toast('Nothing to delete — the workspace is already empty.', 'info'); return;
      }
      if (!confirm('Clear this manuscript and all its chapters? This cannot be undone.')) return;
      VSTtsService.stopPreview(); hideReadingControls();
      chapters.forEach(c => { if (c.audioUrl) URL.revokeObjectURL(c.audioUrl); });
      chapters = [];
      document.getElementById('ab-title').value = '';
      document.getElementById('ab-author').value = '';
      document.getElementById('ab-text').value = '';
      document.getElementById('ab-file').value = '';
      renderChapters();
      VSUi.toast('Book cleared — ready for a new one.', 'success');
    });

    renderChapters();
  })();

  /* =========================================================
     MUSIC STUDIO + LYRICS
     ========================================================= */
  (function initMusic(){
    VSUi.wireTabs('#view-music .tab-btn', 'mtab', (tab) => {
      document.getElementById('music-tab-music').style.display = tab === 'music' ? 'grid' : 'none';
      document.getElementById('music-tab-lyrics').style.display = tab === 'lyrics' ? 'grid' : 'none';
    });

    const tempo = document.getElementById('mus-tempo'), tempoVal = document.getElementById('mus-tempo-val');
    tempo.addEventListener('input', () => tempoVal.textContent = tempo.value);

    const player = VSAudio.bindPlayer(document.getElementById('view-music').querySelector('#music-tab-music .player'));
    let lastMusic = null;

    async function generate(){
      const btn = document.getElementById('mus-generate-btn'); btn.disabled = true;
      const opts = {
        description: document.getElementById('mus-desc').value, genre: document.getElementById('mus-genre').value,
        mood: document.getElementById('mus-mood').value, tempo: Number(tempo.value),
        duration: Number(document.getElementById('mus-duration').value), language: document.getElementById('mus-lang').value,
        vocal: document.getElementById('mus-vocal').value
      };
      const res = await VSMusicService.generateMusic(opts);
      btn.disabled = false;
      if (!res.ok){ VSUi.toast(res.error,'error'); return; }
      lastMusic = res.data;
      player.load(res.data.audioUrl);
      VSAudio.renderStaticWaveform(document.getElementById('mus-waveform'), { seed: opts.description||'music', bars:56 });
      VSProjects.create({ name: opts.description.slice(0,32) || 'Untitled Track', type:'Music', durationSec: res.data.durationSec||30, audioBlob: res.data.blob });
      VSUi.renderDashboard();
      VSUi.toast(res.demo ? 'Track generated (DEMO MODE placeholder — see licensing note).' : 'Track generated.', 'success');
    }
    document.getElementById('mus-generate-btn').addEventListener('click', generate);
    document.getElementById('mus-regen-btn').addEventListener('click', generate);
    document.getElementById('mus-download-btn').addEventListener('click', () => {
      if (!lastMusic){ VSUi.toast('Generate a track first.','error'); return; }
      downloadBlobUrl(lastMusic.audioUrl, 'voicestudio-music.wav');
    });

    document.getElementById('lyr-generate-btn').addEventListener('click', async () => {
      const btn = document.getElementById('lyr-generate-btn'); btn.disabled = true;
      const res = await VSMusicService.generateLyrics({
        topic: document.getElementById('lyr-topic').value, language: document.getElementById('lyr-lang').value,
        mood: document.getElementById('lyr-mood').value, genre: document.getElementById('lyr-genre').value,
        structure: document.getElementById('lyr-structure').value
      });
      btn.disabled = false;
      if (!res.ok){ VSUi.toast(res.error,'error'); return; }
      document.getElementById('lyr-output').value = res.data.lyrics;
      VSUi.toast('Lyrics generated','success');
    });
    document.getElementById('lyr-send-btn').addEventListener('click', () => {
      const lyrics = document.getElementById('lyr-output').value;
      if (!lyrics.trim()){ VSUi.toast('Generate lyrics first.','error'); return; }
      document.getElementById('mus-desc').value = lyrics.slice(0, 400);
      document.querySelector('#view-music .tab-btn[data-mtab="music"]').click();
      VSUi.toast('Lyrics added to Music Studio description','success');
    });
  })();

  /* =========================================================
     CHARACTER VOICES
     ========================================================= */
  (function initCharacters(){
    document.getElementById('char-examples').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      document.getElementById('char-desc').value = chip.textContent;
    });

    // REAL free listen: reads a sample line aloud with the browser's own voice, with rate/pitch
    // nudged by simple honest keyword cues from the description (not AI voice acting — just a
    // real, free approximation using what the browser already gives us).
    document.getElementById('char-listen-btn').addEventListener('click', () => {
      const desc = (document.getElementById('char-desc').value || '').toLowerCase();
      const name = document.getElementById('char-name').value.trim() || 'this character';
      if (!desc.trim()){ VSUi.toast('Describe the character voice first.','error'); return; }
      let rate = 1, pitch = 0;
      if (/deep|wizard|warrior|giant|monster|villain/.test(desc)) pitch -= 6;
      if (/child|kid|small|tiny|mouse/.test(desc)) pitch += 6;
      if (/robot|machine|ai\b/.test(desc)) { rate = 0.85; pitch -= 2; }
      if (/energetic|excited|fast|sports|commentator/.test(desc)) rate = 1.25;
      if (/calm|meditation|slow|peaceful|old|elder|storyteller/.test(desc)) rate = 0.85;
      const sample = `Hello, I am ${name}. ${document.getElementById('char-desc').value}`;
      VSTtsService.speakPreview({ text: sample, rate, pitch, lang: document.getElementById('char-lang').value === 'Hindi' ? 'hi-IN' : 'en-US' });
      VSUi.toast('Reading a sample line with your browser\u2019s voice, shaped by the description — real audio, free.', 'info', 4000);
    });

    const player = VSAudio.bindPlayer(document.getElementById('view-characters').querySelector('.player'));
    let lastVoice = null;

    document.getElementById('char-generate-btn').addEventListener('click', async () => {
      const desc = document.getElementById('char-desc').value.trim();
      if (!desc){ VSUi.toast('Describe the character voice first.','error'); return; }
      const btn = document.getElementById('char-generate-btn'); btn.disabled = true;
      const res = await VSVoiceService.generateCharacterVoice({
        name: document.getElementById('char-name').value.trim() || 'Untitled Character',
        description: desc, age: document.getElementById('char-age').value, gender: document.getElementById('char-gender').value,
        emotion: document.getElementById('char-emotion').value, language: document.getElementById('char-lang').value
      });
      btn.disabled = false;
      if (!res.ok){ VSUi.toast(res.error,'error'); return; }
      lastVoice = res.data;
      player.load(res.data.audioUrl);
      VSUi.toast(res.demo ? 'Character voice generated (DEMO MODE placeholder audio).' : 'Character voice generated.', 'success');
    });

    document.getElementById('char-save-btn').addEventListener('click', () => {
      if (!lastVoice){ VSUi.toast('Generate a character voice first.','error'); return; }
      VSProjects.addVoice({ name:lastVoice.name, description:lastVoice.description, language:lastVoice.language, category:'Character', audioBlob:lastVoice.blob });
      document.dispatchEvent(new CustomEvent('vs:voices-changed'));
      renderCharList();
      VSUi.renderVoiceStudioVoices();
      VSUi.toast('Saved to My Voices','success');
    });

    function renderCharList(){
      const root = document.getElementById('char-voice-list');
      const voices = VSProjects.allVoices().filter(v => v.category === 'Character');
      root.innerHTML = voices.length ? voices.map(VSUi.voiceCardHtml).join('') : `<div class="empty-state">No character voices saved yet.</div>`;
      VSUi.wireVoiceCardActions(root);
    }
    renderCharList();
  })();

  /* =========================================================
     AUDIO EDITOR
     ========================================================= */
  (function initEditor(){
    let currentBuffer = null;    // real, editable AudioBuffer
    let currentBlobUrl = null;   // playable object URL rendered from currentBuffer
    const audio = new Audio();
    const clip = document.getElementById('edit-clip');
    const status = document.getElementById('edit-status');
    let historyStack = []; // stack of previous AudioBuffers, for real Undo

    function setStatus(msg, cls){ status.textContent = msg; status.className = 'field-hint' + (cls ? ' '+cls : ''); }

    /** Re-render playable audio + waveform from the current in-memory buffer (after any real edit). */
    function refreshFromBuffer(){
      const blob = VSAudio.audioBufferToWavBlob(currentBuffer);
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = URL.createObjectURL(blob);
      const wasPlaying = !audio.paused;
      audio.src = currentBlobUrl;
      if (wasPlaying) audio.play().catch(()=>{});
      renderClipWave();
    }

    function pushHistory(){ if (currentBuffer) historyStack.push(currentBuffer); if (historyStack.length > 10) historyStack.shift(); }

    async function loadFile(f){
      setStatus('Decoding ' + f.name + '…');
      try {
        currentBuffer = await VSAudio.decodeAudioFile(f);
        historyStack = [];
        refreshFromBuffer();
        setStatus('Imported ' + f.name + ' — ' + VSAudio.fmtTime(VSAudio.bufferDuration(currentBuffer)) + ' loaded.');
      } catch (err){
        setStatus('Could not read this audio file.', 'err-text');
      }
    }

    document.getElementById('edit-import').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      loadFile(f);
    });

    function renderClipWave(){
      clip.innerHTML = '';
      let seedArr = null;
      if (currentBuffer){
        const data = currentBuffer.getChannelData(0);
        const bars = 40, step = Math.max(1, Math.floor(data.length / bars));
        seedArr = [];
        for (let i=0;i<bars;i++){
          let peak = 0;
          for (let j=i*step; j<Math.min(data.length,(i+1)*step); j++) peak = Math.max(peak, Math.abs(data[j]));
          seedArr.push(peak);
        }
      }
      for (let i=0;i<40;i++){
        const s=document.createElement('span');
        const h = seedArr ? Math.max(4, Math.round(seedArr[i]*52)) : (6+Math.round(Math.random()*28));
        s.style.height = h+'px';
        clip.appendChild(s);
      }
    }
    renderClipWave();

    let vsRecorder = null, stopWave = null;
    document.getElementById('edit-record-btn').addEventListener('click', async () => {
      const btn = document.getElementById('edit-record-btn');
      if (btn.textContent === 'Record'){
        vsRecorder = createVSRecorder({
          onStop: async ({ blob }) => {
            setStatus('Decoding recording…');
            try {
              currentBuffer = await VSAudio.decodeAudioFile(blob);
              historyStack = [];
              refreshFromBuffer();
              setStatus('Recording captured — ' + VSAudio.fmtTime(VSAudio.bufferDuration(currentBuffer)) + '.');
            } catch(err){ setStatus('Could not decode the recording.', 'err-text'); }
          },
          onError: (msg) => VSUi.toast(msg,'error')
        });
        const stream = await vsRecorder.start();
        if (!stream) return;
        btn.textContent = 'Stop Recording';
        stopWave = VSAudio.attachLiveWaveform(document.getElementById('edit-track'), stream);
      } else {
        vsRecorder.stop(); btn.textContent = 'Record'; if (stopWave) stopWave();
      }
    });

    document.getElementById('edit-play').addEventListener('click', () => { if (audio.src) audio.play().catch(()=>{}); });
    document.getElementById('edit-pause').addEventListener('click', () => audio.pause());
    document.getElementById('edit-stop').addEventListener('click', () => { audio.pause(); audio.currentTime = 0; });

    function requireBuffer(){
      if (!currentBuffer){ setStatus('Import or record audio first.', 'err-text'); return false; }
      return true;
    }

    // REAL trim: auto-trims near-silent leading/trailing audio via genuine amplitude analysis.
    document.getElementById('edit-trim').addEventListener('click', () => {
      if (!requireBuffer()) return;
      pushHistory();
      const before = VSAudio.bufferDuration(currentBuffer);
      currentBuffer = VSAudio.trimSilence(currentBuffer);
      const after = VSAudio.bufferDuration(currentBuffer);
      refreshFromBuffer();
      setStatus(`Trimmed silence: ${VSAudio.fmtTime(before)} → ${VSAudio.fmtTime(after)}.`, 'success-text');
    });

    // REAL fades: genuine linear gain envelope applied to the actual samples.
    document.getElementById('edit-fadein').addEventListener('click', () => {
      if (!requireBuffer()) return;
      pushHistory();
      VSAudio.applyFades(currentBuffer, { fadeInSec: Math.min(2, VSAudio.bufferDuration(currentBuffer)/3) });
      refreshFromBuffer();
      setStatus('Fade in applied.', 'success-text');
    });
    document.getElementById('edit-fadeout').addEventListener('click', () => {
      if (!requireBuffer()) return;
      pushHistory();
      VSAudio.applyFades(currentBuffer, { fadeOutSec: Math.min(2, VSAudio.bufferDuration(currentBuffer)/3) });
      refreshFromBuffer();
      setStatus('Fade out applied.', 'success-text');
    });

    // Cut/Split/Merge need a real range-selection UI (drag handles on the timeline), which this
    // build doesn't have yet — being honest here rather than faking a result.
    ['cut','split','merge'].forEach(action => {
      document.getElementById('edit-'+action).addEventListener('click', () => {
        setStatus(`${action[0].toUpperCase()+action.slice(1)} needs a timeline range selected — not available in this build yet. Trim and Fade In/Out work for real right now.`, 'err-text');
      });
    });

    document.getElementById('edit-undo').addEventListener('click', () => {
      if (!historyStack.length){ setStatus('Nothing to undo.'); return; }
      currentBuffer = historyStack.pop();
      refreshFromBuffer();
      setStatus('Undone.');
    });
    document.getElementById('edit-redo').addEventListener('click', () => {
      setStatus('Redo isn\u2019t available yet — Undo keeps one step of history.');
    });

    const vol = document.getElementById('edit-volume'), volVal = document.getElementById('edit-volume-val');
    vol.addEventListener('input', () => { volVal.textContent = vol.value+'%'; audio.volume = Number(vol.value)/100; });
    document.getElementById('edit-speed').addEventListener('change', (e) => audio.playbackRate = Number(e.target.value));
    document.getElementById('edit-mute').addEventListener('change', (e) => audio.muted = e.target.checked);

    document.getElementById('edit-bgmusic').addEventListener('change', (e) => {
      if (e.target.files[0]) setStatus('Background music loaded: ' + e.target.files[0].name + ' (mixing it in requires the paid-provider pipeline — not yet wired up client-side).');
    });

    // REAL export: renders the actual edited buffer (trim/fades included, volume baked in) to a real downloadable WAV.
    document.getElementById('edit-export-btn').addEventListener('click', () => {
      if (!requireBuffer()) return;
      const gain = Number(vol.value) / 100;
      let exportBuffer = currentBuffer;
      if (gain !== 1){
        const AudioCtxCls = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const offline = new AudioCtxCls(currentBuffer.numberOfChannels, currentBuffer.length, currentBuffer.sampleRate);
        exportBuffer = offline.createBuffer(currentBuffer.numberOfChannels, currentBuffer.length, currentBuffer.sampleRate);
        for (let c=0;c<currentBuffer.numberOfChannels;c++){
          const src = currentBuffer.getChannelData(c), dst = exportBuffer.getChannelData(c);
          for (let i=0;i<src.length;i++) dst[i] = src[i] * gain;
        }
      }
      const blob = VSAudio.audioBufferToWavBlob(exportBuffer);
      const url = URL.createObjectURL(blob);
      downloadBlobUrl(url, 'voicestudio-edit.wav');
      VSProjects.create({ name:'Audio Edit', type:'Audio Edit', durationSec: VSAudio.bufferDuration(exportBuffer), audioBlob: blob });
      VSUi.renderDashboard();
      setStatus('Exported — real WAV file, your actual edited audio.', 'success-text');
    });
  })();

  /* =========================================================
     SETTINGS
     ========================================================= */
  (function initSettings(){
    VSUi.wireTabs('#view-settings .tab-btn', 'stab', (tab) => {
      ['profile','app','api','privacy','about'].forEach(t => {
        document.getElementById('settings-'+t).style.display = t === tab ? 'block' : 'none';
      });
    });

    const s = VSSettings.get();
    document.getElementById('set-name').value = s.profile.name || '';
    document.getElementById('set-email').value = s.profile.email || '';
    document.getElementById('set-theme').value = s.theme;
    document.getElementById('set-ui-lang').value = s.uiLanguage;
    document.getElementById('set-api-base').value = s.apiBaseUrl || '';
    document.getElementById('set-demo-mode').checked = s.demoMode !== false;

    document.getElementById('set-profile-save').addEventListener('click', () => {
      VSSettings.update({ profile: { name: document.getElementById('set-name').value, email: document.getElementById('set-email').value } });
      VSUi.toast('Profile saved','success');
    });
    document.getElementById('set-app-save').addEventListener('click', () => {
      const theme = document.getElementById('set-theme').value;
      VSSettings.update({
        uiLanguage: document.getElementById('set-ui-lang').value, theme,
        audioQuality: document.getElementById('set-audio-quality').value,
        defaultSpeed: document.getElementById('set-default-speed').value,
        defaultVoice: document.getElementById('set-default-voice').value,
        defaultLanguage: document.getElementById('set-default-lang').value
      });
      VSUi.applyTheme(theme);
      VSUi.toast('Preferences saved','success');
    });
    document.getElementById('set-api-save').addEventListener('click', () => {
      VSSettings.update({ apiBaseUrl: document.getElementById('set-api-base').value.trim(), demoMode: document.getElementById('set-demo-mode').checked });
      updateDemoPill();
      VSUi.toast('API configuration saved','success');
    });

    // Lists the ACTUAL voices installed on this device/browser — the real, honest answer to
    // "which languages can Listen (free) speak", since that's controlled by the OS, not this app.
    document.getElementById('set-check-voices-btn').addEventListener('click', () => {
      const listEl = document.getElementById('set-voices-list');
      function render(){
        const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
        if (!voices.length){ listEl.innerHTML = '<span class="err-text">No voices reported yet — try tapping the button again in a second.</span>'; return; }
        const langs = {};
        voices.forEach(v => { (langs[v.lang] = langs[v.lang] || []).push(v.name); });
        const rows = Object.keys(langs).sort().map(lang =>
          `<div style="padding:4px 0;border-bottom:1px solid var(--border-soft);"><strong>${lang}</strong> — ${langs[lang].join(', ')}</div>`
        ).join('');
        listEl.innerHTML = `<div style="max-height:220px;overflow-y:auto;">${rows}</div><p class="field-hint" style="margin-top:8px;">${voices.length} voice${voices.length!==1?'s':''} found. Indian-language codes to look for: hi-IN (Hindi), ta-IN (Tamil), te-IN (Telugu), mr-IN (Marathi), bn-IN (Bengali), gu-IN (Gujarati), kn-IN (Kannada), ml-IN (Malayalam), pa-IN (Punjabi), ur-IN/ur-PK (Urdu). If a language isn\u2019t listed here, this device can\u2019t speak it for free — only a paid provider could.</p>`;
      }
      render();
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = render;
    });
  })();

  /* =========================================================
     HELP
     ========================================================= */
  (function initHelp(){
    const search = document.getElementById('help-search');
    const items = Array.from(document.querySelectorAll('#help-topics .help-item'));
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      items.forEach(item => {
        const match = !q || item.textContent.toLowerCase().includes(q);
        item.style.display = match ? '' : 'none';
        if (q && match) item.open = true;
      });
    });
  })();

  /* ================= Helpers ================= */
  function showError(el, msg){ el.textContent = msg; el.className = 'field-hint err-text'; }
  function downloadBlobUrl(url, filename){
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ================= PWA: service worker ================= */
  if ('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {/* offline install is best-effort */});
    });
  }

  /* Ensure speechSynthesis voice list is loaded (some browsers populate async) */
  if ('speechSynthesis' in window){
    window.speechSynthesis.onvoiceschanged = () => {};
  }
});
