/*
 * SIH26047 — core/consent.js
 * ---------------------------------------------------------------------------
 * Consent engine (Module D). Pure module.
 *
 * Records granular, revocable, timestamped consent events and exposes the
 * gate every export/share path must consult (FHIR push, analytics, document
 * storage). Consent records are also persisted to the `consents` table by the
 * persistence layer; this module is the in-memory authority + validator.
 */
(function (global) {
  'use strict';

  // Fixed, versioned consent texts — referenced by key so UI translations are
  // separate from the record. Never string-match on free text.
  var SCOPES = {
    capture:  { key: 'capture',  textKey: 'consent_capture',  label: 'Store structured health history for this visit' },
    documents:{ key: 'documents',textKey: 'consent_documents',label: 'Scan, store and extract my medical documents' },
    share:    { key: 'share',    textKey: 'consent_share',    label: 'Share this visit with my ABHA health record (ABDM)' },
    analytics:{ key: 'analytics',textKey: 'consent_analytics',label: 'Use de-identified data for research / dashboards' }
  };

  function uid() {
    return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Create a consent record. `patientRef` can be an ABHA number/address or a
  // local patient id; `method` one of audio|text|tap|assistant.
  function grant(patientRef, scopes, method) {
    var now = new Date().toISOString();
    var list = Array.isArray(scopes) ? scopes : [scopes];
    var unknown = list.filter(function (s) { return !SCOPES[s]; });
    if (unknown.length) throw new Error('Unknown consent scope(s): ' + unknown.join(', '));
    return {
      id: uid(),
      patient_ref: patientRef || '',
      scopes: list.slice(),
      method: method || 'tap',
      granted_at: now,
      revoked_at: null
    };
  }

  function revoke(record) {
    if (!record) return record;
    record.revoked_at = new Date().toISOString();
    return record;
  }

  // Is a scope currently granted? Consent is per patient: an empty patientRef
  // (no ABHA yet) still allows in-clinic capture but never external sharing.
  function canShare(records, scope) {
    if (scope === 'share' && !(records || []).some(function (r) { return r && r.patient_ref && !r.revoked_at; })) {
      return false; // sharing always requires an identified patient
    }
    return (records || []).some(function (r) {
      return r && !r.revoked_at && r.scopes.indexOf(scope) !== -1;
    });
  }

  // Which of the four scopes are currently granted (for rendering a summary).
  function grantedScopes(records) {
    var out = [];
    Object.keys(SCOPES).forEach(function (s) {
      if (canShare(records, s)) out.push(s);
    });
    return out;
  }

  function serialize(record) {
    return JSON.parse(JSON.stringify(record));
  }

  var api = {
    SCOPES: SCOPES,
    uid: uid,
    grant: grant,
    revoke: revoke,
    canShare: canShare,
    grantedScopes: grantedScopes,
    serialize: serialize
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else {
    global.SIH = global.SIH || {};
    global.SIH.Consent = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
