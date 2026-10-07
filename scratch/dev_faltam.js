const sw = JSON.parse(require('fs').readFileSync(process.env.TEMP + '/sw.json', 'utf8'))[0].results;
const led = JSON.parse(require('fs').readFileSync(process.env.TEMP + '/dev.json', 'utf8'))[0].results;
const tem = new Set(led.map((x) => x.chave.split('|').pop()));
const falt = [];
for (const x of sw) { let l; try { l = JSON.parse(x.devolucoes_json); } catch { continue; } for (const n of l) { if (String(n.data).slice(0, 10) !== '2026-10-07' || !(n.vl_devolvido > 0)) continue; if (!tem.has(String(n.numnota))) falt.push([x.filial_sigla, x.rca_codigo, n.numnota, Math.round(n.vl_devolvido), n.nomecli]); } }
console.log(falt.length, 'notas de hoje fora do ledger, R$', falt.reduce((a, x) => a + x[3], 0)); falt.sort((a, b) => b[3] - a[3]).forEach((x) => console.log(x.join(' | ')));
