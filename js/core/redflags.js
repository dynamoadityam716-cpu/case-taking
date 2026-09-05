/*
 * SIH26047 — core/redflags.js
 * ---------------------------------------------------------------------------
 * Curated red-flag / triage lexicon (Module A). Pure module.
 *
 * Any mention of an emergency symptom in patient text (complaints, notes,
 * voice transcript, chat) raises a flag with a severity and a concrete
 * triage instruction. Detection is intentionally conservative substring
 * matching across EN/HI/MR so nothing urgent is missed in the kiosk setting;
 * the doctor always has the final say (flags never diagnose).
 */
(function (global) {
  'use strict';

  // id, severity (1 = act now), advice (short triage instruction).
  // term lists are checked in ALL languages regardless of UI language.
  var LEXICON = [
    {
      id: 'chest', severity: 1,
      advice: 'Chest pain/discomfort — do not queue; alert triage staff immediately.',
      terms: {
        en: ['chest pain', 'chest pains', 'chest discomfort', 'pain in chest', 'pain in the chest', 'pressure in chest', 'tightness in chest', 'heavy chest'],
        hi: ['सीने में दर्द', 'छाती में दर्द', 'सीने में दबाव', 'छाती में जकड़न', 'सीने में भारीपन'],
        mr: ['छातीत दुखणे', 'छातीत दर्द', 'छातीवर दबाव', 'छातीत जडपणा']
      }
    },
    {
      id: 'breath', severity: 1,
      advice: 'Breathing difficulty — do not queue; alert triage staff immediately.',
      terms: {
        en: ['shortness of breath', 'difficulty breathing', 'difficult breathing', 'hard to breathe', "can't breathe", 'cannot breathe', 'struggling to breathe', 'breathless', 'breathlessness', 'out of breath'],
        hi: ['सांस फूलना', 'सांस लेने में तकलीफ', 'सांस नहीं आ रही', 'सांस नहीं ले पा रहे'],
        mr: ['धाप लागणे', 'श्वास घेण्यास त्रास', 'श्वास घेता येत नाही']
      }
    },
    {
      id: 'faint', severity: 1,
      advice: 'Loss of consciousness / collapse — treat as emergency.',
      terms: {
        en: ['fainted', 'fainting', 'passed out', 'passing out', 'unconscious', 'lost consciousness', 'blacked out', 'collapse', 'collapsed'],
        hi: ['बेहोश', 'बेहोशी', 'गश', 'अचेत', 'बेहोश हो गया'],
        mr: ['बेशुद्ध', 'भान हरपले', 'मूर्छा']
      }
    },
    {
      id: 'stroke', severity: 1,
      advice: 'Possible stroke signs — immediate triage (FAST).',
      terms: {
        en: ['slurred speech', 'face drooping', 'drooping face', 'one side weak', 'weakness on one side', 'one sided weakness', 'left side weak', 'right side weak', 'arm weakness', 'paralysis', 'paralyzed', 'paralysed', 'sudden confusion'],
        hi: ['आधा शरीर कमजोर', 'एक तरफ कमजोरी', 'चेहरा टेढ़ा', 'बोली लड़खड़ाना', 'बोलने में लड़खड़ाहट', 'लकवा', 'अधरंग'],
        mr: ['अर्धांगवायू', 'एका बाजूची कमजोरी', 'चेहरा वाकडा', 'बोलण्यात अडथळा', 'लकवा']
      }
    },
    {
      id: 'bleed', severity: 1,
      advice: 'Heavy / active bleeding — immediate triage.',
      terms: {
        en: ['severe bleeding', 'heavy bleeding', 'bleeding a lot', 'bleeding heavily', 'vomiting blood', 'blood in vomit'],
        hi: ['बहुत ज़्यादा खून बहना', 'अत्यधिक रक्तस्राव', 'खून की उल्टी'],
        mr: ['जास्त रक्तस्त्राव', 'तीव्र रक्तस्त्राव', 'रक्ताच्या उलट्या']
      }
    },
    {
      id: 'diabetes_emergency', severity: 1,
      advice: 'Possible diabetic emergency (very high/low sugar symptoms) — triage soon.',
      terms: {
        en: ['sugar very high', 'blood sugar very high', 'sugar very low', 'diabetic coma', 'insulin reaction'],
        hi: ['शुगर बहुत ज़्यादा', 'ब्लड शुगर बहुत ज़्यादा', 'शुगर बहुत कम'],
        mr: ['साखर खूप जास्त', 'रक्तातील साखर खूप जास्त', 'साखर खूप कमी']
      }
    },
    {
      id: 'suicidal', severity: 1,
      advice: 'Self-harm ideation mentioned — involve clinician / counsellor now, do not leave patient waiting.',
      terms: {
        en: ['want to die', 'kill myself', 'suicide', 'end my life', 'harm myself'],
        hi: ['मरना चाहता हूँ', 'आत्महत्या', 'खुद को नुकसान', 'जान देना चाहता हूँ'],
        mr: ['मरायचं आहे', 'आत्महत्या', 'स्वतःला इजा', 'जीव देऊ इच्छितो']
      }
    },
    {
      id: 'pregnancy_emergency', severity: 2,
      advice: 'Pregnancy-related warning sign — prioritise for clinician review.',
      terms: {
        en: ['pregnant and bleeding', 'bleeding in pregnancy', 'severe abdominal pain pregnant'],
        hi: ['गर्भावस्था में रक्तस्राव', 'प्रेग्नेंसी में खून बहना'],
        mr: ['गर्भधारणेत रक्तस्त्राव']
      }
    },
    {
      id: 'seizure', severity: 2,
      advice: 'Seizure / fits — prioritise; do not leave patient unsupervised.',
      terms: {
        en: ['seizure', 'seizures', 'fitting now', 'had a fit', 'convulsions', 'convulsing', 'epileptic'],
        hi: ['मिर्गी का दौरा', 'दौरा पड़ा', 'ऐंठन', 'मिरगी'],
        mr: ['अपस्मार', 'झटके येणे', 'फिट्स आले']
      }
    },
    {
      id: 'severe_abdo', severity: 2,
      advice: 'Severe abdominal pain — prioritise for clinician review.',
      terms: {
        en: ['severe abdominal pain', 'severe stomach pain', 'unbearable stomach pain', 'severe belly pain'],
        hi: ['गंभीर पेट दर्द', 'बहुत तेज़ पेट दर्द', 'असहनीय पेट दर्द'],
        mr: ['तीव्र पोटदुखी', 'असह्य पोटदुखी']
      }
    },
    {
      id: 'high_fever', severity: 2,
      advice: 'High fever with danger signs — prioritise review.',
      terms: {
        en: ['very high fever', 'temperature very high', 'fever with rash', 'fever not coming down'],
        hi: ['बहुत तेज़ बुखार', 'तेज़ बुखार', 'बुखार के साथ दाने'],
        mr: ['खूप ताप', 'तीव्र ताप', 'तापासोबत पुरळ']
      }
    }
  ];

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  function hasPhrase(text, phrase) {
    var t = norm(text);
    var p = norm(phrase);
    if (!t || !p) return false;
    return t.indexOf(p) !== -1;
  }

  // Detect red flags in a blob of free text. Returns [{id, severity, advice}]
  // in lexicon order (first match per id). Empty text → [].
  function detect(text) {
    var found = [];
    LEXICON.forEach(function (item) {
      var hit = Object.keys(item.terms).some(function (lang) {
        return item.terms[lang].some(function (phrase) { return hasPhrase(text, phrase); });
      });
      if (hit) found.push({ id: item.id, severity: item.severity, advice: item.advice });
    });
    return found;
  }

  // Convenience: scan every free-text field a history object can carry.
  function detectHistory(h) {
    if (!h) return [];
    var bits = [];
    bits.push((h.complaints || []).join(' '));
    var hpi = h.hpi || {};
    Object.keys(hpi).forEach(function (k) { bits.push(hpi[k]); });
    var past = h.past || {};
    Object.keys(past).forEach(function (k) { bits.push(past[k]); });
    if (h.family) bits.push(h.family.history);
    bits.push(h.notes);
    bits.push((h.drugs || []).map(function (d) { return d.name; }).join(' '));
    return detect(bits.join(' '));
  }

  function worstSeverity(flags) {
    var s = 0;
    (flags || []).forEach(function (f) { if (f.severity > s) s = f.severity; });
    return s;
  }

  var api = {
    LEXICON: LEXICON,
    detect: detect,
    detectHistory: detectHistory,
    worstSeverity: worstSeverity,
    norm: norm
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else {
    global.SIH = global.SIH || {};
    global.SIH.RedFlags = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
