// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: varredura de DESCOBERTA de códigos. Procura, em cada filial, códigos de vendedor/conta que têm devolução (ou movimento) no CEVEN
//          e que NÃO estão na nossa lista (banco `representantes` + planilha MOSTRA). Grava em `codigos_descobertos` (tabela PRÓPRIA, criada aqui).
// POR QUE EXISTE (05/10/2026): o painel de devolução do Vitório trazia R$ 61 mil em TPH e a soma dos vendedores conhecidos dava R$ 29 mil. A diferença
//          era de contas internas ("VENDA EMPRESA (INTERNO)", código 2 de TPH = R$ 19,5 mil) e de códigos de ex-vendedores que nenhuma lista tem.
//          Regra do Vitório: "lista viva: sempre que tiver divergência eu preciso saber para olhar e ver se é válida".
// COMO: cursor persistente percorre (filial x código 1..CODIGO_MAX) em fatias; pula o que já conhecemos; chama /api/rca/devolucoes (e, se achar nota,
//       /api/rca/produtividade). 4 chamadas simultâneas no máximo. Roda de madrugada pelo workflow descoberta-codigos.yml (loop até fechar o ciclo).
// REGRA: nunca inventa; só registra o que o CEVEN devolveu. Somente leitura do CEVEN; só escreve nas tabelas próprias (codigos_descobertos, descoberta_cursor).
// =========================================================================

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const FILIAIS = ['TBL', 'TPH', 'TCV', 'ABC', 'API', 'TSJ', 'TBE', 'TPA', 'MCD', 'TCA', 'TCG'];
const CODIGO_MAX = 1400;
const FATIA = 240;            // pares (filial, código) por chamada
const CONC = 4;               // abaixo do teto de 6 da varredura central
const BUDGET_MS = 110000;
const SLOT_S = 150;

const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });

async function getJson(url, ms = 20000) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return JSON.parse(await r.text());
  } catch { return null; }
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) return resp({ erro: 'D1 não configurado' }, 503);
  const t0 = Date.now();
  const origin = new URL(request.url).origin;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS descoberta_cursor (id INTEGER PRIMARY KEY CHECK (id = 1), pos INTEGER NOT NULL DEFAULT 0, ciclo INTEGER NOT NULL DEFAULT 0, ciclo_inicio TEXT, ciclo_fim TEXT, dono TEXT, criado_em TEXT)').run();
  await env.DB.prepare('INSERT OR IGNORE INTO descoberta_cursor (id, pos, ciclo, ciclo_inicio) VALUES (1, 0, 0, CURRENT_TIMESTAMP)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS codigos_descobertos (filial TEXT NOT NULL, codigo TEXT NOT NULL, notas_mes INTEGER NOT NULL DEFAULT 0, devolucao_mes REAL NOT NULL DEFAULT 0, rota_hoje INTEGER NOT NULL DEFAULT 0, pedidos_hoje INTEGER NOT NULL DEFAULT 0, dig_hoje REAL NOT NULL DEFAULT 0, primeira_vez TEXT, atualizado_em TEXT, PRIMARY KEY (filial, codigo))').run();
  // colunas novas (05/10/2026): nome e metas do codigo, para a lista viva mostrar quem e. O ALTER falha (e e ignorado) se a coluna ja existe.
  for (const col of ['nome TEXT', 'meta_fat REAL', 'fat_mes REAL', 'meta_pos INTEGER']) { try { await env.DB.prepare('ALTER TABLE codigos_descobertos ADD COLUMN ' + col).run(); } catch { /* ja existe */ } }

  const tomou = await env.DB.prepare("UPDATE descoberta_cursor SET dono = ?, criado_em = CURRENT_TIMESTAMP WHERE id = 1 AND (dono IS NULL OR criado_em IS NULL OR criado_em < datetime('now', ?))").bind('d:' + t0, `-${SLOT_S} seconds`).run();
  if (!((tomou.meta && tomou.meta.changes) || tomou.changes)) return resp({ status: 'OCUPADO' });

  try {
    // o que já conhecemos: (filial, código) do banco + da planilha
    const conhecidos = new Set();
    const { results: reps } = await env.DB.prepare('SELECT r.codigo, UPPER(COALESCE(f.codigo, r.filial_id)) AS filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id').all();
    for (const r of reps || []) conhecidos.add(r.filial + '|' + r.codigo);
    try {
      const mp = await (await fetch(`${origin}/api/tv-mostra`, { signal: AbortSignal.timeout(8000) })).json();
      for (const [sg, lista] of Object.entries((mp && mp.filiais) || {})) for (const x of Array.isArray(lista) ? lista : []) if (x && x.rca != null) conhecidos.add(String(sg).toUpperCase() + '|' + x.rca);
    } catch { /* sem planilha: só o banco */ }

    const pares = [];
    for (const f of FILIAIS) for (let id = 1; id <= CODIGO_MAX; id++) if (!conhecidos.has(f + '|' + id)) pares.push([f, id]);

    const cur = await env.DB.prepare('SELECT pos, ciclo FROM descoberta_cursor WHERE id = 1').first();
    let pos = Math.min(cur.pos || 0, pares.length);
    const fatia = pares.slice(pos, pos + FATIA);
    const mes = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
    let achados = 0, k = 0;
    const gravar = [];
    async function w() {
      while (k < fatia.length && Date.now() - t0 < BUDGET_MS) {
        const [f, id] = fatia[k++];
        const base = `${CEVEN}/api/rca/%EP%?filial=${f.toLowerCase()}1&id=${id}`;
        const dv = await getJson(base.replace('%EP%', 'devolucoes'));
        const notas = Array.isArray(dv) ? dv.filter((n) => String(n.data || '').startsWith(mes)) : [];
        let rota = 0, ped = 0, dig = 0, nome = null, metaFat = 0, fatMes = 0, metaPos = 0;
        if (notas.length) {
          const p = await getJson(base.replace('%EP%', 'produtividade'));
          const d = (p && p.dia) || {};
          rota = Number(d.total_programado) || 0; ped = Number(d.positivacao) || 0; dig = Number(d.dig_pedido) || 0;
          const dash = await getJson(base.replace('%EP%', 'dashboard'));
          if (dash) { nome = dash.nome ? String(dash.nome).slice(0, 80) : null; metaFat = Number(dash.financeiro && dash.financeiro.meta) || 0; fatMes = Number(dash.financeiro && dash.financeiro.faturado) || 0; metaPos = Number(dash.positivacao && dash.positivacao.meta) || 0; }
        }
        if (!notas.length) continue;
        achados++;
        const val = notas.reduce((s, n) => s + (Number(n.vl_devolvido) || 0), 0);
        gravar.push(env.DB.prepare(
          `INSERT INTO codigos_descobertos (filial, codigo, notas_mes, devolucao_mes, rota_hoje, pedidos_hoje, dig_hoje, nome, meta_fat, fat_mes, meta_pos, primeira_vez, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (filial, codigo) DO UPDATE SET notas_mes = excluded.notas_mes, devolucao_mes = excluded.devolucao_mes, rota_hoje = excluded.rota_hoje,
             pedidos_hoje = excluded.pedidos_hoje, dig_hoje = excluded.dig_hoje, nome = excluded.nome, meta_fat = excluded.meta_fat, fat_mes = excluded.fat_mes, meta_pos = excluded.meta_pos, atualizado_em = CURRENT_TIMESTAMP`
        ).bind(f, String(id), notas.length, val, rota, ped, dig, nome, metaFat, fatMes, metaPos));
      }
    }
    await Promise.all(Array.from({ length: CONC }, w));
    for (let i = 0; i < gravar.length; i += 40) await env.DB.batch(gravar.slice(i, i + 40));

    const novaPos = pos + Math.min(k, fatia.length);
    const fechou = novaPos >= pares.length;
    if (fechou) await env.DB.prepare("UPDATE descoberta_cursor SET pos = 0, ciclo = ciclo + 1, ciclo_fim = CURRENT_TIMESTAMP WHERE id = 1").run();
    else await env.DB.prepare('UPDATE descoberta_cursor SET pos = ? WHERE id = 1').bind(novaPos).run();
    return resp({ status: 'ATUALIZADO', pos: fechou ? 0 : novaPos, total_pares: pares.length, verificados: k, achados, ciclo_concluido: fechou, duracao_ms: Date.now() - t0 });
  } finally {
    await env.DB.prepare('UPDATE descoberta_cursor SET dono = NULL WHERE id = 1').run().catch(() => {});
  }
}
