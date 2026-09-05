/*
 * SIH26047 — core/history.js
 * ---------------------------------------------------------------------------
 * Normalized patient-history model. This is the single source of truth for a
 * visit's structured history:
 *
 *   patient    demographics (name/age/gender/weight/blood/ABHA)
 *   complaints chief complaints (chips + free text)
 *   hpi        History of Present Illness — SOCRATES dimensions
 *   past       past medical / surgical / hospitalisation
 *   drugs      current medicines [{name, dose, frequency, duration, ongoing}]
 *   allergies  [{agent, reaction}]
 *   family     family history
 *   personal   diet / habits / occupation / sleep / addictions
 *   ros        Review Of Systems (ticked findings)
 *   ayush      Dashavidha Pariksha + Agni/Koshtha/Ahara-Vihara/Nidana/Samprapti
 *   triggers   aggravating factors
 *   notes      free text
 *
 * Everything in this file is pure (no DOM, no network) so it runs identically
 * in the browser and under `node tests/run.js`.
 */
(function (global) {
  'use strict';

  var SECTIONS = [
    { key: 'patient',   label: 'Patient details' },
    { key: 'complaints',label: 'Chief complaint' },
    { key: 'hpi',       label: 'History of present illness' },
    { key: 'past',      label: 'Past medical / surgical history' },
    { key: 'drugs',     label: 'Current medicines' },
    { key: 'allergies', label: 'Drug & allergy history' },
    { key: 'family',    label: 'Family history' },
    { key: 'personal',  label: 'Personal / lifestyle history' },
    { key: 'ros',       label: 'Review of systems' },
    { key: 'ayush',     label: 'Ayurveda assessment (Dashavidha etc.)' },
    { key: 'triggers',  label: 'Aggravating factors' },
    { key: 'notes',     label: 'Notes' }
  ];

  function empty() {
    return {
      schema: 1,
      patient: { name: '', age: '', gender: '', weight: '', blood: '', abha: '' },
      complaints: [],
      hpi: {
        onset: '', site: '', character: '', radiation: '', severity: '',
        timing: '', duration: '', aggravating: '', relieving: ''
      },
      past: { medical: '', surgical: '', hospitalizations: '' },
      drugs: [],
      allergies: [],
      family: { history: '', conditions: [] },
      personal: { diet: '', occupation: '', sleep: '', habits: '', addictions: '' },
      ros: [],
      ayush: {
        prakriti: '', vikriti: '', agni: '', koshtha: '', nidana: '', samprapti: '',
        sara: '', samhanana: '', pramana: '', satmya: '', sattva: '',
        ahara_shakti: '', vyayama_shakti: '', vaya: '', ahara_vihara: ''
      },
      triggers: [],
      notes: ''
    };
  }

  function isBlank(v) {
    return v === undefined || v === null || (typeof v === 'string' && !v.trim()) ||
      (Array.isArray(v) && v.length === 0);
  }

  // A compact map of keys → whether they hold any data. Used by the doctor
  // review screen so the physician can see at a glance what was (not) asked.
  function completeness(h) {
    var out = {};
    if (!h) return out;
    SECTIONS.forEach(function (s) {
      var v = h[s.key];
      if (s.key === 'hpi') {
        out[s.key] = Object.keys(v).some(function (k) { return !isBlank(v[k]); });
      } else if (s.key === 'past' || s.key === 'personal' || s.key === 'family' || s.key === 'ayush') {
        out[s.key] = Object.keys(v).some(function (k) { return !isBlank(v[k]); });
      } else if (s.key === 'patient') {
        out[s.key] = !isBlank(v.name);
      } else {
        out[s.key] = !isBlank(v);
      }
    });
    return out;
  }

  // Sections that are clinically important but were left empty — surfaced on
  // the doctor review screen as "not captured — confirm intentionally".
  function criticalGaps(h) {
    var c = completeness(h || empty());
    var gaps = [];
    if (!c.complaints) gaps.push('complaints');
    if (!c.past) gaps.push('past');
    if (!c.allergies) gaps.push('allergies');
    if (!c.personal) gaps.push('personal');
    return gaps;
  }

  // Build a history object from a legacy DB row (the shape the demo queue and
  // portal have always used) plus an optional hash of extra fields.
  function fromLegacy(row) {
    var h = empty();
    if (!row) return h;
    h.patient.name = row.patient_name || '';
    h.patient.age = row.patient_age || '';
    h.patient.gender = row.patient_gender || '';
    h.patient.weight = row.patient_weight || '';
    h.patient.blood = row.patient_blood || '';
    h.patient.abha = row.abha_number || row.abha || '';
    if (row.dosha) h.ayush.prakriti = row.dosha;
    h.complaints = Array.isArray(row.symptoms) ? row.symptoms.slice() : [];
    if (row.factor) h.triggers = String(row.factor).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    h.notes = row.notes || '';
    // symptom_details was symptom → question → answer; flatten into HPI free text
    // so nothing captured on the old form is lost when a doctor reviews.
    var sd = row.symptom_details;
    if (sd && typeof sd === 'object') {
      var parts = [];
      Object.keys(sd).forEach(function (sym) {
        var answers = sd[sym];
        if (answers && typeof answers === 'object') {
          Object.keys(answers).forEach(function (q) {
            parts.push(sym + ': ' + q + ' → ' + answers[q]);
          });
        }
      });
      if (parts.length) h.hpi.onset = (h.hpi.onset ? h.hpi.onset + '; ' : '') + parts.join('; ');
    }
    // merge any already-persisted full history over the legacy mapping
    if (row.history && typeof row.history === 'object') h = merge(h, row.history);
    return h;
  }

  // Deep-ish merge of partial history object `extra` over `base`.
  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    var out = JSON.parse(JSON.stringify(base));
    ['patient', 'hpi', 'past', 'family', 'personal', 'ayush'].forEach(function (sec) {
      var e = extra[sec];
      if (e && typeof e === 'object') Object.keys(e).forEach(function (k) {
        if (e[k] !== undefined && e[k] !== null && e[k] !== '') out[sec][k] = e[k];
      });
    });
    ['complaints', 'drugs', 'allergies', 'ros', 'triggers'].forEach(function (sec) {
      if (Array.isArray(extra[sec]) && extra[sec].length) out[sec] = extra[sec].slice();
    });
    if (typeof extra.notes === 'string' && extra.notes.trim()) out.notes = extra.notes.trim();
    return out;
  }

  function list2text(arr, label) {
    if (!arr || !arr.length) return '';
    var lines = arr.map(function (it) {
      if (typeof it === 'string') return '  • ' + it;
      var bits = [];
      if (it.name) bits.push(it.name);
      if (it.dose) bits.push(it.dose);
      if (it.frequency) bits.push(it.frequency);
      if (it.duration) bits.push(it.duration + (it.ongoing ? ' (ongoing)' : ''));
      return '  • ' + bits.join(' — ') + (it.reaction ? ' (reaction: ' + it.reaction + ')' : '');
    });
    return label + '\n' + lines.join('\n') + '\n';
  }

  // Physician-readable structured summary (Module C). `labels` may supply a
  // translated heading dictionary; keys default to English.
  function summarize(h, labels) {
    var L = labels || {};
    var t = function (key, fallback) { return (L[key] && L[key] !== key) ? L[key] : fallback; };
    var out = [];
    if (!h) h = empty();
    var p = h.patient || {};
    var idLine = [p.name, p.age ? 'Age ' + p.age : '', p.gender, p.weight ? p.weight + ' kg' : '', p.blood ? 'Blood ' + p.blood : '', p.abha ? 'ABHA ' + p.abha : ''].filter(Boolean).join(' · ');
    if (idLine) out.push(t('patient', 'PATIENT') + ': ' + idLine);
    if (h.complaints && h.complaints.length) out.push(t('complaints', 'CHIEF COMPLAINT') + ': ' + h.complaints.join('; '));
    var hpiParts = [];
    var hpi = h.hpi || {};
    [['duration', 'Duration'], ['onset', 'Onset'], ['site', 'Site'], ['character', 'Character'], ['severity', 'Severity'], ['radiation', 'Radiation'], ['timing', 'Timing'], ['aggravating', 'Aggravated by'], ['relieving', 'Relieved by']].forEach(function (pair) {
      if (!isBlank(hpi[pair[0]])) hpiParts.push(pair[1] + ': ' + hpi[pair[0]]);
    });
    if (hpiParts.length) out.push(t('hpi', 'HISTORY OF PRESENT ILLNESS') + '\n' + hpiParts.map(function (s) { return '  • ' + s; }).join('\n'));
    if (h.past && Object.keys(h.past).some(function (k) { return !isBlank(h.past[k]); })) {
      out.push(t('past', 'PAST HISTORY') + '\n' + ['medical', 'surgical', 'hospitalizations'].map(function (k) {
        return isBlank(h.past[k]) ? null : '  • ' + h.past[k];
      }).filter(Boolean).join('\n'));
    }
    var med = list2text(h.drugs, t('drugs', 'CURRENT MEDICINES'));
    if (med) out.push(med.replace(/\n$/, ''));
    var all = list2text(h.allergies, t('allergies', 'ALLERGIES'));
    if (all) out.push(all.replace(/\n$/, ''));
    if (h.family && !isBlank(h.family.history)) out.push(t('family', 'FAMILY HISTORY') + ': ' + h.family.history);
    if (h.personal && Object.keys(h.personal).some(function (k) { return !isBlank(h.personal[k]); })) {
      var per = Object.keys(h.personal).map(function (k) {
        return isBlank(h.personal[k]) ? null : '  • ' + h.personal[k];
      }).filter(Boolean).join('\n');
      if (per) out.push(t('personal', 'PERSONAL / LIFESTYLE') + '\n' + per);
    }
    if (h.ros && h.ros.length) out.push(t('ros', 'REVIEW OF SYSTEMS') + ': ' + h.ros.join('; '));
    var ay = h.ayush || {};
    var ayParts = [];
    var AY = [['prakriti', 'Prakriti'], ['vikriti', 'Vikriti'], ['agni', 'Agni'], ['koshtha', 'Koshtha'], ['sara', 'Sara'], ['samhanana', 'Samhanana'], ['pramana', 'Pramana'], ['satmya', 'Satmya'], ['sattva', 'Sattva'], ['ahara_shakti', 'Ahara shakti'], ['vyayama_shakti', 'Vyayama shakti'], ['vaya', 'Vaya'], ['nidana', 'Nidana'], ['samprapti', 'Samprapti'], ['ahara_vihara', 'Ahara-Vihara']];
    AY.forEach(function (pair) {
      if (!isBlank(ay[pair[0]])) ayParts.push(pair[1] + ': ' + ay[pair[0]]);
    });
    if (ayParts.length) out.push(t('ayush', 'AYURVEDA ASSESSMENT') + '\n' + ayParts.map(function (s) { return '  • ' + s; }).join('\n'));
    if (h.triggers && h.triggers.length) out.push(t('triggers', 'AGGRAVATING FACTORS') + ': ' + h.triggers.join(', '));
    if (!isBlank(h.notes)) out.push(t('notes', 'NOTES') + ': ' + h.notes);
    return out.join('\n\n');
  }

  var api = {
    SECTIONS: SECTIONS,
    empty: empty,
    isBlank: isBlank,
    completeness: completeness,
    criticalGaps: criticalGaps,
    fromLegacy: fromLegacy,
    merge: merge,
    summarize: summarize
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else {
    global.SIH = global.SIH || {};
    global.SIH.History = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
