/*!
 * voiceover.js — Voix off FR / EN / NL / DE pour « Test Pattern [n°3] »
 *
 * - Lit à voix haute le texte de la section affichée (titres + paragraphes),
 *   dans la langue choisie dans #language_select.
 * - Lecture automatique à chaque changement de section (désactivable).
 * - Boutons lecture / pause et lecture automatique (injectés par le script).
 * - Aucun fichier audio : utilise les voix du navigateur (Web Speech API).
 *
 * Installation : <script src="scripts/voiceover.js" defer></script>
 *                (après scripts/app.js)
 *
 * Événements émis sur document :
 *   - 'voiceover:statechange'  detail: { state: 'idle' | 'speaking' | 'paused' }
 *   - 'voiceover:chunk'        detail: { index, total }   (début de chaque phrase)
 */
(() => {
  'use strict';

  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
    console.warn('[VoiceOver] Web Speech API indisponible dans ce navigateur.');
    return;
  }

  const synth = window.speechSynthesis;

  /* =========================================================================
   * 1. Configuration
   * ======================================================================= */

  const CONFIG = {
    sectionSelector: 'main > section.section',
    languageSelector: '#language_select',
    homeSelector: '.home-screen',
    warningSelector: '.warning-popup:not(.inactivity-popup)',

    // Clic sur « J'ai compris » (avertissement flashs) : la voix off peut démarrer
    confirmSelector:
      '.warning-popup__confirm:not(.inactivity-popup__stay):not(.inactivity-popup__home)',
    // Clics de navigation : ils activent aussi la voix off
    navSelector: '.button_next, .button_previous, .menu__link',
    // Clics qui coupent la voix (retour accueil, fin, ouverture du menu)
    stopSelector: '.home-screen, .button_finish, .menu__toggle, .inactivity-popup__home',

    readTitles: true,       // lire les <h2> / <h3> avant les paragraphes
    rate: 0.95,             // vitesse (1 = normale)
    pitch: 1,
    volume: 1,
    // La voix d'une section ne démarre que lorsque celle-ci est « arrivée » :
    // immobile (plus de scroll / transition) et bien visible, pendant `arrivalDelay` ms.
    arrivalDelay: 450,
    minVisibleRatio: 0.85,  // part de la section (ou de l'écran si elle est plus haute) visible
    pollInterval: 120,      // fréquence de vérification de la section affichée (ms)
    maxChunkLength: 180,    // caractères max par segment (évite les coupures de Chrome)
    // true  : si aucune voix de la langue choisie n'existe sur l'appareil, on ne lit rien
    //         (et on l'indique dans la console) au lieu d'utiliser la voix par défaut.
    // false : on laisse le navigateur lire avec sa voix par défaut (souvent française).
    strictVoice: true,
    storageKey: 'voiceover:auto',
  };

  // Langues du site (valeurs de #language_select) → langue de synthèse.
  // `locales` : ordre de préférence pour le choix de la voix.
  const LANGS = {
    french:  { code: 'fr', locales: ['fr-BE', 'fr-FR', 'fr-CA'], number: 'numéro', and: 'et' },
    english: { code: 'en', locales: ['en-GB', 'en-US'],          number: 'number', and: 'and' },
    dutch:   { code: 'nl', locales: ['nl-BE', 'nl-NL'],          number: 'nummer', and: 'en' },
    german:  { code: 'de', locales: ['de-DE', 'de-AT', 'de-CH'], number: 'Nummer', and: 'und' },
  };

  // Libellés des boutons (aria-label + infobulle)
  const LABELS = {
    french:  { group: 'Voix off',      play: 'Écouter la voix off',        pause: 'Mettre la voix off en pause', resume: 'Reprendre la voix off',      auto: 'Lecture automatique' },
    english: { group: 'Voice-over',    play: 'Listen to the voice-over',   pause: 'Pause the voice-over',        resume: 'Resume the voice-over',      auto: 'Automatic narration' },
    dutch:   { group: 'Voice-over',    play: 'Luister naar de voice-over', pause: 'Voice-over pauzeren',         resume: 'Voice-over hervatten',       auto: 'Automatische voorlezing' },
    german:  { group: 'Sprechertext',  play: 'Sprechertext anhören',       pause: 'Sprechertext pausieren',      resume: 'Sprechertext fortsetzen',    auto: 'Automatische Wiedergabe' },
  };

  // Ajustements de prononciation (à régler à l'oreille selon les voix disponibles).
  // Format : [expression régulière, remplacement]
  const PRONUNCIATIONS = {
    french:  [[/\bGifu\b/g, 'Guifou']],
    english: [],
    dutch:   [],
    german:  [],
  };

  /* =========================================================================
   * 2. État
   * ======================================================================= */

  let sections = [];
  let currentSection = null;       // section affichée ET « arrivée » (immobile, bien visible)
  let lastReadSection = null;      // dernière section dont la voix a été lancée (pendant cette visite)
  let candidate = null;            // section en train d'arriver…
  let candidateSig = '';           // …et sa position à la dernière vérification
  let candidateSince = 0;          // …depuis quand elle est immobile
  let armed = false;               // vrai après un premier geste utilisateur utile
  let autoPlay = true;
  let mode = 'idle';               // 'idle' | 'speaking' | 'paused'
  let queue = emptyQueue();
  let session = 0;                 // invalide les callbacks d'une lecture précédente
  let current = null;              // garde une référence à l'utterance (évite le GC)
  let startTimer = null;
  let ui = null;

  try { autoPlay = localStorage.getItem(CONFIG.storageKey) !== 'off'; } catch (_) { /* ignoré */ }

  function emptyQueue() {
    return { chunks: [], index: 0, lang: 'french', section: null };
  }

  /* =========================================================================
   * 3. Langue, visibilité, blocages
   * ======================================================================= */

  function getLanguage() {
    const select = document.querySelector(CONFIG.languageSelector);
    if (select && LANGS[select.value]) return select.value;
    const byHtmlLang = { fr: 'french', en: 'english', nl: 'dutch', de: 'german' };
    return byHtmlLang[(document.documentElement.lang || 'fr').slice(0, 2)] || 'french';
  }

  function isShown(el) {
    if (!el || el.hidden || el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0
      && r.top < window.innerHeight && r.left < window.innerWidth;
  }

  // La section qui occupe le plus de place dans la fenêtre = la section « active »
  function getActiveSection() {
    let best = null;
    let bestArea = 0;
    for (const s of sections) {
      if (!isShown(s)) continue;
      const r = s.getBoundingClientRect();
      const w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
      const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      const area = w * h;
      if (area > bestArea) { best = s; bestArea = area; }
    }
    return best;
  }

  // Part de la section réellement visible : 1 = entièrement à l'écran
  // (si la section est plus haute que l'écran, on compare à la taille de l'écran)
  function visibleRatio(el) {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(r.right, vw) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (w <= 0 || h <= 0) return 0;
    return (w * h) / Math.min(r.width * r.height, vw * vh);
  }

  function homeVisible() {
    const home = document.querySelector(CONFIG.homeSelector);
    return !!home && isShown(home);
  }

  // Pas de voix off pendant une pop-up ouverte ni sur l'écran d'accueil
  function isBlocked() {
    return !!document.querySelector('dialog[open]') || homeVisible();
  }

  /* =========================================================================
   * 4. Préparation du texte
   * ======================================================================= */

  function prepareText(raw, lang) {
    const L = LANGS[lang];
    let t = String(raw)
      .replace(/[\u00a0\u202f]/g, ' ')
      .replace(/\bn\s*°\s*(\d+)/gi, `${L.number} $1`)   // « n°3 » → « numéro 3 »
      .replace(/[\[\]«»“”"]/g, '')
      .replace(/\s*&\s*/g, ` ${L.and} `)
      .replace(/ō/g, 'o').replace(/Ō/g, 'O')            // Ryōji → Ryoji
      .replace(/ū/g, 'u').replace(/Ū/g, 'U');

    for (const [pattern, replacement] of PRONUNCIATIONS[lang] || []) {
      t = t.replace(pattern, replacement);
    }
    return t.replace(/\s+/g, ' ').trim();
  }

  function ensureEnd(s) {
    return /[.!?…:;]$/.test(s) ? s : `${s}.`;
  }

  // Titres + paragraphes d'une section (les boutons, « Texte 01/08 » et images sont ignorés)
  function getSectionBlocks(section, lang) {
    const titles = [];
    const paragraphs = [];

    for (const el of section.children) {
      if (el.tagName === 'H2' || el.tagName === 'H3') {
        if (CONFIG.readTitles) titles.push(prepareText(el.textContent, lang));
      } else if (el.tagName === 'P') {
        paragraphs.push(prepareText(el.textContent, lang));
      }
    }

    const blocks = [];
    const title = titles.filter(Boolean).join(', ');
    if (title) blocks.push(ensureEnd(title));
    paragraphs.filter(Boolean).forEach((p) => blocks.push(ensureEnd(p)));
    return blocks;
  }

  function splitSentences(text) {
    return text.match(/[^.!?…]+(?:[.!?…]+["'»”’)]*|$)\s*/g) || [text];
  }

  function splitLong(sentence) {
    const out = [];
    let buf = '';
    for (const part of sentence.match(/[^,;:]+[,;:]?\s*/g) || [sentence]) {
      if (buf && buf.length + part.length > CONFIG.maxChunkLength) {
        out.push(buf.trim());
        buf = '';
      }
      buf += part;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  // Découpe en segments courts : plus fiable (Chrome coupe les longues utterances)
  // et permet une pause / reprise propre.
  function toChunks(blocks) {
    const chunks = [];
    for (const block of blocks) {
      let buf = '';
      for (const s of splitSentences(block).map((x) => x.trim()).filter(Boolean)) {
        if (buf && buf.length + s.length + 1 > CONFIG.maxChunkLength) {
          chunks.push(buf);
          buf = '';
        }
        if (s.length > CONFIG.maxChunkLength) {
          chunks.push(...splitLong(s));
          continue;
        }
        buf = buf ? `${buf} ${s}` : s;
      }
      if (buf) chunks.push(buf);
    }
    return chunks;
  }

  /* =========================================================================
   * 5. Choix de la voix
   * ======================================================================= */

  const voiceCache = {};
  synth.addEventListener('voiceschanged', () => {
    Object.keys(voiceCache).forEach((k) => delete voiceCache[k]);
  });

  const NOVELTY_VOICES =
    /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;

  // Certains appareils Android annoncent des codes à 3 lettres (« eng-GBR », « nld-NLD »…)
  const LANG_ALIASES = { eng: 'en', fra: 'fr', fre: 'fr', nld: 'nl', dut: 'nl', deu: 'de', ger: 'de' };

  function scoreVoice(voice, cfg) {
    const lang = (voice.lang || '').replace('_', '-').toLowerCase();
    const base = lang.split('-')[0];
    if ((LANG_ALIASES[base] || base) !== cfg.code) return -Infinity;

    let score = 0;
    const idx = cfg.locales.findIndex((l) => l.toLowerCase() === lang);
    score += idx >= 0 ? 40 - idx * 5 : 10;                  // variante de langue préférée
    if (/natural|neural|online/i.test(voice.name)) score += 25;  // voix « naturelles » (Edge…)
    if (/google/i.test(voice.name)) score += 10;
    if (voice.localService) score += 5;
    if (NOVELTY_VOICES.test(voice.name)) score -= 100;
    return score;
  }

  function pickVoice(lang) {
    if (voiceCache[lang]) return voiceCache[lang];
    const cfg = LANGS[lang];
    let best = null;
    let bestScore = -Infinity;
    for (const v of synth.getVoices()) {
      const s = scoreVoice(v, cfg);
      if (s > bestScore) { best = v; bestScore = s; }
    }
    if (best) voiceCache[lang] = best;
    return best;
  }

  function warnNoVoice(lang) {
    const available = [...new Set(synth.getVoices().map((v) => v.lang))].sort().join(', ') || '(aucune)';
    console.warn(
      `[VoiceOver] Aucune voix « ${LANGS[lang].code} » disponible sur cet appareil / navigateur. `
      + `Langues disponibles : ${available}`
    );
    document.dispatchEvent(new CustomEvent('voiceover:novoice', { detail: { language: lang } }));
  }

  // Sur Chrome, la liste des voix se charge de façon asynchrone
  function ensureVoices() {
    return new Promise((resolve) => {
      if (synth.getVoices().length) return resolve();
      const done = () => {
        synth.removeEventListener('voiceschanged', done);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, 1200);
      synth.addEventListener('voiceschanged', done);
    });
  }

  /* =========================================================================
   * 6. Moteur de lecture
   * ======================================================================= */

  function setMode(next) {
    if (mode === next) return;
    mode = next;
    updateUI();
    document.dispatchEvent(new CustomEvent('voiceover:statechange', { detail: { state: next } }));
  }

  // Coupe la voix sans toucher à l'état ni à la file
  function halt() {
    session += 1;
    clearTimeout(startTimer);
    try {
      if (synth.paused) synth.resume();
      synth.cancel();
    } catch (_) { /* ignoré */ }
    current = null;
  }

  function stop() {
    halt();
    queue = emptyQueue();
    setMode('idle');
  }

  // Pause « maison » (la pause native est peu fiable sur mobile) :
  // on coupe et on reprend au début de la phrase en cours.
  function pause() {
    if (mode !== 'speaking') return;
    halt();
    setMode('paused');
  }

  function resume() {
    if (mode !== 'paused') return;
    setMode('speaking');
    play(queue.index);
  }

  function play(index) {
    halt();
    const mine = session;
    // Petit délai après cancel() : évite des silences sur Chrome / Safari / Android
    startTimer = setTimeout(() => {
      ensureVoices().then(() => runChunk(mine, index));
    }, 80);
  }

  function runChunk(mine, i) {
    if (mine !== session) return;

    if (i >= queue.chunks.length) {
      queue = emptyQueue();
      setMode('idle');
      return;
    }

    queue.index = i;
    const total = queue.chunks.length;
    const cfg = LANGS[queue.lang];
    const u = new SpeechSynthesisUtterance(queue.chunks[i]);
    const voice = pickVoice(queue.lang);

    if (!voice) {
      warnNoVoice(queue.lang);
      if (CONFIG.strictVoice) { stop(); return; }
    }

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = cfg.locales[0];
    }
    u.rate = CONFIG.rate;
    u.pitch = CONFIG.pitch;
    u.volume = CONFIG.volume;

    u.onstart = () => {
      if (mine === session) {
        document.dispatchEvent(new CustomEvent('voiceover:chunk', { detail: { index: i, total } }));
      }
    };
    u.onend = () => runChunk(mine, i + 1);
    u.onerror = (e) => {
      if (mine !== session) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      if (e.error !== 'not-allowed') {
        console.warn('[VoiceOver] Erreur de synthèse vocale :', e.error);
      }
      stop();
    };

    current = u;
    synth.speak(u);
  }

  function speakSection(section, { force = false } = {}) {
    if (!section) return;
    const lang = getLanguage();
    if (!force && mode === 'speaking' && queue.section === section && queue.lang === lang) return;

    const chunks = toChunks(getSectionBlocks(section, lang));
    if (!chunks.length) return;

    queue = { chunks, index: 0, lang, section };
    lastReadSection = section;
    setMode('speaking');
    play(0);
  }

  function speakCurrent() {
    arm();
    speakSection(getActiveSection() || currentSection, { force: true });
  }

  function toggle() {
    arm();
    if (mode === 'speaking') pause();
    else if (mode === 'paused') resume();
    else speakCurrent();
  }

  function setAuto(on) {
    autoPlay = !!on;
    try { localStorage.setItem(CONFIG.storageKey, autoPlay ? 'on' : 'off'); } catch (_) { /* ignoré */ }
    if (autoPlay) {
      if (!isBlocked()) speakSection(getActiveSection() || currentSection, { force: true });
    } else {
      stop();
    }
    updateUI();
  }

  /* =========================================================================
   * 7. Suivi des sections et de la langue
   * ======================================================================= */

  function arm() {
    if (armed) return;
    armed = true;
    mountUI();
  }

  // Position arrondie d'une section : sert à savoir si elle bouge encore
  function signature(el) {
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  }

  // Appelée toutes les `pollInterval` ms. Règles :
  //  1. Accueil ou pop-up affichés → aucune voix. Revenir à l'accueil = nouvelle visite.
  //  2. Si la section affichée n'est plus celle qui est lue → on coupe tout de suite.
  //  3. La voix d'une section ne démarre qu'une fois la section arrivée (immobile et
  //     bien visible) et seulement si ce n'est pas celle qui vient d'être lue.
  //  => tant qu'on ne change pas de section, rien ne se relance, et la voix d'une
  //     section ne passe jamais d'elle-même à la suivante.
  function tick() {
    if (document.hidden) return;

    if (isBlocked()) {
      if (mode !== 'idle') stop();
      if (homeVisible()) lastReadSection = null;       // nouvelle visite : on relira la 1re section
      candidate = null;
      return;
    }

    const best = getActiveSection();
    if (!best) { candidate = null; return; }

    // (2) l'utilisateur a quitté la section en cours de lecture
    if (mode !== 'idle' && queue.section && best !== queue.section) stop();

    // (3) attendre que la section soit arrivée
    const sig = signature(best);
    const now = performance.now();
    if (best !== candidate || sig !== candidateSig) {
      candidate = best;
      candidateSig = sig;
      candidateSince = now;
      return;
    }
    if (now - candidateSince < CONFIG.arrivalDelay) return;
    if (visibleRatio(best) < CONFIG.minVisibleRatio) return;

    currentSection = best;
    if (armed && autoPlay && best !== lastReadSection) speakSection(best);
  }

  // Attend que app.js ait fini de traduire le DOM avant de relire
  function whenDomSettled(callback, quiet = 200, max = 1500) {
    const root = document.querySelector('main') || document.body;
    let finished = false;
    let quietTimer;
    let maxTimer;

    const finish = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      callback();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quiet);
    });

    observer.observe(root, { childList: true, characterData: true, subtree: true });
    quietTimer = setTimeout(finish, quiet + 300);
    maxTimer = setTimeout(finish, max);
  }

  function onLanguageChange() {
    const wasSpeaking = mode === 'speaking';
    stop();
    updateUI();
    if (armed && (wasSpeaking || autoPlay)) {
      whenDomSettled(() => {
        if (!isBlocked()) speakSection(getActiveSection() || currentSection, { force: true });
      });
    }
  }

  /* =========================================================================
   * 8. Interface (boutons)
   * ======================================================================= */

  const ICONS = {
    play:  '<svg class="voiceover__icon voiceover__icon--play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg class="voiceover__icon voiceover__icon--pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
    on:    '<svg class="voiceover__icon voiceover__icon--on" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5v5h3.5L11 18.5v-13L6.5 9.5H3z" fill="currentColor"/><path d="M14.5 9a4 4 0 0 1 0 6M17 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    off:   '<svg class="voiceover__icon voiceover__icon--off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5v5h3.5L11 18.5v-13L6.5 9.5H3z" fill="currentColor"/><path d="M15 9.5l5 5M20 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  const STYLES = `
.voiceover{position:fixed;right:var(--voiceover-right,30px);bottom:var(--voiceover-bottom,30px);z-index:var(--voiceover-z,20);display:flex;gap:17px}
.voiceover__btn{display:grid;place-items:center;width:70px;height:70px;padding:0;border:0;border-radius:50%;background:#fff;color:#000;box-shadow:0 2px 8px rgba(0,0,0,.55);cursor:pointer;transition:background-color .15s,color .15s}
.voiceover__btn:focus-visible{outline:3px solid #fff;outline-offset:3px;box-shadow:0 0 0 6px #000}
.voiceover__icon{display:block;width:30px;height:30px}
.voiceover__toggle .voiceover__icon--pause{display:none}
.voiceover[data-state="speaking"] .voiceover__toggle{background:#000;color:#fff}
.voiceover[data-state="speaking"] .voiceover__toggle .voiceover__icon--play{display:none}
.voiceover[data-state="speaking"] .voiceover__toggle .voiceover__icon--pause{display:block}
.voiceover__auto .voiceover__icon--off{display:none}
.voiceover[data-auto="false"] .voiceover__auto .voiceover__icon--on{display:none}
.voiceover[data-auto="false"] .voiceover__auto .voiceover__icon--off{display:block}
@media (prefers-reduced-motion:reduce){.voiceover__btn{transition:none}}
`;

  function mountUI() {
    if (ui) return;

    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.className = 'voiceover';
    root.setAttribute('role', 'group');
    root.innerHTML = `
      <button type="button" class="voiceover__btn voiceover__toggle">${ICONS.play}${ICONS.pause}</button>
      <button type="button" class="voiceover__btn voiceover__auto" aria-pressed="true">${ICONS.on}${ICONS.off}</button>
    `;
    document.body.appendChild(root);

    ui = {
      root,
      toggle: root.querySelector('.voiceover__toggle'),
      auto: root.querySelector('.voiceover__auto'),
    };
    ui.toggle.addEventListener('click', toggle);
    ui.auto.addEventListener('click', () => setAuto(!autoPlay));
    updateUI();
  }

  function updateUI() {
    if (!ui) return;
    const L = LABELS[getLanguage()];

    ui.root.dataset.state = mode;
    ui.root.dataset.auto = String(autoPlay);
    ui.root.setAttribute('aria-label', L.group);

    const label = mode === 'speaking' ? L.pause : mode === 'paused' ? L.resume : L.play;
    ui.toggle.setAttribute('aria-label', label);
    ui.toggle.title = label;

    ui.auto.setAttribute('aria-label', L.auto);
    ui.auto.setAttribute('aria-pressed', String(autoPlay));
    ui.auto.title = L.auto;
  }

  /* =========================================================================
   * 9. Initialisation
   * ======================================================================= */

  // iOS / Safari : la synthèse vocale doit être « débloquée » par un geste utilisateur
  function unlockOnFirstGesture() {
    const unlock = () => {
      ['pointerdown', 'touchend', 'keydown'].forEach((t) => document.removeEventListener(t, unlock, true));
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        synth.speak(u);
      } catch (_) { /* ignoré */ }
    };
    ['pointerdown', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, unlock, true));
  }

  function init() {
    sections = Array.from(document.querySelectorAll(CONFIG.sectionSelector));
    if (!sections.length) {
      console.warn('[VoiceOver] Aucune section trouvée avec :', CONFIG.sectionSelector);
      return;
    }
    // Fonctionne quel que soit le mode de navigation (scroll, classes, transforms…) :
    // on regarde simplement, régulièrement, quelle section est affichée et immobile.
    setInterval(tick, CONFIG.pollInterval);

    document.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      if (target.closest(CONFIG.stopSelector)) stop();

      // « J'ai compris » ou navigation : on arme la voix off. Elle démarrera toute seule
      // (via tick) quand l'accueil et la pop-up auront disparu et que la section sera arrivée.
      if (target.closest(`${CONFIG.confirmSelector}, ${CONFIG.navSelector}`)) arm();

      // Pas de pop-up d'avertissement dans la page : le clic sur l'accueil suffit
      if (target.closest(CONFIG.homeSelector) && !document.querySelector(CONFIG.warningSelector)) arm();
    }, true);

    document.addEventListener('change', (e) => {
      if (e.target instanceof Element && e.target.matches(CONFIG.languageSelector)) onLanguageChange();
    }, true);

    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('pagehide', () => { try { synth.cancel(); } catch (_) { /* ignoré */ } });

    unlockOnFirstGesture();

    // Sans écran d'accueil (ex. version smartphone), on affiche directement les boutons
    if (!document.querySelector(CONFIG.homeSelector)) arm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* =========================================================================
   * 10. API publique
   * ======================================================================= */

  window.VoiceOver = {
    speakSection,
    speakCurrent,
    toggle,
    pause,
    resume,
    stop,
    setAuto,
    arm,
    // Diagnostic : VoiceOver.voices() dans la console → voix disponibles + voix retenue par langue
    voices() {
      console.table(synth.getVoices().map((v) => ({ name: v.name, lang: v.lang, local: v.localService })));
      Object.keys(LANGS).forEach((l) => {
        const v = pickVoice(l);
        console.log(`${l} →`, v ? `${v.name} (${v.lang})` : 'AUCUNE VOIX');
      });
    },
    get state() { return mode; },
  };
})();