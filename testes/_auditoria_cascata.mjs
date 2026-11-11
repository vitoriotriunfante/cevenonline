// AUDITORIA EM CASCATA (Vitorio, 11/11/2026: 'auditoria geral em perguntas de diretores, gerentes, supervisores e vendedores de cima para baixo e de baixo
// para cima... com no minimo 2 vendedores por filial'). Producao, SO LEITURA. Grava auditoria/CASCATA <data>/ (1 MD por filial + RESUMO.md).
// De baixo para cima: o numero do vendedor (faturado, a faturar, meta, positivacao, digitado hoje) tem que ser IGUAL no escopo do vendedor, do supervisor
//   e da filial; soma dos vendedores do supervisor = linha do supervisor; soma dos supervisores + sem supervisor = filial.
// De cima para baixo: as respostas de cada cargo nao podem ter ERRO / undefined / NaN / 'Sem dado agora', e o valor do vendedor aparece igual nas telas de cima.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const { carregaEscopo } = await import('../functions/_lib/jota/escopo.js');
const MO = await import('../functions/_lib/jota/respostas/momentos.js');
const FILIAIS = process.argv.slice(2).length ? process.argv.slice(2) : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
const dia = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
// RODADA 2+ (Vitorio, 11/11/2026: 'dois vendedores diferentes por filial... diferente dos que fez na ultima'): AUDIT_EXCLUI=<pasta da rodada anterior>
// tira os vendedores ja auditados; AUDIT_PASTA = nome da pasta nova.
const EXCLUI = new Set(); if (process.env.AUDIT_EXCLUI) for (const a of fs.readdirSync(process.env.AUDIT_EXCLUI).filter((x) => /^[A-Z]{3}\.md$/.test(x))) for (const m of fs.readFileSync(path.join(process.env.AUDIT_EXCLUI, a), 'utf8').matchAll(/^## Vendedor (\d+) - /gm)) EXCLUI.add(a.slice(0, 3) + '|' + m[1]);
if (process.env.AUDIT_EXCLUI && !EXCLUI.size) throw new Error('AUDIT_EXCLUI sem nenhum vendedor lido: a rodada 2 repetiria os mesmos');
console.log('vendedores excluidos (rodada anterior):', [...EXCLUI].join(' '));
const dir = path.join('auditoria', process.env.AUDIT_PASTA || `CASCATA ${dia}`); fs.mkdirSync(dir, { recursive: true });
const R = (x) => 'R$ ' + Math.round(x || 0).toLocaleString('pt-BR');
const RUIM = /\bERRO\b|undefined|\bNaN\b|Sem dado agora|\[object Object\]/;
const campos = ['fat', 'pend', 'meta', 'pos', 'metaPos', 'dig'];
const igual = (a, b) => campos.every((k) => Math.abs((Number(a[k]) || 0) - (Number(b[k]) || 0)) < 0.5);
const fala = async (c, q, ult = '') => { const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = ult; try { return String(await _teste.respostaPronta(B, c, q, [])); } catch (e) { return 'ERRO ' + e.message; } };
const resumo = [`# Auditoria em cascata — ${dia}`, '', `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · produção, só leitura · ${FILIAIS.length} filiais · 2 vendedores por filial`, '', '| Filial | Vendedores | Números iguais nas 3 telas | Soma do supervisor | Soma da filial | Respostas com erro |', '|---|---|---|---|---|---|'];
const problemas = [];
for (const fil of FILIAIS) {
  const L = [`# ${fil} — auditoria em cascata (${dia})`, ''];
  const B = _teste.criaBase(ORIGIN, { DB });
  const Ef = await carregaEscopo(B, { nome: fil, filiais: [fil], grupo: null, supervisor: null, nacional: false });
  const reais = (Ef.vend || []).filter((v) => v.ehVendedorReal !== false && v.meta > 0 && !EXCLUI.has(fil + '|' + v.rca));
  // 2 vendedores: o de varejo com mais rota hoje e o de maior meta de outro supervisor (cobre 2 equipes quando possivel)
  const v1 = [...reais].filter((v) => v.varejo).sort((a, b) => (b.visP || 0) - (a.visP || 0))[0] || reais[0];
  const v2 = [...reais].filter((v) => v !== v1 && v.supervisor !== (v1 && v1.supervisor)).sort((a, b) => b.meta - a.meta)[0] || reais.find((v) => v !== v1);
  const alvo = [v1, v2].filter(Boolean);
  let okNum = 0, okSup = 0, nSup = 0, ruins = 0;
  for (const v of alvo) {
    const cV = { nome: v.nome, papel: 'vendedor', filial: fil, rca: String(v.rca) }, cS = { nome: v.supervisor, papel: 'supervisor', filial: fil, supervisor: v.supervisor };
    // vendedor, supervisor e filial lidos AO MESMO TEMPO (11/11: ABC acusou diferenca so porque o dado mudou entre uma leitura e outra)
    const [Ev, Es, EfV] = await Promise.all([carregaEscopo(_teste.criaBase(ORIGIN, { DB }), { nome: v.nome, filiais: [fil], grupo: null, supervisor: null, rca: String(v.rca), nacional: false }), carregaEscopo(_teste.criaBase(ORIGIN, { DB }), { nome: 'Equipe', filiais: [fil], grupo: null, supervisor: v.supervisor, nacional: false }), carregaEscopo(_teste.criaBase(ORIGIN, { DB }), { nome: fil, filiais: [fil], grupo: null, supervisor: null, nacional: false })]);
    const vv = (Ev.vend || [])[0] || {}, vs = (Es.vend || []).find((x) => String(x.rca) === String(v.rca)) || {}, vf = (EfV.vend || []).concat(EfV.ocultos || []).find((x) => String(x.rca) === String(v.rca)) || v;
    const ok = igual(vv, vs) && igual(vv, vf); if (ok) okNum++; else problemas.push(`${fil} ${v.rca}: números diferentes entre as telas (vendedor x supervisor x filial)`);
    L.push(`## Vendedor ${v.rca} - ${v.nome} (sup. ${v.supervisor})`, '', '| Campo | Tela do vendedor | Tela do supervisor | Tela da filial |', '|---|---|---|---|',
      ...campos.map((k) => `| ${k} | ${vv[k] ?? '—'} | ${vs[k] ?? '—'} | ${vf[k] ?? '—'} |${Math.abs((Number(vv[k]) || 0) - (Number(vs[k]) || 0)) >= 0.5 || Math.abs((Number(vv[k]) || 0) - (Number(vf[k]) || 0)) >= 0.5 ? ' ❌' : ''}`), '', ok ? '✅ Números iguais nas três telas.' : '❌ **Números diferentes entre as telas.**', '');
    // soma do supervisor: vendedores do escopo do supervisor (+ ocultos) = linha do supervisor na filial
    nSup++;
    const somaS = (k) => (Es.vend || []).concat(Es.ocultos || []).reduce((a, x) => a + (Number(x[k]) || 0), 0), naFil = (k) => (EfV.vend || []).concat(EfV.ocultos || []).filter((x) => x.supervisor === v.supervisor).reduce((a, x) => a + (Number(x[k]) || 0), 0);
    const okS = ['fat', 'pend', 'meta', 'dig'].every((k) => Math.abs(somaS(k) - naFil(k)) < 1); if (okS) okSup++; else problemas.push(`${fil}: soma da equipe ${v.supervisor} diferente entre a tela do supervisor e a da filial`);
    L.push(`Equipe ${v.supervisor}: faturado ${R(somaS('fat'))} · a faturar ${R(somaS('pend'))} · meta ${R(somaS('meta'))} · hoje ${R(somaS('dig'))} — na filial: ${R(naFil('fat'))} · ${R(naFil('pend'))} · ${R(naFil('meta'))} · ${R(naFil('dig'))} ${okS ? '✅' : '❌'}`, '');
    // respostas de cima para baixo (vendedor -> supervisor) com o mesmo vendedor
    const perg = [[cV, '1', 'vendedor: 1 (como estou)'], [cV, '5', 'vendedor: 5 (sem compra)'], [cV, '8', 'vendedor: 8 (recorrência)'], [cV, '16', 'vendedor: 16 (cortes)'],
      [cS, `como esta o vendedor ${v.rca}`, 'supervisor: como está o vendedor'], [cS, `curva negativa do vendedor ${v.rca}`, 'supervisor: curva do vendedor'], [cS, '5', 'supervisor: 5 (sem compra da equipe)']];
    for (const [c, q, rot] of perg) { const r = await fala(c, q); const ruim = RUIM.test(r); if (ruim) { ruins++; problemas.push(`${fil} ${v.rca}: resposta com erro em "${rot}"`); } L.push(`### ${rot} ${ruim ? '❌' : '✅'}`, '```', r.slice(0, 1500), '```', ''); }
    // o 'como estou' do vendedor e o 'como esta o vendedor' do supervisor mostram o mesmo faturado
    const fv = (await fala(cV, '1')).match(/Faturado: \*(R\$ [\d.]+)\*/), fs2 = (await fala(cS, `como esta o vendedor ${v.rca}`)).match(/Faturado: \*(R\$ [\d.]+)\*/);
    if (fv && fs2 && fv[1] !== fs2[1]) problemas.push(`${fil} ${v.rca}: faturado do vendedor ${fv[1]} x na pergunta do supervisor ${fs2[1]}`);
    L.push(`Faturado na resposta do vendedor: ${fv ? fv[1] : '—'} · na resposta ao supervisor: ${fs2 ? fs2[1] : '—'} ${fv && fs2 && fv[1] === fs2[1] ? '✅' : fv && fs2 ? '❌' : ''}`, '');
  }
  // gerente e diretoria: momento do gerente e 'como esta <filial>' da diretoria
  const cG = { nome: 'GERENTE', papel: 'gerente', filial: fil }, cD = { nome: 'VITORIO', papel: 'diretoria', filial: '' };
  let mg = null; try { const Bg = _teste.criaBase(ORIGIN, { DB }); mg = await MO.respMomentoGerente(Bg, cG, Ef, 'meio'); } catch (e) { mg = { texto: 'ERRO ' + e.message }; }
  const rd = await fala(cD, `como esta ${fil}`), ri = await fala(cD, `industrias da ${fil}`);
  for (const [rot, r] of [['gerente: momento do meio do dia', mg && mg.texto], ['diretoria: como está a filial', rd], ['diretoria: indústrias da filial', ri]]) { const ruim = !r || RUIM.test(r); if (ruim) { ruins++; problemas.push(`${fil}: resposta com erro em "${rot}"`); } L.push(`## ${rot} ${ruim ? '❌' : '✅'}`, '```', String(r || 'SEM RESPOSTA').slice(0, 1800), '```', ''); }
  // soma da filial: vendedores + ocultos (mesma regra do item 2) = o que o gerente ve
  const somaF = (Ef.vend || []).concat(Ef.ocultos || []).reduce((a, x) => a + (x.meta || 0), 0), mMeta = mg && mg.texto && (mg.texto.match(/de (R\$ [\d.]+)\n/) || [])[1];
  const okF = mMeta ? mMeta === R(somaF) : null; if (okF === false) problemas.push(`${fil}: meta da filial ${R(somaF)} x momento do gerente ${mMeta}`);
  L.unshift(`Meta da filial (soma dos vendedores + ocultos): ${R(somaF)} · no momento do gerente: ${mMeta || '—'} ${okF ? '✅' : okF === false ? '❌' : ''}`, '');
  fs.writeFileSync(path.join(dir, `${fil}.md`), L.join('\n'));
  resumo.push(`| ${fil} | ${alvo.map((v) => v.rca).join(', ')} | ${okNum} de ${alvo.length} | ${okSup} de ${nSup} | ${okF ? '✅' : okF === false ? '❌' : '—'} | ${ruins} |`);
  console.log(`${fil}: vendedores ${alvo.map((v) => v.rca).join(',')} · numeros ${okNum}/${alvo.length} · supervisor ${okSup}/${nSup} · filial ${okF} · respostas com erro ${ruins}`);
}
resumo.push('', problemas.length ? '## Problemas encontrados' : '## Nenhum problema encontrado', '', ...problemas.map((p) => '- ' + p));
fs.writeFileSync(path.join(dir, 'RESUMO.md'), resumo.join('\n'));
console.log('\n' + (problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'NENHUM PROBLEMA'));
limpa();
