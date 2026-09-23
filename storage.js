/* =========================================================
   VoiceStudio AI — storage.js
   Local persistence layer. Uses localStorage for structured
   records (projects, voices, settings) and IndexedDB for
   larger binary blobs (recorded/generated audio), so the app
   works fully offline in DEMO MODE. Architected so a future
   cloud-storage provider can be swapped in behind the same
   VSStorage interface without touching UI code.
   ========================================================= */

const VSStorage = (() => {
  const LS_KEYS = {
    projects: 'vs_projects',
    voices:   'vs_voices',
    settings: 'vs_settings',
    seeded:   'vs_seeded_v1'
  };

  const DB_NAME = 'voicestudio_ai';
  const DB_VERSION = 1;
  const STORE = 'blobs';
  let dbPromise = null;

  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null); // fail soft — app still runs without blob storage
    });
    return dbPromise;
  }

  async function putBlob(id, blob){
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async function getBlob(id){
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function deleteBlob(id){
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  function readJSON(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error('VSStorage write failed', e); return false; }
  }

  return {
    keys: LS_KEYS,
    getProjects: () => readJSON(LS_KEYS.projects, []),
    setProjects: (list) => writeJSON(LS_KEYS.projects, list),
    getVoices: () => readJSON(LS_KEYS.voices, []),
    setVoices: (list) => writeJSON(LS_KEYS.voices, list),
    getSettings: () => readJSON(LS_KEYS.settings, {}),
    setSettings: (obj) => writeJSON(LS_KEYS.settings, obj),
    isSeeded: () => readJSON(LS_KEYS.seeded, false),
    setSeeded: () => writeJSON(LS_KEYS.seeded, true),
    putBlob, getBlob, deleteBlob,
    estimateUsageRatio(){
      try {
        let total = 0;
        for (const k in localStorage) if (localStorage.hasOwnProperty(k)) total += (localStorage[k]||'').length;
        return Math.min(1, total / (5 * 1024 * 1024)); // rough vs ~5MB typical quota
      } catch (e) { return 0; }
    }
  };
})();

/* ---------------------------------------------------------
   Shared reference data: languages + demo voice catalogue.
   Real providers can replace VOICE_CATALOGUE via voice-service.js
   without changing anything that reads from it.
   --------------------------------------------------------- */
const VS_LANGUAGES = [
  'English','Hindi','Bengali','Tamil','Telugu','Marathi','Gujarati','Kannada',
  'Malayalam','Punjabi','Urdu','Odia','Assamese','Nepali','French','German',
  'Spanish','Italian','Portuguese','Arabic','Chinese','Japanese','Korean','Russian'
];

const VS_GENRES = ['Pop','Rock','Classical','Folk','Indian','Bollywood-style','Electronic','Jazz','Blues','Ambient','Meditation','Devotional','Instrumental','Cinematic',"Children's"];
const VS_MOODS  = ['Happy','Sad','Inspirational','Energetic','Peaceful','Romantic','Dramatic','Mystical','Motivational'];

const VS_VOICE_CATALOGUE = [
  { id:'v-arjun',   name:'Arjun',   category:'Male',         lang:'English' },
  { id:'v-meera',   name:'Meera',   category:'Female',       lang:'English' },
  { id:'v-narrate', name:'Rhea',    category:'Narrator',     lang:'English' },
  { id:'v-news',    name:'Vikram',  category:'News',         lang:'English' },
  { id:'v-teach',   name:'Sunita',  category:'Teacher',      lang:'Hindi' },
  { id:'v-friend',  name:'Kabir',   category:'Friendly',     lang:'Hindi' },
  { id:'v-pro',     name:'Alia',    category:'Professional', lang:'English' },
  { id:'v-child',   name:'Chintu',  category:'Child',        lang:'Hindi' },
  { id:'v-char',    name:'Draco',   category:'Character',    lang:'English' },
];

function vsPopulateLanguageSelect(sel, selected){
  if (!sel) return;
  sel.innerHTML = VS_LANGUAGES.map(l => `<option ${l===selected?'selected':''}>${l}</option>`).join('');
}
function vsPopulateVoiceSelect(sel, voices){
  if (!sel) return;
  const list = voices && voices.length ? voices : VS_VOICE_CATALOGUE;
  sel.innerHTML = list.map(v => `<option value="${v.id}">${v.name} — ${v.category}</option>`).join('');
}
