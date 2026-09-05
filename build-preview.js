// SIH26047 — build-preview.js
// Creates preview.html: a single self-contained copy of the app (all local
// CSS/JS inlined) so the in-app Preview tab can serve it without a web
// server. The canonical file remains index.html (used by start-app.bat).
// Regenerate after editing css/js:  node build-preview.js
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Inline the stylesheet
html = html.replace(
  /<link rel="stylesheet" href="css\/styles\.css">/,
  (m) => {
    const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
    return '<style>\n' + css + '\n</style>';
  }
);

// Inline every local <script src="js/..."> in document order
const scriptRe = /<script src="(js\/[^"]+)"><\/script>/g;
html = html.replace(scriptRe, (m, src) => {
  const file = path.join(root, src);
  let code;
  try {
    code = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error('MISSING', src, e.message);
    return m;
  }
  // Guard: no local file may contain the literal closing-script sequence
  if (/<\/script>/i.test(code)) {
    console.error('SKIPPED (contains </script>):', src);
    return m;
  }
  console.log('inlined', src, '(' + code.length + ' chars)');
  return '<script>\n' + code + '\n</script>';
});

const out = path.join(root, 'preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log('wrote', out, '(' + html.length + ' chars)');
