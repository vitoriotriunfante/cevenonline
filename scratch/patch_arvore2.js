const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

ed('functions/_lib/arvore_ceven.js', (s) => {
  // tabela com nome e canal
  s = tr(s, "  await env.DB.prepare('CREATE TABLE IF NOT EXISTS arvore_supervisores (filial TEXT NOT NULL, rca TEXT NOT NULL, sup_id TEXT, sup_nome TEXT, atualizado_em TEXT, PRIMARY KEY (filial, rca))').run();\n",
    "  await env.DB.prepare('CREATE TABLE IF NOT EXISTS arvore_supervisores (filial TEXT NOT NULL, rca TEXT NOT NULL, sup_id TEXT, sup_nome TEXT, atualizado_em TEXT, nome TEXT, canal TEXT, PRIMARY KEY (filial, rca))').run();\n  for (const col of ['nome', 'canal']) { try { await env.DB.prepare(`ALTER TABLE arvore_supervisores ADD COLUMN ${col} TEXT`).run(); } catch { /* ja existe */ } }\n", 'tabela');
  s = tr(s, "out.set(String(v.id), { rca: String(v.id), sup_id: String(s.supervisorId == null ? '' : s.supervisorId), sup_nome: limpaSup(s.supervisorNome) });",
    "out.set(String(v.id), { rca: String(v.id), sup_id: String(s.supervisorId == null ? '' : s.supervisorId), sup_nome: limpaSup(s.supervisorNome), nome: String(v.nome || v.nome_rca || v.nomeRca || '').trim() });", 'nome');
  // atualiza: reaproveita canal ja buscado e busca o canal so de quem ainda nao esta na Gestao
  s = tr(s, "  const ok = [], falhas = [];\n  let gravados = 0;\n  for (const { g, rows } of resultados) {\n    if (!rows || !rows.length) { falhas.push(g.sigla); continue; }\n    const stmts = [];\n    for (let i = 0; i < rows.length; i += 18) {\n      const lote = rows.slice(i, i + 18);\n      stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO arvore_supervisores (filial, rca, sup_id, sup_nome, atualizado_em) VALUES ${lote.map(() => '(?,?,?,?,?)').join(',')}`)\n        .bind(...lote.flatMap((r) => [g.sigla, r.rca, r.sup_id, r.sup_nome, agora])));\n    }",
    "  const ok = [], falhas = [];\n  let gravados = 0;\n  // canal (area_atuacao) ja conhecido + quem ja esta na Gestao (so quem NAO esta precisa do canal para entrar nas telas)\n  const canalConhecido = new Map();\n  try { const { results } = await env.DB.prepare('SELECT filial, rca, canal FROM arvore_supervisores WHERE canal IS NOT NULL').all(); for (const r of results || []) canalConhecido.set(`${r.filial}|${r.rca}`, r.canal); } catch { /* sem cache */ }\n  const naGestao = new Set();\n  try { const row = await env.DB.prepare('SELECT conteudo_json FROM config_equipe_soberana WHERE id = 1').first(); const j = row && JSON.parse(row.conteudo_json); for (const k of Object.keys((j && j.filiais) || {})) for (const v of j.filiais[k]) naGestao.add(`${k.split('_')[0].toUpperCase()}|${v.rca}`); } catch { /* sem Gestao */ }\n  const precisaCanal = [];\n  for (const { g, rows } of resultados) for (const r of rows || []) { const k = `${g.sigla}|${r.rca}`; if (canalConhecido.has(k)) r.canal = canalConhecido.get(k); else if (!naGestao.has(k)) precisaCanal.push({ g, r }); }\n  for (let i = 0; i < precisaCanal.length; i += 8) {\n    await Promise.all(precisaCanal.slice(i, i + 8).map(async ({ g, r }) => {\n      try { const x = await fetch(`${CEVEN}/api/filiais/${g.filialKey}/representante/${r.rca}`, { signal: AbortSignal.timeout(10000) }); if (x.ok) { const j = await x.json(); r.canal = String(j.area_atuacao || '').toUpperCase(); } } catch { /* tenta de novo na proxima */ }\n    }));\n  }\n  for (const { g, rows } of resultados) {\n    if (!rows || !rows.length) { falhas.push(g.sigla); continue; }\n    const stmts = [];\n    for (let i = 0; i < rows.length; i += 14) {\n      const lote = rows.slice(i, i + 14);\n      stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO arvore_supervisores (filial, rca, sup_id, sup_nome, atualizado_em, nome, canal) VALUES ${lote.map(() => '(?,?,?,?,?,?,?)').join(',')}`)\n        .bind(...lote.flatMap((r) => [g.sigla, r.rca, r.sup_id, r.sup_nome, agora, r.nome || '', r.canal === undefined ? null : r.canal])));\n    }", 'atualiza');
  // aplica: tambem inclui os vendedores da arvore que a Gestao ainda nao tem
  s = tr(s, "    const { results } = await env.DB.prepare('SELECT filial, rca, sup_nome, atualizado_em FROM arvore_supervisores').all();", "    const { results } = await env.DB.prepare('SELECT filial, rca, sup_nome, atualizado_em, nome, canal FROM arvore_supervisores').all();", 'select');
  s = tr(s, "    corpo.arvore_viva = { atualizado_em: ultima, vendedores_com_supervisor_corrigido: ajustados };\n",
`    // VENDEDORES NOVOS: quem esta na arvore do CEVEN e a Gestao ainda nao conhece entra na lista automaticamente (mostra = SIM). Quem NAO deve aparecer a Diretoria marca "nao mostra" na Gestao.
    // Nao entram: vaga (VAGO), conta do proprio supervisor/gerente, canal GER/SUP.
    const ja = new Set();
    for (const chave of Object.keys(corpo.filiais)) for (const v of corpo.filiais[chave] || []) ja.add(chave.split('_')[0].toUpperCase() + '|' + v.rca);
    let novos = 0;
    for (const r of results) {
      const sig = r.filial, k = sig + '|' + r.rca;
      if (ja.has(k)) continue;
      const nome = limpaSup(r.nome);
      if (!nome || /^VAG[OA]\\b/.test(nome) || /^GERENTE\\b/.test(nome) || nome === r.sup_nome || /^(GER|SUP)$/.test(String(r.canal || '').toUpperCase())) continue;
      // gerente/grupo: o mais comum entre os vendedores da Gestao que tem o mesmo supervisor (senao, o mais comum da filial)
      const todos = [];
      for (const chave of Object.keys(corpo.filiais)) if (chave.split('_')[0].toUpperCase() === sig) for (const v of corpo.filiais[chave] || []) todos.push(v);
      const mais = (lista, campo) => { const c = {}; lista.forEach((v) => { if (v[campo]) c[v[campo]] = (c[v[campo]] || 0) + 1; }); const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : ''; };
      const irmaos = todos.filter((v) => String(v.supervisor || '').toUpperCase().trim() === r.sup_nome);
      const base = irmaos.length ? irmaos : todos;
      const item = { rca: r.rca, nome, canal: String(r.canal || '').toUpperCase(), supervisor: r.sup_nome, gerente: mais(base, 'gerente'), grupo: mais(base, 'grupo'), mostra: true, motivo: '', auto_arvore: true };
      const chaveFilial = Object.keys(corpo.filiais).find((c) => c.split('_')[0].toUpperCase() === sig) || sig;
      (corpo.filiais[chaveFilial] = corpo.filiais[chaveFilial] || []).push(item);
      novos++;
    }
    corpo.arvore_viva = { atualizado_em: ultima, vendedores_com_supervisor_corrigido: ajustados, vendedores_novos_da_arvore: novos };
`, 'novos');
  return s;
});

// Gestao: ocultar um vendedor que veio da arvore (ainda nao esta guardado na Gestao) agora grava o registro oculto
ed('functions/api/equipe-solicitacoes.js', (s) => tr(s,
  "            if (v) {\n              v.mostra = false;\n              v.motivo = item.motivo || 'Oculto aprovado pela Diretoria';\n            }\n",
  "            if (v) {\n              v.mostra = false;\n              v.motivo = item.motivo || 'Oculto aprovado pela Diretoria';\n            } else {\n              // vendedor que veio da arvore viva do CEVEN (ainda nao guardado na Gestao): grava o registro ja oculto\n              let ex = {}; try { ex = JSON.parse(item.dados_extras || '{}'); } catch (e) {}\n              baseData.filiais[fil].unshift({ rca: item.rca_id, nome: item.rca_nome, canal: ex.canal || '', supervisor: ex.supervisor || '', gerente: item.gerente_nome || '', grupo: ex.grupo || '', mostra: false, motivo: item.motivo || 'Oculto aprovado pela Diretoria' });\n            }\n", 'ocultar'));
console.log('tudo ok');
