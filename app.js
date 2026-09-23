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
      VSProjects.create({ name: (textEl.value.slice(0,32)||'Speech') , type:'Speech', durationSec: lastResult.durationSec||2 });
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
      checkCloneReady();
      VSUi.toast('Voice sample loaded: ' + f.name, 'success');
    });

    const recBtn = document.getElementById('clone-record-btn');
    const pauseBtn = document.getElementById('clone-pause-btn');
    const stopBtn = document.getElementById('clone-stop-btn');
    const playBtn = document.getElementById('clone-play-btn');
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
          playBtn.disabled = false; rerecordBtn.disabled = false;
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
    rerecordBtn.addEventListener('click', () => {
      sampleBlob = null; sampleUrl = null; recDuration = 0;
      playBtn.disabled = true; rerecordBtn.disabled = true;
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
      VSProjects.addVoice({ name:d.name, description:d.description, language:d.language, category:'Cloned', audioUrl:d.previewUrl });
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
      VSProjects.create({ name: `Dubbed — ${uploadedFileName}`, type:'Dubbing', durationSec: dub.data.durationSec||3 });
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
      const proj = VSProjects.create({ name: document.getElementById('pod-title').value || 'Untitled Podcast', type:'Podcast', durationSec: res.data.durationSec||60 });
      VSUi.toast(res.demo ? 'Episode audio generated (DEMO MODE placeholder).' : 'Episode audio generated.', 'success');
      VSUi.renderDashboard();
      window._vsLastPodcastAudio = res.data.audioUrl;
    });
    document.getElementById('pod-export-btn').addEventListener('click', () => {
      if (!window._vsLastPodcastAudio){ VSUi.toast('Generate audio first.','error'); return; }
      downloadBlobUrl(window._vsLastPodcastAudio, 'podcast-episode.wav');
    });
  })();

  /* =========================================================
     AUDIOBOOK STUDIO
     ========================================================= */
  (function initAudiobook(){
    const speed = document.getElementById('ab-speed'), speedVal = document.getElementById('ab-speed-val');
    speed.addEventListener('input', () => speedVal.textContent = Number(speed.value).toFixed(2)+'x');

    document.getElementById('ab-file').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.type === 'text/plain' || f.name.endsWith('.txt')){
        const text = await f.text();
        document.getElementById('ab-text').value = text;
        VSUi.toast('Loaded ' + f.name, 'success');
      } else {
        VSUi.toast('PDF/DOCX uploaded: ' + f.name + '. Text extraction requires a connected backend — paste text directly for now.', 'info', 4500);
      }
    });

    let chapters = [];
    const listRoot = document.getElementById('ab-chapter-list');
    const combineBtn = document.getElementById('ab-combine-btn');

    function renderChapters(){
      if (!chapters.length){ listRoot.innerHTML = `<div class="empty-state">Split your manuscript to see chapters here.</div>`; combineBtn.disabled = true; return; }
      listRoot.innerHTML = chapters.map((c,i) => `
        <div class="chapter-row" data-idx="${i}">
          <div>
            <div class="chapter-title">${VSUi.escapeHtml(c.title)}</div>
            <div class="chapter-meta">${c.body.split(/\s+/).length} words ${c.durationSec ? '· ' + VSAudio.fmtTime(c.durationSec) + ' generated' : '· not generated'}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm ab-preview-btn" data-idx="${i}" ${c.audioUrl?'':'disabled'}>Preview</button>
            <button class="btn btn-sm ab-gen-btn" data-idx="${i}">${c.audioUrl?'Regenerate':'Generate'}</button>
            <button class="btn btn-sm btn-ghost ab-download-btn" data-idx="${i}" ${c.audioUrl?'':'disabled'}>Download</button>
          </div>
        </div>`).join('');
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
      if (!chapters.length){ VSUi.toast('Paste manuscript text or upload a .txt file first.','error'); return; }
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
      VSProjects.create({ name: res.data.title, type:'Audiobook', durationSec: res.data.durationSec||60 });
      VSUi.renderDashboard();
      VSUi.toast(res.demo ? 'Audiobook combined (DEMO MODE placeholder audio).' : 'Audiobook combined.', 'success');
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
      VSProjects.create({ name: opts.description.slice(0,32) || 'Untitled Track', type:'Music', durationSec: res.data.durationSec||30 });
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
      VSProjects.addVoice({ name:lastVoice.name, description:lastVoice.description, language:lastVoice.language, category:'Character', audioUrl:lastVoice.audioUrl });
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
    let currentBlobUrl = null;
    const audio = new Audio();
    const clip = document.getElementById('edit-clip');
    const status = document.getElementById('edit-status');
    let history = [];

    document.getElementById('edit-import').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      currentBlobUrl = URL.createObjectURL(f);
      audio.src = currentBlobUrl;
      renderClipWave(f.name);
      status.textContent = 'Imported ' + f.name;
    });

    function renderClipWave(seed){
      clip.innerHTML = '';
      for (let i=0;i<40;i++){ const s=document.createElement('span'); s.style.height = (6+Math.round(Math.random()*28))+'px'; clip.appendChild(s); }
    }
    renderClipWave('default');

    let vsRecorder = null, stopWave = null;
    document.getElementById('edit-record-btn').addEventListener('click', async () => {
      const btn = document.getElementById('edit-record-btn');
      if (btn.textContent === 'Record'){
        vsRecorder = createVSRecorder({
          onStop: ({ url }) => { currentBlobUrl = url; audio.src = url; renderClipWave('rec'); status.textContent = 'Recording captured.'; },
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

    function pushHistory(action){ history.push(action); status.textContent = action + ' applied.'; }
    ['trim','cut','split','merge','fadein','fadeout'].forEach(action => {
      document.getElementById('edit-'+action).addEventListener('click', () => pushHistory(action.charAt(0).toUpperCase()+action.slice(1)));
    });
    document.getElementById('edit-undo').addEventListener('click', () => { const a = history.pop(); status.textContent = a ? 'Undid ' + a : 'Nothing to undo.'; });
    document.getElementById('edit-redo').addEventListener('click', () => { status.textContent = 'Redo is available once an action has been undone.'; });

    const vol = document.getElementById('edit-volume'), volVal = document.getElementById('edit-volume-val');
    vol.addEventListener('input', () => { volVal.textContent = vol.value+'%'; audio.volume = Number(vol.value)/100; });
    document.getElementById('edit-speed').addEventListener('change', (e) => audio.playbackRate = Number(e.target.value));
    document.getElementById('edit-mute').addEventListener('change', (e) => audio.muted = e.target.checked);

    document.getElementById('edit-bgmusic').addEventListener('change', (e) => {
      if (e.target.files[0]) status.textContent = 'Background music loaded: ' + e.target.files[0].name;
    });

    document.getElementById('edit-export-btn').addEventListener('click', () => {
      if (!currentBlobUrl){ status.textContent = 'Import or record audio before exporting.'; status.className='field-hint err-text'; return; }
      downloadBlobUrl(currentBlobUrl, 'voicestudio-edit.webm');
      VSProjects.create({ name:'Audio Edit', type:'Audio Edit', durationSec: audio.duration || 0 });
      VSUi.renderDashboard();
      status.textContent = 'Exported.'; status.className='success-text';
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
