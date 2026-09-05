@echo off
rem SIH26047-newdb — starts the local web server and opens the app.
cd /d "%~dp0"
powershell -Command "Start-Sleep -Seconds 1; Start-Process 'http://localhost:8000'"
node -e "const h=require('http'),f=require('fs'),p=require('path');h.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';u=p.join(process.cwd(),u);try{let b=f.readFileSync(u);s.setHeader('Content-Type',p.extname(u)==='.css'?'text/css':p.extname(u)==='.js'?'text/javascript':'text/html; charset=utf-8');s.end(b)}catch(e){s.statusCode=404;s.end('Not found')}}).listen(8000,()=>console.log('App running — open http://localhost:8000'))"
echo.
echo If the browser did not open, go to http://localhost:8000
echo Close this black window to stop the app.
pause
