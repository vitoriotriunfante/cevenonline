// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/bola_cheia.js
// O QUE É: BOLA CHEIA (Vitório, 07/10/2026): às 18h (Brasília) o MELHOR vendedor de cada filial no dia (Varejo) ganha o título "Bola Cheia".
//   - Não vale pontos nem dinheiro: é honra (vídeo na TV da filial e na Matriz, para mandar no grupo).
//   - O vencedor é CONGELADO às 18h e gravado (tabelas bola_cheia / bola_cheia_dia): não muda mais, mesmo que o dia mude depois.
//   - TEM QUE TER VENDIDO: so concorre quem tem ao menos MIN_POSITIVADOS cliente positivado (CEVEN) e digitado > 0.
//   - Critério: mais PONTOS DO DIA na liga (os mesmos lances auditados, ao vivo, de /api/brasileirao-lances); só concorre quem fez
//     ao menos MIN_VISITAS visitas no dia. Desempate: mais clientes positivados, mais digitado, nome. Sem pontos positivos = sem Bola Cheia (nunca inventa).
//   - Só Varejo (canais VJ, FARMA, PET VJ, ESP do CEVEN); ocultos já vêm fora dos lances. AS = por semana (sexta), vem em outra etapa.
// =========================================================================
import { agoraSP } from './liga_fechamento.js';
export const MIN_VISITAS = 5;
export const MIN_POSITIVADOS = 1; // TEM QUE TER VENDIDO (Vitorio, 07/10/2026): pelo menos 1 cliente positivado (numero oficial do CEVEN) e digitado > 0; subir este numero endurece a regra
export const HORA_CONGELA_MIN = 18 * 60;
export const CANAIS_VAREJO = ['VJ', 'FARMA', 'PET VJ', 'ESP'];
const NIVEIS_FORA = ['marker', 'supervisor'];

// Pura (testável): candidatos = [{filial, rca, vendedor, supervisor, pontos, visitas, positivados, digitado, ...}]
export function escolheVencedores(candidatos, minVisitas = MIN_VISITAS) {
  const porFilial = new Map();
  for (const c of candidatos) {
    if (!c || !c.filial || !(Number(c.visitas) >= minVisitas) || !(Number(c.pontos) > 0)) continue;
    if (!(Number(c.positivados) >= MIN_POSITIVADOS) || !(Number(c.digitado) > 0)) continue; // sem venda nao ganha, mesmo cumprindo o processo
    const a = porFilial.get(c.filial);
    let melhor = !a;
    if (a) {
      if (c.pontos !== a.pontos) melhor = c.pontos > a.pontos;
      else if ((c.positivados || 0) !== (a.positivados || 0)) melhor = (c.positivados || 0) > (a.positivados || 0);
      else if ((c.digitado || 0) !== (a.digitado || 0)) melhor = (c.digitado || 0) > (a.digitado || 0);
      else melhor = String(c.vendedor).localeCompare(String(a.vendedor)) < 0;
    }
    if (melhor) porFilial.set(c.filial, c);
  }
  return [...porFilial.values()].sort((a, b) => a.filial.localeCompare(b.filial));
}

export async function garanteTabelasBola(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS bola_cheia_dia (dia TEXT PRIMARY KEY, congelado_em TEXT, hora_sp TEXT, regras_versao TEXT, vencedores INTEGER)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS bola_cheia (dia TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT, vendedor TEXT, supervisor TEXT, pontos REAL, visitas INTEGER, positivados INTEGER, digitado REAL, resumo_json TEXT, PRIMARY KEY (dia, filial))').run();
}

export async function lerBolaCheia(env, dia) {
  try {
    const cab = await env.DB.prepare('SELECT congelado_em, hora_sp, regras_versao, vencedores FROM bola_cheia_dia WHERE dia = ?').bind(dia).first();
    if (!cab) return null;
    const { results } = await env.DB.prepare('SELECT filial, rca, vendedor, supervisor, pontos, visitas, positivados, digitado, resumo_json FROM bola_cheia WHERE dia = ? ORDER BY filial').bind(dia).all();
    return { cab, vencedores: (results || []).map((r) => { let resumo = {}; try { resumo = JSON.parse(r.resumo_json) || {}; } catch (e) { resumo = {}; } const { resumo_json, ...resto } = r; return { ...resto, resumo }; }) };
  } catch (e) { return null; }
}

export async function congelaBolaCheia(env, origin, dia, regrasVersao) {
  await garanteTabelasBola(env);
  const ja = await env.DB.prepare('SELECT congelado_em FROM bola_cheia_dia WHERE dia = ?').bind(dia).first();
  if (ja) return { dia, status: 'JA_CONGELADA', congelado_em: ja.congelado_em };
  const t = agoraSP();
  if (!(dia < t.dia || (dia === t.dia && t.min >= HORA_CONGELA_MIN))) return { dia, status: 'AINDA_NAO', motivo: 'a Bola Cheia congela às 18h' };
  const r = await fetch(`${origin}/api/brasileirao-lances?dia=${dia}&ao_vivo=1`, { signal: AbortSignal.timeout(40000) });
  const j = await r.json().catch(() => null);
  if (!j || !Array.isArray(j.lances)) return { dia, status: 'FALHOU', motivo: 'nao consegui ler os lances do dia' };
  if (!j.lances.length) return { dia, status: 'SEM_LANCES' };
  // canal do CEVEN (so Varejo) e dados reais do dia (roteiro/produtividade da varredura central)
  const { results: cs } = await env.DB.prepare('SELECT filial, rca, canal FROM canal_ceven').all();
  const canal = new Map((cs || []).map((x) => [String(x.filial).toUpperCase().slice(0, 3) + '|' + x.rca, String(x.canal || '').toUpperCase()]));
  const { results: vs } = await env.DB.prepare("SELECT rca_codigo r, filial_sigla f, roteiro_json ro, json_extract(produtividade_json,'$.dia.dig_pedido') dig, json_extract(produtividade_json,'$.dia.positivacao') pos FROM varredura_central_rca WHERE data_ref = ?").bind(dia).all();
  const dadosDia = new Map();
  for (const x of vs || []) {
    let cl = []; try { cl = JSON.parse(x.ro) || []; } catch (e) { cl = []; }
    const feitas = cl.filter((c) => !['AGENDADO', 'ABERTO'].includes(c.status)).length;
    // clientes positivados = o numero OFICIAL do CEVEN (produtividade.dia.positivacao), nao a contagem de status do roteiro (que nao enxerga quem comprou fora da rota): 07/10/2026 o TCG apareceu com 0 positivados tendo 6
    const positivados = x.pos != null ? Number(x.pos) || 0 : null;
    dadosDia.set(String(x.f).toUpperCase() + '|' + x.r, { visitas: feitas, positivados: positivados == null ? 0 : positivados, digitado: Number(x.dig) || 0 });
  }
  const por = new Map();
  for (const l of j.lances) {
    if (NIVEIS_FORA.includes(l.nivel) || !l.rca || /^sup[|]/.test(String(l.chave || '').replace(/^[A-Z]{3}[|]/, ''))) continue;
    const chave = l.filial + '|' + l.rca;
    if (!CANAIS_VAREJO.includes(canal.get(chave) || '')) continue; // sem canal / AS / SUP / GER ficam fora
    const e = por.get(chave) || { filial: l.filial, rca: String(l.rca), vendedor: l.vendedor, supervisor: l.supervisor && l.supervisor !== 'Direto ao gerente' ? l.supervisor : '', pontos: 0, gols: 0, defesas: 0, negativos: 0, lances: 0 };
    e.pontos += Number(l.pontos) || 0; e.lances++;
    if (Number(l.pontos) > 0 && (l.nivel === 'gol' || l.nivel === 'hattrick')) e.gols++;
    else if (l.nivel === 'defesa') e.defesas++;
    else if (Number(l.pontos) < 0) e.negativos++;
    por.set(chave, e);
  }
  const cands = [...por.values()].map((e) => ({ ...e, ...(dadosDia.get(e.filial + '|' + e.rca) || { visitas: 0, positivados: 0, digitado: 0 }) }));
  const venc = escolheVencedores(cands);
  const hora = `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
  const stmts = venc.map((v) => env.DB.prepare('INSERT OR IGNORE INTO bola_cheia (dia, filial, rca, vendedor, supervisor, pontos, visitas, positivados, digitado, resumo_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(dia, v.filial, v.rca, v.vendedor, v.supervisor, v.pontos, v.visitas, v.positivados, v.digitado,
      JSON.stringify({ gols: v.gols, defesas: v.defesas, negativos: v.negativos, lances: v.lances, concorrentes: cands.filter((c) => c.filial === v.filial && c.visitas >= MIN_VISITAS && c.positivados >= MIN_POSITIVADOS && c.digitado > 0).length, min_visitas: MIN_VISITAS })));
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  await env.DB.prepare('INSERT OR IGNORE INTO bola_cheia_dia (dia, congelado_em, hora_sp, regras_versao, vencedores) VALUES (?,?,?,?,?)').bind(dia, new Date().toISOString(), hora, regrasVersao || '', venc.length).run(); // cabecalho POR ULTIMO
  return { dia, status: 'CONGELADA', vencedores: venc.length, hora };
}
