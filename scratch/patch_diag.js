const fs = require('fs');
const DIAG =
"\n// DIAGNOSTICO (?diag=1): mostra no canto da tela o estado da fila de lances, para tirar print se a TV ficar sem popup\n" +
"(function () { if (new URLSearchParams(location.search).get('diag') !== '1') return;\n" +
"  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:6px;bottom:44px;z-index:99999;background:rgba(0,0,0,.8);color:#9ef;font:12px monospace;padding:4px 8px;border-radius:6px;pointer-events:none'; document.body.appendChild(d);\n" +
"  setInterval(() => { try { d.textContent = 'diag · lances novos aguardando ' + RECENTES.size + ' · na espera do VAR ' + ESPERA.length + ' · na tela ' + FILA.length + ' · VARs na ultima hora ' + VARS.length + ' · alertas ' + ALERTAS.length + ' · ' + sp().hms; } catch (e) { d.textContent = 'diag · carregando…'; } }, 1000); })();";
for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
  const marca = "window.addEventListener('resize', cabe); })();";
  if (s.split(marca).length !== 2) throw new Error('ancora ' + rel);
  s = s.replace(marca, () => marca + DIAG);
  fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel);
}
