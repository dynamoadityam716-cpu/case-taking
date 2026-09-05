
  // ---- Shared EN/HI/MR translation data (used by the language toggle AND by
  // dynamically-generated content like the follow-up questions/options) ----
  let uiLang = 'en'; // one of: 'en' | 'hi' | 'mr'
  const i18nDict = {
    // step labels / headings
    'Step 1 — Patient details': 'चरण 1 — रोगी विवरण',
    'Step 2 — Body type (Prakriti)': 'चरण 2 — शरीर प्रकार (प्रकृति)',
    "Step 3 — What's bothering you": 'चरण 3 — तकलीफ़ क्या है',
    'Step 4 — When do your symptoms get worse': 'चरण 4 — लक्षण कब बढ़ते हैं',
    'Step 5 — Anything else to add (optional)': 'चरण 5 — कुछ और जोड़ना है (वैकल्पिक)',
    'Structured record (live)': 'संरचित रिकॉर्ड (लाइव)',
    "Doctor's queue — cases received": 'डॉक्टर की कतार — प्राप्त मामले',
    'Patient portal — look up your prescription': 'रोगी पोर्टल — अपना नुस्खा देखें',
    'Optional — scan a paper case sheet': 'वैकल्पिक — कागज़ी केस शीट स्कैन करें',

    // step progress dots
    'Patient': 'रोगी', 'Body type': 'शरीर प्रकार', 'Symptoms': 'लक्षण', 'Triggers': 'ट्रिगर', 'Notes': 'टिप्पणी',

    // scan block
    'Take or upload a photo': 'फोटो लें या अपलोड करें',
    "We'll pull the patient's details straight off the paper": 'हम कागज़ से रोगी का विवरण सीधे निकाल लेंगे',
    'Demo only — simulates the OCR extraction the real app runs on-device.': 'केवल डेमो — यह उस OCR प्रक्रिया की नकल है जो असली ऐप डिवाइस पर करता है।',
    'Runs real OCR on your device (Tesseract.js). The first scan downloads the engine (~7 MB), so an internet connection is needed.': 'आपके डिवाइस पर वास्तविक OCR (Tesseract.js) चलता है। पहले स्कैन में इंजन (~7 MB) डाउनलोड होता है, इसलिए इंटरनेट कनेक्शन ज़रूरी है।',
    'Clear': 'साफ़ करें',
    'Filled in: name, age, gender, weight, blood group, body type and symptoms from the case sheet — check and adjust anything below.': 'भर दिया गया: केस शीट से नाम, आयु, लिंग, वज़न, रक्त समूह, शरीर प्रकार और लक्षण — नीचे जाँच लें और ज़रूरत हो तो बदलें।',
    "Filled in: name, age, body type, and a note from the case sheet — check it and adjust anything below.": 'भर दिया गया: नाम, आयु, शरीर प्रकार, और केस शीट से एक टिप्पणी — नीचे जाँच लें और ज़रूरत हो तो बदलें।',

    // patient details
    'Full name': 'पूरा नाम',
    'Age': 'आयु',
    'Gender': 'लिंग',
    'Weight (kg)': 'वज़न (किग्रा)',
    'Blood group': 'रक्त समूह',

    // past history (intake page 2)
    'Past / ongoing illnesses & surgeries': 'पिछली / चालू बीमारियाँ और सर्जरी',
    'Current medicines (one per line)': 'वर्तमान दवाइयाँ (एक पंक्ति में एक)',
    'Allergies': 'एलर्जी',
    'Family history': 'पारिवारिक इतिहास',
    'Lifestyle / occupation / habits': 'जीवनशैली / व्यवसाय / आदतें',
    'Ayurveda detail — Agni, Koshtha, Ahara-Vihara, Nidana (optional)': 'आयुर्वेद विवरण — अग्नि, कोष्ठ, आहार-विहार, निदान (वैकल्पिक)',

    // intake page headers / nav (multi-page form)
    'Patient details': 'रोगी विवरण',
    'Who is this visit for?': 'यह विज़िट किसके लिए है?',
    'Past history': 'पिछला इतिहास',
    'What came before today?': 'आज से पहले क्या था?',
    'What is bothering you today?': 'आज आपको क्या परेशानी है?',
    'Anything else & send': 'कुछ और और भेजें',
    'Notes for the doctor': 'डॉक्टर के लिए नोट्स',
    '← Back': '← पीछे',
    'Next →': 'आगे →',

    // dosha buttons
    'Vata': 'वात', 'Pitta': 'पित्त', 'Kapha': 'कफ',
    'Air · Space': 'वायु · आकाश', 'Fire · Water': 'अग्नि · जल', 'Earth · Water': 'पृथ्वी · जल',

    // symptom block
    'Select what applies': 'जो लागू हो उसे चुनें',
    'Something else? (not in the list)': 'कुछ और? (सूची में नहीं है)',
    'Pain & stiffness': 'दर्द और अकड़न',
    'Stomach & appetite': 'पेट और भूख',
    'Mind & sleep': 'मन और नींद',
    'Daily habits': 'दैनिक आदतें',
    'Skin, cough & fever': 'त्वचा, खांसी और बुखार',
    'Joint pain': 'जोड़ों का दर्द',
    'Stiff joints': 'जोड़ों में अकड़न',
    'Headache': 'सिरदर्द',
    'Upset stomach': 'पेट खराब',
    'Not feeling hungry': 'भूख न लगना',
    'Heartburn': 'सीने में जलन',
    'Trouble sleeping': 'नींद न आना',
    'Feeling anxious': 'बेचैनी महसूस होना',
    'Feeling tired': 'थकान महसूस होना',
    'Ongoing cough': 'लगातार खांसी',
    'Mild fever': 'हल्का बुखार',
    'Skin itching or rash': 'त्वचा में खुजली या दाने',

    // follow-up block label
    'A bit more detail on what you picked': 'आपने जो चुना उसके बारे में थोड़ा और विवरण',

    // follow-up questions (dynamically rendered per symptom)
    'How long has this been going on?': 'यह कब से हो रहा है?',
    'How severe is it?': 'यह कितना गंभीर है?',
    'When is it worst?': 'यह कब सबसे ज़्यादा होता है?',
    'Where is the pain?': 'दर्द कहाँ है?',
    'Does light or sound make it worse?': 'क्या रोशनी या आवाज़ से यह बढ़ जाता है?',
    'Worse after eating?': 'क्या खाने के बाद बढ़ जाता है?',
    'Any nausea or vomiting?': 'क्या जी मिचलाना या उल्टी होती है?',
    'How long has appetite been low?': 'भूख कब से कम है?',
    'When does it happen most?': 'यह सबसे ज़्यादा कब होता है?',
    "What's the main issue?": 'मुख्य समस्या क्या है?',
    'How long has this been happening?': 'यह समस्या कब से है?',
    'How often does this come up?': 'यह कितनी बार होता है?',
    'Does rest help?': 'क्या आराम करने से आराम मिलता है?',
    'Dry or with phlegm?': 'सूखी खांसी है या बलगम वाली?',
    'How long has it lasted?': 'यह कब से बनी हुई है?',
    'How long has the fever lasted?': 'बुखार कब से है?',
    'Where is it?': 'यह शरीर पर कहाँ है?',
    'Any known trigger?': 'कोई ज्ञात कारण है?',

    // follow-up options (dynamically rendered per question)
    'A few days': 'कुछ दिन',
    '1-2 weeks': '1-2 हफ्ते',
    '1+ month': '1+ महीना',
    'Mild': 'हल्का',
    'Moderate': 'मध्यम',
    'Severe': 'गंभीर',
    'Morning': 'सुबह',
    'After rest': 'आराम के बाद',
    'End of day': 'दिन के अंत में',
    'Front': 'आगे',
    'Sides': 'बगल में',
    'All over': 'पूरे सिर में',
    'Yes': 'हाँ',
    'No': 'नहीं',
    'Sometimes': 'कभी-कभी',
    'After meals': 'भोजन के बाद',
    'At night': 'रात में',
    'Random': 'अनियमित',
    'Falling asleep': 'नींद आने में',
    'Staying asleep': 'नींद बनाए रखने में',
    'Waking too early': 'जल्दी नींद खुलना',
    'Occasionally': 'कभी-कभार',
    'Most days': 'ज़्यादातर दिन',
    'Constantly': 'लगातार',
    'Yes, fully': 'हाँ, पूरी तरह',
    'Somewhat': 'कुछ हद तक',
    'Not at all': 'बिल्कुल नहीं',
    'Dry': 'सूखी',
    'With phlegm': 'बलगम के साथ',
    'Under a week': 'एक हफ्ते से कम',
    '2+ weeks': '2+ हफ्ते',
    '1-2 days': '1-2 दिन',
    '3-5 days': '3-5 दिन',
    'Longer': 'ज़्यादा समय',
    'Localized': 'एक जगह पर',
    'Spread out': 'फैला हुआ',
    'New food': 'नया खाना',
    'New product': 'नया उत्पाद',
    'Not sure': 'पता नहीं',

    // trigger/factor chips
    'Weather': 'मौसम',
    'Eating habits': 'खाने की आदतें',
    'Cold weather': 'ठंडा मौसम',
    'Dry weather': 'सूखा मौसम',
    'Eating too much': 'अधिक खाना',
    'Skipping meals': 'भोजन छोड़ना',

    // notes
    'Description / notes': 'विवरण / टिप्पणी',
    "Speech-to-text isn't supported in this browser — try Chrome or Edge.": 'इस ब्राउज़र में स्पीच-टू-टेक्स्ट समर्थित नहीं है — Chrome या Edge आज़माएँ।',

    // actions
    'Submit case to doctor': 'डॉक्टर को केस भेजें',
    'Find my prescription': 'मेरा नुस्खा खोजें',
    'Copy': 'कॉपी करें',
    'Synced to ABHA record on save': 'सेव करने पर ABHA रिकॉर्ड से समन्वित',
    'No cases awaiting prescription.': 'अभी तक प्रिस्क्रिप्शन की प्रतीक्षा में कोई केस नहीं।',
    'Awaiting prescription': 'प्रिस्क्रिप्शन की प्रतीक्षा',
    'Prescribe': 'नुस्खा लिखें',
    'Received': 'प्राप्त',
    '🚨 Urgent — triage first': '🚨 अति आवश्यक — पहले ट्राइएज करें',

    // portal
    'Simulates the patient checking their own ABHA-linked record after the visit — enter the same name and age used at check-in to pull up the prescription (nothing is shown until you search).':
      'यह मरीज़ द्वारा विज़िट के बाद अपने ABHA-लिंक्ड रिकॉर्ड की जाँच का अनुकरण है — नुस्खा देखने के लिए चेक-इन पर दिया गया वही नाम और आयु दर्ज करें (खोजने तक कुछ भी नहीं दिखेगा)।',
    'Enter your name and age above to view your prescription, once your doctor has written one.':
      'अपना नुस्खा देखने के लिए ऊपर अपना नाम और आयु दर्ज करें, एक बार जब आपके डॉक्टर ने उसे लिख दिया हो।'
  };
  const i18nPlaceholders = {
    'e.g. Ramesh Iyer': 'जैसे रमेश अय्यर',
    'e.g. 42': 'जैसे 42',
    'Describe it in your own words, e.g. knee pain since last week': 'इसे अपने शब्दों में लिखें, जैसे पिछले हफ्ते से घुटने में दर्द',
    "Describe how you're feeling in your own words, or tap the mic and speak...": 'अपने शब्दों में बताएं कि आप कैसा महसूस कर रहे हैं, या माइक दबाकर बोलें...',
    // past history placeholders (intake page 2)
    'e.g. diabetes since 2018; hernia repair 2021': 'जैसे 2018 से मधुमेह; 2021 में हर्निया ऑपरेशन',
    'e.g. Tab. Metformin 500 mg BD\nAshwagandha 500 mg at night': 'जैसे टैब. मेटफॉर्मिन 500 मिलीग्राम BD\nरात में अश्वगंधा 500 मिलीग्राम',
    'e.g. penicillin — rash': 'जैसे पेनिसिलिन — दाने',
    'e.g. mother has high blood pressure': 'जैसे माँ को उच्च रक्तचाप है',
    'e.g. night-shift worker, smoker, sleeps 5 h': 'जैसे रात्र-पाली कर्मचारी, धूम्रपान करता है, 5 घंटे सोता है',
    'e.g. Agni manda, Koshtha krura, takes cold water regularly': 'जैसे अग्नि मंद, कोष्ठ क्रूर, नियमित ठंडा पानी पीता है'
  };
  // Marathi translations (draft) — same English keys as i18nDict
  const i18nMr = {
    // step labels / headings
    'Step 1 — Patient details': 'पायरी 1 — रुग्णाची माहिती',
    'Step 2 — Body type (Prakriti)': 'पायरी 2 — शरीरप्रकृती (प्रकृती)',
    "Step 3 — What's bothering you": 'पायरी 3 — तुम्हाला काय त्रास आहे',
    'Step 4 — When do your symptoms get worse': 'पायरी 4 — लक्षणे कधी वाढतात',
    'Step 5 — Anything else to add (optional)': 'पायरी 5 — आणखी काही जोडायचे आहे? (ऐच्छिक)',
    'Structured record (live)': 'संरचित नोंद (लाइव्ह)',
    "Doctor's queue — cases received": 'डॉक्टरांची रांग — प्राप्त झालेल्या केसेस',
    'Patient portal — look up your prescription': 'रुग्ण पोर्टल — तुमचे प्रिस्क्रिप्शन पहा',
    'Optional — scan a paper case sheet': 'ऐच्छिक — कागदी केस शीट स्कॅन करा',

    // step progress dots
    'Patient': 'रुग्ण', 'Body type': 'शरीरप्रकृती', 'Symptoms': 'लक्षणे', 'Triggers': 'कारणे', 'Notes': 'टिप्पणी',

    // scan block
    'Take or upload a photo': 'फोटो घ्या किंवा अपलोड करा',
    "We'll pull the patient's details straight off the paper": 'आम्ही रुग्णाची माहिती कागदावरून थेट काढू',
    'Demo only — simulates the OCR extraction the real app runs on-device.': 'फक्त डेमो — वास्तविक ॲप डिव्हाइसवर जी OCR प्रक्रिया करते त्याचे अनुकरण.',
    'Runs real OCR on your device (Tesseract.js). The first scan downloads the engine (~7 MB), so an internet connection is needed.': 'तुमच्या डिव्हाइसवर प्रत्यक्ष OCR (Tesseract.js) चालते. पहिल्या स्कॅनमध्ये इंजिन (~7 MB) डाउनलोड होते, त्यामुळे इंटरनेट कनेक्शन आवश्यक आहे.',
    'Clear': 'साफ करा',
    'Filled in: name, age, gender, weight, blood group, body type and symptoms from the case sheet — check and adjust anything below.': 'भरले: केस शीटवरून नाव, वय, लिंग, वजन, रक्तगट, शरीरप्रकृती आणि लक्षणे — खाली तपासा आणि आवश्यक ते बदला.',
    "Filled in: name, age, body type, and a note from the case sheet — check it and adjust anything below.": 'भरले: नाव, वय, शरीरप्रकृती आणि केस शीटवरील टीप — तपासा आणि आवश्यक ते बदला.',

    // patient details
    'Full name': 'पूर्ण नाव',
    'Age': 'वय',
    'Gender': 'लिंग',
    'Weight (kg)': 'वजन (किलो)',
    'Blood group': 'रक्तगट',

    // past history (intake page 2)
    'Past / ongoing illnesses & surgeries': 'मागील / सध्याचे आजार आणि शस्त्रक्रिया',
    'Current medicines (one per line)': 'सध्याची औषधे (एका ओळीत एक)',
    'Allergies': 'ॲलर्जी',
    'Family history': 'कौटुंबिक इतिहास',
    'Lifestyle / occupation / habits': 'जीवनशैली / व्यवसाय / सवयी',
    'Ayurveda detail — Agni, Koshtha, Ahara-Vihara, Nidana (optional)': 'आयुर्वेद तपशील — अग्नी, कोष्ठ, आहार-विहार, निदान (ऐच्छिक)',

    // intake page headers / nav (multi-page form)
    'Patient details': 'रुग्णाची माहिती',
    'Who is this visit for?': 'ही भेट कोणासाठी आहे?',
    'Past history': 'मागील इतिहास',
    'What came before today?': 'आजपूर्वी काय होते?',
    'What is bothering you today?': 'आज तुम्हाला काय त्रास आहे?',
    'Anything else & send': 'आणखी काही आणि पाठवा',
    'Notes for the doctor': 'डॉक्टरांसाठी टिप्पणी',
    '← Back': '← मागे',
    'Next →': 'पुढे →',

    // dosha buttons
    'Vata': 'वात', 'Pitta': 'पित्त', 'Kapha': 'कफ',
    'Air · Space': 'वायू · आकाश', 'Fire · Water': 'अग्नी · जल', 'Earth · Water': 'पृथ्वी · जल',

    // symptom block
    'Select what applies': 'जे लागू होते ते निवडा',
    'Something else? (not in the list)': 'आणखी काही? (यादीत नाही)',
    'Pain & stiffness': 'दुखणे आणि अकडणे',
    'Stomach & appetite': 'पोट आणि भूक',
    'Mind & sleep': 'मन आणि झोप',
    'Daily habits': 'रोजच्या सवयी',
    'Skin, cough & fever': 'त्वचा, खोकला आणि ताप',
    'Joint pain': 'सांधेदुखी',
    'Stiff joints': 'सांधे अकडणे',
    'Headache': 'डोकेदुखी',
    'Upset stomach': 'पोट बिघडणे',
    'Not feeling hungry': 'भूक न लागणे',
    'Heartburn': 'छातीत जळजळ',
    'Trouble sleeping': 'झोप न लागणे',
    'Feeling anxious': 'चिंता वाटणे',
    'Feeling tired': 'थकवा जाणवणे',
    'Ongoing cough': 'सतत खोकला',
    'Mild fever': 'किंचित ताप',
    'Skin itching or rash': 'त्वचेला खाज किंवा पुरळ',

    // follow-up block label
    'A bit more detail on what you picked': 'तुम्ही निवडलेल्या गोष्टीबद्दल थोडी अधिक माहिती',

    // follow-up questions
    'How long has this been going on?': 'हे किती काळापासून आहे?',
    'How severe is it?': 'ते किती तीव्र आहे?',
    'When is it worst?': 'ते कधी सर्वात जास्त होते?',
    'Where is the pain?': 'दुखणे कुठे आहे?',
    'Does light or sound make it worse?': 'प्रकाश किंवा आवाजाने ते वाढते का?',
    'Worse after eating?': 'जेवणानंतर वाढते का?',
    'Any nausea or vomiting?': 'मळमळ किंवा उलटी होते का?',
    'How long has appetite been low?': 'भूक कमी किती दिवसांपासून आहे?',
    'When does it happen most?': 'ते सर्वात जास्त कधी होते?',
    "What's the main issue?": 'मुख्य समस्या काय आहे?',
    'How long has this been happening?': 'हे किती काळापासून चालू आहे?',
    'How often does this come up?': 'हे किती वेळा होते?',
    'Does rest help?': 'विश्रांतीने आराम मिळतो का?',
    'Dry or with phlegm?': 'कोरडा खोकला की कफासह?',
    'How long has it lasted?': 'ते किती काळापासून आहे?',
    'How long has the fever lasted?': 'ताप किती दिवसांचा आहे?',
    'Where is it?': 'ते कुठे आहे?',
    'Any known trigger?': 'काही ज्ञात कारण आहे का?',

    // follow-up options
    'A few days': 'काही दिवस',
    '1-2 weeks': '1-2 आठवडे',
    '1+ month': '1+ महिना',
    'Mild': 'सौम्य',
    'Moderate': 'मध्यम',
    'Severe': 'तीव्र',
    'Morning': 'सकाळी',
    'After rest': 'विश्रांतीनंतर',
    'End of day': 'दिवसाच्या शेवटी',
    'Front': 'समोर',
    'Sides': 'बाजू',
    'All over': 'सर्वत्र',
    'Yes': 'होय',
    'No': 'नाही',
    'Sometimes': 'कधीकधी',
    'After meals': 'जेवणानंतर',
    'At night': 'रात्री',
    'Random': 'कधीही',
    'Falling asleep': 'झोप येण्यात',
    'Staying asleep': 'झोप टिकवण्यात',
    'Waking too early': 'खूप लवकर जाग येणे',
    'Occasionally': 'कधीतरी',
    'Most days': 'बहुतेक दिवस',
    'Constantly': 'सतत',
    'Yes, fully': 'होय, पूर्ण',
    'Somewhat': 'काही प्रमाणात',
    'Not at all': 'अजिबात नाही',
    'Dry': 'कोरडा',
    'With phlegm': 'कफासह',
    'Under a week': 'एका आठवड्यापेक्षा कमी',
    '2+ weeks': '2+ आठवडे',
    '1-2 days': '1-2 दिवस',
    '3-5 days': '3-5 दिवस',
    'Longer': 'जास्त काळ',
    'Localized': 'एका ठिकाणी',
    'Spread out': 'पसरलेले',
    'New food': 'नवीन अन्न',
    'New product': 'नवीन उत्पादन',
    'Not sure': 'माहिती नाही',

    // trigger/factor chips
    'Weather': 'हवामान',
    'Eating habits': 'खाण्याच्या सवयी',
    'Cold weather': 'थंड हवामान',
    'Dry weather': 'कोरडे हवामान',
    'Eating too much': 'जास्त खाणे',
    'Skipping meals': 'जेवण वगळणे',

    // notes
    'Description / notes': 'वर्णन / टिप्पणी',
    "Speech-to-text isn't supported in this browser — try Chrome or Edge.": 'या ब्राउझरमध्ये स्पीच-टू-टेक्स्ट उपलब्ध नाही — Chrome किंवा Edge वापरा.',

    // actions
    'Submit case to doctor': 'केस डॉक्टरांकडे पाठवा',
    'Find my prescription': 'माझे प्रिस्क्रिप्शन शोधा',
    'Copy': 'कॉपी करा',
    'Synced to ABHA record on save': 'सेव्ह केल्यावर ABHA रेकॉर्डशी समक्रमित',
    'No cases awaiting prescription.': 'प्रिस्क्रिप्शनच्या प्रतीक्षेत सध्या कोणताही केस नाही.',
    'Awaiting prescription': 'प्रिस्क्रिप्शनची प्रतीक्षा',
    'Prescribe': 'प्रिस्क्रिप्शन लिहा',
    'Received': 'प्राप्त',
    '🚨 Urgent — triage first': '🚨 अत्यावश्यक — आधी ट्रायेज करा',

    // portal
    'Simulates the patient checking their own ABHA-linked record after the visit — enter the same name and age used at check-in to pull up the prescription (nothing is shown until you search).': 'रुग्ण स्वतःच्या ABHA-संलग्न नोंदीची भेटीनंतर तपासणी करतो असे अनुकरण — प्रिस्क्रिप्शन पाहण्यासाठी चेक-इनवेळी दिलेलेच नाव आणि वय टाका (शोधेपर्यंत काहीही दिसणार नाही).',
    'Enter your name and age above to view your prescription, once your doctor has written one.': 'एकदा डॉक्टरांनी प्रिस्क्रिप्शन लिहिल्यावर ते पाहण्यासाठी वर तुमचे नाव आणि वय टाका.'
  };
  const i18nMrReverse = {};
  Object.keys(i18nMr).forEach(function(k){ i18nMrReverse[i18nMr[k]] = k; });
  const i18nMrPlaceholders = {
    'e.g. Ramesh Iyer': 'उदा. रमेश अय्यर',
    'e.g. 42': 'उदा. 42',
    'Describe it in your own words, e.g. knee pain since last week': 'ते तुमच्या शब्दांत लिहा, उदा. गेल्या आठवड्यापासून गुडघ्यात दुखणे',
    "Describe how you're feeling in your own words, or tap the mic and speak...": 'तुम्हाला कसे वाटते ते तुमच्या शब्दांत सांगा, किंवा माइक दाबून बोला...',
    // past history placeholders (intake page 2)
    'e.g. diabetes since 2018; hernia repair 2021': 'उदा. 2018 पासून मधुमेह; 2021 मध्ये हर्निया शस्त्रक्रिया',
    'e.g. Tab. Metformin 500 mg BD\nAshwagandha 500 mg at night': 'उदा. टॅब. मेटफॉर्मिन 500 मिग्रॅ BD\nरात्री अश्वगंधा 500 मिग्रॅ',
    'e.g. penicillin — rash': 'उदा. पेनिसिलिन — पुरळ',
    'e.g. mother has high blood pressure': 'उदा. आईला उच्च रक्तदाब आहे',
    'e.g. night-shift worker, smoker, sleeps 5 h': 'उदा. रात्रीची पाळी, धूम्रपान करतो, 5 तास झोपतो',
    'e.g. Agni manda, Koshtha krura, takes cold water regularly': 'उदा. अग्नी मंद, कोष्ठ क्रूर, नियमित थंड पाणी घेतो'
  };
  const i18nMrReversePlaceholders = {};
  Object.keys(i18nMrPlaceholders).forEach(function(k){ i18nMrReversePlaceholders[i18nMrPlaceholders[k]] = k; });
  const i18nReverse = {};
  Object.keys(i18nDict).forEach(function(k){ i18nReverse[i18nDict[k]] = k; });
  const i18nReversePlaceholders = {};
  Object.keys(i18nPlaceholders).forEach(function(k){ i18nReversePlaceholders[i18nPlaceholders[k]] = k; });

  // Translate a string according to the current language state. Works in both
  // directions so content generated fresh (like follow-up Qs) always renders
  // in whichever language is currently active.
  function t(str){
    if(uiLang === 'en'){ return i18nReverse[str] || i18nMrReverse[str] || str; }
    if(uiLang === 'hi'){
      if(i18nDict[str]) return i18nDict[str];
      const en = i18nMrReverse[str]; // text currently in Marathi -> back to English key first
      if(en) return i18nDict[en] || en;
      return str;
    }
    if(uiLang === 'mr'){
      if(i18nMr[str]) return i18nMr[str];
      const en = i18nReverse[str]; // text currently in Hindi -> back to English key first
      if(en) return i18nMr[en] || en;
      return str;
    }
    return str;
  }
  function tPlaceholder(str){
    if(uiLang === 'en'){ return i18nReversePlaceholders[str] || i18nMrReversePlaceholders[str] || str; }
    if(uiLang === 'hi'){
      if(i18nPlaceholders[str]) return i18nPlaceholders[str];
      const en = i18nMrReversePlaceholders[str];
      if(en) return i18nPlaceholders[en] || en;
      return str;
    }
    if(uiLang === 'mr'){
      if(i18nMrPlaceholders[str]) return i18nMrPlaceholders[str];
      const en = i18nReversePlaceholders[str];
      if(en) return i18nMrPlaceholders[en] || en;
      return str;
    }
    return str;
  }

  