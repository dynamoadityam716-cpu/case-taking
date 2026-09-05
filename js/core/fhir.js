/*
 * SIH26047 — core/fhir.js
 * ---------------------------------------------------------------------------
 * FHIR R4 bundle builder (Module D). Pure module.
 *
 * Converts a visit (patient + history + prescriptions + document references +
 * consent) into a FHIR R4 "collection" Bundle whose resources follow ABDM /
 * NDHM conventions (Patient, Condition, Observation, MedicationStatement,
 * AllergyIntolerance, DocumentReference, Consent, Provenance). It is a
 * *builder + structural validator* — clinical judgment stays with the doctor.
 *
 * The output is credential- and network-agnostic: the same bundle can be
 * printed, stored, or pushed through the `abdmGateway` (sandbox or, after
 * certification, production) in `supabase/functions/`.
 */
(function (global) {
  'use strict';

  function code(fn) { return fn.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40); }

  function ref(kind, id) { return kind + '/' + id; }

  function genderCode(g) {
    var v = String(g || '').toLowerCase();
    if (v.indexOf('female') !== -1 || v === 'f' || v === 'महिला' || v === 'स्त्री') return 'female';
    if (v.indexOf('male') !== -1 || v === 'm' || v === 'पुरुष') return 'male';
    return 'unknown';
  }

  // birthDate cannot be derived from age reliably; ABDM captures age at the
  // time of registration. We emit age as a Patient.extension (ABDM style) and
  // only add birthDate when a real one is passed.
  function patientResource(p) {
    var res = {
      resourceType: 'Patient',
      id: 'patient-' + code(p.abha || p.name || 'p'),
      meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient'] },
      name: [{ text: p.name || '' }],
      gender: genderCode(p.gender)
    };
    var ext = [];
    if (p.abha) ext.push({ url: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/ABHA-Number', valueString: p.abha });
    if (p.age) ext.push({ url: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient-age', valueAge: { value: Number(p.age) || 0, unit: 'years', system: 'http://unitsofmeasure.org', code: 'a' } });
    if (p.weight) res.extension = ext.concat([{ url: 'http://hl7.org/fhir/StructureDefinition/patient-weight', valueQuantity: { value: Number(p.weight) || 0, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' } }]);
    else if (ext.length) res.extension = ext;
    if (p.blood) res.extension = (res.extension || []).concat([{ url: 'http://hl7.org/fhir/StructureDefinition/patient-bloodGroup', valueString: p.blood }]);
    return res;
  }

  function conditionResource(complaint, idx, patientId) {
    return {
      resourceType: 'Condition',
      id: 'condition-' + idx,
      meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition'] },
      subject: { reference: ref('Patient', patientId) },
      code: { text: complaint || 'Unspecified complaint' },
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'provisional' }] }
    };
  }

  function observationResource(entry, idx, patientId) {
    return {
      resourceType: 'Observation',
      id: 'observation-' + idx,
      meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Observation'] },
      status: 'final',
      code: { text: entry.test || entry.name || 'Investigation' },
      subject: { reference: ref('Patient', patientId) },
      valueString: entry.value || entry.result || '',
      referenceRange: entry.range ? [{ text: entry.range }] : undefined,
      interpretation: entry.abnormal ? [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A' }] }] : undefined
    };
  }

  function medicationResource(med, idx, patientId) {
    var res = {
      resourceType: 'MedicationStatement',
      id: 'medication-' + idx,
      meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationStatement'] },
      status: med.ongoing === false ? 'stopped' : 'active',
      medicationCodeableConcept: { text: med.name || '' },
      subject: { reference: ref('Patient', patientId) }
    };
    var dose = [med.dose, med.frequency].filter(Boolean).join(' ');
    if (dose) res.dosage = [{ text: dose }];
    return res;
  }

  function allergyResource(all, idx, patientId) {
    return {
      resourceType: 'AllergyIntolerance',
      id: 'allergy-' + idx,
      meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/AllergyIntolerance'] },
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
      code: { text: all.agent || '' },
      reaction: all.reaction ? [{ manifestation: [{ text: all.reaction }] }] : undefined,
      patient: { reference: ref('Patient', patientId) }
    };
  }

  function documentResource(doc, idx, patientId) {
    return {
      resourceType: 'DocumentReference',
      id: 'docref-' + idx,
      meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentReference'] },
      status: 'current',
      type: { text: doc.kind || 'Medical document' },
      date: doc.date || new Date().toISOString(),
      content: [{ attachment: { contentType: doc.contentType || 'application/octet-stream', title: doc.title || 'Uploaded document', url: doc.url || '' } }],
      subject: { reference: ref('Patient', patientId) }
    };
  }

  // Convert an in-memory consent record to a FHIR Consent resource.
  function consentResource(consent, patientId) {
    return {
      resourceType: 'Consent',
      id: 'consent-' + code(consent.id || 'main'),
      status: consent.revoked_at ? 'inactive' : 'active',
      scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentcategory', code: 'npp' }] }],
      patient: { reference: ref('Patient', patientId) },
      dateTime: consent.granted_at || new Date().toISOString(),
      provision: {
        purpose: consent.scopes.map(function (s) { return { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: s === 'share' ? 'HLAWR' : 'CAREMGT' }] }; }),
        action: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentaction', code: 'access' }] }]
      }
    };
  }

  // Build a full Bundle from a visit-shaped object.
  // input: { patient:{...}, history:{...}, documents:[...], prescription:{...},
  //          consent:{...}, practitionerName, orgName }
  function buildBundle(input) {
    var src = input || {};
    var patient = src.patient || {};
    var history = src.history || {};
    var entries = [];

    var pRes = patientResource(patient);
    entries.push({ fullUrl: 'urn:uuid:' + pRes.id, resource: pRes });
    var patientId = pRes.id;

    var complaints = history.complaints || [];
    if (complaints.length === 0 && patient.name) {
      // still include one provisional condition so the bundle is not empty
      complaints = ['History taken — no specific complaint recorded'];
    }
    complaints.forEach(function (c, i) {
      entries.push({ fullUrl: 'urn:uuid:condition-' + i, resource: conditionResource(c, i, patientId) });
    });

    var labs = history.labs || [];
    labs.forEach(function (lab, i) {
      entries.push({ fullUrl: 'urn:uuid:observation-' + i, resource: observationResource(lab, i, patientId) });
    });

    (history.drugs || []).forEach(function (med, i) {
      entries.push({ fullUrl: 'urn:uuid:medication-' + i, resource: medicationResource(med, i, patientId) });
    });

    (history.allergies || []).forEach(function (all, i) {
      entries.push({ fullUrl: 'urn:uuid:allergy-' + i, resource: allergyResource(all, i, patientId) });
    });

    (src.documents || []).forEach(function (doc, i) {
      entries.push({ fullUrl: 'urn:uuid:docref-' + i, resource: documentResource(doc, i, patientId) });
    });

    if (src.consent) {
      var cRes = consentResource(src.consent, patientId);
      entries.push({ fullUrl: 'urn:uuid:' + cRes.id, resource: cRes });
    }

    if (src.practitionerName || src.orgName) {
      entries.push({
        fullUrl: 'urn:uuid:provenance-main',
        resource: {
          resourceType: 'Provenance',
          id: 'provenance-main',
          target: entries.filter(function (e) { return e.resource.resourceType !== 'Provenance'; }).map(function (e) { return { reference: e.fullUrl }; }),
          recorded: new Date().toISOString(),
          agent: [{
            who: { display: src.practitionerName || 'Practitioner (doctor)' },
            onBehalfOf: src.orgName ? { display: src.orgName } : undefined
          }]
        }
      });
    }

    var bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: entries
    };
    return bundle;
  }

  // Lightweight structural validation: returns an array of warning strings.
  // Throws only on a genuinely unusable bundle.
  function validate(bundle) {
    var warnings = [];
    if (!bundle || bundle.resourceType !== 'Bundle') throw new Error('Not a FHIR Bundle');
    if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) warnings.push('Bundle has no entries');
    var patient = bundle.entry.filter(function (e) { return e.resource.resourceType === 'Patient'; });
    if (patient.length !== 1) warnings.push('Expected exactly one Patient resource');
    if (patient.length && !patient[0].resource.name[0].text) warnings.push('Patient has no name');
    var consents = bundle.entry.filter(function (e) { return e.resource.resourceType === 'Consent'; });
    consents.forEach(function (c) {
      if (c.resource.status !== 'active') warnings.push('Consent is not active — sharing may be blocked');
    });
    var count = bundle.entry.length;
    if (bundle.total !== undefined && bundle.total !== count) warnings.push('Bundle.total does not match entry count');
    return warnings;
  }

  var api = {
    buildBundle: buildBundle,
    validate: validate,
    genderCode: genderCode,
    patientResource: patientResource
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else {
    global.SIH = global.SIH || {};
    global.SIH.Fhir = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
