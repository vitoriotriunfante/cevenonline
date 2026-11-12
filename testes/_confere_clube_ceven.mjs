// CONFERENCIA CLUBE x CEVEN (Vitorio, 12/11/2026: "precisamos ter certeza dos dados" antes de usar o Clube na rota e na Liga). SO LEITURA.
// Uso: node testes/_confere_clube_ceven.mjs <clube_AAAAMMDD.json> AAAA-MM-DD   -> auditoria/CONFERE CLUBE x CEVEN <dia>.md
import { spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const [arq, dia] = process.argv.slice(2);
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const q = (sql) => { const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', sql], { encoding: 'utf8', maxBuffer: 1 << 29, env: { ...process.env, NO_COLOR: '1' } }); return JSON.parse(r.stdout)[0].results; };
const C = JSON.parse(fs.readFileSync(arq, 'utf8'));
const R$ = (x) => 'R$ ' + Math.round(x || 0).toLocaleString('pt-BR');
const L = [`# Conferência Clube da Venda × CEVEN — ${dia}`, '', `Clube lido em ${C.lido_em} (${C.vendedores.length} vendedores, ${C.checkins.length} check-in/out, ${C.justificativas.length} justificativas). Só leitura.`, ''];
// ---------- 1) CHECK-IN: cada cliente com check-in no roteiro do CEVEN tem o mesmo check-in no Clube? ----------
const rows = q(`SELECT filial_sigla f, rca_codigo r, roteiro_json, roteiro_em, produtividade_json, prod_em FROM varredura_central_rca WHERE data_ref = '${dia}'`);
const ckClube = new Map();   // filial|rca|cliente -> [{tipo, hora}]
for (const c of C.checkins) { const k = c.filial + '|' + c.rca + '|' + String(c.cliente); if (!ckClube.has(k)) ckClube.set(k, []); ckClube.get(k).push({ tipo: c.tipo, hora: String(c.data_hora || '').slice(11, 16) }); }
let ckTot = 0, ckIgual = 0, ckSoCeven = 0, ckHoraDif = 0, coTot = 0, coIgual = 0; const exDif = [], exFalta = [];
for (const r of rows) {
  let rot = null; try { rot = JSON.parse(r.roteiro_json || 'null'); } catch { }
  for (const c of Array.isArray(rot) ? rot : []) {
    if (String(c.data_visita || '').slice(0, 10) !== dia || !c.checkin_horario) continue;
    ckTot++;
    const L2 = ckClube.get(r.f + '|' + r.r + '|' + String(c.id_cliente)) || [];
    const ci = L2.filter((x) => x.tipo === 'CHECKIN').map((x) => x.hora), co = L2.filter((x) => x.tipo === 'CHECKOUT').map((x) => x.hora);
    if (!ci.length) { ckSoCeven++; if (exFalta.length < 15) exFalta.push(`${r.f} ${r.r} cliente ${c.id_cliente} (${c.nome_cliente || ''}) check-in CEVEN ${c.checkin_horario}`); continue; }
    if (ci.includes(String(c.checkin_horario).slice(0, 5))) ckIgual++; else { ckHoraDif++; if (exDif.length < 15) exDif.push(`${r.f} ${r.r} cliente ${c.id_cliente}: CEVEN ${c.checkin_horario} × Clube ${ci.join(', ')}`); }
    if (c.checkout_horario) { coTot++; if (co.includes(String(c.checkout_horario).slice(0, 5))) coIgual++; }
  }
}
L.push('## 1. Check-in e check-out (cliente a cliente)', '', `Clientes com check-in no roteiro do CEVEN de ${dia}: **${ckTot}**`, `- mesmo check-in no Clube (mesma hora:minuto): **${ckIgual}** (${(ckIgual / Math.max(ckTot, 1) * 100).toFixed(1)}%)`, `- check-in no Clube com hora diferente: **${ckHoraDif}**`, `- sem check-in no Clube: **${ckSoCeven}**`, `- check-out igual: **${coIgual} de ${coTot}**`, '', ...(exDif.length ? ['Exemplos de hora diferente:', ...exDif.map((x) => '- ' + x), ''] : []), ...(exFalta.length ? ['Exemplos sem check-in no Clube:', ...exFalta.map((x) => '- ' + x), ''] : []));
// ---------- 2) VISITAS E ROTEIROS por vendedor (so quem o CEVEN leu depois das 15h BRT) ----------
const CV = new Map(C.vendedores.map((v) => [v.filial + '|' + v.rca, v]));
let vTot = 0, vVisIg = 0, vRotIg = 0; const exVis = [];
for (const r of rows) {
  if (!r.prod_em || r.prod_em < `${dia} 18:00`) continue;   // UTC: 15h BRT
  let p = null; try { p = JSON.parse(r.produtividade_json || 'null'); } catch { }
  const d = p && p.dia; const c = CV.get(r.f + '|' + r.r); if (!d || !c) continue;
  vTot++;
  if (Number(d.total_programado) === Number(c.roteiros)) vRotIg++;
  const vc = Number(d.visitas_na_rota) || 0; if (Math.abs(vc - (c.visitas_rota || 0)) <= 1) vVisIg++; else if (exVis.length < 12) exVis.push(`${r.f} ${r.r} ${c.nome}: CEVEN ${vc} de ${d.total_programado} (lido ${r.prod_em} UTC) × Clube ${c.visitas_rota} de ${c.roteiros} (fim do dia)`);
}
L.push('## 2. Roteiros e visitas por vendedor', '', `Vendedores com produtividade do CEVEN lida depois das 15h: **${vTot}**`, `- roteiros iguais: **${vRotIg}**`, `- visitas iguais (±1; o Clube é do fim do dia, o CEVEN da hora da leitura): **${vVisIg}**`, '', ...(exVis.length ? ['Exemplos diferentes:', ...exVis.map((x) => '- ' + x), ''] : []));
// ---------- 3) VENDAS: total do Clube × pedidos gravados (Winthor + historico) ----------
const P = q(`SELECT filial f, rca r, sum(valor) v, count(*) n FROM pedido_status WHERE data_pedido = '${dia}' AND status <> 'CANCELADO' GROUP BY 1, 2`);
const PM = new Map(P.map((x) => [x.f + '|' + x.r, x]));
let pTot = 0, pIg = 0, somaC = 0, somaP = 0; const exP = [];
for (const c of C.vendedores) {
  const p = PM.get(c.filial + '|' + c.rca); const vc = c.total_pedido || 0, vp = p ? Number(p.v) || 0 : 0; if (!vc && !vp) continue;
  pTot++; somaC += vc; somaP += vp;
  if (Math.abs(vc - vp) <= Math.max(5, 0.02 * Math.max(vc, vp))) pIg++; else if (exP.length < 15) exP.push(`${c.filial} ${c.rca} ${c.nome}: Clube ${R$(vc)} (${c.ped_total} ped) × gravados ${R$(vp)} (${p ? p.n : 0} ped)`);
}
L.push('## 3. Vendas do dia por vendedor', '', `Vendedores com venda: **${pTot}** · iguais (±2%): **${pIg}**`, `Total Clube ${R$(somaC)} × pedidos gravados ${R$(somaP)}`, '', ...(exP.length ? ['Exemplos diferentes:', ...exP.map((x) => '- ' + x), ''] : []));
const saida = path.join('auditoria', `CONFERE CLUBE x CEVEN ${dia}.md`); fs.writeFileSync(saida, L.join('\n')); console.log(L.join('\n'));
