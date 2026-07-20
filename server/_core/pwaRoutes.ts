/**
 * Routes PWA publiques — servies sous /api/pwa/* pour contourner
 * l'authentification Cloudflare qui protège les routes statiques.
 *
 * Ces routes ne nécessitent aucune authentification et sont accessibles
 * directement par le navigateur pour l'installation PWA.
 */
import type { Express } from "express";
import fs from "fs";
import path from "path";

function getPublicDir(): string {
  // En production, les fichiers sont dans dist/public (relatif au fichier compilé)
  // En développement, ils sont dans client/public
  if (process.env.NODE_ENV === "development") {
    return path.resolve(process.cwd(), "client", "public");
  }
  // En production, __dirname pointe vers dist/
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "public");
}

const IOS_DIAG_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagnostic Micro iOS</title>
<style>
body{font-family:system-ui,sans-serif;max-width:480px;margin:2rem auto;padding:1rem;background:#f9f9f9}
h1{color:#E6007E;font-size:1.3rem}
.card{background:#fff;border-radius:12px;padding:1rem;margin:1rem 0;box-shadow:0 2px 8px rgba(0,0,0,.08)}
btn,button{background:#E6007E;color:#fff;border:none;border-radius:8px;padding:.75rem 1.5rem;font-size:1rem;cursor:pointer;width:100%;margin:.5rem 0}
btn:disabled{opacity:.5}
#log{font-family:monospace;font-size:.8rem;background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:8px;max-height:300px;overflow-y:auto;white-space:pre-wrap}
</style>
</head>
<body>
<h1>&#127899; Diagnostic Micro &mdash; OUIGO Control</h1>
<div class="card">
  <b>Informations navigateur</b>
  <div id="info"></div>
</div>
<div class="card">
  <b>Test microphone</b><br>
  <small>Appuyez sur le bouton pour tester l'acces au microphone.</small><br>
  <button id="btnTest" onclick="testMic()">&#127908; Tester le microphone</button>
  <button id="btnStop" onclick="stopRec()" disabled>&#9209; Arreter</button>
  <div id="status"></div>
</div>
<div class="card">
  <b>Journal</b>
  <div id="log"></div>
</div>
<script>
function log(msg,cls){var el=document.getElementById('log');var line=document.createElement('div');if(cls)line.style.color=cls==='ok'?'#4ade80':cls==='err'?'#f87171':'#fbbf24';line.textContent=new Date().toLocaleTimeString()+' - '+msg;el.appendChild(line);el.scrollTop=el.scrollHeight;}
function setStatus(msg){document.getElementById('status').textContent=msg;}
(function(){var info=document.getElementById('info');var lines=['UA: '+navigator.userAgent,'SpeechRecognition: '+(('SpeechRecognition' in window||'webkitSpeechRecognition' in window)?'OK':'Non disponible'),'MediaRecorder: '+(typeof MediaRecorder!=='undefined'?'OK':'Non disponible'),'getUserMedia: '+(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia?'OK':'Non disponible'),'HTTPS: '+(location.protocol==='https:'?'Oui':'Non - requis pour le micro')];if(typeof MediaRecorder!=='undefined'){['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg'].forEach(function(f){lines.push('isTypeSupported('+f+'): '+(MediaRecorder.isTypeSupported(f)?'OUI':'non'));});}info.innerHTML=lines.map(function(l){return'<div style="font-size:.85rem;margin:.2rem 0">'+l+'</div>';}).join('');})();
var mr=null,chunks=[],stream=null;
function testMic(){log('Demande acces microphone...');document.getElementById('btnTest').disabled=true;navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){stream=s;log('Acces microphone accorde','ok');var mime=MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';log('Format: '+mime);chunks=[];mr=new MediaRecorder(s,{mimeType:mime});mr.ondataavailable=function(e){if(e.data.size>0){chunks.push(e.data);log('Chunk: '+e.data.size+' octets');}};mr.onstop=function(){var blob=new Blob(chunks,{type:mime});log('Total: '+blob.size+' octets');if(blob.size<100){log('ATTENTION: audio vide - probleme format ou permissions','warn');}else{log('Succes: audio enregistre ('+blob.size+' octets)','ok');}stream.getTracks().forEach(function(t){t.stop();});document.getElementById('btnTest').disabled=false;document.getElementById('btnStop').disabled=true;};mr.start(500);log('Enregistrement demarre...');setStatus('Enregistrement en cours...');document.getElementById('btnStop').disabled=false;}).catch(function(e){log('Erreur: '+e.name+' - '+e.message,'err');setStatus('Erreur: '+e.name);document.getElementById('btnTest').disabled=false;});}
function stopRec(){if(mr&&mr.state!=='inactive'){mr.stop();setStatus('Arrete.');}document.getElementById('btnStop').disabled=true;}
</script>
</body>
</html>
`;

export function registerPwaRoutes(app: Express) {
  // Page de diagnostic iOS — accessible sans auth
  app.get("/api/pwa/diag-ios", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(IOS_DIAG_HTML);
  });

  // Manifest PWA — accessible sans auth
  app.get("/api/pwa/manifest.json", (_req, res) => {
    const publicDir = getPublicDir();
    const manifestPath = path.join(publicDir, "manifest.json");

    if (!fs.existsSync(manifestPath)) {
      // Fallback inline si le fichier n'existe pas
      res.json({
        name: "OUIGO Control",
        short_name: "OUIGO Control",
        description: "Contrôle propreté des rames OUIGO — Application terrain SNCF",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#E6007E",
        theme_color: "#E6007E",
        icons: [
          { src: "/api/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/api/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/api/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/api/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      });
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      // Remplacer les URLs des icônes pour pointer vers /api/pwa/
      manifest.icons = [
        { src: "/api/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/api/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/api/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/api/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];
      res.setHeader("Content-Type", "application/manifest+json");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.json(manifest);
    } catch {
      res.status(500).send("Error reading manifest");
    }
  });

  // Icône 192x192 — accessible sans auth
  app.get("/api/pwa/icon-192.png", (_req, res) => {
    const publicDir = getPublicDir();
    const iconPath = path.join(publicDir, "icon-192.png");
    if (!fs.existsSync(iconPath)) {
      res.status(404).send("Icon not found");
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(iconPath);
  });

  // Icône 512x512 — accessible sans auth
  app.get("/api/pwa/icon-512.png", (_req, res) => {
    const publicDir = getPublicDir();
    const iconPath = path.join(publicDir, "icon-512.png");
    if (!fs.existsSync(iconPath)) {
      res.status(404).send("Icon not found");
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(iconPath);
  });
}
