
  // ---- Entry language picker — opens right after login / workspace entry ----
  (function setupEntryLangPicker(){
    const overlay = document.getElementById('langPickOverlay');
    if(!overlay) return;
    let opened = false;   // popup currently on screen
    let chosen = false;   // a language was already picked this session — never re-ask
    function openPicker(){
      if(opened || chosen) return;
      opened = true;
      overlay.classList.add('open');
    }
    function closePicker(){ overlay.classList.remove('open'); }
    // Dismissing (✕ / backdrop / Esc) leaves the popup able to come back
    // if entry fires again; only picking a language finalises the choice.
    function dismiss(){ opened = false; closePicker(); }
    function resetPicker(){ opened = false; chosen = false; closePicker(); }
    function choose(code){
      chosen = true;
      dismiss();
      if(window.setUiLang) window.setUiLang(code);
      // Language picked — send the user straight to the case-taking form
      // instead of leaving them at the top of the landing page.
      const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      setTimeout(function(){
        const demo = document.getElementById('demo');
        if(demo && demo.scrollIntoView){
          demo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }
        // on phones/tablets the notebook shows one page at a time — make
        // sure it is on the "fill the case" page, not the record page
        if(window.__notebookGoToPage && window.innerWidth <= 880){
          window.__notebookGoToPage('1');
        }
        // land the caret in the first field so filling can start immediately
        const nameField = document.getElementById('inName');
        if(nameField){
          try{ nameField.focus({ preventScroll: true }); }
          catch(err){ nameField.focus(); }
        }
      }, 160);
    }
    overlay.querySelectorAll('.lang-pick-btn').forEach(function(btn){
      btn.addEventListener('click', function(){ choose(btn.getAttribute('data-lang')); });
    });
    const closeBtn = document.getElementById('langPickClose');
    if(closeBtn) closeBtn.addEventListener('click', dismiss);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) dismiss(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && overlay.classList.contains('open')) dismiss(); });
    window.addEventListener('appenter', openPicker);
    window.addEventListener('appexit', resetPicker);
    // A restored Supabase session may authenticate before this script runs
    if(window.__appEntered) openPicker();
    window.__openLangPick = openPicker;
    window.__closeLangPick = closePicker;
  })();
