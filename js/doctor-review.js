/*
 * SIH26047 — doctor-review.js (Module C)
 * ---------------------------------------------------------------------------
 * Doctor review & confirm overlay for a queue case.
 *
 * A case's structured summary is a *draft*: the physician reads it, edits it,
 * and confirms before it is final. Confirming persists
 * summary_draft/summary_final/status/confirmed_at back to the `cases` row
 * (new columns added by sql/schema.sql) and records an audit row via the DB
 * trigger. If the database is not reachable or not yet upgraded, the review
 * still completes in-session so a consultation never dead-ends.
 *
 * Exposes window.SIH.Review = { open(row, itemEl) }.
 */
(function () {
  'use strict';

  var overlay = null;
  var modal = null;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) return;
    overlay = el('div', 'rx-overlay sih-review-overlay');
    overlay.id = 'sihReviewOverlay';
    modal = el('div', 'rx-modal sih-review-modal');
    modal.id = 'sihReviewModal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  function close() {
    if (overlay) overlay.classList.remove('open');
  }

  function buildSummary(row) {
    var SIH = window.SIH || {};
    if (!SIH.History) return '';
    var history = SIH.History.fromLegacy(row);
    return row.summary_draft || SIH.History.summarize(history);
  }

  function flaggedItems(row) {
    var SIH = window.SIH || {};
    var ids = row.red_flags ? row.red_flags.slice() : [];
    if (!ids.length && SIH.RedFlags) {
      var h = SIH.History ? SIH.History.fromLegacy(row) : null;
      ids = (SIH.RedFlags.detectHistory(h) || []).map(function (f) { return f.id; });
    }
    return ids.map(function (id) {
      var item = ((SIH.RedFlags && SIH.RedFlags.LEXICON) || []).filter(function (l) { return l.id === id; })[0];
      return { id: id, advice: item ? item.advice : id };
    });
  }

  // dbEnabled / supabaseClient are top-level consts declared in js/config.js
  // (global lexical scope, not window properties).
  function persist(row, fields) {
    if (typeof dbEnabled === 'undefined' || !dbEnabled || !supabaseClient || String(row.id || '').indexOf('local-') === 0) {
      return Promise.resolve({ ok: true, remote: false });
    }
    var patch = {};
    if (fields.summaryDraft !== undefined) patch.summary_draft = fields.summaryDraft;
    if (fields.summaryFinal !== undefined) patch.summary_final = fields.summaryFinal;
    if (fields.status) patch.status = fields.status;
    if (fields.status === 'confirmed') patch.confirmed_at = new Date().toISOString();
    return supabaseClient.from('cases').update(patch).eq('id', row.id).select()
      .then(function (res) {
        if (res.error) throw res.error;
        return { ok: true, remote: true };
      })
      .catch(function (err) {
        return { ok: true, remote: false, warning: String((err && err.message) || err) };
      });
  }

  // Module D handoff: when the confirmed visit is saved remotely AND a FHIR
  // export endpoint is configured in js/env.js, submit the bundle once.
  // Never blocks or throws — export problems must not undo a confirmation.
  function queueFhirExport(row) {
    try {
      var envCfg = (typeof window !== 'undefined' && window.SIH_ENV) ? window.SIH_ENV : null;
      var SIH = window.SIH || {};
      if (!envCfg || !envCfg.fhirEdgeUrl || !SIH.Fhir || !SIH.History) return;
      var history = row.history && typeof row.history === 'object' ? row.history : SIH.History.fromLegacy(row);
      var bundle = SIH.Fhir.buildBundle({
        patient: history.patient || SIH.History.empty().patient,
        history: history,
        documents: [],
        practitionerName: 'Doctor (confirmed via review)'
      });
      var warnings = SIH.Fhir.validate(bundle);
      if (warnings.length) console.warn('FHIR export warnings:', warnings);
      fetch(envCfg.fhirEdgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visit_id: row.id, bundle: bundle })
      }).catch(function (err) { console.warn('FHIR export failed (non-fatal):', err); });
    } catch (e) { console.warn('FHIR export skipped:', e); }
  }

  function markReviewedInQueue(itemEl, row) {
    if (!itemEl) return;
    var btn = itemEl.querySelector('.qrx-btn.review');
    if (btn) btn.remove();
    var status = itemEl.querySelector('.qstatus');
    if (status) {
      status.classList.remove('pending');
      status.classList.add('reviewed');
      status.textContent = (typeof t === 'function') ? t('✓ Reviewed — awaiting prescription') : '✓ Reviewed — awaiting prescription';
    }
    var rxBtn = itemEl.querySelector('.qrx-btn:not(.review)');
    if (rxBtn) rxBtn.textContent = row.prescription ? (typeof t === 'function' ? t('Edit prescription') : 'Edit prescription') : (typeof t === 'function' ? t('Prescribe') : 'Prescribe');
  }

  function open(row, itemEl) {
    if (!row) return;
    ensureOverlay();
    var SIH = window.SIH || {};
    modal.innerHTML = '';

    // ---- header ----
    var head = el('div', 'rx-modal-head');
    var headLeft = el('div');
    var title = el('h3', null, row.patient_name ? 'Review — ' + row.patient_name : 'Review case');
    headLeft.appendChild(title);
    var meta = el('p', null, (function () {
      var bits = [];
      if (row.patient_age) bits.push('Age ' + row.patient_age);
      if (row.patient_gender) bits.push(row.patient_gender);
      if (row.abha_number) bits.push('ABHA ' + row.abha_number);
      if (row.code) bits.push(row.code);
      return bits.length ? bits.join(' · ') : 'Structured summary — draft';
    })());
    headLeft.appendChild(meta);
    head.appendChild(headLeft);
    var closeBtn = el('button', 'rx-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    head.appendChild(closeBtn);
    modal.appendChild(head);

    // ---- red-flag panel (triage) ----
    var flags = flaggedItems(row);
    if (flags.length || row.urgent) {
      var flagBox = el('div', 'sih-review-flags');
      flagBox.appendChild(el('div', 'sih-review-flag-title', '🚨 Triage flags on this case'));
      flags.forEach(function (f) {
        flagBox.appendChild(el('div', 'sih-review-flag', '• ' + f.advice));
      });
      if (row.urgent && !flags.length) flagBox.appendChild(el('div', 'sih-review-flag', '• Marked urgent at intake'));
      modal.appendChild(flagBox);
    }

    // ---- physician-editable summary ----
    modal.appendChild(el('span', 'rx-section-label', 'Physician summary — edit before confirming'));
    var textarea = el('textarea', 'sih-review-summary');
    textarea.rows = 14;
    textarea.value = buildSummary(row);
    modal.appendChild(textarea);

    // ---- coverage note (what was / was not captured) ----
    if (SIH.History) {
      var h = SIH.History.fromLegacy(row);
      var gaps = SIH.History.criticalGaps(h);
      var note = el('p', 'sih-review-gaps');
      if (gaps.length) {
        var labels = gaps.map(function (g) {
          var sec = SIH.History.SECTIONS.filter(function (s) { return s.key === g; })[0];
          return sec ? sec.label : g;
        });
        note.textContent = 'Not captured: ' + labels.join(', ') +
          '. Add anything you elicit verbally to the summary, then confirm.';
        note.classList.add('warn');
      } else {
        note.textContent = 'All core history sections captured — confirm to finalise.';
      }
      modal.appendChild(note);
    }

    // ---- actions ----
    var actions = el('div', 'rx-modal-actions');
    var cancelBtn = el('button', 'btn btn-ghost sih-review-cancel', 'Close');
    cancelBtn.type = 'button';
    var draftBtn = el('button', 'btn btn-ghost sih-review-draft', 'Save draft');
    draftBtn.type = 'button';
    var confirmBtn = el('button', 'btn btn-primary sih-review-confirm', 'Confirm review ✓');
    confirmBtn.type = 'button';
    actions.appendChild(cancelBtn);
    actions.appendChild(draftBtn);
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);

    var statusLine = el('p', 'sih-review-status');
    modal.appendChild(statusLine);

    overlay.classList.add('open');
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);

    function note(msg, isWarn) {
      statusLine.textContent = msg;
      statusLine.classList.toggle('warn', !!isWarn);
    }

    function save(mode) {
      var text = textarea.value;
      var isFinal = mode === 'final';
      row.summary_draft = text;
      if (isFinal) {
        row.summary_final = text;
        row.status = 'confirmed';
        row.confirmed_at = new Date().toISOString();
      }
      note(isFinal ? 'Saving…' : 'Saving draft…');
      persist(row, {
        summaryDraft: text,
        summaryFinal: isFinal ? text : undefined,
        status: isFinal ? 'confirmed' : 'draft'
      }).then(function (res) {
        if (res.warning) {
          note((isFinal ? 'Confirmed in-session. ' : 'Draft saved in-session. ') +
            'Database not updated (' + res.warning + ') — run sql/schema.sql to add the review columns.', true);
        } else if (!res.remote) {
          note(isFinal ? 'Confirmed in-session (offline / local case).' : 'Draft saved in-session.');
        } else {
          note(isFinal ? 'Confirmed and saved to the record.' : 'Draft saved to the record.');
        }
        if (isFinal) {
          markReviewedInQueue(itemEl, row);
          if (typeof window.__onCaseReviewed === 'function') window.__onCaseReviewed(row);
          queueFhirExport(row); // best-effort Module D handoff when configured
          setTimeout(close, res.remote ? 700 : 1200);
        } else if (typeof window.__onCaseDrafted === 'function') {
          window.__onCaseDrafted(row);
        }
      });
    }

    draftBtn.addEventListener('click', function () { save('draft'); });
    confirmBtn.addEventListener('click', function () { save('final'); });
    setTimeout(function () { textarea.focus(); }, 50);
  }

  window.SIH = window.SIH || {};
  window.SIH.Review = { open: open };
})();
