const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

ed('functions/api/divergencias.js', (s) => {
  // 1) a decisao do Vitorio: NAO MOSTRA na Gestao (continua assim?) e CEVEN que a Gestao nunca viu
  s = tr(s, "    const arvore = { disponivel: false, atualizado_em: null, novos: [], supervisor_mudou: [], so_gestao: [] };",
    "    const arvore = { disponivel: false, atualizado_em: null, novos: [], supervisor_mudou: [], so_gestao: [] };\n" +
    "    const decisao = { nao_mostra: [], fora_da_gestao: [] };\n" +
    "    const comNumeros = (it, codigo) => { const m = movDe.get(String(codigo)) || {}; return { ...it, rota_hoje: Number(m.rota) || 0, visitas_hoje: Number(m.vis) || 0, pedidos_hoje: Number(m.ped) || 0, digitado_hoje: arred(m.dig), meta_fat: arred(m.meta_fat), fat_mes: arred(m.fat_mes), meta_pos: Number(m.meta_pos) || 0, pos_mes: Number(m.pos_mes) || 0, notas_devolucao_mes: Number(m.notas) || 0, devolucao_mes: arred(m.dev) }; };", 'decl');
  s = tr(s, "        for (const k of Object.keys(base.filiais || {})) {\n          const sig = k.split('_')[0].toUpperCase();\n          for (const v of base.filiais[k] || []) if (!naArv.has(",
    "        for (const k of Object.keys(base.filiais || {})) {\n          const sig = k.split('_')[0].toUpperCase();\n          for (const v of base.filiais[k] || []) if (v.mostra === false) decisao.nao_mostra.push(Object.assign(comNumeros({ filial: sig, codigo: String(v.rca), nome: v.nome, supervisor: v.supervisor || '', canal: v.canal || '', motivo: v.motivo || '', no_ceven: naArv.has(sig + '|' + v.rca) }, v.rca), {}));\n        }\n        for (const x of decisao.nao_mostra) x.leitura = leitura(x);\n        for (const x of arvore.novos) decisao.fora_da_gestao.push(comNumeros({ ...x }, x.codigo));\n        for (const x of decisao.fora_da_gestao) x.leitura = leitura(x);\n        const ord = (a, b) => (b.fat_mes + b.digitado_hoje) - (a.fat_mes + a.digitado_hoje) || (b.meta_fat - a.meta_fat);\n        decisao.nao_mostra.sort(ord); decisao.fora_da_gestao.sort(ord);\n        for (const k of Object.keys(base.filiais || {})) {\n          const sig = k.split('_')[0].toUpperCase();\n          for (const v of base.filiais[k] || []) if (!naArv.has(", 'loop');
  s = tr(s, "gerado_em: new Date().toISOString(), dia, planilha_lida: planilhaOk, arvore,", "gerado_em: new Date().toISOString(), dia, planilha_lida: planilhaOk, arvore, decisao,", 'ret');
  return s;
});

ed('public/divergencias.html', (s) => {
  s = tr(s, "  $('corpo').innerHTML = aviso +\n", "  const dc = d.decisao || {nao_mostra: [], fora_da_gestao: []};\n" +
"  const tg = (l) => { const t = l.leitura || {}; const cls = t.tipo === 'produzindo' ? 'mov' : (t.tipo === 'sem_atividade' ? 'ok' : 'nova'); return `<span class=\"tag ${cls}\">${esc(t.texto || '')}</span>`; };\n" +
"  const colsDec = [\n" +
"    {t: 'Filial', f: l => '<b>' + esc(l.filial) + '</b>'}, {t: 'Vendedor', f: l => esc(l.nome) + ' <span style=\"color:var(--mut)\">(' + esc(l.codigo) + ')</span>'}, {t: 'Supervisor', f: l => esc(l.supervisor || '—')}, {t: 'Canal', f: l => esc(l.canal || '—')},\n" +
"    {t: 'Meta do mês', n: 1, f: l => l.meta_fat ? brl(l.meta_fat) : '<span style=\"color:var(--mut)\">sem meta</span>'}, {t: 'Faturado no mês', n: 1, f: l => brl(l.fat_mes) + pct(l.fat_mes, l.meta_fat)},\n" +
"    {t: 'Rota hoje', n: 1, f: l => nv(l.rota_hoje)}, {t: 'Pedidos hoje', n: 1, f: l => nv(l.pedidos_hoje)}, {t: 'O que os números dizem', f: tg}\n" +
"  ];\n" +
"  const D1 = tabela([...colsDec, {t: 'Motivo na Gestão', f: l => esc(l.motivo || '—')}, {t: 'No CEVEN hoje?', f: l => l.no_ceven ? 'sim' : '<b style=\"color:var(--aviso)\">não</b>'}], dc.nao_mostra, 'Ninguém está como NÃO MOSTRA na Gestão de Equipe.');\n" +
"  const D2 = tabela([...colsDec, {t: 'Hoje nas telas', f: l => '<span class=\"tag ok\">MOSTRA</span>'}], dc.fora_da_gestao, 'Nenhum: todo vendedor do CEVEN já está na Gestão de Equipe.');\n" +
"  const dMeta = (L) => L.filter(x => x.meta_fat > 0).length, dVende = (L) => L.filter(x => x.fat_mes > 0 || x.pedidos_hoje > 0).length;\n" +
"  const decisaoHtml =\n" +
"    secao('A. Estão como NÃO MOSTRA na Gestão de Equipe — continua assim?', `${dc.nao_mostra.length} vendedores · ${dMeta(dc.nao_mostra)} com meta · ${dVende(dc.nao_mostra)} vendendo. Os que têm meta ou venda aparecem primeiro: são os que merecem sua atenção. Para mudar, use a Gestão de Equipe (MOSTRA = SIM).`, D1) +\n" +
"    secao('B. Estão no CEVEN agora e a Gestão de Equipe nunca viu — decida', `${dc.fora_da_gestao.length} vendedores · ${dMeta(dc.fora_da_gestao)} com meta · ${dVende(dc.fora_da_gestao)} vendendo. Enquanto você não decide, eles APARECEM nas telas (MOSTRA). Para tirar algum, marque NÃO MOSTRA na Gestão de Equipe.`, D2);\n" +
"  const tecnico = '<details style=\"margin-top:10px\"><summary style=\"cursor:pointer;color:var(--mut);padding:8px 0\">Outras conferências (técnicas): supervisor trocado, só na Gestão, banco, descobertos</summary>';\n" +
"  $('corpo').innerHTML = aviso + decisaoHtml + tecnico +\n", 'corpo');
  s = tr(s, "  const v = d.varredura_descoberta || {};", "  $('corpo').innerHTML += '</details>';\n  const v = d.varredura_descoberta || {};", 'fim');
  // chips enxutos: os 3 numeros da decisao
  s = tr(s, "  $('chips').innerHTML = [\n", "  $('chips').innerHTML = [\n    ['NÃO MOSTRA na Gestão', ((d.decisao || {}).nao_mostra || []).length, 'confirme se continua assim'],\n    ['CEVEN que a Gestão nunca viu', ((d.decisao || {}).fora_da_gestao || []).length, 'decida mostra / não mostra'],\n", 'chips');
  return s;
});
console.log('tudo ok');
