
  (function setupChat(){
    const fab = document.getElementById('chatFab');
    const panel = document.getElementById('chatPanel');
    const msgs = document.getElementById('chatMsgs');
    const typing = document.getElementById('chatTyping');
    const chipsRow = document.getElementById('chatChips');
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const chatLangBtn = document.getElementById('chatLangBtn');
    const settingsBtn = document.getElementById('chatSettingsBtn');
    const settingsPanel = document.getElementById('chatSettings');
    const keyInput = document.getElementById('chatKeyInput');
    const modelInput = document.getElementById('chatModelInput');
    const keySave = document.getElementById('chatKeySave');
    const keyClear = document.getElementById('chatKeyClear');
    const statusDot = document.getElementById('chatStatusDot');
    const statusText = document.getElementById('chatStatusText');
    const closeBtn = document.getElementById('chatCloseBtn');
    if(!fab || !panel) return;

    const KEY_STORE = 'sihGeminiKey';
    const DEFAULT_MODEL = 'gemini-3.6-flash';
    const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];
    const MAX_HISTORY = 12; // messages kept in context (6 exchanges)
    function getModel(){ return (localStorage.getItem('sihGeminiModel') || '').trim() || DEFAULT_MODEL; }
    let history = [];
    let busy = false;
    let chatLang = localStorage.getItem('sihChatLang') || ''; // chat language: '' (ask) | en | hi | mr

    function getKey(){ return localStorage.getItem(KEY_STORE) || ''; }
    function langName(code){
      const c = code || chatLang || (typeof uiLang !== 'undefined' ? uiLang : 'en');
      if(c === 'hi') return 'Hindi';
      if(c === 'mr') return 'Marathi';
      return 'English';
    }
    function setStatus(ready){
      if(ready){ statusDot.classList.remove('off'); statusText.textContent = getKey() ? 'Online — AI ready' : 'Set up your AI key'; }
      else{ statusDot.classList.add('off'); statusText.textContent = 'Offline / needs setup'; }
    }

    function addMsg(role, text, isError, extraClass){
      const b = document.createElement('div');
      b.className = 'chat-bubble ' + (isError ? 'error' : role) + (extraClass ? ' ' + extraClass : '');
      b.textContent = text;
      msgs.appendChild(b);
      msgs.scrollTop = msgs.scrollHeight;
      return b;
    }

    function showSettings(show){
      settingsPanel.classList.toggle('show', show);
      if(show){ keyInput.value = getKey(); if(modelInput){ modelInput.value = getModel(); } keyInput.focus(); }
    }

    const QUICK = {
      en: [
        'How do I scan a paper case sheet?',
        'What does my dosha mean?',
        'How does the patient find their prescription?',
        'What does the NAMASTE/ICD-11 code mean?'
      ],
      hi: [
        'केस शीट कैसे स्कैन करें?',
        'मेरा दोष क्या मतलब है?',
        'मरीज अपना प्रिस्क्रिप्शन कैसे ढूँढता है?',
        'NAMASTE/ICD-11 कोड का क्या अर्थ है?'
      ],
      mr: [
        'केस शीट कशी स्कॅन करावी?',
        'माझा दोष काय आहे याचा अर्थ काय?',
        'रुग्णाला त्याचे प्रिस्क्रिप्शन कसे सापडते?',
        'NAMASTE/ICD-11 कोडचा अर्थ काय आहे?'
      ]
    };
    function renderChips(){
      chipsRow.innerHTML = '';
      if(!IV.active){
        const start = document.createElement('button');
        start.type = 'button';
        start.className = 'chat-chip primary tall';
        start.textContent = (START_LABEL[chatLang] || START_LABEL.en);
        start.addEventListener('click', function(){ startInterview(); });
        chipsRow.appendChild(start);
      }
      const list = QUICK[chatLang || 'en'] || QUICK.en;
      list.forEach(function(q){
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chat-chip';
        c.textContent = q;
        c.addEventListener('click', function(){ input.value = q; send(); });
        chipsRow.appendChild(c);
      });
    }

    // =====================================================================
    // Guided voice + touch history interview — asks the case form questions
    // one at a time, in the patient's chosen chat language, and fills the
    // REAL form fields/chips as the patient answers by voice, tap or typing.
    // Works without an API key (deterministic parsing + the app's own
    // translations); free-form questions remain available via Gemini.
    // =====================================================================
    const SYMPTOM_KEYS = [];
    const FACTOR_KEYS = [];
    (function ivCollectKeys(){
      document.querySelectorAll('#symptomChips .check-item').forEach(function(el){ SYMPTOM_KEYS.push(el.getAttribute('data-symptom')); });
      document.querySelectorAll('#factorChips .check-item').forEach(function(el){ FACTOR_KEYS.push(el.getAttribute('data-factor')); });
    })();

    const IV_FIELDS = [
      { key: 'name', type: 'text', q: 'q_name', label: 'Full name' },
      { key: 'age', type: 'age', q: 'q_age', label: 'Age' },
      { key: 'gender', type: 'pick', q: 'q_gender', label: 'Gender', opts: ['Male', 'Female', 'Other'] },
      { key: 'weight', type: 'weight', q: 'q_weight', label: 'Weight (kg)' },
      { key: 'blood', type: 'pick', q: 'q_blood', label: 'Blood group', opts: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], unknown: true },
      { key: 'dosha', type: 'pick', q: 'q_dosha', label: 'Body type', opts: ['Vata', 'Pitta', 'Kapha'], unknown: true },
      { key: 'symptoms', type: 'multi', q: 'q_symptoms', label: 'Main complaint' },
      { key: 'factors', type: 'multi', q: 'q_factors', label: 'Worse when' },
      { key: 'lifestyle_sleep', type: 'pick', q: 'q_life_sleep', label: 'Sleep', opts: ['Soundly', 'Okay', 'Disturbed', 'Very little'] },
      { key: 'lifestyle_appetite', type: 'pick', q: 'q_life_appetite', label: 'Appetite', opts: ['Good', 'Average', 'Low', 'Irregular'] },
      { key: 'lifestyle_diet', type: 'pick', q: 'q_life_diet', label: 'Diet', opts: ['Vegetarian', 'Non-vegetarian', 'Mixed'] }
    ];

    // Per-symptom follow-up questions (mirror of the form's follow-up bank,
    // needed to ask the same questions in the chat's own language and to
    // tick the matching buttons in the form).
    const IV_FUP = {
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

    // Generic follow-up used for a complaint typed under "Something else".
    const IV_GENERIC_FU = [
      { q: 'How long has this been going on?', opts: ['A few days', '1-2 weeks', '1+ month'] },
      { q: 'How severe is it?', opts: ['Mild', 'Moderate', 'Severe'] }
    ];
    const IV_EN = {
      'q_name': 'What is your full name?',
      'q_age': 'How old are you, in years?',
      'q_gender': 'What is your gender?',
      'q_weight': 'What is your weight in kilograms?',
      'q_blood': 'Do you know your blood group? Tap it below, or say “Don’t know”.',
      'q_dosha': 'Which is your body type (Prakriti)? Tap or say one — Vata, Pitta or Kapha.',
      'q_symptoms': 'What is troubling you today? Tap every symptom you have (more than one is fine), or say them. If nothing is wrong, tap “No symptoms”.',
      'q_factors': 'When do your symptoms get worse — in which weather, or after eating? Tap all that apply. If none, tap “None of these”.',
      'Full name': 'Full name', 'Age': 'Age', 'Gender': 'Gender', 'Weight (kg)': 'Weight (kg)',
      'Blood group': 'Blood group', 'Body type': 'Body type', 'Main complaint': 'Main complaint', 'Worse when': 'Worse when',
      'Male': 'Male', 'Female': 'Female', 'Other': 'Other',
      'Skip': 'Skip', 'Done': 'Done', 'No symptoms': 'No symptoms', 'None of these': 'None of these',
      "Don't know": "Don't know", 'End interview': 'End interview', 'Review my case sheet': 'Review my case sheet',
      'iv_intro': 'Namaste! I’ll ask a few short questions to fill your case sheet. You can speak with the 🎤 button, type, or tap an option.',
      'iv_pick_lang': 'Please choose your language first so I can guide you in it.',
      'iv_captured': '✓ {label}: {value}',
      'iv_any_more': 'Anything else? Say “done” or tap Done when you finish.',
      'iv_added': 'Added: {list}.',
      'iv_no_symptom': 'No complaints noted — that’s fine, we’ll move on.',
      'iv_no_factor': 'No triggers selected — noted.',
      'iv_fu_done': 'I’ve noted those details in the case sheet.',
      'iv_no_match': 'Sorry, I couldn’t understand that. Please tap one of the options below, or try saying it again.',
      'Something else': 'Something else',
      'iv_custom_ask': 'Tell me in your own words — what’s bothering you? Type it, or speak with the 🎤 button.',
      'iv_retry_name': 'Please tell me your full name (or type it below).',
      'iv_age_bad': 'I need your age as a number (for example 42). Please type it below.',
      'iv_weight_bad': 'I need your weight in kg as a number (for example 65). Please type it below.',
      'iv_ended': 'Interview ended — everything you already answered is saved in the case sheet. You can ask me anything below.',
      'iv_summary': 'All done! Here is the case I captured:',
      'iv_review': 'Tap “Review my case sheet” to see the filled form — the doctor can then submit it.',
      'iv_fu_q': 'A quick detail about {sym}: {q}',
      'iv_ask': 'Ask me anything',
      'iv_sel': 'Selected: {list}',
      'iv_lang_warn': 'Please end the interview first (use the “End interview” chip) before changing language.',
      'mic_listening': 'Listening… tap 🎤 to stop',
      'mic_speak': 'Speak your answer',
      'Mic unsupported': 'Voice isn’t supported in this browser — please tap options or type instead.',
      'Mic blocked': 'Microphone access is blocked — please allow the mic in your browser and try again.',
      'Mic network': 'Voice needs an internet connection — please tap or type your answer instead.',
      'Mic busy': 'Please wait for the assistant to finish replying.',
      'Mic error': 'Voice did not start — please try again.',
      'rf_title': 'Possible emergency',
      'rf_chat': 'Please do not wait in the queue — tell the clinic staff right away. You mentioned: {flags}.',
      'rf_banner': 'URGENT — possible emergency symptom mentioned: {flags}. Do not queue this patient — alert triage staff immediately.',
      'rf_after': 'Besides this, is anything else troubling you? Tap an option below, or say “no complaints” to continue.',
      'rf_flag_chest': 'chest pain',
      'rf_flag_breath': 'difficulty breathing',
      'rf_flag_faint': 'fainting or unconsciousness',
      'rf_flag_stroke': 'stroke signs (one-sided weakness, slurred speech)',
      'rf_flag_bleed': 'severe bleeding',
      'q_life_sleep': 'How well do you sleep at night?',
      'q_life_appetite': 'How is your appetite these days?',
      'q_life_diet': 'What kind of food do you eat?',
      'Sleep': 'Sleep', 'Appetite': 'Appetite', 'Diet': 'Diet',
      'Soundly': 'Soundly', 'Okay': 'Okay', 'Disturbed': 'Disturbed', 'Very little': 'Very little',
      'Good': 'Good', 'Average': 'Average', 'Low': 'Low', 'Irregular': 'Irregular',
      'Vegetarian': 'Vegetarian', 'Non-vegetarian': 'Non-vegetarian', 'Mixed': 'Mixed'
    };
    const IV_HI = {
      'q_name': 'आपका पूरा नाम क्या है?',
      'q_age': 'आपकी उम्र कितनी है (सालों में)?',
      'q_gender': 'आपका लिंग क्या है?',
      'q_weight': 'आपका वजन कितने किलो है?',
      'q_blood': 'क्या आपको अपना ब्लड ग्रुप पता है? नीचे चुनें, या कहें “पता नहीं”।',
      'q_dosha': 'आपका शरीर प्रकार (प्रकृति) कौन सा है? वात, पित्त या कफ — चुनें या बोलें।',
      'q_symptoms': 'आज आपको क्या तकलीफ है? जो भी लक्षण हों उन्हें चुनें (एक से अधिक भी चलेंगे), या बोलकर बताएँ। कुछ नहीं है तो “कोई लक्षण नहीं” चुनें।',
      'q_factors': 'आपके लक्षण कब बढ़ते हैं — किस मौसम में या खाने से? जो लागू हो उसे चुनें। कुछ नहीं तो “इनमें से कोई नहीं” चुनें।',
      'Full name': 'पूरा नाम', 'Age': 'उम्र', 'Gender': 'लिंग', 'Weight (kg)': 'वजन (किलो)',
      'Blood group': 'ब्लड ग्रुप', 'Body type': 'शरीर प्रकार', 'Main complaint': 'मुख्य तकलीफ', 'Worse when': 'कब बढ़ता है',
      'Male': 'पुरुष', 'Female': 'महिला', 'Other': 'अन्य',
      'Skip': 'छोड़ें', 'Done': 'हो गया', 'No symptoms': 'कोई लक्षण नहीं', 'None of these': 'इनमें से कोई नहीं',
      "Don't know": 'पता नहीं', 'End interview': 'इंटर्व्यू खत्म करें', 'Review my case sheet': 'मेरी केस शीट देखें',
      'iv_intro': 'नमस्ते! मैं आपकी केस शीट भरने के लिए कुछ छोटे सवाल पूछूँगा। आप 🎤 बटन से बोल सकते हैं, टाइप कर सकते हैं, या विकल्प चुन सकते हैं।',
      'iv_pick_lang': 'कृपया पहले अपनी भाषा चुनें, ताकि मैं उसी भाषा में आपका मार्गदर्शन कर सकूँ।',
      'iv_captured': '✓ {label}: {value}',
      'iv_any_more': 'और कुछ? “हो गया” कहें या नीचे “हो गया” चुनें।',
      'iv_added': 'जोड़े गए: {list}।',
      'iv_no_symptom': 'कोई तकलीफ नहीं — ठीक है, आगे बढ़ते हैं।',
      'iv_no_factor': 'कोई कारण नहीं चुना — लिख लिया।',
      'iv_fu_done': 'मैंने उन विस्तारों के जवाब केस शीट में लिख लिए हैं।',
      'iv_no_match': 'माफ़ कीजिए, मैं समझ नहीं पाया। कृपया नीचे दिया कोई विकल्प चुनें, या फिर से कहें।',
      'Something else': 'कुछ और',
      'iv_custom_ask': 'मुझे अपने शब्दों में बताएं — आपको क्या परेशानी है? टाइप करें या 🎤 बटन से बोलें।',
      'iv_retry_name': 'कृपया अपना पूरा नाम बताएँ (या नीचे टाइप करें)।',
      'iv_age_bad': 'मुझे आपकी उम्र अंकों में चाहिए (जैसे 42)। कृपया नीचे टाइप करें।',
      'iv_weight_bad': 'मुझे आपका वजन किलो में अंकों से चाहिए (जैसे 65)। कृपया नीचे टाइप करें।',
      'iv_ended': 'बातचीत खत्म — आप जो भी जवाब दे चुके हैं वे केस शीट में सुरक्षित हैं। नीचे आप कुछ भी पूछ सकते हैं।',
      'iv_summary': 'सब हो गया! मैंने आपकी केस शीट में यह लिखा:',
      'iv_review': 'केस शीट देखने के लिए “मेरी केस शीट देखें” चुनें — डॉक्टर उसे सबमिट कर सकते हैं।',
      'iv_fu_q': '{sym} के बारे में एक छोटा सवाल: {q}',
      'iv_ask': 'कुछ भी पूछें',
      'iv_lang_warn': 'कृपया पहले इंटर्व्यू खत्म करें (“इंटर्व्यू खत्म करें” चुनें), फिर भाषा बदलें।',
      'mic_listening': 'सुन रहा हूँ… रोकने के लिए 🎤 दबाएँ',
      'mic_speak': 'अपना जवाब बोलें',
      'Mic unsupported': 'इस ब्राउज़र में आवाज़ सुविधा नहीं है — कृपया विकल्प चुनें या टाइप करें।',
      'Mic blocked': 'माइक्रोफ़ोन की अनुमति नहीं मिली — ब्राउज़र में माइक की अनुमति दें और फिर कोशिश करें।',
      'Mic network': 'आवाज़ के लिए इंटरनेट चाहिए — कृपया विकल्प चुनें या टाइप करें।',
      'Mic busy': 'कृपया सहायक के जवाब देने तक रुकें।',
      'Mic error': 'आवाज़ शुरू नहीं हो सकी — फिर से कोशिश करें।',
      'rf_title': 'संभावित आपात स्थिति',
      'rf_chat': 'कृपया कतार में न रुकें — क्लिनिक स्टाफ को तुरंत बताएँ। आपने बताया: {flags}।',
      'rf_banner': 'आपातकालीन — संभावित आपात लक्षण: {flags}। इस रोगी को कतार में न रखें — तुरंत ट्राइएज स्टाफ को सूचित करें।',
      'rf_after': 'इसके अलावा और कोई तकलीफ है? नीचे विकल्प चुनें, या आगे बढ़ने के लिए “कोई लक्षण नहीं” कहें।',
      'rf_flag_chest': 'सीने में दर्द',
      'rf_flag_breath': 'सांस लेने में तकलीफ',
      'rf_flag_faint': 'बेहोशी',
      'rf_flag_stroke': 'लकवा-जैसे संकेत (एक तरफ कमजोरी, अस्पष्ट बोली)',
      'rf_flag_bleed': 'अत्यधिक रक्तस्राव',
      'q_life_sleep': 'रात में आपकी नींद कैसी है?',
      'q_life_appetite': 'इन दिनों आपकी भूख कैसी है?',
      'q_life_diet': 'आप किस तरह का खाना खाते हैं?',
      'Sleep': 'नींद', 'Appetite': 'भूख', 'Diet': 'आहार',
      'Soundly': 'गहरी नींद', 'Okay': 'ठीक-ठाक', 'Disturbed': 'टूटी-फूटी नींद', 'Very little': 'बहुत कम नींद',
      'Good': 'अच्छी', 'Average': 'सामान्य', 'Low': 'कम', 'Irregular': 'अनियमित',
      'Vegetarian': 'शाकाहारी', 'Non-vegetarian': 'मांसाहारी', 'Mixed': 'मिश्रित'
    };
    const IV_MR = {
      'q_name': 'तुमचे पूर्ण नाव काय आहे?',
      'q_age': 'तुमचे वय किती आहे (वर्षांत)?',
      'q_gender': 'तुमचे लिंग काय आहे?',
      'q_weight': 'तुमचे वजन किती किलो आहे?',
      'q_blood': 'तुम्हाला तुमचा ब्लड ग्रुप माहित आहे का? खाली निवडा, किंवा म्हणा “माहित नाही”.',
      'q_dosha': 'तुमचा शरीर प्रकार (प्रकृती) कोणता आहे? वात, पित्त किंवा कफ — निवडा किंवा बोला.',
      'q_symptoms': 'आज तुम्हाला काय त्रास आहे? जी लक्षणे असतील ती निवडा (एकापेक्षा जास्तही चालतील), किंवा बोलून सांगा. काही नसेल तर “लक्षणे नाहीत” निवडा.',
      'q_factors': 'तुमची लक्षणे केव्हा वाढतात — कोणत्या हवामानात किंवा जेवणाने? जे लागू असेल ते निवडा. काही नसेल तर “यापैकी काही नाही” निवडा.',
      'Full name': 'पूर्ण नाव', 'Age': 'वय', 'Gender': 'लिंग', 'Weight (kg)': 'वजन (किलो)',
      'Blood group': 'ब्लड ग्रुप', 'Body type': 'शरीर प्रकार', 'Main complaint': 'मुख्य त्रास', 'Worse when': 'केव्हा वाढते',
      'Male': 'पुरुष', 'Female': 'महिला', 'Other': 'इतर',
      'Skip': 'वगळा', 'Done': 'झाले', 'No symptoms': 'लक्षणे नाहीत', 'None of these': 'यापैकी काही नाही',
      "Don't know": 'माहित नाही', 'End interview': 'मुलाखत संपवा', 'Review my case sheet': 'माझी केस शीट पहा',
      'iv_intro': 'नमस्कार! तुमची केस शीट भरण्यासाठी मी काही छोटे प्रश्न विचारेन. तुम्ही 🎤 बटणाने बोलू शकता, टाइप करू शकता, किंवा पर्याय निवडू शकता.',
      'iv_pick_lang': 'कृपया आधी तुमची भाषा निवडा, म्हणजे मी तिच भाषेत मार्गदर्शन करू शकेन.',
      'iv_captured': '✓ {label}: {value}',
      'iv_any_more': 'आणखी काही? “झाले” म्हणा किंवा खाली “झाले” निवडा.',
      'iv_added': 'जोडले: {list}.',
      'iv_no_symptom': 'त्रास नाही — ठीक आहे, पुढे जाऊया.',
      'iv_no_factor': 'कारण निवडले नाही — नोंदवले.',
      'iv_fu_done': 'मी ते तपशीलाची उत्तरे केस शीटमध्ये नोंदवली आहेत.',
      'iv_no_match': 'माफ करा, मला समजले नाही. कृपया खालीलपैकी एक पर्याय निवडा, किंवा पुन्हा सांगा.',
      'Something else': 'आणखी काही',
      'iv_custom_ask': 'तुमच्या शब्दांत सांगा — तुम्हाला काय त्रास आहे? टाइप करा किंवा 🎤 बटण दाबून बोला.',
      'iv_retry_name': 'कृपया तुमचे पूर्ण नाव सांगा (किंवा खाली टाइप करा).',
      'iv_age_bad': 'मला तुमचे वय आकड्यांत हवे आहे (उदा. 42). कृपया खाली टाइप करा.',
      'iv_weight_bad': 'मला तुमचे वजन किलोमध्ये आकड्यांत हवे आहे (उदा. 65). कृपया खाली टाइप करा.',
      'iv_ended': 'मुलाखत संपली — तुम्ही दिलेली सर्व उत्तरे केस शीटमध्ये सुरक्षित आहेत. खाली तुम्ही काहीही विचारू शकता.',
      'iv_summary': 'सर्व झाले! मी तुमच्या केस शीटमध्ये हे नोंदवले:',
      'iv_review': 'केस शीट पाहण्यासाठी “माझी केस शीट पहा” निवडा — डॉक्टर ती सबमिट करू शकतात.',
      'iv_fu_q': '{sym} बद्दल एक छोटा प्रश्न: {q}',
      'iv_ask': 'आणखी काही विचारा',
      'iv_lang_warn': 'कृपया आधी मुलाखत संपवा (“मुलाखत संपवा” निवडा), मग भाषा बदला.',
      'mic_listening': 'ऐकत आहे… थांबवण्यासाठी 🎤 दाबा',
      'mic_speak': 'तुमचे उत्तर बोला',
      'Mic unsupported': 'या ब्राउझरमध्ये आवाज सुविधा नाही — कृपया पर्याय निवडा किंवा टाइप करा.',
      'Mic blocked': 'मायक्रोफोनची परवानगी मिळाली नाही — ब्राउझरमध्ये मायक्रोफोनला परवानगी द्या आणि पुन्हा प्रयत्न करा.',
      'Mic network': 'आवाजासाठी इंटरनेट हवे — कृपया पर्याय निवडा किंवा टाइप करा.',
      'Mic busy': 'कृपया सहायक उत्तर देईपर्यंत थांबा.',
      'Mic error': 'आवाज सुरू होऊ शकली नाही — पुन्हा प्रयत्न करा.',
      'rf_title': 'संभावित आपत्कालीन स्थिती',
      'rf_chat': 'कृपया रांगेत थांबू नका — क्लिनिक स्टाफला लगेच सांगा. तुम्ही नमूद केले: {flags}.',
      'rf_banner': 'आपत्कालीन — संभावित आपत्कालीन लक्षण: {flags}. या रुग्णाला रांगेत ठेवू नका — लगेच ट्रायेज स्टाफला कळवा.',
      'rf_after': 'याशिवाय आणखी काही त्रास आहे का? खाली पर्याय निवडा, किंवा पुढे जाण्यासाठी “लक्षणे नाहीत” म्हणा.',
      'rf_flag_chest': 'छातीत दुखणे',
      'rf_flag_breath': 'श्वास घेण्यास त्रास',
      'rf_flag_faint': 'बेशुद्धी',
      'rf_flag_stroke': 'लकव्याची लक्षणे (एका बाजूची कमजोरी, अस्पष्ट बोलणे)',
      'rf_flag_bleed': 'तीव्र रक्तस्त्राव',
      'q_life_sleep': 'रात्री तुमची झोप कशी आहे?',
      'q_life_appetite': 'या दिवसांत तुमची भूक कशी आहे?',
      'q_life_diet': 'तुम्ही कोणत्या प्रकारचे अन्न खाता?',
      'Sleep': 'झोप', 'Appetite': 'भूक', 'Diet': 'आहार',
      'Soundly': 'गाढ झोप', 'Okay': 'ठीकठाक', 'Disturbed': 'तुटलेली झोप', 'Very little': 'खूप कमी झोप',
      'Good': 'चांगली', 'Average': 'साधारण', 'Low': 'कमी', 'Irregular': 'अनियमित',
      'Vegetarian': 'शाकाहारी', 'Non-vegetarian': 'मांसाहारी', 'Mixed': 'मिश्र'
    };
    const IV_DICTS = { en: IV_EN, hi: IV_HI, mr: IV_MR };
    function ivLang(){ return (chatLang === 'hi' || chatLang === 'mr') ? chatLang : 'en'; }
    function ivT(key, forcedLang){
      const lg = (forcedLang === 'en' || forcedLang === 'hi' || forcedLang === 'mr') ? forcedLang : ivLang();
      const own = IV_DICTS[lg][key];
      if(own) return own;
      const app = (lg === 'hi' && typeof i18nDict !== 'undefined' && i18nDict[key]) || (lg === 'mr' && typeof i18nMr !== 'undefined' && i18nMr[key])
               || (lg === 'hi' && typeof i18nMr !== 'undefined' && i18nMr[key]) || (lg === 'mr' && typeof i18nDict !== 'undefined' && i18nDict[key]) || '';
      if(app) return app;
      return IV_EN[key] || key;
    }

    // Tiny matcher: tokenise text & alias, then look for the alias's tokens
    // as a contiguous run inside the text's tokens (handles punctuation and
    // Devanagari without fragile regex escaping).
    function ivTokens(s){
      return String(s || '').toLowerCase().replace(/[\u2018\u2019']/g, '').split(/[^a-z0-9\u0900-\u097f]+/).filter(Boolean);
    }
    function ivHasPhrase(text, phrase){
      const arr = ivTokens(text);
      const sub = ivTokens(phrase);
      if(!arr.length || !sub.length) return false;
      for(let i = 0; i + sub.length <= arr.length; i++){
        let ok = true;
        for(let j = 0; j < sub.length; j++){ if(arr[i + j] !== sub[j]){ ok = false; break; } }
        if(ok) return true;
      }
      return false;
    }
    function ivHasAny(text, phrases){ return (phrases || []).some(function(p){ return ivHasPhrase(text, p); }); }
    function ivHasWord(text, word){ return ivHasPhrase(text, word); }

    const IV_ALIAS = {
      'Male': { en: ['male', 'man', 'boy'], hi: ['\u092a\u0941\u0930\u0941\u0937', '\u092a\u0941\u0930\u0942\u0937', '\u092e\u0930\u094d\u0926'], mr: ['\u092a\u0941\u0930\u0941\u0937', '\u092e\u093e\u0923\u0942\u0938'] },
      'Female': { en: ['female', 'woman', 'girl', 'lady'], hi: ['\u092e\u0939\u093f\u0932\u093e', '\u0938\u094d\u0924\u094d\u0930\u0940'], mr: ['\u092e\u0939\u093f\u0932\u093e', '\u0938\u094d\u0924\u094d\u0930\u0940'] },
      'Other': { en: ['other'], hi: ['\u0905\u0928\u094d\u092f'], mr: ['\u0907\u0924\u0930'] },
      'Yes': { en: ['yes', 'yeah', 'yep'], hi: ['\u0939\u093e\u0901', '\u0939\u093e\u0902', '\u091c\u0940'], mr: ['\u0939\u094b\u092f', '\u0939\u094b'] },
      'No': { en: ['no', 'nope'], hi: ['\u0928\u0939\u0940\u0902', '\u0928\u093e'], mr: ['\u0928\u093e\u0939\u0940', '\u0928\u093e'] },
      'Vata': { en: ['vata', 'vaat', 'vaata'], hi: ['\u0935\u093e\u0924'], mr: ['\u0935\u093e\u0924'] },
      'Pitta': { en: ['pitta', 'pita', 'pit'], hi: ['\u092a\u093f\u0924\u094d\u0924'], mr: ['\u092a\u093f\u0924\u094d\u0924'] },
      'Kapha': { en: ['kapha', 'kaph', 'kafa'], hi: ['\u0915\u092b'], mr: ['\u0915\u092b'] },
      'Joint pain': { en: ['joint pain', 'joint pains', 'pain in joints', 'joint ache', 'arthralgia'], hi: ['\u091c\u094b\u0921\u093c\u094b\u0902 \u092e\u0947\u0902 \u0926\u0930\u094d\u0926', '\u091c\u094b\u0921\u093c\u094b\u0902 \u0915\u093e \u0926\u0930\u094d\u0926'], mr: ['\u0938\u093e\u0902\u0927\u0947\u0926\u0941\u0916\u0940', '\u0938\u093e\u0902\u0927\u094d\u092f\u093e\u0902\u0924 \u0926\u0941\u0916\u0923\u0947'] },
      'Stiff joints': { en: ['stiff joints', 'stiffness', 'stiff joint', 'joints stiff'], hi: ['\u091c\u0915\u0921\u093c\u0928', '\u0905\u0915\u0921\u093c\u0928'], mr: ['\u0915\u0921\u0915 \u0938\u093e\u0902\u0927\u0947', '\u091c\u0921 \u0938\u093e\u0902\u0927\u0947'] },
      'Headache': { en: ['headache', 'head pain', 'head ache', 'head hurts'], hi: ['\u0938\u093f\u0930\u0926\u0930\u094d\u0926'], mr: ['\u0921\u094b\u0915\u0947\u0926\u0941\u0916\u0940'] },
      'Upset stomach': { en: ['upset stomach', 'stomach ache', 'stomach pain', 'indigestion', 'acidity stomach'], hi: ['\u092a\u0947\u091f \u0926\u0930\u094d\u0926', '\u0905\u092a\u091a', '\u092a\u0947\u091f \u0916\u0930\u093e\u092c'], mr: ['\u092a\u094b\u091f\u0926\u0941\u0916\u0940', '\u0905\u092a\u091a'] },
      'Not feeling hungry': { en: ['not feeling hungry', 'no appetite', 'loss of appetite', 'low appetite', 'not hungry'], hi: ['\u092d\u0942\u0916 \u0928\u0939\u0940\u0902'], mr: ['\u092d\u0942\u0915 \u0928\u093e\u0939\u0940'] },
      'Heartburn': { en: ['heartburn', 'acid reflux', 'burning in chest', 'chest burning'], hi: ['\u090f\u0938\u093f\u0921\u093f\u091f\u0940', '\u091c\u0932\u0928', '\u0938\u0940\u0928\u0947 \u092e\u0947\u0902 \u091c\u0932\u0928'], mr: ['\u091b\u093e\u0924\u0940\u0924 \u091c\u0933\u093e\u0933'] },
      'Trouble sleeping': { en: ['trouble sleeping', 'insomnia', "can't sleep", 'cannot sleep', 'poor sleep', 'no sleep'], hi: ['\u0905\u0928\u093f\u0926\u094d\u0930\u093e', '\u0928\u0940\u0902\u0926 \u0928\u0939\u0940\u0902'], mr: ['\u0928\u093f\u0926\u094d\u0930\u093e\u0928\u093e\u0936', '\u091d\u094b\u092a \u092f\u0947\u0924 \u0928\u093e\u0939\u0940'] },
      'Feeling anxious': { en: ['anxious', 'anxiety', 'stress', 'worried', 'tension'], hi: ['\u091a\u093f\u0902\u0924\u093e', '\u0924\u0928\u093e\u0935'], mr: ['\u0915\u093e\u0933\u091c\u0940', '\u091a\u093f\u0902\u0924\u093e', '\u0924\u0923\u093e\u0935'] },
      'Feeling tired': { en: ['tired', 'fatigue', 'weakness', 'no energy', 'low energy', 'exhausted'], hi: ['\u0925\u0915\u093e\u0928', '\u0915\u092e\u091c\u094b\u0930\u0940'], mr: ['\u0925\u0915\u0935\u093e', '\u0926\u092e \u0932\u093e\u0917\u0923\u0947'] },
      'Ongoing cough': { en: ['cough', 'coughing'], hi: ['\u0916\u093e\u0902\u0938\u0940'], mr: ['\u0916\u094b\u0915\u0932\u093e'] },
      'Mild fever': { en: ['fever', 'mild fever', 'temperature'], hi: ['\u092c\u0941\u0916\u093e\u0930'], mr: ['\u0924\u093e\u092a'] },
      'Skin itching or rash': { en: ['itching', 'itch', 'itchy', 'rash', 'skin rash'], hi: ['\u0916\u0941\u091c\u0932\u0940', '\u0926\u093e\u0928\u0947'], mr: ['\u0916\u093e\u091c', '\u092a\u0941\u0930\u0933'] },
      'Cold weather': { en: ['cold weather', 'cold', 'winter', 'cool weather'], hi: ['\u0920\u0902\u0921\u093e', '\u0920\u0902\u0921', '\u0938\u0930\u094d\u0926\u0940'], mr: ['\u0925\u0902\u0921', '\u0925\u0902\u0921\u0940', '\u0939\u093f\u0935\u093e\u0933\u093e'] },
      'Dry weather': { en: ['dry weather', 'dry', 'dryness'], hi: ['\u0938\u0942\u0916\u093e', '\u0930\u0942\u0916\u093e\u092a\u0928'], mr: ['\u0915\u094b\u0930\u0921\u0947'] },
      'Eating too much': { en: ['overeating', 'eating too much', 'heavy food', 'too much food', 'eat a lot'], hi: ['\u0905\u0927\u093f\u0915 \u0916\u093e\u0928\u093e', '\u091c\u094d\u092f\u093e\u0926\u093e \u0916\u093e\u0928\u093e', '\u092d\u093e\u0930\u0940 \u0916\u093e\u0928\u093e'], mr: ['\u091c\u093e\u0938\u094d\u0924 \u0916\u093e\u0923\u0947', '\u091c\u0921 \u091c\u0947\u0935\u0923'] },
      'Skipping meals': { en: ['skipping meals', 'skip meals', 'missing meals', 'empty stomach', 'starving'], hi: ['\u092d\u094b\u091c\u0928 \u091b\u094b\u0921\u093c\u0928\u093e', '\u0916\u093e\u0928\u093e \u091b\u094b\u0921\u093c\u0928\u093e'], mr: ['\u091c\u0947\u0935\u0923 \u0935\u0917\u0933\u0923\u0947', '\u0909\u092a\u093e\u0936\u0940 \u0930\u093e\u0939\u0923\u0947'] },
      'Soundly': { en: ['sound sleep', 'soundly', 'good sleep', 'sleep well', 'deep sleep'], hi: ['\u0917\u0939\u0930\u0940 \u0928\u0940\u0902\u0926', '\u0905\u091a\u094d\u091b\u0940 \u0928\u0940\u0902\u0926'], mr: ['\u0917\u093e\u0922 \u091d\u094b\u092a', '\u091a\u093e\u0902\u0917\u0932\u0940 \u091d\u094b\u092a'] },
      'Okay': { en: ['okay', 'ok', 'fine', 'not bad'], hi: ['\u0920\u0940\u0915 \u0920\u093e\u0915'], mr: ['\u0920\u0940\u0915\u0920\u093e\u0915'] },
      'Disturbed': { en: ['disturbed', 'broken sleep', 'restless sleep', 'waking up often', 'wake up at night'], hi: ['\u091f\u0942\u091f\u0940 \u0928\u0940\u0902\u0926', '\u0928\u0940\u0902\u0926 \u0916\u0930\u093e\u092c'], mr: ['\u0924\u0941\u091f\u0932\u0947\u0932\u0940 \u091d\u094b\u092a', '\u091d\u094b\u092a \u092c\u093f\u0918\u0921\u0924\u0947'] },
      'Very little': { en: ['very little', 'very little sleep', 'hardly any sleep', 'little sleep', 'less sleep', 'not much sleep'], hi: ['\u092c\u0939\u0941\u0924 \u0915\u092e \u0928\u0940\u0902\u0926'], mr: ['\u0916\u0942\u092a \u0915\u092e\u0940 \u091d\u094b\u092a'] },
      'Good': { en: ['good appetite', 'good', 'eat well', 'hungry', 'good hunger'], hi: ['\u0905\u091a\u094d\u091b\u0940 \u092d\u0942\u0916'], mr: ['\u091a\u093e\u0902\u0917\u0932\u0940 \u092d\u0942\u0915'] },
      'Average': { en: ['average', 'medium', 'okay appetite', 'so so'], hi: ['\u0938\u093e\u092e\u093e\u0928\u094d\u092f \u092d\u0942\u0916'], mr: ['\u0938\u093e\u0927\u093e\u0930\u0923 \u092d\u0942\u0915'] },
      'Low': { en: ['low appetite', 'poor appetite', 'less hunger', 'little hunger', 'not much hunger'], hi: ['\u0915\u092e \u092d\u0942\u0916'], mr: ['\u0915\u092e\u0940 \u092d\u0942\u0915'] },
      'Irregular': { en: ['irregular', 'sometimes hungry', 'up and down', 'skips meals often'], hi: ['\u0905\u0928\u093f\u092f\u092e\u093f\u0924 \u092d\u0942\u0916'], mr: ['\u0905\u0928\u093f\u092f\u092e\u093f\u0924 \u092d\u0942\u0915'] },
      'Vegetarian': { en: ['vegetarian', 'veg', 'pure veg', 'no meat'], hi: ['\u0936\u093e\u0915\u093e\u0939\u093e\u0930\u0940'], mr: ['\u0936\u093e\u0915\u093e\u0939\u093e\u0930\u0940'] },
      'Non-vegetarian': { en: ['non vegetarian', 'non veg', 'nonveg', 'meat eater', 'eat meat'], hi: ['\u092e\u093e\u0902\u0938\u093e\u0939\u093e\u0930\u0940'], mr: ['\u092e\u093e\u0902\u0938\u093e\u0939\u093e\u0930\u0940'] },
      'Mixed': { en: ['mixed', 'both', 'veg and non veg'], hi: ['\u092e\u093f\u0936\u094d\u0930\u093f\u0924'], mr: ['\u092e\u093f\u0936\u094d\u0930'] }
    };
    const IV_NONE_WORDS = {
      en: ['none', 'nothing', 'no symptoms', 'no complaint', 'no complaints', 'no issues', 'not really', 'nothing wrong', 'all fine', 'i am fine', "i'm fine"],
      hi: ['\u0915\u094b\u0908 \u0932\u0915\u094d\u0937\u0923 \u0928\u0939\u0940\u0902', '\u0915\u0941\u091b \u0928\u0939\u0940\u0902', '\u0915\u094b\u0908 \u0924\u0915\u0932\u0940\u092b \u0928\u0939\u0940\u0902', '\u0920\u0940\u0915 \u0939\u0942\u0901', '\u0938\u092c \u0920\u0940\u0915'],
      mr: ['\u0932\u0915\u094d\u0937\u0923\u0947 \u0928\u093e\u0939\u0940\u0924', '\u0915\u093e\u0939\u0940 \u0928\u093e\u0939\u0940', '\u0924\u094d\u0930\u093e\u0938 \u0928\u093e\u0939\u0940', '\u0920\u0940\u0915 \u0906\u0939\u0947', '\u0938\u0930\u094d\u0935 \u0920\u0940\u0915']
    };
    const IV_DONE_WORDS = {
      en: ['done', "that's all", 'that is all', 'nothing else', 'no more', 'finish', 'finished'],
      hi: ['\u0939\u094b \u0917\u092f\u093e', '\u092c\u0938', '\u0914\u0930 \u0915\u0941\u091b \u0928\u0939\u0940\u0902', '\u0916\u0924\u094d\u092e'],
      mr: ['\u091d\u093e\u0932\u0947', '\u092c\u0938', '\u0906\u0923\u0916\u0940 \u0915\u093e\u0939\u0940 \u0928\u093e\u0939\u0940', '\u0938\u0902\u092a\u0932\u0947']
    };

    // ---- Red-flag / triage detection (Module A) ----
    // Any mention of an emergency symptom raises a red banner + chat alert
    // and marks the case URGENT in the doctor's queue when submitted.
    const RED_FLAGS = [
      { id: 'chest',  en: ['chest pain', 'chest pains', 'chest discomfort', 'pain in chest', 'pain in the chest', 'pressure in chest', 'tightness in chest', 'heavy chest'],
        hi: ['\u0938\u0940\u0928\u0947 \u092e\u0947\u0902 \u0926\u0930\u094d\u0926', '\u091b\u093e\u0924\u0940 \u092e\u0947\u0902 \u0926\u0930\u094d\u0926', '\u0938\u0940\u0928\u0947 \u092e\u0947\u0902 \u0926\u092c\u093e\u0935', '\u091b\u093e\u0924\u0940 \u092e\u0947\u0902 \u091c\u0915\u0921\u093c\u0928', '\u0938\u0940\u0928\u0947 \u092e\u0947\u0902 \u092d\u093e\u0930\u0940\u092a\u0928'],
        mr: ['\u091b\u093e\u0924\u0940\u0924 \u0926\u0941\u0916\u0923\u0947', '\u091b\u093e\u0924\u0940\u0924 \u0926\u0930\u094d\u0926', '\u091b\u093e\u0924\u0940\u0935\u0930 \u0926\u092c\u093e\u0935', '\u091b\u093e\u0924\u0940\u0924 \u091c\u0921\u092a\u0923\u093e'] },
      { id: 'breath', en: ['shortness of breath', 'difficulty breathing', 'difficult breathing', 'hard to breathe', "can't breathe", 'cannot breathe', 'struggling to breathe', 'breathless', 'breathlessness', 'out of breath'],
        hi: ['\u0938\u093e\u0902\u0938 \u092b\u0942\u0932\u0928\u093e', '\u0938\u093e\u0902\u0938 \u0932\u0947\u0928\u0947 \u092e\u0947\u0902 \u0924\u0915\u0932\u0940\u092b', '\u0938\u093e\u0902\u0938 \u0928\u0939\u0940\u0902 \u0906 \u0930\u0939\u0940', '\u0938\u093e\u0902\u0938 \u0928\u0939\u0940\u0902 \u0932\u0947 \u092a\u093e'],
        mr: ['\u0927\u093e\u092a \u0932\u093e\u0917\u0923\u0947', '\u0936\u094d\u0935\u093e\u0938 \u0918\u0947\u0923\u094d\u092f\u093e\u0938 \u0924\u094d\u0930\u093e\u0938', '\u0936\u094d\u0935\u093e\u0938 \u0918\u0947\u0924\u093e \u092f\u0947\u0924 \u0928\u093e\u0939\u0940'] },
      { id: 'faint',  en: ['fainted', 'fainting', 'passed out', 'passing out', 'unconscious', 'lost consciousness', 'blacked out', 'collapse', 'collapsed'],
        hi: ['\u092c\u0947\u0939\u094b\u0936', '\u092c\u0947\u0939\u094b\u0936\u0940', '\u0917\u0936', '\u0905\u091a\u0947\u0924', '\u092c\u0947\u0939\u094b\u0936 \u0939\u094b \u0917\u092f\u093e'],
        mr: ['\u092c\u0947\u0936\u0941\u0926\u094d\u0927', '\u092d\u093e\u0928 \u0939\u0930\u092a\u0932\u0947', '\u092e\u0942\u0930\u094d\u091b\u093e'] },
      { id: 'stroke', en: ['slurred speech', 'face drooping', 'drooping face', 'one side weak', 'weakness on one side', 'one sided weakness', 'left side weak', 'right side weak', 'arm weakness', 'paralysis', 'paralyzed', 'paralysed', 'sudden confusion'],
        hi: ['\u0906\u0927\u093e \u0936\u0930\u0940\u0930 \u0915\u092e\u091c\u094b\u0930', '\u090f\u0915 \u0924\u0930\u092b \u0915\u092e\u091c\u094b\u0930\u0940', '\u091a\u0947\u0939\u0930\u093e \u091f\u0947\u0922\u093c\u093e', '\u092c\u094b\u0932\u0940 \u0932\u0921\u093c\u0916\u0921\u093c\u093e\u0928\u093e', '\u092c\u094b\u0932\u0928\u0947 \u092e\u0947\u0902 \u0932\u0921\u093c\u0916\u0921\u093c\u093e\u0939\u091f', '\u0932\u0915\u0935\u093e', '\u0905\u0927\u0930\u0902\u0917'],
        mr: ['\u0905\u0930\u094d\u0927\u093e\u0902\u0917\u0935\u093e\u092f\u0942', '\u090f\u0915\u093e \u092c\u093e\u091c\u0942\u091a\u0940 \u0915\u092e\u091c\u094b\u0930\u0940', '\u091a\u0947\u0939\u0930\u093e \u0935\u093e\u0915\u0921\u093e', '\u092c\u094b\u0932\u0923\u094d\u092f\u093e\u0924 \u0905\u0921\u0925\u0933\u093e', '\u0932\u0915\u0935\u093e'] },
      { id: 'bleed',  en: ['severe bleeding', 'heavy bleeding', 'bleeding a lot', 'bleeding heavily', 'vomiting blood', 'blood in vomit'],
        hi: ['\u092c\u0939\u0941\u0924 \u091c\u094d\u092f\u093e\u0926\u093e \u0916\u0942\u0928 \u092c\u0939\u0928\u093e', '\u0905\u0924\u094d\u092f\u0927\u093f\u0915 \u0930\u0915\u094d\u0924\u0938\u094d\u0930\u093e\u0935', '\u0916\u0942\u0928 \u0915\u0940 \u0909\u0932\u094d\u091f\u0940'],
        mr: ['\u091c\u093e\u0938\u094d\u0924 \u0930\u0915\u094d\u0924\u0938\u094d\u0924\u094d\u0930\u093e\u0935', '\u0924\u0940\u0935\u094d\u0930 \u0930\u0915\u094d\u0924\u0938\u094d\u0924\u094d\u0930\u093e\u0935', '\u0930\u0915\u094d\u0924\u093e\u091a\u094d\u092f\u093e \u0909\u0932\u091f\u094d\u092f\u093e'] }
    ];
    function ivCheckRed(text){
      // Emergency phrases are checked in ALL three languages — a patient may
      // speak or type in a script different from the chat's own language.
      const found = [];
      RED_FLAGS.forEach(function(rf){
        const phrases = (rf.en || []).concat(rf.hi || []).concat(rf.mr || []);
        if(phrases.some(function(p){ return ivHasPhrase(text, p); })) found.push(rf.id);
      });
      return found;
    }
    function ivDismissTriage(){
      window.__redFlagActive = false;
      window.__redRaisedSig = '';
      const b = document.getElementById('triageBanner');
      if(b) b.remove();
    }
    function ivRaiseRed(ids){
      if(!ids || !ids.length) return;
      const langUi = (typeof uiLang !== 'undefined' && (uiLang === 'hi' || uiLang === 'mr')) ? uiLang : 'en';
      const joinedChat = ids.map(function(id){ return ivT('rf_flag_' + id); }).join(', ');
      const joinedUi = ids.map(function(id){ return ivT('rf_flag_' + id, langUi); }).join(', ');
      const sig = ids.join('+');
      if(window.__redRaisedSig !== sig){
        window.__redRaisedSig = sig;
        addMsg('bot', '🚨 ' + ivT('rf_title') + '\n' + ivT('rf_chat').replace('{flags}', joinedChat), true, 'red');
      }
      window.__redFlagActive = true;
      const nameEl = document.getElementById('inName');
      const name = (nameEl && nameEl.value) ? String(nameEl.value).trim() : '';
      let b = document.getElementById('triageBanner');
      if(!b){
        b = document.createElement('div');
        b.className = 'triage-banner';
        b.id = 'triageBanner';
        document.body.appendChild(b);
        b.addEventListener('click', function(e){
          if(e.target && e.target.classList.contains('triage-close')) ivDismissTriage();
        });
      }
      const msg = ivT('rf_banner', langUi).replace('{flags}', joinedUi);
      b.innerHTML = '';
      const ico = document.createElement('span');
      ico.className = 'triage-ico';
      ico.textContent = '🚨';
      const body = document.createElement('div');
      body.className = 'triage-msg';
      const bEl = document.createElement('b');
      bEl.textContent = ivT('rf_title', langUi);
      const p = document.createElement('div');
      p.textContent = msg + (name ? ' (' + name + ')' : '');
      body.appendChild(bEl);
      body.appendChild(p);
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'triage-close';
      close.setAttribute('aria-label', 'Dismiss');
      close.textContent = '✕';
      b.appendChild(ico);
      b.appendChild(body);
      b.appendChild(close);
      b.classList.remove('show');
      void b.offsetWidth; // restart pulse
      b.classList.add('show');
    }

    function ivHits(text, key){
      const lg = ivLang();
      const names = [key].concat(IV_ALIAS[key] ? (IV_ALIAS[key][lg] || []) : []);
      if(lg === 'hi' || lg === 'mr'){
        const other = (lg === 'hi') ? 'mr' : 'hi';
        names.push.apply(names, IV_ALIAS[key] ? (IV_ALIAS[key][other] || []) : []);
      }
      // include the on-screen translated label too
      const label = ivT(key);
      if(label && label !== key){ names.push(label); }
      if(names.some(function(a){ return ivHasPhrase(text, a); })) return true;
      const n = ivTokens(text).join(' ');
      return names.some(function(a){ return ivTokens(a).join(' ') === n; });
    }

    const IV = { active: false, idx: 0, fu: false, fq: [], fqi: 0, lifestyle: {}, customPending: false };
    let ivNotesBlock = '';
    const micEl = document.getElementById('chatMicBtn');

    // Writes the sleep/appetite/diet answers into the notes field (Step 5),
    // so the doctor sees them with the case and they get saved on submit.
    function ivWriteLifestyle(){
      const notes = document.getElementById('inNotes');
      const lf = IV.lifestyle || {};
      const lines = [];
      if(lf.lifestyle_sleep) lines.push('Sleep: ' + lf.lifestyle_sleep);
      if(lf.lifestyle_appetite) lines.push('Appetite: ' + lf.lifestyle_appetite);
      if(lf.lifestyle_diet) lines.push('Diet: ' + lf.lifestyle_diet);
      if(!lines.length) return;
      const block = lines.join('\n');
      let cur = notes ? (notes.value || '') : '';
      if(ivNotesBlock && cur && cur.indexOf(ivNotesBlock) !== -1){
        cur = cur.replace(ivNotesBlock, '');
      }
      cur = cur.replace(/\n{3,}/g, '\n\n').trim();
      ivNotesBlock = block;
      if(notes){
        notes.value = cur ? (cur + '\n\n' + block) : block;
        notes.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    let chatRec = null;
    let chatMicOn = false;

    function ivSetMic(on){
      chatMicOn = on;
      if(micEl){ micEl.classList.toggle('listening', on); micEl.title = on ? ivT('mic_listening') : ivT('mic_speak'); }
    }
    function ivStopMic(){
      if(chatRec){ try{ chatRec.stop(); }catch(e){} }
      chatRec = null;
      ivSetMic(false);
    }
    function ivResetState(){
      IV.active = false;
      IV.fu = false;
      IV.idx = 0;
      IV.fq = [];
      IV.fqi = 0;
      IV.customPending = false;
      IV.lifestyle = {};
      ivNotesBlock = '';
      ivStopMic();
    }
    function ivCur(){ return IV_FIELDS[IV.idx]; }
    function ivSymOn(k){ const el = document.querySelector('#symptomChips .check-item[data-symptom="' + k.replace(/"/g, '&quot;') + '"]'); return !!(el && el.classList.contains('active')); }
    function ivFacOn(k){ const el = document.querySelector('#factorChips .check-item[data-factor="' + k.replace(/"/g, '&quot;') + '"]'); return !!(el && el.classList.contains('active')); }
    function ivSetSym(k, on){
      const el = document.querySelector('#symptomChips .check-item[data-symptom="' + k.replace(/"/g, '&quot;') + '"]');
      if(!el) return;
      if(on && !el.classList.contains('active')) el.click();
      if(!on && el.classList.contains('active')) el.click();
    }
    function ivSetFac(k, on){
      const el = document.querySelector('#factorChips .check-item[data-factor="' + k.replace(/"/g, '&quot;') + '"]');
      if(!el) return;
      if(on && !el.classList.contains('active')) el.click();
      if(!on && el.classList.contains('active')) el.click();
    }
    function ivClearSyms(){
      SYMPTOM_KEYS.forEach(function(k){ ivSetSym(k, false); });
      const oi = document.getElementById('inOtherComplaint');
      if(oi && oi.value){ ivSetText('inOtherComplaint', ''); }
    }
    function ivClearFacs(){ FACTOR_KEYS.forEach(function(k){ ivSetFac(k, false); }); }
    function ivAnyActive(){
      const f = ivCur();
      const keys = (f.key === 'symptoms') ? SYMPTOM_KEYS : FACTOR_KEYS;
      return keys.some(function(k){ return (f.key === 'symptoms') ? ivSymOn(k) : ivFacOn(k); });
    }
    function ivSetText(id, v){
      const el = document.getElementById(id);
      if(!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function ivChip(label, cls, fn){
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chat-chip' + (cls ? (' ' + cls) : '');
      c.textContent = label;
      c.addEventListener('click', function(){ fn(); });
      chipsRow.appendChild(c);
    }
    function ivShowOpts(){
      chipsRow.innerHTML = '';
      if(!IV.active) return;
      if(IV.fu){
        const item = IV.fq[IV.fqi];
        if(item){
          item.opts.forEach(function(opt){ ivChip(ivT(opt), '', function(){ ivFuPick(opt); }); });
          ivChip(ivT('Skip'), '', function(){ ivFuSkip(); });
        }
        ivChip(ivT('End interview'), '', function(){ ivEnd(); });
        return;
      }
      const f = ivCur();
      if(f.type === 'text' || f.type === 'age' || f.type === 'weight'){
        ivChip(ivT('Skip'), '', function(){ ivTap('__skip__'); });
      } else if(f.type === 'pick'){
        f.opts.forEach(function(opt){ ivChip(ivT(opt), '', function(){ ivTap(opt); }); });
        if(f.unknown) ivChip(ivT("Don't know"), '', function(){ ivTap('__unknown__'); });
        ivChip(ivT('Skip'), '', function(){ ivTap('__skip__'); });
      } else if(f.type === 'multi'){
        const keys = (f.key === 'symptoms') ? SYMPTOM_KEYS : FACTOR_KEYS;
        keys.forEach(function(k){
          const on = (f.key === 'symptoms') ? ivSymOn(k) : ivFacOn(k);
          ivChip(ivT(k), on ? 'active' : '', function(){ ivTap(k); });
        });
        if(f.key === 'symptoms'){ ivChip(ivT('Something else'), '', function(){ ivTap('__custom__'); }); }
        ivChip(ivT(f.key === 'symptoms' ? 'No symptoms' : 'None of these'), '', function(){ ivTap('__none__'); });
        ivChip(ivT('Done'), 'primary', function(){ ivTap('__done__'); });
      }
      ivChip(ivT('End interview'), '', function(){ ivEnd(); });
    }
    function ivAsk(){
      if(!IV.active) return;
      const f = ivCur();
      addMsg('bot', ivT(f.q) + ' (' + (IV.idx + 1) + '/' + IV_FIELDS.length + ')');
      ivShowOpts();
    }
    function ivNext(){
      const done = IV_FIELDS[IV.idx];
      if(done && done.key && done.key.indexOf('lifestyle_') === 0) ivWriteLifestyle();
      IV.idx++;
      if(IV.idx >= IV_FIELDS.length){ ivComplete(); return; }
      ivAsk();
    }
    function ivCaptured(f, v){
      const label = ivT(f.label);
      // option values that exist in the translation tables are shown in the
      // chat's language (e.g. Female, Vata); everything else stays raw (A+)
      const value = (IV_EN[v] !== undefined) ? ivT(v) : v;
      return ivT('iv_captured').replace('{label}', label).replace('{value}', value);
    }
    function ivApplyPick(f, v){
      if(f.key === 'gender') ivSetText('inGender', v);
      else if(f.key === 'blood') ivSetText('inBlood', v);
      else if(f.key === 'dosha'){
        const key = v.toLowerCase();
        const btn = document.querySelector('.dosha-btn[data-dosha="' + key + '"]');
        if(btn && !btn.classList.contains('active')) btn.click();
      }
      else if(f.key && f.key.indexOf('lifestyle_') === 0){
        IV.lifestyle[f.key] = v;
      }
    }
    function ivTap(v){
      addMsg('user', v === '__skip__' ? ivT('Skip') : (v === '__none__' ? ivT(ivCur().key === 'symptoms' ? 'No symptoms' : 'None of these') : (v === '__done__' ? ivT('Done') : (v === '__custom__' ? ivT('Something else') : (v === '__unknown__' ? ivT("Don't know") : ivT(v))))));
      if(v === '__skip__'){ ivNext(); return; }
      if(v === '__done__'){ ivFinishMulti(); return; }
      if(v === '__custom__'){
        IV.customPending = true;
        addMsg('bot', ivT('iv_custom_ask'));
        ivShowOpts();
        return;
      }
      if(v === '__none__'){
        const f = ivCur();
        if(f.key === 'symptoms') ivClearSyms(); else ivClearFacs();
        addMsg('bot', ivT(f.key === 'symptoms' ? 'iv_no_symptom' : 'iv_no_factor'));
        ivNext();
        return;
      }
      if(v === '__unknown__'){
        const f = ivCur();
        addMsg('bot', ivCaptured(f, "Don't know"));
        ivNext();
        return;
      }
      const f = ivCur();
      if(f.type === 'pick'){
        ivApplyPick(f, v);
        addMsg('bot', ivCaptured(f, v));
        ivNext();
        return;
      }
      if(f.type === 'multi'){
        if(f.key === 'symptoms') ivSetSym(v, !ivSymOn(v)); else ivSetFac(v, !ivFacOn(v));
        ivShowOpts();
      }
    }
    function ivFinishMulti(){
      const f = ivCur();
      const keys = (f.key === 'symptoms') ? SYMPTOM_KEYS : FACTOR_KEYS;
      const sel = keys.filter(function(k){ return (f.key === 'symptoms') ? ivSymOn(k) : ivFacOn(k); });
      if(f.key === 'symptoms'){
        const oi = document.getElementById('inOtherComplaint');
        const custRaw = oi ? oi.value.replace(/\s+/g, ' ').trim() : '';
        const cust = custRaw ? custRaw.charAt(0).toUpperCase() + custRaw.slice(1) : '';
        const allSel = cust ? sel.concat([cust]) : sel;
        if(!allSel.length){ addMsg('bot', ivT('iv_no_symptom')); ivNext(); return; }
        const shown = allSel.map(function(s){ return ivT(s); }).join(', ');
        addMsg('bot', ivT('iv_captured').replace('{label}', ivT(f.label)).replace('{value}', shown));
        IV.fq = [];
        allSel.forEach(function(s){
          const bank = IV_FUP[s] || IV_GENERIC_FU;
          bank.forEach(function(qq, qi){
            IV.fq.push({ s: s, qi: qi, q: qq.q, opts: qq.opts });
          });
        });
        IV.fqi = 0;
        if(!IV.fq.length){ ivNext(); return; }
        IV.fu = true;
        ivAskFU();
        return;
      }
      if(!sel.length){ addMsg('bot', ivT('iv_no_factor')); }
      else addMsg('bot', ivT('iv_captured').replace('{label}', ivT(f.label)).replace('{value}', sel.map(function(k){ return ivT(k); }).join(', ')));
      ivNext();
    }
    function ivFuItemFor(sym){
      const list = document.getElementById('followupList');
      if(!list) return null;
      const lg = (typeof uiLang !== 'undefined' && (uiLang === 'hi' || uiLang === 'mr')) ? uiLang : 'en';
      const cand = (lg === 'hi' && typeof i18nDict !== 'undefined' && i18nDict[sym]) || (lg === 'mr' && typeof i18nMr !== 'undefined' && i18nMr[sym]) || sym;
      const items = list.querySelectorAll('.followup-item');
      for(let i = 0; i < items.length; i++){
        const tEl = items[i].querySelector('.fu-title');
        if(tEl && tEl.textContent.trim() === cand) return items[i];
      }
      return null;
    }
    function ivClickFuDom(sym, qi, opt){
      const item = ivFuItemFor(sym);
      if(!item) return;
      const qw = item.querySelectorAll('.followup-q');
      const wrap = qw[qi];
      if(!wrap) return;
      const btns = wrap.querySelectorAll('.fu-opt');
      const want = ivFuOptIndex(sym, qi, opt);
      const b = btns[want];
      if(b && !b.classList.contains('active')) b.click();
    }
    function ivFuOptIndex(sym, qi, opt){
      const bank = IV_FUP[sym] || IV_GENERIC_FU;
      const qq = bank[qi];
      return qq ? qq.opts.indexOf(opt) : -1;
    }
    function ivAskFU(){
      const item = IV.fq[IV.fqi];
      if(!item){ IV.fu = false; addMsg('bot', ivT('iv_fu_done')); ivNext(); return; }
      addMsg('bot', ivT('iv_fu_q').replace('{sym}', ivT(item.s)).replace('{q}', ivT(item.q)));
      ivShowOpts();
    }
    function ivFuPick(opt){
      addMsg('user', ivT(opt));
      const item = IV.fq[IV.fqi];
      if(item) ivClickFuDom(item.s, item.qi, opt);
      IV.fqi++;
      ivAskFU();
    }
    function ivFuSkip(){
      addMsg('user', ivT('Skip'));
      IV.fqi++;
      ivAskFU();
    }
    function ivComplete(){
      IV.customPending = false;
      IV.active = false;
      IV.fu = false;
      const lines = [];
      const name = (document.getElementById('inName') || {}).value || '';
      const age = (document.getElementById('inAge') || {}).value || '';
      const gender = (document.getElementById('inGender') || {}).value || '';
      const weight = (document.getElementById('inWeight') || {}).value || '';
      const blood = (document.getElementById('inBlood') || {}).value || '';
      const doshaBtn = document.querySelector('.dosha-btn.active');
      const dosha = doshaBtn ? doshaBtn.getAttribute('data-dosha') : '';
      const doshaName = dosha ? ivT(dosha.charAt(0).toUpperCase() + dosha.slice(1)) : '';
      const syms = SYMPTOM_KEYS.filter(ivSymOn).map(function(k){ return ivT(k); });
      const custRaw = ((document.getElementById('inOtherComplaint') || {}).value || '').replace(/\s+/g, ' ').trim();
      if(custRaw){ syms.push(custRaw.charAt(0).toUpperCase() + custRaw.slice(1)); }
      const facs = FACTOR_KEYS.filter(ivFacOn).map(function(k){ return ivT(k); });
      if(name.trim()) lines.push('• ' + ivT('Full name') + ': ' + name.trim());
      if(age) lines.push('• ' + ivT('Age') + ': ' + age);
      if(gender) lines.push('• ' + ivT('Gender') + ': ' + ivT(gender));
      if(weight) lines.push('• ' + ivT('Weight (kg)') + ': ' + weight);
      if(blood) lines.push('• ' + ivT('Blood group') + ': ' + blood);
      if(doshaName) lines.push('• ' + ivT('Body type') + ': ' + doshaName);
      if(syms.length) lines.push('• ' + ivT('Main complaint') + ': ' + syms.join(', '));
      if(facs.length) lines.push('• ' + ivT('Worse when') + ': ' + facs.join(', '));
      if(!lines.length) lines.push('• ' + ivT('Nothing was entered'));
      addMsg('bot', ivT('iv_summary'));
      addMsg('bot', lines.join('\n'));
      addMsg('bot', ivT('iv_review'));
      chipsRow.innerHTML = '';
      ivChip(ivT('Review my case sheet'), 'primary', function(){ ivReview(); });
      ivChip(ivT('iv_ask'), '', function(){ ivAskAnything(); });
    }
    function ivReview(){
      ivEnd(true);
      panel.classList.remove('open');
      clearChat();
      const demo = document.getElementById('demo');
      if(demo){ demo.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
    function ivAskAnything(){
      IV.active = false;
      IV.fu = false;
      renderChips();
    }
    function ivEnd(silent){
      if(!IV.active && !IV.fu) return;
      IV.active = false;
      IV.fu = false;
      if(!silent){ addMsg('bot', ivT('iv_ended')); renderChips(); }
    }
    function startInterview(){
      if(!chatLang){
        addMsg('bot', ivT('iv_pick_lang'));
        renderLangPicker();
        return;
      }
      IV.active = true;
      IV.idx = 0;
      IV.fu = false;
      IV.fq = [];
      IV.fqi = 0;
      IV.customPending = false;
      IV.lifestyle = {};
      ivNotesBlock = '';
      addMsg('bot', ivT('iv_intro'));
      ivAsk();
    }
    const SKIP_EXACT = { en: ['skip', 'next'], hi: ['\u091b\u094b\u0921\u093c\u0947\u0902', '\u0905\u0917\u0932\u093e'], mr: ['\u0935\u0917\u0933\u093e', '\u092a\u0941\u0922\u0947'] };
    function ivNumFrom(text){
      const m = String(text || '').match(/\d+(?:\.\d+)?/);
      if(m) return parseFloat(m[0]);
      // basic English spoken numbers (e.g. "forty two") as a fallback
      const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
      const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
      const toks = ivTokens(text);
      let total = 0;
      let cur = 0;
      let found = false;
      toks.forEach(function(t){
        let v = UNITS.indexOf(t);
        if(v !== -1){ cur += v; found = true; return; }
        v = TENS.indexOf(t);
        if(v >= 2){ cur += v * 10; found = true; return; }
      });
      total = cur;
      return found ? total : null;
    }
    function ivCleanName(text){
      let raw = String(text || '').trim();
      const prefixes = ['my full name is ', 'my name is ', 'i am ', "i'm ", 'name is ', '\u092e\u0947\u0930\u093e \u092a\u0942\u0930\u093e \u0928\u093e\u092e ', '\u092e\u0947\u0930\u093e \u0928\u093e\u092e ', '\u0928\u093e\u092e ', '\u092e\u093e\u091d\u0947 \u092a\u0942\u0930\u094d\u0923 \u0928\u093e\u0935 ', '\u092e\u093e\u091d\u0947 \u0928\u093e\u0935 '];
      const lower = raw.toLowerCase();
      for(let i = 0; i < prefixes.length; i++){
        if(lower.indexOf(prefixes[i]) === 0){ raw = raw.slice(prefixes[i].length).trim(); break; }
      }
      raw = raw.replace(/[.,;:]+$/, '').replace(/\s+/g, ' ').trim();
      if(!raw) return '';
      if(!/[a-z\u0900-\u097f]/i.test(raw)) return '';
      return raw;
    }
    function ivUnknownWords(text){
      const lg = ivLang();
      return ivHasAny(text, ['dont know', 'do not know', "don't know", 'not sure', 'no idea'].concat(IV_NONE_WORDS[lg]));
    }
    function ivCleanComplaint(raw){
      let s = String(raw || '').trim().replace(/[.,;:!?]+$/, '').replace(/\s+/g, ' ');
      if(s.length > 2){
        const low = s.toLowerCase();
        const prefixes = ['i have had ', 'i have been having ', 'i have ', 'i am having ', 'i am experiencing ', 'i am feeling ', 'i feel ', 'i get ', 'having ', 'my main problem is ', 'my problem is ', 'my complaint is ', 'the problem is ', 'problem is ', 'suffering from ', 'i suffer from ', 'मुझे ', 'मुझको ', 'मुझमें ', 'मुझे महसूस हो रहा है ', 'मला ', 'माझी ', 'माझे ', 'मला वाटते '];
        for(let i = 0; i < prefixes.length; i++){
          if(low.indexOf(prefixes[i]) === 0){ s = s.slice(prefixes[i].length).trim(); break; }
        }
      }
      if(!s) return '';
      s = s.charAt(0).toUpperCase() + s.slice(1);
      return s.length > 80 ? s.slice(0, 80) + '…' : s;
    }
    function ivCaptureCustom(text){
      const cleaned = ivCleanComplaint(text);
      if(!cleaned){
        addMsg('bot', ivT('iv_custom_ask'));
        ivShowOpts();
        return;
      }
      IV.customPending = false;
      ivSetText('inOtherComplaint', cleaned);
      addMsg('bot', ivT('iv_added').replace('{list}', cleaned));
      addMsg('bot', ivT('iv_any_more'));
      ivShowOpts();
    }
    function ivHandleText(text){
      if(!IV.active) return;
      addMsg('user', text);
      const rf = ivCheckRed(text);
      if(rf.length) ivRaiseRed(rf);
      const lg = ivLang();
      if(IV.fu){
        const item = IV.fq[IV.fqi];
        if(item){
          const hit = item.opts.filter(function(o){ return ivHits(text, o); });
          const skip = ivHasAny(text, SKIP_EXACT.en.concat(SKIP_EXACT[lg]));
          if(hit.length){ ivFuPick(hit[0]); return; }
          if(skip){ ivFuSkip(); return; }
          addMsg('bot', ivT('iv_no_match'));
          ivShowOpts();
          return;
        }
      }
      const f = ivCur();
      if(f.type === 'text'){
        const nm = ivCleanName(text);
        if(!nm){ addMsg('bot', ivT('iv_retry_name')); ivShowOpts(); return; }
        ivSetText('inName', nm);
        addMsg('bot', ivCaptured(f, nm));
        ivNext();
        return;
      }
      if(f.type === 'age' || f.type === 'weight'){
        const n = ivNumFrom(text);
        const ok = (n !== null) && (f.type === 'age' ? (n >= 1 && n <= 120) : (n >= 2 && n <= 350));
        if(!ok){ addMsg('bot', ivT(f.type === 'age' ? 'iv_age_bad' : 'iv_weight_bad')); ivShowOpts(); return; }
        const val = f.type === 'age' ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
        ivSetText(f.type === 'age' ? 'inAge' : 'inWeight', val);
        addMsg('bot', ivCaptured(f, val));
        ivNext();
        return;
      }
      if(f.type === 'pick'){
        if(f.key === 'blood'){
          const bg = ivParseBlood(text);
          if(bg){ ivApplyPick(f, bg); addMsg('bot', ivCaptured(f, bg)); ivNext(); return; }
        }
        const hit = f.opts.filter(function(o){ return ivHits(text, o); });
        if(hit.length){ ivApplyPick(f, hit[0]); addMsg('bot', ivCaptured(f, hit[0])); ivNext(); return; }
        if(f.unknown && ivUnknownWords(text)){ addMsg('bot', ivCaptured(f, "Don't know")); ivNext(); return; }
        addMsg('bot', ivT(rf.length ? 'rf_after' : 'iv_no_match'));
        ivShowOpts();
        return;
      }
      if(f.type === 'multi'){
        const keys = (f.key === 'symptoms') ? SYMPTOM_KEYS : FACTOR_KEYS;
        const matches = keys.filter(function(k){ return ivHits(text, k); });
        const doneW = ivHasAny(text, IV_DONE_WORDS[lg]);
        const noneW = ivHasAny(text, IV_NONE_WORDS[lg]);
        if(matches.length){
          matches.forEach(function(k){ if(f.key === 'symptoms') ivSetSym(k, true); else ivSetFac(k, true); });
          ivShowOpts();
          if(doneW || noneW){ ivFinishMulti(); }
          else addMsg('bot', ivT('iv_any_more'));
          return;
        }
        if(noneW){
          if(f.key === 'symptoms') ivClearSyms(); else ivClearFacs();
          addMsg('bot', ivT(f.key === 'symptoms' ? 'iv_no_symptom' : 'iv_no_factor'));
          ivNext();
          return;
        }
        if(doneW){ ivFinishMulti(); return; }
        // The problem may simply not be one of the listed symptoms — an
        // unmatched spoken/typed complaint (or one offered after tapping
        // "Something else") becomes the patient's own free-text complaint.
        if(f.key === 'symptoms'){
          const t2 = String(text || '').trim();
          const noise = ivHasAny(t2, SKIP_EXACT.en.concat(SKIP_EXACT[lg]).concat(['ok', 'okay', 'alright', 'hmm', 'um', 'thanks', 'thank you', 'what', 'yes', 'no', 'maybe', 'ya', 'fine']));
          if(!noise && !ivUnknownWords(t2) && t2.indexOf('?') === -1 && t2.length >= 3){
            ivCaptureCustom(t2);
            return;
          }
        }
        addMsg('bot', ivT(rf.length ? 'rf_after' : 'iv_no_match'));
        ivShowOpts();
      }
    }
    function ivParseBlood(text){
      const up = String(text || '').toUpperCase().replace(/POSITIVE/g, '+').replace(/NEGATIVE/g, '-').replace(/[\s._-]+/g, '');
      const m = up.match(/(A|B|AB|O)[+-]/);
      if(!m) return null;
      const b = m[0];
      return ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].indexOf(b) !== -1 ? b : null;
    }

    // ---- chat mic: speak an answer (or a question when not interviewing) ----
    if(micEl && !(window.SpeechRecognition || window.webkitSpeechRecognition)){
      micEl.disabled = true;
      micEl.title = ivT('Mic unsupported');
    }
    function ivToggleMic(){
      if(!micEl || micEl.disabled) return;
      if(chatRec){ ivStopMic(); return; }
      if(busy){ addMsg('bot', ivT('Mic busy')); return; }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!SR){ addMsg('bot', ivT('Mic unsupported'), true); return; }
      let rec = null;
      try{ rec = new SR(); }catch(e){ addMsg('bot', ivT('Mic error'), true); return; }
      chatRec = rec;
      const lg = ivLang();
      rec.lang = (lg === 'hi') ? 'hi-IN' : (lg === 'mr') ? 'mr-IN' : 'en-IN';
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let finalTxt = '';
      rec.onresult = function(e){
        for(let i = 0; i < e.results.length; i++){
          if(e.results[i].isFinal) finalTxt += e.results[i][0].transcript;
        }
      };
      rec.onend = function(){
        const wasRec = chatRec;
        chatRec = null;
        ivSetMic(false);
        const t = (finalTxt || '').trim();
        if(wasRec && t){
          input.value = t;
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 90) + 'px';
          if(IV.active){ ivHandleText(t); input.value = ''; }
          else send();
        }
      };
      rec.onerror = function(e){
        const n = e && e.error;
        const wasRec = chatRec;
        chatRec = null;
        ivSetMic(false);
        let msg = null;
        if(n === 'not-allowed' || n === 'service-not-allowed') msg = 'Mic blocked';
        else if(n === 'network') msg = 'Mic network';
        else if(n === 'no-speech' || n === 'aborted') msg = null;
        else msg = 'Mic error';
        if(msg && wasRec) addMsg('bot', ivT(msg), true);
      };
      ivSetMic(true);
      try{ rec.start(); }
      catch(e){ ivStopMic(); addMsg('bot', ivT('Mic error'), true); }
    }
    if(micEl){ micEl.addEventListener('click', ivToggleMic); }
    const START_LABEL = {
      en: '\ud83d\udccb Start guided case interview',
      hi: '\ud83d\udccb \u0917\u093e\u0907\u0921\u0947\u0921 \u0915\u0947\u0938 \u0907\u0902\u091f\u0930\u094d\u0935\u094d\u092f\u0942 \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902',
      mr: '\ud83d\udccb \u092e\u093e\u0930\u094d\u0917\u0926\u0930\u094d\u0936\u093f\u0924 \u0915\u0947\u0938 \u092e\u0941\u0932\u093e\u0916\u0924 \u0938\u0941\u0930\u0942 \u0915\u0930\u093e'
    };

    function systemPrompt(){
      let dosha = 'none';
      try{
        const active = document.querySelector('.dosha-btn.active');
        if(active) dosha = active.textContent.replace(/\s+/g, ' ').trim();
      }catch(e){}
      let symptoms = 'none';
      let factors = 'none';
      const outSym = document.getElementById('outSymptoms');
      const outFac = document.getElementById('outFactor');
      if(outSym && outSym.textContent && outSym.textContent.indexOf('—') === -1) symptoms = outSym.textContent.trim();
      if(outFac && outFac.textContent && outFac.textContent.indexOf('—') === -1) factors = outFac.textContent.trim();
      const lang = langName();
      return 'You are the assistant inside \u201CPatient Case-Taking Software — SIH26047\u201D, an Ayurveda clinic app by the Ministry of Ayush. Help both doctors and patients with clear, brief, friendly answers. ' +
        'App features you can explain: structured case-taking (patient details incl. gender, weight and blood group; body type/Prakriti Vata-Pitta-Kapha; symptom chips with follow-up questions; weather/eating triggers), ' +
        'auto-generated NAMASTE/ICD-11 case codes, real on-device OCR (Tesseract.js) to scan paper case sheets, the doctor\u2019s queue with prescribing and print-prescription, ' +
        'a patient portal to look up prescriptions by name and age, ABHA record linking, voice input for notes, three languages (English/Hindi/Marathi), dark mode, and a Supabase database. ' +
        'CURRENT UI LANGUAGE: ' + lang + '. Reply in ' + lang + ' using simple, respectful words. ' +
        'CURRENT CASE: dosha=' + dosha + '; symptoms=' + symptoms + '; triggers=' + factors + '. ' +
        'If nothing is selected, say so. Keep answers under ~120 words unless the user asks for detail. ' +
        'If asked something unrelated to this app or to Ayurveda, politely explain you can only help with those.';
    }

    async function callGemini(){
      const key = getKey().trim();
      const modelList = [getModel()];
      FALLBACK_MODELS.forEach(function(m){ if(modelList.indexOf(m) === -1){ modelList.push(m); } });
      let lastModelError = '';
      for(let i = 0; i < modelList.length; i++){
        const model = modelList[i];
        const body = {
          system_instruction: { parts: [{ text: systemPrompt() }] },
          contents: history,
          generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
        };
        const res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key),
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        if(res.ok){
          const data = await res.json();
          const text = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
            data.candidates[0].content.parts && data.candidates[0].content.parts.length
            ? data.candidates[0].content.parts.map(function(p){ return p.text || ''; }).join('')
            : '';
          if(!text.trim()) return 'I could not produce an answer — please try again.';
          return (i > 0 ? '[fallback model ' + model + '] ' : '') + text;
        }
        let detail = '';
        try{ detail = (await res.json()).error.message || ''; }catch(e){}
        if(/no longer available|not found|does not exist|not supported|not a valid model/i.test(detail)){
          lastModelError = detail;
          continue; // model retired/unavailable — try the next fallback
        }
        if(res.status === 400 && /API_KEY|key/i.test(detail)){
          localStorage.removeItem(KEY_STORE);
          setStatus(false);
          showSettings(true);
          return 'Your Gemini API key is invalid or expired — please paste a new one in settings (⚙).';
        }
        if(res.status === 429) return 'Rate limit reached — please wait about a minute and try again.';
        if(detail) return 'The AI service said: ' + detail;
        return 'The AI service returned an error (HTTP ' + res.status + ').';
      }
      return 'The model ' + modelList[0] + ' and its fallbacks are all unavailable right now — try a different model in settings (⚙). ' + (lastModelError ? '(' + lastModelError + ')' : '');
    }

    async function send(){
      const text = input.value.trim();
      if(!text || busy) return;
      if(IV.active){
        input.value = '';
        ivHandleText(text);
        return;
      }
      if(!getKey()){
        addMsg('user', text);
        history.push({ role: 'user', parts: [{ text: text }] });
        addMsg('bot', 'I\u2019m almost ready — please paste your free Gemini API key first (tap the ⚙ button above, or use the settings link).');
        input.value = '';
        showSettings(true);
        setStatus(false);
        return;
      }
      busy = true;
      sendBtn.disabled = true;
      addMsg('user', text);
      const rfText = ivCheckRed(text);
      if(rfText.length) ivRaiseRed(rfText);
      history.push({ role: 'user', parts: [{ text: text }] });
      if(history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
      input.value = '';
      typing.classList.add('show');
      msgs.scrollTop = msgs.scrollHeight;
      try{
        const reply = await callGemini();
        const isErr = reply.indexOf('API key is invalid') === 0 || reply.indexOf('Rate limit') === 0 || reply.indexOf('AI service') === 0 || reply.indexOf('could not produce') === 0;
        addMsg('bot', reply, isErr);
        if(!isErr) history.push({ role: 'model', parts: [{ text: reply }] });
      }catch(e){
        addMsg('bot', 'Could not reach the AI service — check your internet connection and try again.', true);
      }
      typing.classList.remove('show');
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }

    function welcomeTexts(lang){
      if(lang === 'hi') return 'नमस्ते! मैं आपका केस-टेकिंग सहायक हूँ। मैं केस शीट स्कैन करने, दोष समझने, डॉक्टर की कतार इस्तेमाल करने या प्रिस्क्रिप्शन ढूँढने में मदद कर सकता हूँ। मैं हिंदी में जवाब दूँगा।';
      if(lang === 'mr') return 'नमस्कार! मी तुमचा केस-टेकिंग सहायक आहे. केस शीट स्कॅन करणे, दोष समजून घेणे, डॉक्टरची रांग वापरणे किंवा प्रिस्क्रिप्शन शोधणे यात मी मदत करू शकतो. मी मराठीत उत्तर देईन.';
      return 'Namaste! I\u2019m your case-taking assistant. Ask me anything about the app or Ayurveda — I\u2019m replying in ' + langName() + '.';
    }
    function refreshChatLangBtn(){
      if(chatLangBtn){ chatLangBtn.textContent = (chatLang === 'hi') ? 'हि' : (chatLang === 'mr') ? 'म' : 'EN'; }
    }
    function renderLangPicker(){
      chipsRow.innerHTML = '';
      [['en','English'],['hi','हिन्दी'],['mr','मराठी']].forEach(function(pair){
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chat-chip' + (chatLang === pair[0] ? ' active' : '');
        c.textContent = pair[1];
        c.addEventListener('click', function(){
          chatLang = pair[0];
          localStorage.setItem('sihChatLang', chatLang);
          refreshChatLangBtn();
          chipsRow.innerHTML = '';
          addMsg('bot', welcomeTexts(chatLang));
          renderChips();
        });
        chipsRow.appendChild(c);
      });
    }
    function openPanel(){
      panel.classList.add('open');
      setStatus(true);
      if(!msgs.children.length){
        if(!chatLang){
          addMsg('bot', 'Namaste! Please choose your language — / अपनी भाषा चुनें — / तुमची भाषा निवडा:');
          renderLangPicker();
        } else {
          addMsg('bot', welcomeTexts(chatLang));
          renderChips();
        }
      }
      if(!getKey()){ showSettings(true); }
      setTimeout(function(){ input.focus(); }, 100);
    }
    if(chatLangBtn){
      chatLangBtn.addEventListener('click', function(){
        if(IV.active){ addMsg('bot', ivT('iv_lang_warn')); return; }
        addMsg('bot', 'Change language / भाषा बदलें / भाषा बदला:');
        renderLangPicker();
      });
      refreshChatLangBtn();
    }

    // Closing the bot wipes the conversation and the language choice, so the
    // next patient opens a fresh chat and picks their own language again.
    function clearChat(){
      ivResetState();
      msgs.innerHTML = '';
      chipsRow.innerHTML = '';
      history = [];
      busy = false;
      sendBtn.disabled = false;
      typing.classList.remove('show');
      chatLang = '';
      localStorage.removeItem('sihChatLang');
      refreshChatLangBtn();
    }
    fab.addEventListener('click', function(){
      if(panel.classList.contains('open')){ clearChat(); panel.classList.remove('open'); }
      else{ openPanel(); }
    });
    fab.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fab.click(); } });
    closeBtn.addEventListener('click', function(){ clearChat(); panel.classList.remove('open'); });
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function(e){
      if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(); }
    });
    input.addEventListener('input', function(){ input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 90) + 'px'; });
    settingsBtn.addEventListener('click', function(){ showSettings(!settingsPanel.classList.contains('show')); });
    keySave.addEventListener('click', function(){
      const k = keyInput.value.trim();
      if(!k){ return; }
      localStorage.setItem(KEY_STORE, k);
      if(modelInput && modelInput.value.trim()){ localStorage.setItem('sihGeminiModel', modelInput.value.trim()); }
      else{ localStorage.removeItem('sihGeminiModel'); }
      showSettings(false);
      setStatus(true);
    });
    keyClear.addEventListener('click', function(){
      localStorage.removeItem(KEY_STORE);
      keyInput.value = '';
      setStatus(false);
    });
    setStatus(true);
  })();
