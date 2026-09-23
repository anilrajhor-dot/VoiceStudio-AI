/* =========================================================
   VoiceStudio AI — projects.js
   CRUD for "My Projects" and the voice library. Storage today
   is local (VSStorage); the shape below (id/type/date/duration/
   status) is deliberately simple so a future cloud-database
   provider can serialise to/from the same fields.
   ========================================================= */

const VSProjects = (() => {

  function uid(prefix){ return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  function all(){ return VSStorage.getProjects(); }

  function create({ name, type, durationSec = 0, status = 'Ready', meta = {} }){
    const list = all();
    const project = {
      id: uid('proj'),
      name: name || 'Untitled project',
      type: type || 'Voice',
      createdAt: Date.now(),
      durationSec,
      status, // Ready | Draft | Processing
      meta
    };
    list.unshift(project);
    VSStorage.setProjects(list);
    return project;
  }

  function update(id, patch){
    const list = all();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch);
    VSStorage.setProjects(list);
    return list[idx];
  }

  function remove(id){
    VSStorage.setProjects(all().filter(p => p.id !== id));
  }

  function duplicate(id){
    const p = all().find(x => x.id === id);
    if (!p) return null;
    return create({ name: p.name + ' (copy)', type: p.type, durationSec: p.durationSec, status: p.status, meta: p.meta });
  }

  function query({ search = '', type = '', sort = 'date-desc' } = {}){
    let list = all();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (type) list = list.filter(p => p.type === type);
    switch (sort){
      case 'date-asc': list = list.slice().sort((a,b)=>a.createdAt-b.createdAt); break;
      case 'name-asc': list = list.slice().sort((a,b)=>a.name.localeCompare(b.name)); break;
      case 'name-desc': list = list.slice().sort((a,b)=>b.name.localeCompare(a.name)); break;
      default: list = list.slice().sort((a,b)=>b.createdAt-a.createdAt);
    }
    return list;
  }

  /* ---------------- Voices ---------------- */
  function allVoices(){ return VSStorage.getVoices(); }
  function addVoice(voice){
    const list = allVoices();
    const v = Object.assign({ id: uid('voice'), createdAt: Date.now() }, voice);
    list.unshift(v);
    VSStorage.setVoices(list);
    return v;
  }
  function removeVoice(id){
    VSStorage.setVoices(allVoices().filter(v => v.id !== id));
  }

  /* ---------------- Demo seed data (section 29) ---------------- */
  function seedIfEmpty(){
    if (VSStorage.isSeeded()) return;
    const samples = [
      { name:'Morning Motivation', type:'Speech', durationSec: 95, status:'Ready' },
      { name:'Business Podcast', type:'Podcast', durationSec: 620, status:'Ready' },
      { name:'My First Audiobook', type:'Audiobook', durationSec: 1450, status:'Draft' },
      { name:'Hindi Training Module', type:'Speech', durationSec: 310, status:'Ready' },
      { name:'Fantasy Character', type:'Character', durationSec: 8, status:'Ready' },
      { name:'Motivational Song', type:'Music', durationSec: 180, status:'Ready' },
    ];
    samples.reverse().forEach(s => create(s));
    VSStorage.setSeeded();
  }

  return { all, create, update, remove, duplicate, query, allVoices, addVoice, removeVoice, seedIfEmpty, uid };
})();
