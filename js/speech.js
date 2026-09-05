/*
 * SIH26047 — speech.js
 * ---------------------------------------------------------------------------
 * Shared ASR / TTS provider layer + kiosk accessibility helpers (Module A /
 * Module D voice requirements).
 *
 *   window.SIH.asr.transcribe({ lang })   — speech → text  (Promise<string>)
 *   window.SIH.tts.speak(text, lang)      — text → speech
 *   window.SIH.kiosk.{ enable, disable, announce, textMode }
 *
 * Providers: `webspeech` works in any modern Chrome/Edge/Safari without keys
 * (the demo/fallback path) and `bhashini` is the production provider for
 * Indian-language, noisy-OPD voice. The Bhashini provider calls an Edge
 * Function (supabase/functions/bhashini) whose URL is configured in
 * js/env.js — until that env var exists it fails with a clear message and the
 * UI falls back to webspeech. No audio is persisted by this module.
 */
(function () {
  'use strict';

  function env() {
    return (typeof window !== 'undefined' && window.SIH_ENV) ? window.SIH_ENV : {};
  }

  function langTag(code) {
    // app codes en/hi/mr → BCP-47 for the speech engines
    var map = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
    return map[code] || code || 'en-IN';
  }

  // ---------------- ASR ----------------
  var provider = 'webspeech';

  var webSpeechSupported = (function () {
    if (typeof window === 'undefined') return false;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return !!SR;
  })();

  function transcribeWebSpeech(opts) {
    return new Promise(function (resolve, reject) {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return reject(new Error('Speech-to-text not supported in this browser.'));
      var rec = new SR();
      rec.lang = langTag(opts.lang);
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; try { rec.stop(); } catch (e) {} reject(new Error('No speech heard — try again.')); }
      }, opts.timeoutMs || 12000);
      rec.onresult = function (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        var text = '';
        for (var i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        resolve(text.trim());
      };
      rec.onerror = function (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('Speech error: ' + (e.error || 'unknown')));
      };
      rec.onend = function () {
        if (!settled) { settled = true; clearTimeout(timer); reject(new Error('No speech heard — try again.')); }
      };
      try { rec.start(); } catch (e) { reject(e); }
    });
  }

  function transcribeBhashini(opts) {
    var base = env().bhashiniUrl || env().bhashiniEdgeUrl;
    if (!base) {
      return Promise.reject(new Error('Bhashini is not configured — add bhashiniEdgeUrl to js/env.js, or use the webspeech provider.'));
    }
    return fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'asr', audioUrl: opts.audioUrl, lang: langTag(opts.lang) })
    }).then(function (r) {
      if (!r.ok) throw new Error('Bhashini ASR failed (' + r.status + ')');
      return r.json();
    }).then(function (data) {
      var text = data && (data.text || (data.data && data.data.text)) || '';
      if (!text) throw new Error('Bhashini returned no transcript.');
      return String(text).trim();
    });
  }

  var asr = {
    get provider() { return provider; },
    setProvider: function (name) {
      if (name !== 'webspeech' && name !== 'bhashini') throw new Error('Unknown ASR provider: ' + name);
      provider = name;
    },
    supported: function () { return webSpeechSupported || !!env().bhashiniEdgeUrl; },
    transcribe: function (opts) {
      opts = opts || {};
      if (provider === 'bhashini') return transcribeBhashini(opts);
      return transcribeWebSpeech(opts);
    }
  };

  // ---------------- TTS ----------------
  function speakWeb(text, lang) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.reject(new Error('Speech synthesis not supported in this browser.'));
    }
    return new Promise(function (resolve) {
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = langTag(lang);
      u.rate = 0.98;
      u.onend = function () { resolve(); };
      u.onerror = function () { resolve(); }; // never block the flow on TTS failure
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      // some browsers never fire onend — resolve after a beat anyway
      setTimeout(resolve, Math.min(6000, 800 + String(text).length * 45));
    });
  }

  var tts = {
    speak: function (text, lang) { return speakWeb(text, lang); },
    stop: function () {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  };

  // ---------------- Kiosk / accessibility ----------------
  var kiosk = {
    enabled: false,
    enable: function () {
      kiosk.enabled = true;
      document.body.classList.add('kiosk-mode');
      kiosk.ensureLiveRegion();
    },
    disable: function () {
      kiosk.enabled = false;
      document.body.classList.remove('kiosk-mode');
    },
    // textMode: body class that enlarges type / increases contrast
    textMode: function (on) {
      document.body.classList.toggle('text-big', !!on);
    },
    ensureLiveRegion: function () {
      if (document.getElementById('sihLiveRegion')) return;
      var region = document.createElement('div');
      region.id = 'sihLiveRegion';
      region.setAttribute('aria-live', 'polite');
      region.className = 'sih-live-region';
      document.body.appendChild(region);
    },
    // Read a step aloud (audio prompt) and mirror it to the live region.
    announce: function (text, lang) {
      kiosk.ensureLiveRegion();
      var region = document.getElementById('sihLiveRegion');
      if (region) region.textContent = text || '';
      if (kiosk.enabled && text) return tts.speak(text, lang);
      return Promise.resolve();
    }
  };

  window.SIH = window.SIH || {};
  window.SIH.asr = asr;
  window.SIH.tts = tts;
  window.SIH.kiosk = kiosk;
})();
