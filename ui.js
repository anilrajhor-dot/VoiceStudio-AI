/* =========================================================
   VoiceStudio AI — ui.js
   Generic interface plumbing shared by every module: view
   routing, toasts, the New Project modal, tab switching, theme,
   the responsive sidebar/bottom-nav, and the renderers for
   Dashboard / My Projects / voice lists that read from
   VSProjects and redraw whenever data changes.
   ========================================================= */

const VSUi = (() => {

  const VIEW_TITLES = {
    dashboard: ['Dashboard', 'Create professional audio with AI'],
    'voice-studio': ['Voice Studio', 'Every voice tool in one place'],
    tts: ['Text to Speech', 'Turn text into natural speech'],
    cloning: ['Voice Cloning', 'Create a reusable voice from a consented sample'],
    dubbing: ['AI Dubbing', 'Transcribe, translate and re-voice your content'],
    podcast: ['Podcast Studio', 'Create a podcast in minutes'],
    audiobook: ['Audiobook Studio', 'Transform your document into an audiobook'],
    music: ['Music Studio', 'Create music from your idea'],
    characters: ['Character Voices', 'Build a fictional character voice'],
    editor: ['Audio Editor', 'Trim, mix and polish your recordings'],
    projects: ['My Projects', 'Every project, in one place'],
    settings: ['Settings', 'Profile, app preferences and API configuration']
  };

  let currentView = 'dashboard';

  function navigateTo(view){
    if (!VIEW_TITLES[view]) return;
    currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    document.querySelectorAll('.bn-item[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    const bnMore = document.getElementById('bn-more-btn');
    if (bnMore) bnMore.classList.toggle('active', !['dashboard','tts','podcast','projects'].includes(view));

    const [title, subtitle] = VIEW_TITLES[view];
    const titleEl = document.getElementById('view-title');
    const subEl = document.getElementById('view-subtitle');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;

    closeSidebar();
    document.getElementById('view-root').scrollTo({ top:0, behavior:'instant' in window ? 'instant' : 'auto' });

    if (view === 'dashboard') renderDashboard();
    if (view === 'projects') renderProjectsView();
    if (view === 'voice-studio') renderVoiceStudioVoices();
  }

  /* ---------------- Sidebar (mobile off-canvas) ---------------- */
  function openSidebar(){
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-scrim').classList.add('open');
  }
  function closeSidebar(){
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-scrim').classList.remove('open');
  }

  /* ---------------- Theme ---------------- */
  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    const label = document.getElementById('theme-toggle-label');
    if (label) label.textContent = theme === 'light' ? 'Light Mode' : 'Dark Mode';
    VSSettings.update({ theme });
  }
  function toggleTheme(){
    const cur = VSSettings.get().theme;
    applyTheme(cur === 'light' ? 'dark' : 'light');
  }

  /* ---------------- Toasts ---------------- */
  function toast(message, type = 'info', ms = 3200){
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(()=>el.remove(), 200); }, ms);
  }

  /* ---------------- Modal ---------------- */
  function openModal(id){ document.getElementById(id).classList.add('open'); }
  function closeModal(id){ document.getElementById(id).classList.remove('open'); }

  /* ---------------- Generic tabs (data-tab / data-mtab / data-stab groups) ---------------- */
  function wireTabs(buttonSelector, attr, onSwitch){
    document.querySelectorAll(buttonSelector).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(buttonSelector).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onSwitch(btn.dataset[attr]);
      });
    });
  }

  /* ---------------- Chip select (single-select pill groups) ---------------- */
  function wireChipGroup(container){
    if (!container) return;
    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip || !container.contains(chip)) return;
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  }
  function activeChip(container){
    const el = container && container.querySelector('.chip.active');
    return el ? (el.dataset.cat || el.textContent.trim()) : '';
  }

  /* ---------------- Storage meter ---------------- */
  function refreshStorageMeter(){
    const ratio = VSStorage.estimateUsageRatio();
    const pct = Math.round(ratio * 100);
    const label = document.getElementById('storage-label');
    const bar = document.getElementById('storage-bar-fill');
    if (label) label.textContent = `Local storage · ${pct}%`;
    if (bar) bar.style.width = Math.max(2,pct) + '%';
  }

  /* ---------------- Dashboard ---------------- */
  function renderDashboard(){
    const projects = VSProjects.all();
    const voices = VSProjects.allVoices();
    const stats = [
      { label:'Projects', value: projects.length },
      { label:'Voices', value: voices.length },
      { label:'Podcasts', value: projects.filter(p=>p.type==='Podcast').length },
      { label:'Audiobooks', value: projects.filter(p=>p.type==='Audiobook').length },
    ];
    const statRoot = document.getElementById('stat-cards');
    if (statRoot) statRoot.innerHTML = stats.map(s => `
      <div class="card stat-card"><div class="stat-num">${s.value}</div><div class="stat-label">${s.label}</div></div>
    `).join('');

    const recentRoot = document.getElementById('recent-projects');
    if (recentRoot){
      const recent = projects.slice(0,6);
      recentRoot.innerHTML = recent.length ? recent.map(projectCardHtml).join('')
        : `<div class="empty-state" style="grid-column:1/-1;">No projects yet — use a quick action above to create your first one.</div>`;
      wireProjectCardActions(recentRoot);
    }

    const wave = document.getElementById('hero-wave');
    if (wave && !wave.childElementCount){
      for (let i=0;i<22;i++){
        const s = document.createElement('span');
        s.style.height = (10 + Math.round(Math.sin(i*0.7)*14+14)) + 'px';
        s.style.animationDelay = (i*0.05)+'s';
        wave.appendChild(s);
      }
    }
    refreshStorageMeter();
  }

  function projectCardHtml(p){
    const date = new Date(p.createdAt).toLocaleDateString(undefined,{ month:'short', day:'numeric', year:'numeric' });
    const dur = VSAudio.fmtTime(p.durationSec || 0);
    const statusClass = p.status === 'Draft' || p.status === 'Processing' ? 'pending' : '';
    return `
    <div class="card project-card" data-project-id="${p.id}">
      <div class="project-top">
        <span class="project-type">${p.type}</span>
        <button class="icon-btn btn-icon-only proj-menu-btn" data-id="${p.id}" style="width:28px;height:28px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
        </button>
      </div>
      <div class="project-title">${escapeHtml(p.name)}</div>
      <div class="project-meta">
        <span>${date}</span><span>${dur}</span>
        <span class="status-dot ${statusClass}">${p.status}</span>
      </div>
      <div class="project-actions">
        <button class="btn btn-sm proj-play-btn" data-id="${p.id}">Play</button>
        <button class="btn btn-sm proj-rename-btn" data-id="${p.id}">Edit</button>
        <button class="btn btn-sm btn-ghost proj-export-btn" data-id="${p.id}">Export</button>
      </div>
    </div>`;
  }

  function wireProjectCardActions(root){
    root.querySelectorAll('.proj-play-btn').forEach(b => b.addEventListener('click', async () => {
      const p = VSProjects.all().find(x=>x.id===b.dataset.id);
      if (!p) return;
      if (p.meta && p.meta.remoteAudioUrl){
        new Audio(p.meta.remoteAudioUrl).play().catch(() => toast('Could not play this project\u2019s audio.', 'error'));
        return;
      }
      if (!p.meta || !p.meta.hasAudio){
        toast(p.status === 'Draft' ? 'This project isn\u2019t finished generating yet.' : 'No audio is attached to this project — it may be a demo entry, or was created before audio saving was added.', 'info', 4000);
        return;
      }
      const blob = await VSStorage.getBlob(p.id);
      if (!blob){ toast('This project\u2019s audio couldn\u2019t be found — it may have been cleared from this browser.', 'error'); return; }
      new Audio(URL.createObjectURL(blob)).play().catch(() => toast('Could not play this project\u2019s audio.', 'error'));
    }));
    root.querySelectorAll('.proj-rename-btn').forEach(b => b.addEventListener('click', () => {
      const p = VSProjects.all().find(x=>x.id===b.dataset.id);
      if (!p) return;
      const name = prompt('Rename project', p.name);
      if (name && name.trim()){ VSProjects.update(p.id, { name: name.trim() }); renderDashboard(); renderProjectsView(); toast('Project renamed','success'); }
    }));
    root.querySelectorAll('.proj-export-btn').forEach(b => b.addEventListener('click', async () => {
      const p = VSProjects.all().find(x=>x.id===b.dataset.id);
      if (!p) return;
      if (p.meta && p.meta.remoteAudioUrl){
        const a = document.createElement('a'); a.href = p.meta.remoteAudioUrl; a.download = p.name.replace(/\s+/g,'_')+'.mp3';
        document.body.appendChild(a); a.click(); a.remove();
        toast('Export ready — check your downloads','success');
        return;
      }
      if (!p.meta || !p.meta.hasAudio){
        toast(p.status === 'Draft' ? 'This project isn\u2019t finished generating yet.' : 'No audio is attached to this project to export.', 'info', 4000);
        return;
      }
      const blob = await VSStorage.getBlob(p.id);
      if (!blob){ toast('This project\u2019s audio couldn\u2019t be found — it may have been cleared from this browser.', 'error'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = p.name.replace(/\s+/g,'_')+'.wav';
      document.body.appendChild(a); a.click(); a.remove();
      toast('Export ready — check your downloads','success');
    }));
    root.querySelectorAll('.proj-menu-btn').forEach(b => b.addEventListener('click', () => {
      const p = VSProjects.all().find(x=>x.id===b.dataset.id);
      if (!p) return;
      if (confirm(`Delete "${p.name}"? This cannot be undone.`)){
        VSStorage.deleteBlob(p.id);
        VSProjects.remove(p.id); renderDashboard(); renderProjectsView(); toast('Project deleted','info');
      }
    }));
  }

  /* ---------------- Projects view ---------------- */
  function renderProjectsView(){
    const search = document.getElementById('proj-search');
    const filter = document.getElementById('proj-filter');
    const sort = document.getElementById('proj-sort');
    const grid = document.getElementById('proj-grid');
    if (!grid) return;
    const list = VSProjects.query({
      search: search ? search.value : '',
      type: filter ? filter.value : '',
      sort: sort ? sort.value : 'date-desc'
    });
    grid.innerHTML = list.length ? list.map(projectCardHtml).join('')
      : `<div class="empty-state" style="grid-column:1/-1;">No projects match your search.</div>`;
    wireProjectCardActions(grid);
  }

  /* ---------------- Voice lists (reused in Voice Studio, Cloning, Characters) ---------------- */
  function voiceCardHtml(v){
    const initials = (v.name || '?').slice(0,2).toUpperCase();
    return `
    <div class="card voice-card" data-voice-id="${v.id}">
      <div class="voice-avatar">${initials}</div>
      <div class="voice-info">
        <div class="voice-name">${escapeHtml(v.name)}</div>
        <div class="voice-tags">${v.category || 'Voice'} · ${v.language || 'English'}</div>
      </div>
      <button class="btn btn-sm voice-preview-btn" data-id="${v.id}">Preview</button>
      <button class="btn btn-sm btn-danger voice-delete-btn" data-id="${v.id}">Delete</button>
    </div>`;
  }
  function wireVoiceCardActions(root){
    root.querySelectorAll('.voice-preview-btn').forEach(b => b.addEventListener('click', async () => {
      const v = VSProjects.allVoices().find(x=>x.id===b.dataset.id);
      if (!v || !v.hasAudio){ toast('No preview audio available for this voice.','info'); return; }
      if (v.remoteAudioUrl){ new Audio(v.remoteAudioUrl).play().catch(() => toast('Could not play this voice.','error')); return; }
      const blob = await VSStorage.getBlob(v.id);
      if (!blob){ toast('This voice\u2019s audio couldn\u2019t be found — it may have been cleared from this browser.','error'); return; }
      new Audio(URL.createObjectURL(blob)).play().catch(() => toast('Could not play this voice.','error'));
    }));
    root.querySelectorAll('.voice-delete-btn').forEach(b => b.addEventListener('click', () => {
      VSProjects.removeVoice(b.dataset.id);
      renderVoiceStudioVoices();
      document.dispatchEvent(new CustomEvent('vs:voices-changed'));
      toast('Voice deleted','info');
    }));
  }
  function renderVoiceStudioVoices(){
    const root = document.getElementById('voice-studio-voices');
    if (!root) return;
    const voices = VSProjects.allVoices();
    root.innerHTML = voices.length ? voices.map(voiceCardHtml).join('')
      : `<div class="empty-state" style="grid-column:1/-1;">No custom voices yet — create one in Voice Cloning or Character Voices.</div>`;
    wireVoiceCardActions(root);
  }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  return {
    navigateTo, openSidebar, closeSidebar, applyTheme, toggleTheme, toast,
    openModal, closeModal, wireTabs, wireChipGroup, activeChip,
    refreshStorageMeter, renderDashboard, renderProjectsView, renderVoiceStudioVoices,
    projectCardHtml, wireProjectCardActions, voiceCardHtml, wireVoiceCardActions,
    escapeHtml, getCurrentView: () => currentView
  };
})();
