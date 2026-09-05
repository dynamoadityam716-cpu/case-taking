# SIH26047 — New Database App (fully isolated copy)

This folder is a **standalone copy** of the SIH26047 patient case-taking app
that connects to a **brand-new Supabase project** — it is deliberately kept
completely separate from the base project:

- separate folder → separate code copy → separate database
- `js/config.js` here holds **only the new project's credentials** (pasted in
  step 3 below); it can never silently fall back to the base DB
- the base project folder (`sih26047-software/`) is never touched by this copy

## Setup (do these three steps)

1. **Create the new project**
   https://supabase.com → **New project** → choose any org → give it a
   **different name** from the base project → pick a region → **save the
   database password**.

2. **Run the schema**
   Open the new project → **SQL editor**:
   - run the whole of [`sql/schema.sql`](sql/schema.sql)
   - then [`sql/seed_dev.sql`](sql/seed_dev.sql) — replace
     `doctor@example.com` with the email you will log in with

3. **Paste the new credentials**
   New project → **Project Settings → API** → copy **Project URL** and
   **anon public key** into [`js/config.js`](js/config.js) (the two
   `YOUR_NEW_PROJECT_...` lines).

## Source code & pushing changes

This copy lives in its own git repository, deliberately separate from the base
project's repo:

- **repo:** https://github.com/dynamoadityam716-cpu/case-taking.git
- the local folder is already initialised on `main` and tracks
  `origin/main` — `git status` should show a clean working tree

Whenever you change the app and want it on GitHub:

```bash
cd C:\Users\dynam\OneDrive\ドキュメント\sih26047-software-newdb
git add -A
git commit -m "Describe the change"
git push
```

Notes:

- `.freebuff/` (Freebuff workspace metadata) is git-ignored and never pushed.
- `js/config.js` may contain the Supabase **anon public key** — that is safe to
  commit. Never put the **service_role** key (or any other secret) in the repo.

## Run it

Serve this folder (any static server):

```bash
# Node (no install):
node -e "const h=require('http'),f=require('fs'),p=require('path');h.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';u=p.join(process.cwd(),u);try{let b=f.readFileSync(u);s.setHeader('Content-Type',p.extname(u)==='.css'?'text/css':p.extname(u)==='.js'?'text/javascript':'text/html; charset=utf-8');s.end(b)}catch(e){s.statusCode=404;s.end('Not found')}}).listen(8000,()=>console.log('open http://localhost:8000'))"

# or: python -m http.server 8000
```

Then open http://localhost:8000 → create an account → run
[`sql/seed_dev.sql`](sql/seed_dev.sql) with that email if you have not yet →
log in → fill a case → **Review & confirm** → prescribe → check the portal.

> Internet is needed for the CDN scripts (Supabase client, Tesseract OCR,
> fonts).
