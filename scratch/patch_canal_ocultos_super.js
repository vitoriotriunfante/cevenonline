const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ================= 1) CANAL VEM DO CEVEN (area_atuacao), nao da Gestao =================
ed('functions/_lib/arvore_ceven.js', (s) => {
  // 1a) atualiza o canal de todos os vendedores da arvore (em lotes, cache de 24h)
  s = tr(s, "// Baixa as 11 filiais e grava no D1.", `// CANAL DE CADA VENDEDOR = o do CEVEN (area_atuacao). Vitório, 07/10/2026: "tem cara de AS como o proprio CEVEN do Luciano e o cara tá como varejo": o canal da Gestão estava errado em
// dezenas de vendedores (33 de 54 conferidos). Guarda em canal_ceven (cache de 24 h, até 150 vendedores por chamada) e aplicaArvore passa a usar esse canal.
export async function atualizaCanais(env, limite = 150) {
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS canal_ceven (filial TEXT NOT NULL, rca TEXT NOT NULL, canal TEXT, em INTEGER, PRIMARY KEY (filial, rca))').run();
    const { results } = await env.DB.prepare("SELECT a.filial AS filial, a.rca AS rca FROM arvore_supervisores a LEFT JOIN canal_ceven c ON c.filial = a.filial AND c.rca = a.rca WHERE c.em IS NULL OR c.em < ? ORDER BY COALESCE(c.em, 0) LIMIT ?").bind(Date.now() - 24 * 3600e3, limite).all();
    const lista = results || [];
    for (let i = 0; i < lista.length; i += 10) {
      await Promise.all(lista.slice(i, i + 10).map(async (v) => {
        try {
          const x = await fetch(\`\${CEVEN}/api/filiais/\${String(v.filial).toLowerCase()}1/representante/\${v.rca}\`, { signal: AbortSignal.timeout(6000) });
          if (!x.ok) return;
          let canal = ''; try { const j = await x.json(); canal = String(j.area_atuacao || '').toUpperCase(); } catch { /* corpo vazio: o CEVEN nao tem canal desse codigo */ }
          await env.DB.prepare('INSERT OR REPLACE INTO canal_ceven (filial, rca, canal, em) VALUES (?, ?, ?, ?)').bind(v.filial, String(v.rca), canal, Date.now()).run();
        } catch { /* tenta de novo na proxima rodada */ }
      }));
    }
    return lista.length;
  } catch { return 0; }
}

// Baixa as 11 filiais e grava no D1.`, 'fn');
  s = tr(s, "  return { status: falhas.length ? 'PARCIAL' : 'ATUALIZADA', filiais_ok: ok, filiais_falharam: falhas, vendedores: gravados, atualizado_em: agora };", "  const canaisAtualizados = await atualizaCanais(env, 150);\n  return { status: falhas.length ? 'PARCIAL' : 'ATUALIZADA', filiais_ok: ok, filiais_falharam: falhas, vendedores: gravados, canais_atualizados: canaisAtualizados, atualizado_em: agora };", 'ret');
  // 1b) aplicaArvore usa o canal do CEVEN
  s = tr(s, "export async function aplicaArvore(env, corpo) {\n  if (!env.DB || !corpo || !corpo.filiais) return corpo;\n  try {\n", `export async function aplicaArvore(env, corpo) {
  if (!env.DB || !corpo || !corpo.filiais) return corpo;
  // canal do CEVEN por cima do canal da Gestao (a Gestao so manda em mostra/nao mostra, gerente e grupo; o canal real e o do CEVEN)
  try {
    const { results: cc } = await env.DB.prepare("SELECT filial, rca, canal FROM canal_ceven WHERE canal IS NOT NULL AND canal != ''").all();
    if (cc && cc.length) {
      const mc = new Map(cc.map((x) => [x.filial + '|' + x.rca, String(x.canal).toUpperCase()]));
      let trocados = 0;
      for (const chave of Object.keys(corpo.filiais)) {
        const sig = chave.split('_')[0].toUpperCase();
        for (const v of corpo.filiais[chave] || []) {
          const c = v && mc.get(sig + '|' + v.rca);
          if (c && c !== String(v.canal || '').toUpperCase()) { v.canal_gestao = v.canal || ''; v.canal = c; trocados++; }
        }
      }
      corpo.canais_do_ceven = { vendedores_com_canal_corrigido: trocados };
    }
  } catch { /* tabela ainda nao existe: segue com o canal da Gestao */ }
  try {
`, 'aplica');
  return s;
});

// ================= 2) OCULTOS FORA DOS LANCES =================
fs.writeFileSync('functions/_lib/equipe_ocultos.js', `// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/equipe_ocultos.js
// O QUE É: conjunto de vendedores que a Gestão de Equipe OCULTA (mostra = NÃO), no formato "FILIAL|RCA". Vitório, 07/10/2026: um vendedor em Afastamento/Férias (oculto) aparecia na lista
//          de cartões amarelos da Matriz. Quem está oculto NÃO gera lance nem aparece em lista de lances. Cache de 60 s (a Gestão muda pouco).
// =========================================================================
let cache = { ate: 0, set: new Set() };
export async function ocultosDaEquipe(origin) {
  if (Date.now() < cache.ate) return cache.set;
  try {
    const r = await fetch(origin + '/api/tv-mostra', { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const set = new Set();
    for (const [k, lista] of Object.entries((j && j.filiais) || {})) for (const v of Array.isArray(lista) ? lista : []) if (v && v.rca != null && v.mostra === false) set.add(k.split('_')[0].toUpperCase() + '|' + v.rca);
    cache = { ate: Date.now() + 60000, set };
    return set;
  } catch { return cache.set; /* sem resposta: usa o ultimo conhecido (nunca tira lance por engano) */ }
}
// filial real do lance: a do proprio lance, ou o prefixo "TBL|" da chave quando a Matriz (MTZ) gravou
export function filialDoLance(l) {
  const m = /^([A-Z]{3})[|]/.exec(String(l.chave || ''));
  return l.filial && l.filial !== 'MTZ' ? String(l.filial).toUpperCase() : (m ? m[1] : String(l.filial || '').toUpperCase());
}
export const lanceDeOculto = (l, set) => l && l.rca != null && set.has(filialDoLance(l) + '|' + l.rca);
`);
console.log('ok equipe_ocultos');

ed('functions/api/brasileirao-lances.js', (s) => {
  s = tr(s, "import { lerDiaFechado } from '../_lib/liga_fechamento.js';", "import { lerDiaFechado } from '../_lib/liga_fechamento.js';\nimport { ocultosDaEquipe, lanceDeOculto } from '../_lib/equipe_ocultos.js';", 'imp');
  s = tr(s, "    if (f) { const porNivel = {}; for (const l of f.lances) porNivel[l.nivel] = (porNivel[l.nivel] || 0) + 1; return resp({ dia, filial: filial || 'TODAS', total: f.lances.length, duplicados_removidos: 0, porNivel, lances: f.lances,", "    if (f) { const oc = await ocultosDaEquipe(u.origin); const fl = f.lances.filter((l) => !lanceDeOculto(l, oc)); const porNivel = {}; for (const l of fl) porNivel[l.nivel] = (porNivel[l.nivel] || 0) + 1; return resp({ dia, filial: filial || 'TODAS', total: fl.length, ocultos_fora: f.lances.length - fl.length, duplicados_removidos: 0, porNivel, lances: fl,", 'frozen');
  s = tr(s, "    const lancesBrutos = (results || []).filter(l => {\n      const ch = String(l.chave || '');\n", "    const ocultos = await ocultosDaEquipe(u.origin);\n    const lancesBrutos = (results || []).filter(l => {\n      const ch = String(l.chave || '');\n      if (lanceDeOculto(l, ocultos)) return false; // vendedor oculto na Gestao de Equipe (afastado, ferias, conta de teste) nao gera lance\n", 'live');
  return s;
});
