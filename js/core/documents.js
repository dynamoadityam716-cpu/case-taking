/*
 * SIH26047 — core/documents.js
 * ---------------------------------------------------------------------------
 * Document routing + typed extraction (Module B). Pure module.
 *
 * Takes raw OCR text and a declared kind (prescription / lab report /
 * discharge summary / prior case sheet) and returns structured *draft*
 * entities: medications, lab tests with reference ranges, diagnoses,
 * procedures, and extracted dates. Extraction is deliberately heuristic and
 * conservative: it is a draft for the doctor to confirm, never a final
 * record — matching the review-first design of the rest of the app.
 *
 * Abnormal-value flagging compares a numeric result against a bracketed
 * reference range in the same line, e.g. "Hb 9.8 g/dL (13-17)".
 */
(function (global) {
  'use strict';

  var KINDS = {
    prescription:    { label: 'Prescription',    fileMatch: [/rx|prescri|medicine/i] },
    lab_report:      { label: 'Lab report',      fileMatch: [/lab|report|investigation|blood test/i] },
    discharge_summary:{ label: 'Discharge summary', fileMatch: [/discharge/i] },
    case_sheet:      { label: 'Prior case sheet', fileMatch: [/case\s*sheet|opd|history sheet/i] }
  };

  function detectKind(filename, text) {
    var hay = (filename || '') + ' ' + (text || '').slice(0, 400);
    var order = ['prescription', 'lab_report', 'discharge_summary', 'case_sheet'];
    for (var i = 0; i < order.length; i++) {
      if (KINDS[order[i]].fileMatch.some(function (re) { re.lastIndex = 0; return re.test(hay); })) return order[i];
    }
    return 'prescription'; // most common document in an OPD
  }

  function extractDates(text) {
    var out = [];
    var re = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var y = m[3].length === 2 ? '20' + m[3] : m[3];
      out.push({ day: m[1], month: parseInt(m[2], 10), year: y, raw: m[0] });
    }
    // month-name forms: "12 Aug 2026", "Aug 12, 2026"
    var months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    var re2 = /\b(\d{1,2})\s+([a-z]{3,4})[a-z]*\.?\s+(\d{4})\b|\b([a-z]{3,4})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi;
    var m2;
    while ((m2 = re2.exec(text)) !== null) {
      var mn, d, yy;
      if (m2[1]) { d = m2[1]; mn = months[(m2[2] || '').toLowerCase().slice(0, 3)]; yy = m2[3]; }
      else { mn = months[(m2[4] || '').toLowerCase().slice(0, 3)]; d = m2[5]; yy = m2[6]; }
      if (mn) out.push({ day: d, month: mn, year: yy, raw: m2[0] });
    }
    return out;
  }

  // ---- medication line heuristics ----
  // "Tab. Paracetamol 500 mg 1-0-1 x 5 days", "Cough syrup 2 tsp BD",
  // "Amlodipine 5 mg OD (ongoing)"
  var DOSE_UNIT = /^(mg|g|ml|mcg|gm|unit|units|iu|sachet|tsp|tab|cap|drop|drops)$/i;
  var FREQ_TOKEN = /^(1-0-1|1-1-1|0-1-1|1-0-0|0-0-1|1-1-0|od|bd|tds|qid|hs|sos|bid|tid|qd|q6h|q8h)$/i;
  var FORMS = /^(?:tab|cap|syp|syr|oint|gel|drops?|inhaler|powder|kwath|kadha|avaleh|vatika|gutika|tablet|capsule|syrup)\.?$/i;
  function extractMeds(text) {
    var out = [];
    var lines = String(text).split(/\n+/);
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line || line.length < 4 || line.length > 200) return;
      // skip obvious header/narrative lines
      if (/^(dr|patient|address|date|hospital|clinic|opd|ipd|name|age|sex|ref|reg)/i.test(line)) return;
      var tokens = line.split(/\s+/);
      var head = 0;
      // strip a leading dosage-form token if present ("Tab.", "Cap.", "Syp")
      if (FORMS.test(tokens[0])) head = 1;
      // medicine name = leading alphabetic words that are not dose/freq tokens
      var nameTokens = [];
      var i = head;
      for (; i < tokens.length; i++) {
        var tok = tokens[i];
        if (/^\d/.test(tok) || DOSE_UNIT.test(tok) || FREQ_TOKEN.test(tok) || /^(x|for|×)$/i.test(tok)) break;
        nameTokens.push(tok);
      }
      var name = nameTokens.join(' ').replace(/[^A-Za-z .\-]/g, '').trim();
      if (!name || name.length < 2 || /^(and|with|also|along|the)$/i.test(name)) return;
      var rest = tokens.slice(i).join(' ');
      // dose = first "number unit" pair
      var dose = null;
      var dm = rest.match(/(\d+(?:[.,]\d+)?)\s*(mg|g|ml|mcg|gm|unit|units|iu|sachet|tsp|tab|cap|drops?)\b/i);
      if (dm) dose = dm[1].replace(',', '.') + ' ' + dm[2].toLowerCase();
      var freq = null;
      var f = rest.match(/\b(1-0-1|1-1-1|0-1-1|1-0-0|0-0-1|1-1-0|od|bd|tds|qid|hs|sos|bid|tid|qd|q6h|q8h)\b/i);
      if (f) freq = f[1].toUpperCase();
      var dur = null;
      var d = rest.match(/(?:x|for|×)?\s*(\d+)\s*(?:day|days|wk|week|weeks|month|months)\b/i);
      if (d) dur = d[1] + ' ' + (/(months?)/i.test(d[0]) ? 'month(s)' : 'day(s)');
      out.push({ name: name, dose: dose, frequency: freq, duration: dur, ongoing: !dur && !!freq });
    });
    return out;
  }

  // ---- lab test heuristics: "Hb 9.8 g/dL (13-17)" → value + flag ----
  function extractLabs(text) {
    var out = [];
    var re = /([A-Za-z][A-Za-z .\/\-]{1,30}?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z\/%µ]+)?\s*(?:\(([\d.\-–—]+)\s*(?:-|–|to)\s*([\d.]+)\s*(?:[a-zA-Z\/%µ]*)\))?/g;
    var m;
    var seen = {};
    while ((m = re.exec(text)) !== null) {
      var name = m[1].trim();
      if (!name || /\b(patient|date|name|age|sex|page|sl|sr|no)\b/i.test(name)) continue;
      if (!m[4] && !/^(?:WBC|RBC|Hb|PLT|ESR|CRP|ALT|AST|SGPT|SGOT|urea|creatinine|sugar|glucose|cholesterol|HDL|LDL|TGL|T3|T4|TSH)\b/i.test(name)) continue;
      var value = parseFloat(m[2]);
      var range = m[4] ? parseFloat(m[4]) + '-' + m[5] : null;
      var lo = m[4] ? parseFloat(m[4]) : null;
      var hi = m[5] ? parseFloat(m[5]) : null;
      var abnormal = null;
      if (lo !== null && hi !== null) {
        if (value < lo) abnormal = 'low';
        else if (value > hi) abnormal = 'high';
      }
      var key = (name + '|' + m[2]).toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push({
        test: name, value: m[2], unit: m[3] || null,
        range: range, abnormal: abnormal
      });
    }
    return out;
  }

  // ---- diagnoses / procedures / advice heuristics ----
  function extractDiagnoses(text) {
    var out = [];
    var re = /\b(?:dx|diagnos(?:is|es)?|impression|clinical findings?|conclusion|assessment|provisional)\s*[:.\-]?\s*(.+)$/gmi;
    var m;
    while ((m = re.exec(text)) !== null && out.length < 8) {
      m[1].split(/[,;]\s*/).forEach(function (bit) {
        var clean = bit.replace(/[.:]+$/g, '').trim();
        if (clean.length > 2 && clean.length < 160) out.push(clean);
      });
    }
    return out;
  }

  function extractProcedures(text) {
    var out = [];
    var re = /\b(?:procedure|surgery|operation|op performed|underwent)\s*[:.\-]?\s*(.+)$/gmi;
    var m;
    while ((m = re.exec(text)) !== null && out.length < 8) {
      var clean = m[1].replace(/[.:]+$/g, '').trim();
      if (clean.length > 2 && clean.length < 160) out.push(clean);
    }
    return out;
  }

  // Full typed parse of one document's OCR text.
  function parseDocument(text, kind) {
    var k = kind && KINDS[kind] ? kind : detectKind('', text);
    var res = {
      kind: k,
      dates: extractDates(text),
      medications: extractMeds(text),
      labs: extractLabs(text),
      diagnoses: extractDiagnoses(text),
      procedures: extractProcedures(text),
      flags: []
    };
    // cross-kind abnormal flags
    res.labs.forEach(function (lab) {
      if (lab.abnormal) res.flags.push(lab.test + ' ' + lab.value + ' is ' + lab.abnormal + ' (ref ' + lab.range + ')');
    });
    return res;
  }

  var api = {
    KINDS: KINDS,
    detectKind: detectKind,
    extractDates: extractDates,
    extractMeds: extractMeds,
    extractLabs: extractLabs,
    extractDiagnoses: extractDiagnoses,
    extractProcedures: extractProcedures,
    parseDocument: parseDocument
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else {
    global.SIH = global.SIH || {};
    global.SIH.Documents = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
