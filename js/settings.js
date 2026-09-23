/* =========================================================
   VoiceStudio AI — settings.js
   Reads/writes the settings object in VSStorage. Exposes a
   small API that the AI service layer (js/services/*) checks
   before every call: apiBaseUrl + demoMode decide whether a
   service simulates a result or calls a real backend.
   ========================================================= */

const VSSettings = (() => {
  const DEFAULTS = {
    profile: { name: '', email: '' },
    uiLanguage: 'en',
    theme: 'dark',
    audioQuality: 'Standard (44.1kHz)',
    defaultSpeed: '1x',
    defaultVoice: '',
    defaultLanguage: 'English',
    apiBaseUrl: '',
    demoMode: true
  };

  function get(){
    return Object.assign({}, DEFAULTS, VSStorage.getSettings());
  }
  function update(patch){
    const merged = Object.assign({}, get(), patch);
    VSStorage.setSettings(merged);
    return merged;
  }
  function isDemoMode(){
    const s = get();
    return s.demoMode || !s.apiBaseUrl;
  }
  function apiBase(){
    return get().apiBaseUrl || '';
  }

  return { DEFAULTS, get, update, isDemoMode, apiBase };
})();
