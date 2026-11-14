// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/motor.js
// Motor declarativo de regras, eventos de dominio, simulacao e ROI.
// Nao chama o CEVEN; le apenas D1 (GEROT, Clube, pedido_status, roteiro_dia).
// =========================================================================
import { hojeSP, N, P, R$, titulo } from '../jota/base.js';
import { criaBase } from '../jota/fontes.js';
import { carregaEscopo } from '../jota/escopo.js';
import { respMatinal } from '../jota/respostas/gestao.js';

export const BONEQUINHO_MIDIA = {
  BOPE_OPERACAO: '/figurinhas/bope/fig_02_operacao_positivacao.png',
  BOPE_TROPA: '/figurinhas/bope/fig_01_tropa_da_positivacao.png',
  BOPE_GUERRA: '/figurinhas/bope/03_bora_pra_guerra_das_metas.jpg',
};

export async function listarRegras(db) {
  const { results } = await db.prepare('SELECT * FROM regras_monitoria ORDER BY onda ASC, id ASC').all().catch(() => ({ results: [] }));
  return results || [];
}

export async function atualizarRegra(db, body) {
  const id = String(body.id || '').trim();
  if (!id) throw new Error('id obrigatorio');
  const campos = [];
  const vals = [];
  if (body.modo && ['OFF', 'SIMULACAO_VITORIO', 'PRODUCAO'].includes(body.modo)) { campos.push('modo = ?'); vals.push(body.modo); }
  if (body.ativo !== undefined) { campos.push('ativo = ?'); vals.push(body.ativo ? 1 : 0); }
  if (body.horario !== undefined) { campos.push('horario = ?'); vals.push(String(body.horario)); }
  if (body.bonequinho !== undefined) { campos.push('bonequinho = ?'); vals.push(String(body.bonequinho)); }
  if (!campos.length) return { ok: false, erro: 'nenhum campo valido' };
  campos.push("atualizado_em = datetime('now','-3 hours')");
  vals.push(id);
  await db.prepare(`UPDATE regras_monitoria SET ${campos.join(', ')} WHERE id = ?`).bind(...vals).run();
  return { ok: true, id };
}

export async function emitirEvento(db, ev) {
  const occurred = ev.occurred_at || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  await db.prepare('INSERT OR IGNORE INTO domain_events (event_type, entity_key, filial, rca, payload_json, source, occurred_at) VALUES (?,?,?,?,?,?,?)')
    .bind(String(ev.event_type), String(ev.entity_key), ev.filial || null, ev.rca || null, ev.payload ? JSON.stringify(ev.payload) : null, ev.source || 'monitoria', occurred).run();
}

export async function simularOnda1(origin, env, opts = {}) {
  const db = env.DB;
  const hoje = hojeSP();
  const regras = await listarRegras(db);
  const ativas = regras.filter((r) => r.onda === 1 && r.ativo === 1 && r.modo !== 'OFF');
  const B = criaBase(origin, env);
  const amostras = [];

  const regPreview = async (regra, destinoReal, papel, filial, rca, texto) => {
    const midia = BONEQUINHO_MIDIA[regra.bonequinho] || null;
    await db.prepare('INSERT INTO monitoria_envios (regra_id, data, celular, destino_real, papel, filial, rca, modo, texto_preview, bonequinho, status, enviado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\',\'-3 hours\')) ON CONFLICT (regra_id, data, celular, modo) DO UPDATE SET texto_preview = excluded.texto_preview, bonequinho = excluded.bonequinho, enviado_em = excluded.enviado_em')
      .bind(regra.id, hoje, opts.celularVitorio || 'SIMULACAO', destinoReal, papel, filial || '', rca || '', regra.modo, String(texto || '').slice(0, 3500), midia || regra.bonequinho, 'SIMULADO').run();
    amostras.push({ regra: regra.id, nome: regra.nome, horario: regra.horario, modo: regra.modo, destino_real: destinoReal, bonequinho: midia || regra.bonequinho, preview: String(texto || '').slice(0, 500) });
  };

  // Amostras reais de Onda 1 (1 por papel para validacao segura em SIMULACAO_VITORIO)
  const rV1 = ativas.find((r) => r.id === 'V1');
  if (rV1) {
    const E = await carregaEscopo(B, { nome: 'Tamara Guedes (TCV)', filiais: ['TCV'], rca: '352' }).catch(() => null);
    if (E) await regPreview(rV1, '352 - Tamara Guedes (TCV)', 'vendedor', 'TCV', '352', await respMatinal(B, E));
  }
  const rS1 = ativas.find((r) => r.id === 'S1');
  if (rS1) {
    const E = await carregaEscopo(B, { nome: 'Equipe Ederson Suonski (TPH)', filiais: ['TPH'], supervisor: 'EDERSON SUONSKI' }).catch(() => null);
    if (E) await regPreview(rS1, 'Ederson Suonski (TPH)', 'supervisor', 'TPH', '', await respMatinal(B, E));
  }
  const rG1 = ativas.find((r) => r.id === 'G1');
  if (rG1) {
    const E = await carregaEscopo(B, { nome: 'TCV', filiais: ['TCV'] }).catch(() => null);
    if (E) await regPreview(rG1, 'Gerência TCV', 'gerente', 'TCV', '', await respMatinal(B, E));
  }
  const rD1 = ativas.find((r) => r.id === 'D1');
  if (rD1) {
    const E = await carregaEscopo(B, { nome: 'Brasil', filiais: ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'], nacional: true }).catch(() => null);
    if (E) await regPreview(rD1, 'Diretoria (Brasil)', 'diretoria', 'BR', '', await respMatinal(B, E));
  }
  const rD2 = ativas.find((r) => r.id === 'D2');
  if (rD2) {
    const { results: stats } = await db.prepare('SELECT status, COUNT(*) q FROM monitoria_envios WHERE data = ? GROUP BY status').bind(hoje).all().catch(() => ({ results: [] }));
    const txt = [`🤖 *Auditoria MONITOR.IA (${hoje})*`, `Regras ativas Onda 1: *${ativas.length}* (modo SIMULACAO_VITORIO)`, ...(stats || []).map((s) => `• ${s.status}: ${N(s.q)}`)].join('\n');
    await regPreview(rD2, 'Diretoria (Auditoria)', 'diretoria', 'BR', '', txt);
  }

  return { ok: true, data: hoje, regras_ativas: ativas.length, amostras };
}

