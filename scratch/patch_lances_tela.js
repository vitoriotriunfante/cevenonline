const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 1 + 1) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

const BLOCO = (chaveExib) =>
"const INVICTA_AVISADA = new Set();\n" +
"// LANCES QUE O SERVIDOR (coletor, de 5 em 5 min) REGISTROU ANTES DESTA TELA (Vitório, 06/10/2026: \"não to vendo um lance já tem mais de 20 minutos\"): como o coletor grava primeiro,\n" +
"// a tela nunca era a 'descobridora' e nao apitava. Agora o lance registrado nos ultimos 12 min (e que esta tela ainda nao mostrou) tambem entra na fila do VAR.\n" +
"const RECENTES = new Set(); let EXIB = new Set(store.get(" + chaveExib + " + HOJE0, []));\n" +
"const NIVEIS_APITAM = ['gol', 'hattrick', 'defesa', 'penalti', 'impedimento', 'vermelho', 'golcontra'];\n" +
"const varGapS = () => (+P.get('vargap') || (sp().h >= 16 ? 90 : 180)); // depois das 16h o VAR roda mais rapido (intensifica o fechamento)\n" +
"const varMaxH = () => (+P.get('varmax') || (sp().h >= 16 ? 40 : 20));\n";

function comum(s, chaveExib, nomeSet) {
  s = tr(s, "const INVICTA_AVISADA = new Set();\n", BLOCO(chaveExib), 'bloco');
  s = tr(s, "d.lances.forEach(r => { seen.add(r.chave); if (!tem.has(r.chave))",
    "const agoraS = secDe(sp().hms);\n  const ehRecente = (r) => !Number(r.baseline) && NIVEIS_APITAM.includes(r.nivel) && !EXIB.has(r.chave) && (agoraS - secDe(r.hora_sp)) >= 0 && (agoraS - secDe(r.hora_sp)) <= 12 * 60;\n  d.lances.forEach(r => { if (ehRecente(r)) RECENTES.add(r.chave); else seen.add(r.chave); if (!tem.has(r.chave))", 'carrega');
  s = tr(s, "novos.forEach(a => LOG.push(", "novos.filter(a => !LOG.some(e => e.key === a.key)).forEach(a => LOG.push(", 'log');
  s = tr(s, "const "+nomeSet+" = new Set(d.novos); novos = cands.filter(a => "+nomeSet+".has(a.key)); }", "const "+nomeSet+" = new Set(d.novos); novos = cands.filter(a => "+nomeSet+".has(a.key) || RECENTES.has(a.key)); novos.forEach(a => { RECENTES.delete(a.key); EXIB.add(a.key); }); store.set(" + chaveExib + " + HOJE0, [...EXIB]); }", 'proc');
  return s;
}
ed('public/tvapp.html', (s) => {
  s = comum(s, "'ceven_exib_' + FIL + '_'", 'set');
  s = tr(s, "const VAR_GAP_S = +P.get('vargap') || 180, VAR_MAX_H = +P.get('varmax') || 20;", "const VAR_GAP_S = +P.get('vargap') || 180, VAR_MAX_H = +P.get('varmax') || 20; // base; o que vale e varGapS()/varMaxH() (mais rapido depois das 16h)", 'cte');
  s = tr(s, "VARS.length < VAR_MAX_H && (!VARS.length || agora - VARS[VARS.length - 1] >= VAR_GAP_S * 1000)", "VARS.length < varMaxH() && (!VARS.length || agora - VARS[VARS.length - 1] >= varGapS() * 1000)", 'pode');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = comum(s, "'ceven_exib_MTZ_'", 'st');
  s = tr(s, "VARS.length < VAR_MAX_H && (!VARS.length || agora - VARS[VARS.length - 1] >=", "VARS.length < varMaxH() && (!VARS.length || agora - VARS[VARS.length - 1] >=", 'pode');
  s = tr(s, "VAR_GAP_S * 1000); }", "varGapS() * 1000); }", 'gap');
  return s;
});
console.log('tudo ok');
