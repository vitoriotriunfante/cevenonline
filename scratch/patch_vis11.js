const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
// chave nova vis11 (o vermelho de abandono passou das 10h para as 11h; a chave antiga vis10 do dia de hoje ficou ocupada pela regra velha)
ed('functions/api/cron-lances.js', (s) => tr(s, 'out.push({ chave: `vis10|${v.id}`, nivel: \'vermelho\'', 'out.push({ chave: `vis11|${v.id}`, nivel: \'vermelho\'', 'cron'));
ed('public/tvapp.html', (s) => {
  s = tr(s, 'out.push({key: `vis10|${v.id}`, nivel: \'vermelho\', subtipo: \'abandono_campo\', v});\n', 'out.push({key: `vis11|${v.id}`, nivel: \'vermelho\', subtipo: \'abandono_campo\', v});\n', 'tv key');
  s = tr(s, ".includes('vis10') && !String(a.key).includes('ven10')", ".includes('vis10') && !String(a.key).includes('vis11') && !String(a.key).includes('ven10')", 'tv pool');
  return s;
});
ed('public/matrizapp.html', (s) => tr(s, 'out.push({key: `${sig}|vis10|${v.id}`', 'out.push({key: `${sig}|vis11|${v.id}`', 'mz key'));
ed('functions/api/brasileirao-lances.js', (s) => tr(s, "  vis10: { nome: 'Cartão Vermelho (Abandono de Campo)'", "  vis11: { nome: 'Cartão Vermelho (Abandono de Campo)', pontos: -10, motivo: 'Nenhuma visita feita até às 11h com rota ativa (regra de 06/10/2026)' },\n  vis10: { nome: 'Cartão Vermelho (Abandono de Campo)'", 'rules'));
ed('public/brasileirao.html', (s) => tr(s, "  vis10: { nome: 'Cartão Vermelho (Abandono de Campo)'", "  vis11: { nome: 'Cartão Vermelho (Abandono de Campo)', pontos: -10, motivo: 'Nenhuma visita feita até às 11h com rota ativa (regra de 06/10/2026)' },\n  vis10: { nome: 'Cartão Vermelho (Abandono de Campo)'", 'rules br'));
