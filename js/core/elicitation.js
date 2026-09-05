/*
 * SIH26047 — core/elicitation.js
 * ---------------------------------------------------------------------------
 * Complaint-adaptive elicitation (Module A). Pure module.
 *
 * Given the patient's chief complaints this returns the ordered set of
 * follow-up probes (SOCRATES-style) a clinician would ask. It is a
 * deterministic rule graph — no network, no LLM — so an interview never
 * dead-ends offline. Each probe has a stable `key` so the engine can be asked
 * "what should I ask next?" without repeating questions already asked.
 *
 * A question is only returned once per patient (dedup by key). Multiple
 * complaints share probes (e.g. two pain complaints ask site/onset once).
 */
(function (global) {
  'use strict';

  // probe categories; `match` is a list of keyword regexes OR plain strings.
  var CATEGORIES = [
    {
      id: 'pain',
      match: [/pain/i, /ache/i, /hurt/i, /stiff/i, /burning/i, /sore/i, /cramp/i],
      probes: [
        { key: 'pain_site', q: 'Where exactly is the pain?', opts: ['Front', 'Sides', 'All over', 'Not sure'] },
        { key: 'pain_onset', q: 'When did it start?', opts: ['Today', 'A few days ago', '1-2 weeks ago', '1+ month ago'] },
        { key: 'pain_character', q: 'How would you describe it?', opts: ['Dull / aching', 'Sharp / stabbing', 'Burning', 'Throbbing', 'Pressing'] },
        { key: 'pain_severity', q: 'How bad is it right now (0 = none, 10 = worst)?', opts: ['0-3 (mild)', '4-6 (moderate)', '7-10 (severe)'] },
        { key: 'pain_aggravating', q: 'What makes it worse?', opts: ['Movement', 'Eating', 'Cold weather', 'Stress', 'Nothing in particular'] },
        { key: 'pain_relieving', q: 'What makes it better?', opts: ['Rest', 'Heat', 'Cold', 'Medicine', 'Nothing'] },
        { key: 'pain_timing', q: 'Is it constant or does it come and go?', opts: ['Constant', 'Comes and goes', 'Only at night', 'Only in the morning'] },
        { key: 'pain_radiation', q: 'Does it spread anywhere else?', opts: ['No', 'To the back', 'To the arm/shoulder', 'To the head', 'Down the leg'] }
      ]
    },
    {
      id: 'fever',
      match: [/fever/i, /temperature/i, /\/bukhar/i, /ताप/i, /बुखार/i, /तापमान/i],
      probes: [
        { key: 'fever_duration', q: 'How long has the fever lasted?', opts: ['1-2 days', '3-5 days', 'Longer than 5 days'] },
        { key: 'fever_pattern', q: 'When is it highest?', opts: ['Morning', 'Evening / night', 'All the time'] },
        { key: 'fever_associated', q: 'Any chills, body ache or rash with it?', opts: ['Chills', 'Body ache', 'Rash', 'None of these'] }
      ]
    },
    {
      id: 'cough_resp',
      match: [/cough/i, /khansi/i, /खांसी/i, /खोकला/i, /phlegm/i, /sputum/i],
      probes: [
        { key: 'cough_type', q: 'Dry cough or with phlegm?', opts: ['Dry', 'With phlegm'] },
        { key: 'cough_duration', q: 'How long has the cough lasted?', opts: ['Under a week', '1-2 weeks', '2+ weeks'] },
        { key: 'cough_night', q: 'Does it disturb your sleep at night?', opts: ['Yes', 'No'] }
      ]
    },
    {
      id: 'gi',
      match: [/stomach/i, /abdomen/i, /belly/i, /vomit/i, /nausea/i, /loose motion/i, /diarrhoea/i, /diarrhea/i, /पेट/i, /उल्टी/i, /दस्त/i, /पोट/i],
      probes: [
        { key: 'gi_after_food', q: 'Is it related to eating?', opts: ['Worse after meals', 'Better after meals', 'No relation'] },
        { key: 'gi_nausea', q: 'Any nausea or vomiting?', opts: ['Yes', 'No'] },
        { key: 'gi_stool', q: 'Any change in your stool (loose / constipated / blood)?', opts: ['Loose motions', 'Constipated', 'Blood in stool', 'No change'] },
        { key: 'gi_duration', q: 'How long has this been going on?', opts: ['A few days', '1-2 weeks', '1+ month'] }
      ]
    },
    {
      id: 'head',
      match: [/headache/i, /head ache/i, /migraine/i, /सिरदर्द/i, /डोकेदुखी/i, /dizziness/i, /vertigo/i, /चक्कर/i],
      probes: [
        { key: 'head_site', q: 'Where is the pain or dizziness?', opts: ['Front of head', 'One side', 'Back of head', 'All over'] },
        { key: 'head_triggers', q: 'Does light, sound or smell make it worse?', opts: ['Light', 'Sound', 'Smell', 'None'] },
        { key: 'head_visual', q: 'Any blurring of vision or spinning sensation?', opts: ['Blurred vision', 'Spinning', 'Neither'] }
      ]
    },
    {
      id: 'sleep_mood',
      match: [/sleep/i, /insomnia/i, /anxious/i, /anxiety/i, /stress/i, /sad/i, /depress/i, /नींद/i, /चिंता/i, /तणाव/i, /झोप/i],
      probes: [
        { key: 'sleep_issue', q: "What's the main problem?", opts: ['Falling asleep', 'Waking up at night', 'Waking too early', 'Feeling tired despite sleep'] },
        { key: 'sleep_duration', q: 'How long has this been happening?', opts: ['A few days', '1-2 weeks', '1+ month'] },
        { key: 'mood_appetite', q: 'Has your appetite or interest in things changed?', opts: ['Yes, reduced', 'Yes, increased', 'No change'] }
      ]
    },
    {
      id: 'skin',
      match: [/itch/i, /rash/i, /skin/i, /hives/i, /खुजली/i, /दाने/i, /चाम/i, /त्वचा/i, /खाज/i],
      probes: [
        { key: 'skin_site', q: 'Where on the body is it?', opts: ['Localized (one spot)', 'Spread over many areas'] },
        { key: 'skin_trigger', q: 'Any new food, soap, medicine or product before it started?', opts: ['New food', 'New soap/cream', 'New medicine', 'Not sure'] },
        { key: 'skin_bleed', q: 'Any oozing, bleeding or fever with it?', opts: ['Oozing', 'Bleeding', 'Fever', 'None'] }
      ]
    },
    {
      id: 'joints',
      match: [/joint/i, /sandhi/i, /जोड़/i, /संधि/i, /सांधे/i, /gout/i, /arthritis/i],
      probes: [
        { key: 'joint_site', q: 'Which joints are affected?', opts: ['Knees', 'Hands / wrists', 'Back / spine', 'Multiple joints'] },
        { key: 'joint_morning', q: 'Is it worst in the morning or after rest?', opts: ['Morning stiffness', 'After rest', 'End of day', 'No pattern'] },
        { key: 'joint_swelling', q: 'Any swelling, redness or warmth over the joints?', opts: ['Swelling', 'Redness', 'Warmth', 'None'] }
      ]
    },
    {
      id: 'urinary',
      match: [/urine/i, /urination/i, /burning.*urine/i, /पेशाब/i, /मूत्र/i, /लघवी/i],
      probes: [
        { key: 'urine_burning', q: 'Any burning or pain while passing urine?', opts: ['Burning', 'Pain', 'Neither'] },
        { key: 'urine_frequency', q: 'Passing urine much more often than usual?', opts: ['Yes', 'No'] },
        { key: 'urine_blood', q: 'Any blood in the urine?', opts: ['Yes', 'No'] }
      ]
    }
  ];

  // A generic fallback used when no category matches — the same short set for
  // every unlisted complaint, kept minimal so it never feels interrogative.
  var GENERIC = [
    { key: 'gen_duration', q: 'How long has this been going on?', opts: ['A few days', '1-2 weeks', '1+ month'] },
    { key: 'gen_severity', q: 'How does it affect your day-to-day life?', opts: ['Mild — hardly affects me', 'Moderate — I have to adjust', 'Severe — difficult to manage'] },
    { key: 'gen_pattern', q: 'Is it there all the time or does it come and go?', opts: ['Constant', 'Comes and goes'] }
  ];

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  function matches(text, entry) {
    var t = norm(text);
    if (!t) return false;
    return entry.some(function (m) {
      if (m instanceof RegExp) { m.lastIndex = 0; return m.test(t); }
      return t.indexOf(norm(m)) !== -1;
    });
  }

  // The ordered probe list relevant to the given complaints (no duplicates).
  function probesForComplaints(complaints) {
    var asked = {};
    var out = [];
    (complaints || []).forEach(function (c) {
      CATEGORIES.forEach(function (cat) {
        if (!matches(c, cat.match)) return;
        cat.probes.forEach(function (probe) {
          if (asked[probe.key]) return;
          asked[probe.key] = true;
          out.push({ key: probe.key, q: probe.q, opts: probe.opts.slice() });
        });
      });
    });
    return out;
  }

  // Complaints that no category understood → still get the generic set once.
  function genericProbesForComplaints(complaints) {
    var out = [];
    var matchedAny = false;
    (complaints || []).forEach(function (c) {
      CATEGORIES.forEach(function (cat) { if (matches(c, cat.match)) matchedAny = true; });
    });
    // Also include generic probes when nothing at all matched.
    if (!matchedAny) return GENERIC.map(function (p) { return { key: p.key, q: p.q, opts: p.opts.slice() }; });
    return out;
  }

  // Full deterministic question plan for a patient's complaints, de-duplicated
  // and category-ordered: relevant probes first, generic fallback only when
  // the complaint matched nothing.
  function plan(complaints) {
    var specific = probesForComplaints(complaints);
    var generic = genericProbesForComplaints(complaints);
    return specific.concat(generic);
  }

  // Given previously answered probe keys, return the next unanswered probe.
  function nextUnanswered(complaints, answeredKeys) {
    var planList = plan(complaints);
    var done = {};
    (answeredKeys || []).forEach(function (k) { done[k] = true; });
    for (var i = 0; i < planList.length; i++) {
      if (!done[planList[i].key]) return planList[i];
    }
    return null;
  }

  var api = {
    CATEGORIES: CATEGORIES,
    GENERIC: GENERIC,
    plan: plan,
    nextUnanswered: nextUnanswered
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else {
    global.SIH = global.SIH || {};
    global.SIH.Elicitation = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
