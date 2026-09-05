// ---- Notebook page tabs (mobile: show one page at a time, like flipping a notebook) ----
  (function setupNotebookTabs(){
    const tabs = document.querySelectorAll('.notebook-tab');
    const pages = document.querySelectorAll('.notebook-page');
    if(!tabs.length) return;

    function goToPage(n){
      tabs.forEach(function(tb){ tb.classList.toggle('active', tb.getAttribute('data-page') === String(n)); });
      pages.forEach(function(pg){ pg.classList.toggle('active', pg.getAttribute('data-page') === String(n)); });
    }
    window.__notebookGoToPage = goToPage;

    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        goToPage(tab.getAttribute('data-page'));
        const demoSection = document.getElementById('demo');
        if(demoSection && window.innerWidth <= 880){
          demoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  })();

  // nav toggle (mobile)
  document.getElementById('navToggle').addEventListener('click', function(){
    document.getElementById('navLinks').classList.toggle('open');
  });

  // hero paper/digital toggle
  const viewPaper = document.getElementById('viewPaper');
  const viewDigital = document.getElementById('viewDigital');
  const paperView = document.getElementById('paperView');
  const digitalView = document.getElementById('digitalView');
  viewPaper.addEventListener('click', function(){
    viewPaper.classList.add('active'); viewDigital.classList.remove('active');
    paperView.classList.add('active'); digitalView.classList.remove('active');
  });
  viewDigital.addEventListener('click', function(){
    viewDigital.classList.add('active'); viewPaper.classList.remove('active');
    digitalView.classList.add('active'); paperView.classList.remove('active');
  });
  // auto-cycle the demo once on load for attention (respects reduced motion by simply not animating further)
  let autoCycled = false;
  setTimeout(function(){
    if(!autoCycled){ viewDigital.click(); autoCycled = true; }
  }, 1800);

  // patient details
  const inNotes = document.getElementById('inNotes');
  const micBtn = document.getElementById('micBtn');
  const micUnsupported = document.getElementById('micUnsupported');

  (function setupSpeechToText(){
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micHint = micUnsupported;
    let hintTimer = null;
    function showHint(msg){
      micHint.textContent = msg;
      micHint.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function(){ micHint.classList.remove('show'); }, 8000);
    }
    if(!SpeechRecognition){
      micBtn.disabled = true;
      micHint.textContent = "Speech-to-text isn't supported in this browser — try Chrome or Edge.";
      micHint.classList.add('show');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    let listening = false;
    let starting = false;
    let baseText = '';

    recognition.addEventListener('start', function(){
      listening = true;
      starting = false;
      micBtn.classList.add('listening');
      micBtn.title = 'Tap to stop';
      baseText = inNotes.value.trim();
      micHint.classList.remove('show');
    });
    recognition.addEventListener('end', function(){
      listening = false;
      starting = false;
      micBtn.classList.remove('listening');
      micBtn.title = 'Speak to fill in';
    });
    recognition.addEventListener('error', function(e){
      listening = false;
      starting = false;
      micBtn.classList.remove('listening');
      micBtn.title = 'Speak to fill in';
      const n = e && e.error;
      if(n === 'not-allowed' || n === 'service-not-allowed'){
        showHint('Microphone access is blocked — allow the mic for this page and try again.');
      } else if(n === 'network'){
        showHint('Voice needs an internet connection — check your connection and try again.');
      } else if(n === 'no-speech' || n === 'aborted'){
        // silent/normal end — nothing to warn about
      } else {
        showHint(n ? ('Voice error: ' + n) : 'Voice did not start — please retry.');
      }
    });
    recognition.addEventListener('result', function(e){
      let finalTranscript = '';
      let interimTranscript = '';
      for(let i = 0; i < e.results.length; i++){
        const transcript = e.results[i][0].transcript;
        if(e.results[i].isFinal){ finalTranscript += transcript; }
        else { interimTranscript += transcript; }
      }
      const combined = (finalTranscript + ' ' + interimTranscript).trim();
      inNotes.value = (baseText ? baseText + ' ' : '') + combined;
    });

    micBtn.addEventListener('click', function(){
      if(listening){
        recognition.stop();
        return;
      }
      if(starting) return;
      try{
        // match the speech language to the UI language
        recognition.lang = (typeof uiLang !== 'undefined' && uiLang === 'hi') ? 'hi-IN' : ((typeof uiLang !== 'undefined' && uiLang === 'mr') ? 'mr-IN' : 'en-IN');
        starting = true;
        recognition.start();
      } catch(err){
        starting = false;
        if(err && err.name === 'InvalidStateError'){
          // a previous session is still winding down — retry once shortly
          setTimeout(function(){
            if(listening) return;
            try{
              starting = true;
              recognition.start();
            } catch(e2){ starting = false; }
          }, 350);
        } else {
          showHint('Voice could not start — allow microphone access and try again.');
        }
      }
    });
  })();

  // ---- Photo-to-scan intake (real OCR via Tesseract.js) ----
  (function setupPhotoScan(){
    const dropzone = document.getElementById('scanDropzone');
    const fileInput = document.getElementById('scanFileInput');
    const preview = document.getElementById('scanPreview');
    const previewFrame = document.getElementById('scanPreviewFrame');
    const previewImg = document.getElementById('scanPreviewImg');
    const statusEl = document.getElementById('scanStatus');
    const statusText = document.getElementById('scanStatusText');
    const fieldsNote = document.getElementById('scanFieldsNote');
    const clearBtn = document.getElementById('scanClearBtn');

    // Real OCR engine (Tesseract.js v5) — loaded lazily on the first scan and
    // cached by the browser afterwards, so later scans work offline.
    let ocrLibPromise = null;
    function ensureTesseract(){
      if(window.Tesseract) return Promise.resolve(window.Tesseract);
      if(!ocrLibPromise){
        ocrLibPromise = new Promise(function(resolve, reject){
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
          script.async = true;
          script.onload = function(){ window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR engine loaded but did not start.')); };
          script.onerror = function(){ reject(new Error('Could not download the OCR engine — check your internet connection and try again.')); };
          document.head.appendChild(script);
        });
        // allow one retry after a transient failure
        ocrLibPromise.catch(function(){ ocrLibPromise = null; });
      }
      return ocrLibPromise;
    }
    let ocrRunId = 0;

    function openPicker(){ fileInput.click(); }
    dropzone.addEventListener('click', openPicker);
    dropzone.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openPicker(); }
    });
    ['dragover','dragenter'].forEach(function(evt){
      dropzone.addEventListener(evt, function(e){ e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave','drop'].forEach(function(evt){
      dropzone.addEventListener(evt, function(e){ e.preventDefault(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', function(e){
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if(file){ handleFile(file); }
    });
    fileInput.addEventListener('change', function(){
      if(fileInput.files && fileInput.files[0]){ handleFile(fileInput.files[0]); }
    });

    function handleFile(file){
      if(!file.type || file.type.indexOf('image') !== 0) return;
      const reader = new FileReader();
      reader.onload = function(e){
        previewImg.src = e.target.result;
        preview.classList.add('show');
        previewFrame.classList.add('scanning');
        statusEl.classList.remove('done');
        statusText.textContent = 'Scanning photo…';
        fieldsNote.classList.remove('show');
        runOcr(e.target.result, ++ocrRunId);
      };
      reader.readAsDataURL(file);
    }

    // Turn the photo into a clean grayscale, high-contrast image first —
    // photos of paper are rarely flat and white, and a contrast stretch helps
    // Tesseract a lot on real-world phone shots.
    function preprocessForOcr(dataUrl){
      return new Promise(function(resolve, reject){
        const img = new Image();
        img.onload = function(){
          try{
            let w = img.naturalWidth || 1200;
            let h = img.naturalHeight || 900;
            const maxDim = 2400;
            const scale = Math.min(1, maxDim / Math.max(w, h));
            w = Math.max(2, Math.round(w * scale));
            h = Math.max(2, Math.round(h * scale));
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const id = ctx.getImageData(0, 0, w, h);
            const d = id.data;
            const hist = new Array(256).fill(0);
            for(let i = 0; i < d.length; i += 4){
              hist[(d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) | 0]++;
            }
            const total = d.length / 4;
            let cum = 0, lo = 0;
            for(let i = 0; i < 256; i++){ cum += hist[i]; if(cum >= total * 0.01){ lo = i; break; } }
            cum = 0; let hi = 255;
            for(let i = 255; i >= 0; i--){ cum += hist[i]; if(cum >= total * 0.01){ hi = i; break; } }
            if(hi - lo < 10){ lo = 0; hi = 255; }
            const span = hi - lo;
            for(let i = 0; i < d.length; i += 4){
              const lum = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) | 0;
              const v = Math.max(0, Math.min(255, Math.round((lum - lo) * 255 / span)));
              d[i] = v; d[i+1] = v; d[i+2] = v;
            }
            ctx.putImageData(id, 0, 0);
            resolve(cv.toDataURL('image/png'));
          } catch(err){ reject(err); }
        };
        img.onerror = function(){ reject(new Error('Could not read the photo.')); };
        img.src = dataUrl;
      });
    }

    function runOcr(dataUrl, runId){
      const startedAt = Date.now();
      statusText.textContent = 'Preparing photo…';
      Promise.all([ensureTesseract(), preprocessForOcr(dataUrl)]).then(function(results){
        if(runId !== ocrRunId) return null;
        statusText.textContent = 'Loading OCR engine… (first scan downloads ~7 MB)';
        return Tesseract.recognize(results[1], 'eng+hin', {
          langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
          logger: function(m){
            if(runId !== ocrRunId) return;
            if(m.status === 'recognizing text'){
              const pct = Math.min(100, Math.round((m.progress || 0) * 100));
              statusText.textContent = 'Reading text… ' + pct + '%';
            } else if(m.status === 'loading language traineddata' || m.status === 'loading tesseract core' || m.status === 'initializing api'){
              statusText.textContent = 'Loading OCR engine…';
            }
          }
        });
      }).then(function(result){
        if(runId !== ocrRunId) return;
        const text = result && result.data && typeof result.data.text === 'string' ? result.data.text : '';
        if(!text.trim()){
          previewFrame.classList.remove('scanning');
          statusEl.classList.add('done');
          statusText.textContent = 'No readable text found — try a clearer, flatter photo';
          fieldsNote.classList.remove('show');
          return;
        }
        // Let the scan animation finish breathing, then fill the form.
        const remain = 600 - (Date.now() - startedAt);
        setTimeout(function(){
          if(runId !== ocrRunId) return;
          previewFrame.classList.remove('scanning');
          statusEl.classList.add('done');
          statusText.textContent = 'Extracted from photo';
          fieldsNote.classList.add('show');
          applyExtraction(text);
        }, remain > 0 ? remain : 0);
      }).catch(function(err){
        if(runId !== ocrRunId) return;
        console.error('OCR failed:', err);
        previewFrame.classList.remove('scanning');
        statusEl.classList.add('error');
        statusText.textContent = 'OCR failed — ' + ((err && err.message) || 'unexpected error');
        fieldsNote.classList.remove('show');
      });
    }

    // Best-effort parse of the raw OCR text into the form fields. Everything
    // here is a suggestion: name, age, body type and symptoms are guessed from
    // the text, and the doctor can correct any field before submitting.
    function applyExtraction(rawText){
      const text = String(rawText || '')
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      const lines = text.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
      const lower = '\n' + text.toLowerCase() + '\n';
      const headerWords = /(?:name|patient|age|sex|gender|male|female|date|address|phone|mobile|prakriti|dosha|symptoms|complaint|diagnosis|case|doctor|sign|signature|registration|opd|नाम|आयु|उम्र|पता|लिंग|पुरुष|महिला|तिथि|प्रकृति|शिकायत|रोग|डॉक्टर|विभाग|पंजीकरण)/i;

      // ---- Age ----
      let age = '';
      let m = text.match(/(?:^|\n)\s*(?:age|आयु|उम्र|उमर)\s*[:.\-]?\s*(\d{1,3})\b/i)
           || text.match(/(^|[^\d])(\d{1,3})\s*(?:yrs?|years?|y\/o|year old|साल|वर्ष)/i);
      if(m){ age = (m[1] || m[2] || '').trim(); }
      if(!age){
        const lone = lines.find(function(l){
          return /^\d{1,3}$/.test(l) && parseInt(l, 10) >= 1 && parseInt(l, 10) <= 120;
        });
        if(lone !== undefined) age = lone;
      }

      // ---- Gender ----
      let gender = '';
      m = text.match(/(?:^|\n)\s*(?:gender|sex|लिंग)\s*[:.\-]?\s*([A-Za-z\u0900-\u097F]{1,20})/i);
      if(m){
        const raw = m[1].toLowerCase();
        if(/^(f|female|महिला|स्त्री)/.test(raw)) gender = 'Female';
        else if(/^(m|male|पुरुष|पुरूष)/.test(raw)) gender = 'Male';
        else if(/^(o|other|अन्य)/.test(raw)) gender = 'Other';
      }
      if(!gender){
        const gw = lower.match(/(^|[^\p{L}])(female|male|पुरुष|पुरूष|महिला|स्त्री)([^\p{L}]|$)/iu);
        if(gw){
          const g = gw[2].toLowerCase();
          if(/^(female|महिला|स्त्री)/.test(g)) gender = 'Female';
          else if(/^(male|पुरुष|पुरूष)/.test(g)) gender = 'Male';
        }
      }

      // ---- Weight (kg) ----
      let weight = '';
      m = text.match(/(?:^|\n)\s*(?:body\s*weight|weight|wt|वज़न|वजन|भार)\s*[:.\-]?\s*(\d{1,3}(?:\.\d)?)/i);
      if(m) weight = m[1].trim();
      if(!weight){
        const wm = text.match(/(^|[^\d.])(\d{1,3}(?:\.\d)?)\s*(?:kg|kgs|kilograms?|किलो|किग्रा|किलोग्राम)/i);
        if(wm) weight = wm[2].trim();
      }

      // ---- Blood group ----
      const normBg = function(v){
        return v.toUpperCase().replace(/\s+/g, '').replace('POSITIVE', '+').replace('NEGATIVE', '-');
      };
      let blood = '';
      m = text.match(/(?:^|\n)\s*(?:blood(?:\s*group)?|रक्त\s*समूह|ब्लड\s*ग्रुप)\s*[:.\-]?\s*((?:A|B|AB|O)\s*(?:[+-]|positive|negative))/i);
      if(m) blood = normBg(m[1]);
      if(!blood){
        const bm = lower.match(/(^|[^\p{L}0-9])((?:a|b|ab|o)[+-])([^\p{L}0-9]|$)/iu);
        if(bm) blood = bm[2].toUpperCase();
      }
      if(blood && ['A+','A-','B+','B-','AB+','AB-','O+','O-'].indexOf(blood) === -1) blood = '';

      // ---- Name ----
      let name = '';
      m = text.match(/(?:^|\n)\s*(?:patient['’]?s?\s+name|name|रोगी का नाम|नाम)\s*[:.\-]\s*([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F .'’\-]{2,45})/i);
      if(m) name = m[1].trim();
      if(!name){
        // A "Name……" value sometimes sits on the line just above an age marker.
        for(let i = 1; i < lines.length; i++){
          if(/^age\s*[:.\-]?\s*\d/i.test(lines[i])){ name = lines[i - 1]; break; }
        }
      }
      if(!name){
        // Fallback: the first short all-letters line that reads like a full name.
        name = lines.find(function(line){
          if(line.length < 3 || line.length > 42 || headerWords.test(line)) return false;
          const tokens = line.split(/[\s.]+/).filter(Boolean);
          if(tokens.length < 2 || tokens.length > 4) return false;
          return tokens.every(function(tok){
            return /^[A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F'’\-]*$/.test(tok);
          }) && tokens.some(function(tok){ return /^[A-Z]/.test(tok); });
        });
        if(name) name = name.trim();
      }

      // ---- Body type (dosha) ----
      const devanagariDosha = { '\u0935\u093e\u0924': 'vata', '\u092a\u093f\u0924\u094d\u0924': 'pitta', '\u0915\u092b': 'kapha' };
      let dosha = null;
      const dm = lower.match(/(^|[^\p{L}])(vata|vat|pitta|pitt|kapha|kaph)([^\p{L}]|$)/iu);
      if(dm){
        const d = dm[2].toLowerCase();
        if(d === 'vata' || d === 'vat') dosha = 'vata';
        else if(d === 'pitta' || d === 'pitt') dosha = 'pitta';
        else if(d === 'kapha' || d === 'kaph') dosha = 'kapha';
      }
      if(!dosha){
        Object.keys(devanagariDosha).forEach(function(d){
          if(lower.indexOf(d) !== -1) dosha = devanagariDosha[d];
        });
      }

      // ---- Symptoms: tick every chip the text mentions ----
      const symptomAliases = {
        'Joint pain': ['joint pain', 'joint pains', 'joint ache', 'pain in joints', 'pain in the joints', 'arthralgia', 'जोड़ों में दर्द', 'जोड़ों का दर्द'],
        'Stiff joints': ['stiff joints', 'stiff joint', 'stiffness', 'जकड़न'],
        'Headache': ['headache', 'head ache', 'head pain', 'सिरदर्द'],
        'Upset stomach': ['upset stomach', 'stomach ache', 'abdominal pain', 'indigestion', 'dyspepsia', 'पेट दर्द', 'अपच'],
        'Not feeling hungry': ['not feeling hungry', 'loss of appetite', 'no appetite', 'low appetite', 'appetite reduced', 'appetite loss', 'भूख नहीं'],
        'Heartburn': ['heartburn', 'acidity', 'acid reflux', 'burning sensation', 'एसिडिटी', 'जलन'],
        'Trouble sleeping': ['trouble sleeping', 'cannot sleep', "can't sleep", 'insomnia', 'sleeplessness', 'poor sleep', 'sleepless', 'अनिद्रा', 'नींद नहीं'],
        'Feeling anxious': ['feeling anxious', 'anxiety', 'anxious', 'stress', 'चिंता'],
        'Feeling tired': ['feeling tired', 'tired', 'fatigue', 'low energy', 'weakness', 'exhaustion', 'lethargy', 'थकान', 'कमजोरी'],
        'Ongoing cough': ['cough', 'coughing', 'खांसी'],
        'Mild fever': ['fever', 'बुखार'],
        'Skin itching or rash': ['itching', 'itchy', 'itch', 'rash', 'skin rash', 'खुजली', 'दाने']
      };
      const matched = [];
      Object.keys(symptomAliases).forEach(function(label){
        const hit = symptomAliases[label].some(function(alias){
          const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp('(^|[^\\p{L}])' + esc + '([^\\p{L}]|$)', 'iu').test(lower);
        });
        if(hit) matched.push(label);
      });

      // ---- Fill the form ----
      if(name) inName.value = name;
      if(age) inAge.value = age;
      if(gender) inGender.value = gender;
      if(weight) inWeight.value = weight;
      if(blood) inBlood.value = blood;
      if(name || age || gender || weight || blood) updatePatientCard();

      if(dosha){
        doshaBtns.forEach(function(b){ b.classList.toggle('active', b.dataset.dosha === dosha); });
        selectedDosha = dosha;
        const activeBtn = document.querySelector('.dosha-btn[data-dosha="' + dosha + '"]');
        if(activeBtn){
          outDosha.textContent = activeBtn.querySelector('strong').textContent;
          outDosha.classList.remove('placeholder');
        }
      }

      symptomChips.forEach(function(chip){
        const on = matched.indexOf(chip.dataset.symptom) !== -1;
        chip.classList.toggle('active', on);
        chip.setAttribute('aria-checked', String(on));
      });
      selectedSymptoms = matched;
      symptomDetails = {};
      // a fresh paper case sheet replaces any typed "Something else" complaint too
      customComplaint = '';
      if(otherInput){ otherInput.value = ''; }
      refreshSymptomOut();
      renderFollowups();

      updateCode();
    }

    clearBtn.addEventListener('click', function(e){
      e.stopPropagation();
      preview.classList.remove('show');
      previewFrame.classList.remove('scanning');
      previewImg.src = '';
      fileInput.value = '';
      ocrRunId++; // cancel any OCR still in flight
    });

    window.__clearPhotoScan = function(){
      preview.classList.remove('show');
      previewFrame.classList.remove('scanning');
      previewImg.src = '';
      fileInput.value = '';
      ocrRunId++; // cancel any OCR still in flight
    };
  })();

  const inName = document.getElementById('inName');
  const inAge = document.getElementById('inAge');
  const inGender = document.getElementById('inGender');
  const inWeight = document.getElementById('inWeight');
  const inBlood = document.getElementById('inBlood');
  const outName = document.getElementById('outName');
  const outAge = document.getElementById('outAge');
  const outAvatar = document.getElementById('outAvatar');
  function updatePatientCard(){
    const name = inName.value.trim();
    const age = inAge.value.trim();
    const gender = inGender.value.trim();
    const weight = inWeight.value.trim();
    const blood = inBlood.value.trim();
    outName.textContent = name ? name : 'Unnamed patient';
    const meta = [];
    if(age) meta.push('Age ' + age);
    if(gender) meta.push(gender);
    if(weight) meta.push('Weight ' + weight + ' kg');
    if(blood) meta.push('Blood ' + blood);
    outAge.textContent = meta.length ? meta.join(' · ') : 'Age — not entered';
    if(name){
      const parts = name.split(/\s+/).filter(Boolean);
      const initials = (parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '');
      outAvatar.textContent = initials.toUpperCase() || '–';
    } else {
      outAvatar.textContent = '–';
    }
    if(window.__updateStepProgress){ window.__updateStepProgress(); }
  }
  inName.addEventListener('input', updatePatientCard);
  inAge.addEventListener('input', updatePatientCard);
  inGender.addEventListener('input', updatePatientCard);
  inWeight.addEventListener('input', updatePatientCard);
  inBlood.addEventListener('input', updatePatientCard);
  inNotes.addEventListener('input', function(){ if(window.__updateStepProgress){ window.__updateStepProgress(); } });

  // dosha select
  const doshaBtns = document.querySelectorAll('.dosha-btn');
  const outDosha = document.getElementById('outDosha');
  let selectedDosha = null;
  doshaBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      doshaBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      selectedDosha = btn.dataset.dosha;
      outDosha.textContent = btn.querySelector('strong').textContent;
      outDosha.classList.remove('placeholder');
      updateCode();
    });
  });

  // helper: let a div[role="checkbox"] be operated with mouse AND keyboard
  function makeActivatable(el, handler){
    el.addEventListener('click', handler);
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
        e.preventDefault();
        handler();
      }
    });
  }

  // symptom chips
  const symptomChips = document.querySelectorAll('#symptomChips .check-item');
  const outSymptoms = document.getElementById('outSymptoms');
  let selectedSymptoms = [];
  const otherInput = document.getElementById('inOtherComplaint');
  let customComplaint = '';

  // The patient's own typed complaint ("Something else?"), combined with the
  // ticked chips, is what the live record, code, follow-ups and validation all see.
  function allComplaints(){
    return customComplaint ? selectedSymptoms.concat([customComplaint]) : selectedSymptoms.slice();
  }
  function refreshSymptomOut(){
    const list = allComplaints();
    if(list.length){
      outSymptoms.textContent = list.join(', ');
      outSymptoms.classList.remove('placeholder');
    } else {
      outSymptoms.textContent = '— none selected —';
      outSymptoms.classList.add('placeholder');
    }
  }

  // Follow-up question bank: 1-2 short questions per symptom, tap-to-answer.
  const followupBank = {
    'Joint pain': [
      { q: 'How long has this been going on?', opts: ['A few days', '1-2 weeks', '1+ month'] },
      { q: 'How severe is it?', opts: ['Mild', 'Moderate', 'Severe'] }
    ],
    'Stiff joints': [
      { q: 'When is it worst?', opts: ['Morning', 'After rest', 'End of day'] },
      { q: 'How severe is it?', opts: ['Mild', 'Moderate', 'Severe'] }
    ],
    'Headache': [
      { q: 'Where is the pain?', opts: ['Front', 'Sides', 'All over'] },
      { q: 'Does light or sound make it worse?', opts: ['Yes', 'No'] }
    ],
    'Upset stomach': [
      { q: 'Worse after eating?', opts: ['Yes', 'No', 'Sometimes'] },
      { q: 'Any nausea or vomiting?', opts: ['Yes', 'No'] }
    ],
    'Not feeling hungry': [
      { q: 'How long has appetite been low?', opts: ['A few days', '1-2 weeks', '1+ month'] }
    ],
    'Heartburn': [
      { q: 'When does it happen most?', opts: ['After meals', 'At night', 'Random'] }
    ],
    'Trouble sleeping': [
      { q: "What's the main issue?", opts: ['Falling asleep', 'Staying asleep', 'Waking too early'] },
      { q: 'How long has this been happening?', opts: ['A few days', '1-2 weeks', '1+ month'] }
    ],
    'Feeling anxious': [
      { q: 'How often does this come up?', opts: ['Occasionally', 'Most days', 'Constantly'] }
    ],
    'Feeling tired': [
      { q: 'Does rest help?', opts: ['Yes, fully', 'Somewhat', 'Not at all'] },
      { q: 'How long has this been going on?', opts: ['A few days', '1-2 weeks', '1+ month'] }
    ],
    'Ongoing cough': [
      { q: 'Dry or with phlegm?', opts: ['Dry', 'With phlegm'] },
      { q: 'How long has it lasted?', opts: ['Under a week', '1-2 weeks', '2+ weeks'] }
    ],
    'Mild fever': [
      { q: 'How long has the fever lasted?', opts: ['1-2 days', '3-5 days', 'Longer'] }
    ],
    'Skin itching or rash': [
      { q: 'Where is it?', opts: ['Localized', 'Spread out'] },
      { q: 'Any known trigger?', opts: ['New food', 'New product', 'Not sure'] }
    ]
  };
  // Generic fallback for a complaint typed under "Something else?" — the same
  // two short questions, since there's no symptom-specific bank for it.
  const GENERIC_FU = [
    { q: 'How long has this been going on?', opts: ['A few days', '1-2 weeks', '1+ month'] },
    { q: 'How severe is it?', opts: ['Mild', 'Moderate', 'Severe'] }
  ];
  let symptomDetails = {};
  const followupBlock = document.getElementById('followupBlock');
  const followupList = document.getElementById('followupList');

  function renderFollowups(){
    followupList.innerHTML = '';
    if(allComplaints().length === 0){
      followupBlock.style.display = 'none';
      return;
    }
    followupBlock.style.display = 'block';
    allComplaints().forEach(function(symptom){
      const questions = followupBank[symptom] || GENERIC_FU;
      if(!questions) return;
      if(!symptomDetails[symptom]) symptomDetails[symptom] = {};

      const item = document.createElement('div');
      item.className = 'followup-item';
      const title = document.createElement('div');
      title.className = 'fu-title';
      title.textContent = t(symptom);
      item.appendChild(title);

      questions.forEach(function(entry){
        const qWrap = document.createElement('div');
        qWrap.className = 'followup-q';
        const qLabel = document.createElement('div');
        qLabel.className = 'fu-question';
        qLabel.textContent = t(entry.q);
        qWrap.appendChild(qLabel);

        const optsWrap = document.createElement('div');
        optsWrap.className = 'fu-opts';
        entry.opts.forEach(function(opt){
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'fu-opt';
          btn.textContent = t(opt);
          if(symptomDetails[symptom][entry.q] === opt){ btn.classList.add('active'); }
          btn.addEventListener('click', function(){
            symptomDetails[symptom][entry.q] = opt;
            optsWrap.querySelectorAll('.fu-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          });
          optsWrap.appendChild(btn);
        });
        qWrap.appendChild(optsWrap);
        item.appendChild(qWrap);
      });

      followupList.appendChild(item);
    });
  }

  symptomChips.forEach(function(chip){
    makeActivatable(chip, function(){
      chip.classList.toggle('active');
      const isActive = chip.classList.contains('active');
      chip.setAttribute('aria-checked', String(isActive));
      const val = chip.dataset.symptom;
      if(isActive){ selectedSymptoms.push(val); }
      else{
        selectedSymptoms = selectedSymptoms.filter(s=>s!==val);
        delete symptomDetails[val];
      }
      refreshSymptomOut();
      renderFollowups();
      updateCode();
    });
  });

  // factor chips (multi select — several weather/eating triggers can apply)
  const factorChips = document.querySelectorAll('#factorChips .check-item');
  const outFactor = document.getElementById('outFactor');
  let selectedFactors = [];
  function refreshFactorOut(){
    if(selectedFactors.length){
      outFactor.textContent = selectedFactors.join(', ');
      outFactor.classList.remove('placeholder');
    } else {
      outFactor.textContent = '— none selected —';
      outFactor.classList.add('placeholder');
    }
  }
  factorChips.forEach(function(chip){
    makeActivatable(chip, function(){
      const val = chip.dataset.factor;
      const on = !chip.classList.contains('active');
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-checked', String(on));
      if(on){
        if(selectedFactors.indexOf(val) === -1){ selectedFactors.push(val); }
      } else {
        selectedFactors = selectedFactors.filter(function(f){ return f !== val; });
      }
      refreshFactorOut();
      updateCode();
    });
  });

  // Typing into "Something else?" adds the complaint exactly like a ticked
  // symptom chip — record, code, follow-up questions and validation all see it.
  if(otherInput){
    otherInput.addEventListener('input', function(){
      const val = otherInput.value.replace(/\s+/g, ' ').trim();
      const next = val ? val.charAt(0).toUpperCase() + val.slice(1) : '';
      if(next === customComplaint) return;
      customComplaint = next;
      refreshSymptomOut();
      renderFollowups();
      updateCode();
    });
  }

  const outCode = document.getElementById('outCode');
  const doshaCodeMap = { vata:'VA', pitta:'PI', kapha:'KA' };
  const symptomShortMap = {
    'Joint pain':'Joint',
    'Stiff joints':'Stiffness',
    'Headache':'Head',
    'Upset stomach':'Stomach',
    'Not feeling hungry':'Appetite',
    'Heartburn':'Heartburn',
    'Feeling tired':'Tired',
    'Trouble sleeping':'Sleep',
    'Feeling anxious':'Anxious',
    'Ongoing cough':'Cough',
    'Mild fever':'Fever',
    'Skin itching or rash':'Skin'
  };
  function updateCode(){
    const list = allComplaints();
    if(selectedDosha && list.length){
      const prefix = doshaCodeMap[selectedDosha];
      const num = 10 + list.length;
      const shortForms = list.map(s => symptomShortMap[s] || (s.length > 14 ? s.slice(0, 12) + '…' : s)).join(', ');
      outCode.textContent = 'AYU-' + prefix + '-' + num + '.' + list.length + ' · TM26.' + prefix.charAt(0) + ' · ' + shortForms;
      outCode.classList.remove('placeholder');
    } else if(selectedDosha){
      // No specific complaint picked (chip or typed) — still emit a
      // Prakriti-level code so a symptom-less case can be submitted.
      const prefix = doshaCodeMap[selectedDosha];
      outCode.textContent = 'AYU-' + prefix + '-10 · TM26.' + prefix.charAt(0) + ' · complaint not specified';
      outCode.classList.remove('placeholder');
    } else {
      outCode.textContent = '— pending —';
      outCode.classList.add('placeholder');
    }
    if(window.__updateStepProgress){ window.__updateStepProgress(); }
  }

  // submit case to doctor
  const submitBtn = document.getElementById('submitCase');
  const submitHint = document.getElementById('submitHint');
  const submitBanner = document.getElementById('submitBanner');
  const abhaStrip = document.getElementById('abhaStrip');
  const queueList = document.getElementById('queueList');
  const queueEmpty = document.getElementById('queueEmpty');
  let bannerTimeout = null;

  if(!dbEnabled && queueEmpty){
    queueEmpty.textContent = 'No cases awaiting prescription. (Add your Supabase URL/key in the code to make this persist.)';
  }

  // in-memory store of every case shown in the queue, keyed by id, so the
  // prescription modal can look up patient/case details without re-fetching.
  const casesData = {};
  let localIdCounter = 0;
  function makeLocalId(){
    localIdCounter += 1;
    return 'local-' + Date.now() + '-' + localIdCounter;
  }

  function renderQueueItem(row){
    const id = row.id || row.uuid || makeLocalId();
    row.id = id;
    casesData[id] = row;

    const timeStr = new Date(row.created_at || Date.now()).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

    const item = document.createElement('div');
    item.className = 'queue-item';
    item.dataset.caseId = id;

    const top = document.createElement('div');
    top.className = 'qtop';

    const left = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'qname';
    // textContent (not innerHTML) — patient_name/patient_age are untrusted
    // user input and must never be parsed as HTML.
    nameEl.textContent = row.patient_name + (row.patient_age ? ' · Age ' + row.patient_age : '') + (row.patient_gender ? ' · ' + row.patient_gender : '') + (row.patient_weight ? ' · ' + row.patient_weight + ' kg' : '') + (row.patient_blood ? ' · Blood ' + row.patient_blood : '');
    const metaEl = document.createElement('div');
    metaEl.className = 'qmeta';
    metaEl.textContent = t('Received') + ' ' + timeStr;
    left.appendChild(nameEl);
    left.appendChild(metaEl);

    const codeEl = document.createElement('div');
    codeEl.className = 'qcode';
    codeEl.textContent = row.code || '';

    top.appendChild(left);
    top.appendChild(codeEl);

    const bottom = document.createElement('div');
    bottom.className = 'qbottom';

    const urgent = !!(row.urgent);
    const reviewed = !!(row.summary_final);
    const statusEl = document.createElement('span');
    statusEl.className = 'qstatus ' + (urgent ? 'urgent' : (reviewed ? 'reviewed' : 'pending'));
    statusEl.textContent = urgent ? t('🚨 Urgent — triage first') : (reviewed ? t('✓ Reviewed — awaiting prescription') : t('Awaiting prescription'));

    const rxBtn = document.createElement('button');
    rxBtn.type = 'button';
    rxBtn.className = 'qrx-btn';
    rxBtn.textContent = t('Prescribe');
    rxBtn.addEventListener('click', function(){ openRxModal(id); });

    // Doctor review & confirm (Module C) — every case is a draft until the
    // physician reviews the structured summary.
    const reviewBtn = document.createElement('button');
    reviewBtn.type = 'button';
    reviewBtn.className = 'qrx-btn review';
    reviewBtn.textContent = reviewed ? t('Re-review') : t('Review & confirm');
    reviewBtn.addEventListener('click', function(){
      if(window.SIH && window.SIH.Review){ window.SIH.Review.open(row, item); }
    });

    bottom.appendChild(statusEl);
    bottom.appendChild(reviewBtn);
    bottom.appendChild(rxBtn);

    item.appendChild(top);
    item.appendChild(bottom);
    queueList.prepend(item);

    return item;
  }

  // A case leaves the doctor's queue once its prescription is saved — the
  // patient can still pull it up any time through the portal lookup.
  function removeFromQueue(id){
    const item = queueList.querySelector('.queue-item[data-case-id="' + id + '"]');
    if(item){ item.remove(); }
    if(queueList.children.length === 0 && queueEmpty && !queueEmpty.isConnected){
      queueList.appendChild(queueEmpty);
    }
  }

  // Keep already-rendered doctor-queue rows in step with the current UI
  // language when the doctor switches language (status, button, meta only).
  window.__rerenderQueueLang = function(){
    queueList.querySelectorAll('.queue-item').forEach(function(item){
      const s = item.querySelector('.qstatus');
      if(s){ s.textContent = s.classList.contains('urgent') ? t('🚨 Urgent — triage first') : t('Awaiting prescription'); }
      const b = item.querySelector('.qrx-btn');
      if(b){ b.textContent = t('Prescribe'); }
      const m = item.querySelector('.qmeta');
      if(m){ const rest = m.textContent.replace(/^Received\s+/, ''); m.textContent = t('Received') + ' ' + rest; }
    });
  };

  async function loadQueue(){
    if(!dbEnabled) return;
    // Load prescriptions first, so cases that already have one can be kept out
    // of the pending queue (they remain searchable via the patient portal).
    const { data: rxData, error: rxError } = await supabaseClient
      .from('prescriptions')
      .select('*')
      .order('created_at', { ascending: true });
    if(rxError){
      console.error('Could not load prescriptions:', rxError.message);
      return;
    }
    const rxByCase = {};
    if(rxData && rxData.length){
      rxData.forEach(function(rx){ rxByCase[rx.case_id] = rx; });
    }

    const { data, error } = await supabaseClient
      .from('cases')
      .select('*')
      .order('created_at', { ascending: true });
    if(error){
      console.error('Could not load cases:', error.message);
      return;
    }
    if(data && data.length){
      if(queueEmpty){ queueEmpty.remove(); }
      queueList.innerHTML = '';
      data.forEach(function(row){
        const rx = rxByCase[row.id];
        if(rx){
          // already prescribed — remember it for the portal, skip the queue
          row.prescription = rx;
          casesData[row.id] = row;
          return;
        }
        renderQueueItem(row);
      });
    }
    if(queueList.children.length === 0 && queueEmpty && !queueEmpty.isConnected){
      queueList.appendChild(queueEmpty);
    }
  }
  loadQueue();

  function resetForm(){
    inName.value = '';
    inAge.value = '';
    inGender.value = '';
    inWeight.value = '';
    inBlood.value = '';
    inNotes.value = '';
    updatePatientCard();

    doshaBtns.forEach(b => b.classList.remove('active'));
    selectedDosha = null;
    outDosha.textContent = '— select above —';
    outDosha.classList.add('placeholder');

    symptomChips.forEach(c => c.classList.remove('active'));
    selectedSymptoms = [];
    customComplaint = '';
    if(otherInput){ otherInput.value = ''; }
    symptomDetails = {};
    renderFollowups();
    refreshSymptomOut();

    factorChips.forEach(c => c.classList.remove('active'));
    selectedFactors = [];
    refreshFactorOut();

    updateCode();
    if(window.__clearPhotoScan){ window.__clearPhotoScan(); }
    inName.focus();
  }

  // ---- Patient portal: render a prescription card into search results ----
  const rxList = document.getElementById('rxList');
  const rxEmpty = document.getElementById('rxEmpty');

  function renderRxCard(caseRow, rx){
    // if this patient already has a card (editing a prescription), replace it
    const existing = rxList.querySelector('.rx-card[data-case-id="' + caseRow.id + '"]');
    if(existing){ existing.remove(); }
    if(rxEmpty){ rxEmpty.remove(); }

    const card = document.createElement('div');
    card.className = 'rx-card';
    card.dataset.caseId = caseRow.id;

    const head = document.createElement('div');
    head.className = 'rx-card-head';
    const headLeft = document.createElement('div');
    const rxname = document.createElement('div');
    rxname.className = 'rxname';
    rxname.textContent = caseRow.patient_name + (caseRow.patient_age ? ' · Age ' + caseRow.patient_age : '') + (caseRow.patient_gender ? ' · ' + caseRow.patient_gender : '') + (caseRow.patient_weight ? ' · ' + caseRow.patient_weight + ' kg' : '') + (caseRow.patient_blood ? ' · Blood ' + caseRow.patient_blood : '');
    const rxmeta = document.createElement('div');
    rxmeta.className = 'rxmeta';
    rxmeta.textContent = 'Prescribed ' + new Date(rx.created_at || Date.now()).toLocaleString([], { dateStyle:'medium', timeStyle:'short' });
    headLeft.appendChild(rxname);
    headLeft.appendChild(rxmeta);
    const rxcode = document.createElement('div');
    rxcode.className = 'rxcode';
    rxcode.textContent = caseRow.code || '';
    head.appendChild(headLeft);
    head.appendChild(rxcode);

    const medsWrap = document.createElement('div');
    medsWrap.className = 'rx-meds';
    (rx.medicines || []).forEach(function(med){
      const pill = document.createElement('div');
      pill.className = 'med-pill';
      const mname = document.createElement('div');
      mname.className = 'mname';
      mname.textContent = med.name;
      const mmeta = document.createElement('div');
      mmeta.className = 'mmeta';
      mmeta.textContent = [med.dosage, med.duration].filter(Boolean).join(' · ');
      pill.appendChild(mname);
      pill.appendChild(mmeta);
      medsWrap.appendChild(pill);
    });

    card.appendChild(head);
    card.appendChild(medsWrap);

    if(rx.instructions){
      const instr = document.createElement('p');
      instr.className = 'rx-instructions';
      instr.textContent = rx.instructions;
      card.appendChild(instr);
    }

    if(rx.follow_up_days){
      const fu = document.createElement('div');
      fu.className = 'rx-followup';
      fu.textContent = 'Follow-up in ' + rx.follow_up_days + ' day' + (String(rx.follow_up_days) === '1' ? '' : 's');
      card.appendChild(fu);
    }

    const avail = document.createElement('div');
    avail.className = 'rx-avail';
    avail.innerHTML = '<div class="pulse"></div>';
    avail.appendChild(document.createTextNode('Available in the patient\u2019s ABHA-linked record'));
    card.appendChild(avail);

    rxList.prepend(card);
  }

  // ---- Prescription modal ----
  const rxOverlay = document.getElementById('rxOverlay');
  const rxModalName = document.getElementById('rxModalName');
  const rxModalMeta = document.getElementById('rxModalMeta');
  const rxMedRows = document.getElementById('rxMedRows');
  const rxAddMedBtn = document.getElementById('rxAddMedBtn');
  const rxInstructions = document.getElementById('rxInstructions');
  const rxFollowUp = document.getElementById('rxFollowUp');
  const rxHint = document.getElementById('rxHint');
  const rxSaveBtn = document.getElementById('rxSaveBtn');
  const rxCancelBtn = document.getElementById('rxCancelBtn');
  const rxCloseBtn = document.getElementById('rxCloseBtn');
  let activeCaseId = null;

  function addMedRow(prefill){
    const row = document.createElement('div');
    row.className = 'rx-med-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Medicine, e.g. Ashwagandha churna';
    nameInput.className = 'rx-med-name';
    nameInput.value = (prefill && prefill.name) || '';

    const dosageInput = document.createElement('input');
    dosageInput.type = 'text';
    dosageInput.placeholder = 'Dosage, e.g. 1-0-1';
    dosageInput.className = 'rx-med-dosage';
    dosageInput.value = (prefill && prefill.dosage) || '';

    const durationInput = document.createElement('input');
    durationInput.type = 'text';
    durationInput.placeholder = 'Duration, e.g. 7 days';
    durationInput.className = 'rx-med-duration';
    durationInput.value = (prefill && prefill.duration) || '';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'rx-remove-med';
    removeBtn.setAttribute('aria-label', 'Remove this medicine');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', function(){
      // always keep at least one row so the doctor always has a field to fill
      if(rxMedRows.children.length > 1){ row.remove(); }
      else{
        nameInput.value = ''; dosageInput.value = ''; durationInput.value = '';
      }
    });

    row.appendChild(nameInput);
    row.appendChild(dosageInput);
    row.appendChild(durationInput);
    row.appendChild(removeBtn);
    rxMedRows.appendChild(row);
  }

  rxAddMedBtn.addEventListener('click', function(){ addMedRow(); });

  function openRxModal(caseId){
    const caseRow = casesData[caseId];
    if(!caseRow) return;
    activeCaseId = caseId;

    rxModalName.textContent = caseRow.patient_name
      ? 'Prescription for ' + caseRow.patient_name
      : 'Prescription';
    const metaBits = [];
    if(caseRow.dosha){ metaBits.push(caseRow.dosha.charAt(0).toUpperCase() + caseRow.dosha.slice(1)); }
    if(caseRow.code){ metaBits.push(caseRow.code); }
    rxModalMeta.textContent = metaBits.length ? metaBits.join(' · ') : '—';

    rxMedRows.innerHTML = '';
    const existingRx = caseRow.prescription;
    if(existingRx && existingRx.medicines && existingRx.medicines.length){
      existingRx.medicines.forEach(function(med){ addMedRow(med); });
      rxInstructions.value = existingRx.instructions || '';
      rxFollowUp.value = existingRx.follow_up_days || '';
    } else {
      addMedRow();
      rxInstructions.value = '';
      rxFollowUp.value = '';
    }

    rxHint.classList.remove('show');
    rxOverlay.classList.add('open');
    rxMedRows.querySelector('.rx-med-name').focus();
  }

  function closeRxModal(){
    rxOverlay.classList.remove('open');
    activeCaseId = null;
  }
  rxCancelBtn.addEventListener('click', closeRxModal);
  rxCloseBtn.addEventListener('click', closeRxModal);
  rxOverlay.addEventListener('click', function(e){
    if(e.target === rxOverlay){ closeRxModal(); }
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && rxOverlay.classList.contains('open')){ closeRxModal(); }
  });

  rxSaveBtn.addEventListener('click', async function(){
    if(!activeCaseId) return;
    const caseRow = casesData[activeCaseId];

    const medicines = Array.from(rxMedRows.querySelectorAll('.rx-med-row')).map(function(row){
      return {
        name: row.querySelector('.rx-med-name').value.trim(),
        dosage: row.querySelector('.rx-med-dosage').value.trim(),
        duration: row.querySelector('.rx-med-duration').value.trim()
      };
    }).filter(function(med){ return med.name; });

    if(medicines.length === 0){
      rxHint.textContent = 'Add at least one medicine with a name before saving.';
      rxHint.classList.add('show');
      return;
    }
    rxHint.classList.remove('show');

    const rxRow = {
      case_id: activeCaseId,
      medicines: medicines,
      instructions: rxInstructions.value.trim() || null,
      follow_up_days: rxFollowUp.value.trim() || null
    };

    rxSaveBtn.disabled = true;

    let savedRemotely = false;
    if(dbEnabled && !String(activeCaseId).startsWith('local-')){
      const { data, error } = await supabaseClient.from('prescriptions').insert(rxRow).select();
      if(error){
        // Most likely cause: the `prescriptions` table hasn't been created
        // yet in this Supabase project (see the SQL in the config block
        // above, or prescriptions_table.sql). Nothing was saved — keep the
        // queue entry AND the modal open so the doctor can retry, and say
        // clearly that the record did not persist.
        console.error('Could not save prescription to Supabase:', error.message);
        rxHint.textContent = 'Could not reach the database (' + error.message + ') — the prescription was NOT saved yet. Press Save to retry, or run the prescriptions table SQL in Supabase to make this persist.';
        rxHint.classList.add('show');
        rxSaveBtn.disabled = false;
        return;
      }
      caseRow.prescription = data[0];
      savedRemotely = true;
    }

    if(!savedRemotely){
      // No database configured (pure demo) or a locally-generated demo case:
      // keep the prescription in memory only, so the patient portal can find
      // it for the rest of this session.
      const localRx = Object.assign({}, rxRow, { created_at: new Date() });
      caseRow.prescription = localRx;
    }

    rxSaveBtn.disabled = false;

    // Note: we deliberately do NOT render the prescription anywhere public
    // here. The patient (or anyone) only sees it through the lookup below,
    // by searching their own name + age — same as a doctor's queue update
    // isn't itself a broadcast of the record.
    // The case is finished once its prescription is saved — it leaves the
    // queue and the modal closes. (A failed remote save returns above, so a
    // case that never reached the database stays visible for a retry.)
    if(savedRemotely || String(activeCaseId).startsWith('local-')){
      removeFromQueue(activeCaseId);
      closeRxModal();
    }
  });

  // ---- Print / save the prescription (opens a clean printable sheet) ----
  const printRxBtn = document.getElementById('printRxBtn');
  if(printRxBtn){
    printRxBtn.addEventListener('click', function(){
      if(!activeCaseId) return;
      const caseRow = casesData[activeCaseId];
      if(!caseRow) return;

      const esc = function(s){
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      };

      const medicines = Array.from(rxMedRows.querySelectorAll('.rx-med-row')).map(function(row){
        return {
          name: row.querySelector('.rx-med-name').value.trim(),
          dosage: row.querySelector('.rx-med-dosage').value.trim(),
          duration: row.querySelector('.rx-med-duration').value.trim()
        };
      }).filter(function(med){ return med.name; });

      if(medicines.length === 0){
        rxHint.textContent = 'Add at least one medicine before printing the prescription.';
        rxHint.classList.add('show');
        return;
      }
      rxHint.classList.remove('show');

      const metaBits = [];
      if(caseRow.patient_age){ metaBits.push('Age ' + caseRow.patient_age); }
      if(caseRow.patient_gender){ metaBits.push(caseRow.patient_gender); }
      if(caseRow.patient_weight){ metaBits.push('Weight ' + caseRow.patient_weight + ' kg'); }
      if(caseRow.patient_blood){ metaBits.push('Blood group ' + caseRow.patient_blood); }

      const rowsHtml = medicines.map(function(med){
        return '<tr><td>' + esc(med.name) + '</td><td>' + esc(med.dosage) + '</td><td>' + esc(med.duration) + '</td></tr>';
      }).join('');

      const instructions = (rxInstructions.value || '').trim();
      const followUp = (rxFollowUp.value || '').trim();
      const doshaLabel = caseRow.dosha
        ? caseRow.dosha.charAt(0).toUpperCase() + caseRow.dosha.slice(1)
        : '—';
      const dateStr = new Date().toLocaleDateString([], { day:'numeric', month:'long', year:'numeric' });

      const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Prescription — ' + esc(caseRow.patient_name || 'Patient') + '</title>' +
        '<style>' +
        'body{ font-family: Georgia, "Times New Roman", serif; color:#1a1a1a; margin:0; padding:48px 56px; }' +
        '.head{ border-bottom:2px solid #2C4247; padding-bottom:14px; margin-bottom:24px; }' +
        '.head h1{ font-size:20px; margin:0 0 4px; color:#2C4247; }' +
        '.head p{ margin:0; font-size:12px; color:#666; }' +
        '.pat{ margin-bottom:22px; font-size:14px; line-height:1.7; }' +
        '.pat strong{ color:#2C4247; }' +
        'table{ width:100%; border-collapse:collapse; margin:6px 0 8px; }' +
        'th, td{ border:1px solid #bbb; padding:9px 12px; text-align:left; font-size:14px; }' +
        'th{ background:#f3f0e6; }' +
        '.lab{ font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#888; margin:18px 0 4px; }' +
        '.val{ font-size:14px; line-height:1.6; }' +
        '.follow{ margin-top:22px; font-size:14px; }' +
        '.sign{ margin-top:60px; border-top:1px solid #333; width:320px; padding-top:8px; font-size:13px; color:#444; }' +
        '.foot{ margin-top:36px; font-size:11px; color:#999; border-top:1px dashed #ccc; padding-top:10px; }' +
        '</style></head><body>' +
        '<div class="head"><h1>Patient Case-Taking Software — SIH26047 · Ministry of Ayush</h1><p>Prescription issued ' + dateStr + '</p></div>' +
        '<div class="pat"><strong>' + esc(caseRow.patient_name || 'Patient') + '</strong>' + (metaBits.length ? ' &nbsp;·&nbsp; ' + esc(metaBits.join(' · ')) : '') + '</div>' +
        '<div class="lab">Body type (Prakriti)</div><div class="val">' + esc(doshaLabel) + (caseRow.code ? ' &nbsp;·&nbsp; <span style="font-family:monospace">' + esc(caseRow.code) + '</span>' : '') + '</div>' +
        '<div class="lab">Medicines</div>' +
        '<table><thead><tr><th>Medicine</th><th>Dosage</th><th>Duration</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
        (instructions ? '<div class="lab">Instructions for patient</div><div class="val">' + esc(instructions) + '</div>' : '') +
        (followUp ? '<div class="follow"><strong>Follow-up in ' + esc(followUp) + ' day' + (String(followUp) === '1' ? '' : 's') + '</strong></div>' : '') +
        '<div class="sign">Doctor\'s signature</div>' +
        '<div class="foot">ABHA-linked digital record — the patient can look this up by name and age in the patient portal.</div>' +
        '</body></html>';

      const win = window.open('', '_blank', 'width=780,height=940');
      if(!win){
        rxHint.textContent = 'Your browser blocked the print window — allow pop-ups for this page and try again.';
        rxHint.classList.add('show');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(function(){ win.print(); }, 400);
    });
  }

  // ---- Patient portal: look up a prescription by name + age ----
  const portalName = document.getElementById('portalName');
  const portalAge = document.getElementById('portalAge');
  const portalSearchBtn = document.getElementById('portalSearchBtn');

  function clearRxList(message){
    rxList.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'queue-empty';
    p.textContent = message;
    rxList.appendChild(p);
  }

  function searchPrescriptions(){
    const name = portalName.value.trim().toLowerCase();
    const age = portalAge.value.trim();

    if(!name){
      clearRxList('Enter your name to search.');
      return;
    }

    const matches = Object.values(casesData).filter(function(c){
      const nameMatches = (c.patient_name || '').trim().toLowerCase() === name;
      const ageMatches = age ? String(c.patient_age || '') === age : true;
      return nameMatches && ageMatches && c.prescription;
    });

    if(matches.length === 0){
      clearRxList('No prescription found for that name and age yet. Double-check the spelling, or check back once the doctor has prescribed.');
      return;
    }

    rxList.innerHTML = '';
    // newest visit first
    matches
      .sort(function(a, b){ return new Date(b.prescription.created_at || 0) - new Date(a.prescription.created_at || 0); })
      .forEach(function(c){ renderRxCard(c, c.prescription); });
  }

  portalSearchBtn.addEventListener('click', searchPrescriptions);
  [portalName, portalAge].forEach(function(el){
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); searchPrescriptions(); }
    });
  });

  submitBtn.addEventListener('click', async function(){
    if(!inName.value.trim() || !selectedDosha){
      submitHint.textContent = "Add the patient's name and body type before submitting. (Symptoms are optional — if the problem isn't listed, describe it under 'Something else?' or in the notes field.)";
      submitHint.classList.add('show');
      return;
    }
    submitHint.classList.remove('show');

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const row = {
      patient_name: inName.value.trim(),
      patient_age: inAge.value.trim() || null,
      patient_gender: inGender.value.trim() || null,
      patient_weight: inWeight.value.trim() || null,
      patient_blood: inBlood.value.trim() || null,
      dosha: selectedDosha,
      symptoms: allComplaints(),
      factor: selectedFactors.length ? selectedFactors.join(', ') : null,
      code: outCode.textContent,
      notes: inNotes.value.trim() || null,
      symptom_details: Object.keys(symptomDetails).length ? symptomDetails : null
    };

    // ---- structured history + triage + consent assembly (production core) ----
    const abhaInput = document.getElementById('inAbha');
    if(abhaInput && abhaInput.value.trim()){ row.abha_number = abhaInput.value.trim(); }
    row.abha_address = row.abha_number || null;

    const SIH = window.SIH || {};
    const extra = {};
    const pick = function(id){ const n = document.getElementById(id); return n ? n.value.trim() : ''; };
    if(pick('extraPast')) extra.past = { medical: pick('extraPast') };
    if(pick('extraMedsTa')){ extra.drugs = (SIH.Documents && SIH.Documents.extractMeds(pick('extraMedsTa'))) || []; }
    if(pick('extraAllergies')){
      extra.allergies = pick('extraAllergies').split(/[;,\n]+/).map(function(s){ return { agent: s.trim() }; }).filter(function(a){ return a.agent; });
    }
    if(pick('extraFamily')) extra.family = { history: pick('extraFamily') };
    if(pick('extraLifestyle')) extra.personal = { habits: pick('extraLifestyle') };
    if(pick('extraAyush')) extra.ayush = { ahara_vihara: pick('extraAyush') };

    const history = SIH.History ? SIH.History.merge(SIH.History.fromLegacy(row), extra) : null;
    if(history){ row.history = history; }

    // triage flags (Module A) — module detection OR the chat's own red flags
    let flags = [];
    if(SIH.RedFlags && history){ flags = SIH.RedFlags.detectHistory(history); }
    row.red_flags = flags.map(function(f){ return f.id; });
    row.urgent = !!(flags.length || window.__redFlagActive);
    if(history && SIH.History){ row.summary_draft = SIH.History.summarize(history); }

    // consent records (Module D) — fire-and-forget, never blocks intake
    if(window.SIH && SIH.Consent && (dbEnabled && supabaseClient)){
      try {
        const scopes = ['capture'];
        const docsChk = document.getElementById('consentDocsChk');
        const shareChk = document.getElementById('consentShareChk');
        if(docsChk && docsChk.checked){ scopes.push('documents'); }
        if(shareChk && shareChk.checked && row.abha_number){ scopes.push('share'); }
        const rec = SIH.Consent.grant(row.abha_number || '', scopes, 'tap');
        supabaseClient.from('consents').insert({
          patient_ref: rec.patient_ref, scopes: rec.scopes, method: rec.method
        }).then().catch(function(){});
      } catch(e) { /* consent persistence is best-effort */ }
    }

    submitBtn.disabled = true;

    // Local copy used whenever the database is not configured OR refuses the
    // row (e.g. RLS with no INSERT policy) — the case never dead-ends.
    const localRow = {
      patient_name: row.patient_name,
      patient_age: row.patient_age,
      patient_gender: inGender.value.trim() || null,
      patient_weight: inWeight.value.trim() || null,
      patient_blood: inBlood.value.trim() || null,
      dosha: row.dosha,
      code: row.code,
      urgent: !!(window.__redFlagActive),
      created_at: now
    };
    let syncBlocked = null;

    if(dbEnabled){
      // Full insert (includes the new history/triage/ABHA columns from
      // sql/schema.sql). If the project has not been upgraded yet, fall back
      // to the legacy column subset so the case still persists remotely.
      let attempt = await supabaseClient.from('cases').insert(row).select();
      let data = attempt.data, error = attempt.error;
      const missingCol = /column|could not find|schema cache/i.test(String((error && error.message) || ''));
      if(error && missingCol){
        console.warn('cases table not upgraded — retrying with legacy columns (run sql/schema.sql):', error.message);
        const legacy = {
          patient_name: row.patient_name, patient_age: row.patient_age,
          patient_gender: row.patient_gender, patient_weight: row.patient_weight,
          patient_blood: row.patient_blood, dosha: row.dosha,
          symptoms: row.symptoms, factor: row.factor, code: row.code,
          notes: row.notes, symptom_details: row.symptom_details
        };
        const retry = await supabaseClient.from('cases').insert(legacy).select();
        data = retry.data; error = retry.error;
      }
      submitBtn.disabled = false;
      if(error){
        console.error('Supabase insert failed:', error);
        const msg = (error.message || '').toLowerCase();
        if(/row.level.security|policy/.test(msg)){
          syncBlocked = 'row-level security has no INSERT policy for this table';
        } else if(/could not find the|does not exist|schema cache/i.test(msg)){
          syncBlocked = 'the cases table is missing required columns — run sql/schema.sql in the Supabase SQL editor, then submit again';
        } else if(/permission|jwt|unauthor|invalid login/i.test(msg)){
          syncBlocked = 'your database session was not accepted';
        } else {
          syncBlocked = 'the database returned: ' + error.message;
        }
      } else {
        if(queueEmpty){ queueEmpty.remove(); }
        // merge the returned row with the in-memory copy so the doctor queue
        // has the full history/triage/summary fields even on old tables
        renderQueueItem(Object.assign({}, row, localRow, data && data[0] ? data[0] : {}, { urgent: row.urgent || !!(window.__redFlagActive) }));
      }
    } else {
      submitBtn.disabled = false;
    }

    if(syncBlocked || !dbEnabled){
      if(queueEmpty){ queueEmpty.remove(); }
      renderQueueItem(localRow);
    }

    // confirm to the patient, then clear the form for the next patient
    if(syncBlocked){
      submitBanner.textContent = 'Could not save to the database — ' + syncBlocked + '. The case was kept in this session only (' + timeStr + ').';
      submitBanner.classList.add('warn');
    } else {
      submitBanner.textContent = 'Sent to the doctor\u2019s queue (' + timeStr + ') — form cleared for the next patient';
      submitBanner.classList.remove('warn');
    }
    submitBanner.style.display = 'flex';
    if(abhaStrip){
      abhaStrip.innerHTML = syncBlocked
        ? '<div class="pulse"></div> Saved locally — database sync blocked'
        : '<div class="pulse"></div> Synced to ABHA record';
    }
    if(typeof window.__notebookGoToPage === 'function' && window.innerWidth <= 880){
      window.__notebookGoToPage(2);
    }

    clearTimeout(bannerTimeout);
    bannerTimeout = setTimeout(function(){
      submitBanner.style.display = 'none';
      if(abhaStrip){ abhaStrip.innerHTML = syncBlocked ? '<div class="pulse"></div> Not synced — RLS blocked' : '<div class="pulse"></div> Synced to ABHA record on save'; }
    }, 3200);

    // the case has reached the doctor's queue — clear triage/urgent state
    window.__redFlagActive = false;
    window.__redRaisedSig = '';
    const triageEl = document.getElementById('triageBanner');
    if(triageEl) triageEl.remove();

    resetForm();
    if(typeof window.__intakeResetPage === 'function'){ window.__intakeResetPage(); }
  });

  // accordion
  document.querySelectorAll('.challenge-head').forEach(function(head){
    head.addEventListener('click', function(){
      head.parentElement.classList.toggle('open');
    });
  });
  // open first by default
  document.querySelector('.challenge-item').classList.add('open');

  // ---- Scroll-reveal motion for section content ----
  (function setupReveal(){
    const revealEls = document.querySelectorAll('.reveal');
    if(!revealEls.length) return;

    // stagger items that share a parent container so grids/lists cascade in
    const groups = new Map();
    revealEls.forEach(function(el){
      const parent = el.parentElement;
      if(!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    groups.forEach(function(list){
      list.forEach(function(el, i){
        el.style.transitionDelay = Math.min(i * 70, 280) + 'ms';
      });
    });

    if(!('IntersectionObserver' in window)){
      revealEls.forEach(function(el){ el.classList.add('in'); });
      return;
    }

    const observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function(el){ observer.observe(el); });
  })();

  // ---- Animated count-up for the impact stat ----
  (function setupStatCount(){
    const statBlock = document.querySelector('.stat-block');
    const statEl = statBlock ? statBlock.querySelector('.stat') : null;
    if(!statBlock || !statEl) return;
    const finalText = statEl.textContent.trim(); // e.g. "100%"
    const match = finalText.match(/(\d+)/);
    if(!match){ return; }
    const target = parseInt(match[1], 10);
    const suffix = finalText.replace(match[1], '');
    let animated = false;

    function animateCount(){
      if(animated) return;
      animated = true;
      const duration = 900;
      const start = performance.now();
      function tick(now){
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        statEl.textContent = Math.round(target * eased) + suffix;
        if(progress < 1){ requestAnimationFrame(tick); }
        else{ statEl.textContent = finalText; }
      }
      requestAnimationFrame(tick);
    }

    if('IntersectionObserver' in window){
      const statObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){ animateCount(); statObserver.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      statObserver.observe(statBlock);
    } else {
      animateCount();
    }
  })();

  // ---- Step progress bar for the demo form ----
  (function setupStepProgress(){
    const fill = document.getElementById('stepProgressFill');
    const labels = document.querySelectorAll('.step-dot-label');
    if(!fill) return;

    window.__updateStepProgress = function(){
      const done = [
        !!(inName && inName.value.trim()),
        !!selectedDosha,
        allComplaints().length > 0,
        selectedFactors.length > 0,
        !!(inNotes && inNotes.value.trim())
      ];
      const completedCount = done.filter(Boolean).length;
      fill.style.width = (completedCount / done.length * 100) + '%';
      labels.forEach(function(label, i){
        label.classList.toggle('done', done[i]);
      });
    };
    window.__updateStepProgress();
  })();

  // ---- Night OPD mode (the choice is remembered for the next visit) ----
  (function setupThemeToggle(){
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    try{
      if(localStorage.getItem('sihTheme') === 'dark'){ document.body.classList.add('dark'); }
    }catch(e){}
    btn.addEventListener('click', function(){
      const on = document.body.classList.toggle('dark');
      try{ localStorage.setItem('sihTheme', on ? 'dark' : 'light'); }catch(e){}
    });
  })();

  // ---- Multilingual form demo (English / Hindi) ----
  (function setupLangToggle(){
    const btn = document.getElementById('langToggle');
    if(!btn) return;

    // Translate only the trailing text node of an element, so sibling elements
    // (like the empty .box checkbox square, or an SVG icon) are left untouched.
    function translateTextNode(el){
      for(let i = el.childNodes.length - 1; i >= 0; i--){
        const node = el.childNodes[i];
        if(node.nodeType === 3 && node.textContent.trim()){
          node.textContent = t(node.textContent.trim());
          return;
        }
      }
    }

    function translatePlaceholder(el){
      const current = el.getAttribute('placeholder');
      if(current){ el.setAttribute('placeholder', tPlaceholder(current)); }
    }

    function applyLang(){
      // simple text elements (buttons, labels, headings, spans)
      document.querySelectorAll([
        '.demo-label', '.scan-block > label', '#submitCase', '#portalSearchBtn',
        '.patient-details label', '#fullHistoryBlock label', '.notes-field label', '.step-dot-label',
        '.scan-copy strong', '.scan-copy span', '.scan-note', '.scan-clear', '#scanFieldsNote',
        '.symptom-block > label', '.check-category-label', '.followup-block > label',
        '.mic-unsupported', '.copy-code-btn', '.abha-strip',
        '#queueEmpty', '.portal-sub', '#rxEmpty', '.other-complaint label'
      ].join(', ')).forEach(translateTextNode);

      // checkbox rows: text sits after an empty .box span
      document.querySelectorAll('.check-item').forEach(translateTextNode);

      // dosha buttons: strong + span are separate text nodes
      document.querySelectorAll('.dosha-btn strong, .dosha-btn span').forEach(translateTextNode);

      // placeholders
      document.querySelectorAll('#inName, #inAge, #portalName, #portalAge, #inNotes, #inOtherComplaint, #extraPast, #extraMedsTa, #extraAllergies, #extraFamily, #extraLifestyle, #extraAyush')
        .forEach(translatePlaceholder);

      // re-render any currently-visible follow-up questions/options so they
      // pick up the new language too (they're built fresh from data, not
      // static markup, so they need their own re-render rather than a text swap)
      if(typeof renderFollowups === 'function'){ renderFollowups(); }

      // keep already-rendered doctor-queue rows in step with the new language
      if(typeof window.__rerenderQueueLang === 'function'){ window.__rerenderQueueLang(); }

      // re-render the multi-page intake form's header/nav/dot labels, which are
      // built from JS data rather than static markup (intake-pages.js)
      if(typeof window.__intakeRefreshLang === 'function'){ window.__intakeRefreshLang(); }

      btn.textContent = (uiLang === 'hi') ? 'हि' : (uiLang === 'mr') ? 'म' : 'EN';
    }

    function persistLang(){
      try{ localStorage.setItem('sihUiLang', uiLang); }catch(e){}
    }
    btn.addEventListener('click', function(){
      uiLang = (uiLang === 'en') ? 'hi' : (uiLang === 'hi') ? 'mr' : 'en';
      persistLang();
      applyLang();
    });
    // Programmatic language switch (used by the entry language picker)
    window.setUiLang = function(code){
      if(code !== 'en' && code !== 'hi' && code !== 'mr') return;
      uiLang = code;
      persistLang();
      applyLang();
    };
    // Remember the last-used workspace language across visits — first-time
    // visitors stay in English.
    let savedLang = 'en';
    try{ savedLang = localStorage.getItem('sihUiLang') || 'en'; }catch(e){}
    if(savedLang !== 'en'){
      uiLang = savedLang;
      applyLang();
    }
  })();

  // ---- Copy NAMASTE/ICD-11 code ----
  (function setupCopyCode(){
    const copyBtn = document.getElementById('copyCodeBtn');
    if(!copyBtn) return;
    copyBtn.addEventListener('click', function(){
      const code = outCode.textContent.trim();
      if(!code || code === '— pending —') return;
      const finish = function(){
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('copied');
        setTimeout(function(){ copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 1400);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(code).then(finish).catch(finish);
      } else {
        finish();
      }
    });
  })();

