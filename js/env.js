  // ---- Public runtime configuration --------------------------------------
  // Only PUBLIC values belong here (URLs of Supabase Edge Functions the
  // browser calls). Real credentials (Supabase service role, ABDM sandbox
  // client id/secret, Bhashini keys) NEVER belong in the browser — they are
  // read from function secrets inside supabase/functions/*. See README
  // "Production posture" for the full secret map.
  //
  // After deploying the Edge Functions (supabase functions deploy), paste the
  // public URLs here, e.g.
  //   bhashiniEdgeUrl: 'https://<project-ref>.supabase.co/functions/v1/bhashini',
  //   abdmEdgeUrl:     'https://<project-ref>.supabase.co/functions/v1/abdm',
  //   fhirEdgeUrl:     'https://<project-ref>.supabase.co/functions/v1/fhir-export',
  //
  // Until set, the app runs with the in-browser fallbacks (Web Speech ASR/TTS
  // and the local simulated ABDM gateway) and logs a console warning.
  window.SIH_ENV = {
    bhashiniEdgeUrl: '',
    abdmEdgeUrl: '',
    fhirEdgeUrl: ''
  };
