/*
 * SIH26047 — intake-pages.js
 * ---------------------------------------------------------------------------
 * Reorganises the single long case-taking form into four spacious pages:
 *
 *   1 · Patient       — scan (optional), patient details, ABHA + consent
 *   2 · Past history  — past illness, medicines, allergies, family, lifestyle,
 *                       Ayurveda background (was the collapsed "fuller history")
 *   3 · Symptoms      — body type, symptom chips, follow-ups, aggravators
 *   4 · Review & send — notes + submit
 *
 * Implementation notes:
 *  • The page moves DOM NODES — no element is recreated, so every id,
 *    listener and OCR/chat binding keeps working.
 *  • Navigation is progressive (Back/Next + clickable dots); validation stays
 *    with the submit button exactly as before.
 *  • Exposes window.__intakeResetPage() so the submit flow can jump back to
 *    page 1 after a successful submission.
 */
(function () {
  'use strict';

  var root = document.querySelector('.demo-side.form');
  if (!root) return;

  var PAGES = [
    { title: 'Patient details', eyebrow: 'Who is this visit for?' },
    { title: 'Past history', eyebrow: 'What came before today?' },
    { title: 'Symptoms', eyebrow: 'What is bothering you today?' },
    { title: 'Anything else & send', eyebrow: 'Notes for the doctor' }
  ];

  // ---- classify an existing top-level child of the form into a page ----
  function pageOf(el) {
    var cls = el.className || '';
    if (typeof cls === 'string' && cls.indexOf('scan-block') !== -1) return 1;
    if (el.id === 'consentBlock') return 1;
    if (typeof cls === 'string' && cls.indexOf('patient-details') !== -1) return 1;
    if (el.id === 'fullHistoryBlock') return 2;
    if (el.id === 'stepProgress') return -1;               // legacy bar — hidden
    if (typeof cls === 'string' && cls.indexOf('prakriti-select') !== -1) return 3;
    if (el.id === 'followupBlock') return 3;
    if (typeof cls === 'string' && cls.indexOf('other-complaint') !== -1) return 3;
    if (typeof cls === 'string' && cls.indexOf('symptom-block') !== -1) return 3;
    if (typeof cls === 'string' && cls.indexOf('notes-field') !== -1) return 4;
    if (typeof cls === 'string' && cls.indexOf('form-actions') !== -1) return 4;
    if (el.id === 'submitHint') return 4;
    if (typeof cls === 'string' && cls.indexOf('demo-label') !== -1) {
      var t = (el.textContent || '').toLowerCase();
      if (t.indexOf('step 1') !== -1) return 1;
      if (t.indexOf('step 5') !== -1) return 4;
      return 3; // step 2/3/4 all belong to the symptoms experience
    }
    return 1; // anything unexpected stays on the first page
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  // ---- build page shells, header + progress, footer nav ----
  var kids = Array.prototype.slice.call(root.children);
  var legacyProgress = document.getElementById('stepProgress');
  if (legacyProgress) legacyProgress.style.display = 'none';

  var pagesWrap = el('div', 'intake-pages');
  var pageEls = [];

  var header = el('div', 'intake-head');
  var headTitle = el('h2', 'intake-head-title');
  var headSub = el('p', 'intake-head-sub');
  header.appendChild(headTitle);
  header.appendChild(headSub);
  pagesWrap.appendChild(header);

  var dots = el('div', 'intake-dots');
  for (var d = 0; d < PAGES.length; d++) {
    (function (idx) {
      var dot = el('button', 'intake-dot', String(idx + 1));
      dot.type = 'button';
      dot.title = 'Go to: ' + PAGES[idx].title;
      dot.addEventListener('click', function () { goTo(idx + 1); });
      dots.appendChild(dot);
    })(d);
  }
  pagesWrap.appendChild(dots);

  for (var i = 0; i < PAGES.length; i++) {
    var page = el('section', 'intake-page');
    page.dataset.page = String(i + 1);
    if (i === 1) page.classList.add('page-past');
    pageEls.push(page);
    pagesWrap.appendChild(page);
  }

  var nav = el('div', 'intake-nav');
  var backBtn = el('button', 'btn btn-ghost intake-back', '← Back');
  backBtn.type = 'button';
  var countEl = el('span', 'intake-count', '1 of ' + PAGES.length);
  var nextBtn = el('button', 'btn btn-primary intake-next', 'Next →');
  nextBtn.type = 'button';
  nav.appendChild(backBtn);
  nav.appendChild(countEl);
  nav.appendChild(nextBtn);
  pagesWrap.appendChild(nav);

  // Grab a reference to the past-history node BEFORE the children are moved
  // into the (not-yet-attached) page container — getElementById would miss it
  // once it is inside a detached subtree.
  var past = document.getElementById('fullHistoryBlock');

  // ---- move the real form content into the pages (nodes keep bindings) ----
  kids.forEach(function (child) {
    var p = pageOf(child);
    if (p < 1) return; // hidden legacy bits
    pageEls[p - 1].appendChild(child);
  });

  // The past-history <details> is its own page now. Replace it with a plain
  // always-visible <div> so it can never collapse or show a stray header.
  if (past && past.tagName === 'DETAILS') {
    var rep = document.createElement('div');
    rep.id = 'fullHistoryBlock';
    rep.className = past.className + ' page-open';
    while (past.firstChild) {
      var kid = past.firstChild;
      past.removeChild(kid);
      if (kid.tagName === 'SUMMARY') continue; // drop the old toggle header
      rep.appendChild(kid);
    }
    past.replaceWith(rep);
  }

  root.appendChild(pagesWrap);

  // ---- navigation ----
  var current = 1;

  function render() {
    pageEls.forEach(function (pg, idx) {
      var active = idx + 1 === current;
      pg.classList.toggle('active', active);
      pg.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    Array.prototype.forEach.call(dots.children, function (dot, idx) {
      dot.classList.toggle('active', idx + 1 === current);
      dot.classList.toggle('done', idx + 1 < current);
      dot.title = 'Go to: ' + t(PAGES[idx].title);
    });
    backBtn.style.visibility = current === 1 ? 'hidden' : 'visible';
    nextBtn.style.display = current === PAGES.length ? 'none' : 'inline-flex';
    headTitle.textContent = t(PAGES[current - 1].title);
    headSub.textContent = t(PAGES[current - 1].eyebrow);
    backBtn.textContent = t('← Back');
    nextBtn.textContent = t('Next →');
    countEl.textContent = current + ' of ' + PAGES.length;
  }

  function goTo(n) {
    if (n < 1 || n > PAGES.length) return;
    current = n;
    render();
    if (pagesWrap.scrollIntoView) pagesWrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  backBtn.addEventListener('click', function () { goTo(current - 1); });
  nextBtn.addEventListener('click', function () {
    if (current < PAGES.length) goTo(current + 1);
    else {
      var s = document.getElementById('submitCase');
      if (s) s.click();
    }
  });

  window.__intakeGoTo = goTo;
  window.__intakeResetPage = function () { goTo(1); };
  // called by the language toggle (app.js) so the header/nav/dots re-translate
  window.__intakeRefreshLang = render;
  goTo(1);
})();
