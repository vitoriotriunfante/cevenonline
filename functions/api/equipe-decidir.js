// =========================================================================
// FICHA DO ARQUIVO: equipe-decidir.js
// O QUE É: decisão de UM vendedor (MOSTRA / NÃO MOSTRA) direto da tela /divergencias (Vitório, 06/10/2026: "ter que sair de uma tela e entrar
//          em outra não faz sentido"). Grava na MESMA base da Gestão de Equipe (config_equipe_soberana), só naquele vendedor; nada mais muda.
//          Vendedor que a Gestão ainda não tinha (veio da árvore do CEVEN) é incluído já com a decisão.
// SEGURANÇA: exige a senha da Diretoria (X-Equipe-Senha), igual ao equipe-salvar.
// =========================================================================
import { exigeSenhaEquipe } from '../_lib/senha_equipe.js';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Equipe-Senha',
  'Cache-Control': 'no-store'
};
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });
const sigDe = (k) => String(k).split('_')[0].toUpperCase();

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestPost({ request, env }) {
  const negado = await exigeSenhaEquipe(request, env, CORS);
  if (negado) return negado;
  if (!env.DB) return resp({ erro: 'D1 não configurado' }, 503);
  try {
    const p = await request.json();
    const filial = String(p.filial || '').toUpperCase().trim();
    const rca = String(p.rca == null ? '' : p.rca).trim();
    if (!filial || !rca || typeof p.mostra !== 'boolean') return resp({ erro: 'Informe filial, rca e mostra (true/false).' }, 400);
    const row = await env.DB.prepare('SELECT conteudo_json FROM config_equipe_soberana WHERE id = 1').first();
    if (!row) return resp({ erro: 'Base da Gestão de Equipe não encontrada.' }, 404);
    const base = JSON.parse(row.conteudo_json);
    base.filiais = base.filiais || {};

    let alvo = null;
    for (const k of Object.keys(base.filiais)) {
      if (sigDe(k) !== filial) continue;
      alvo = (base.filiais[k] || []).find((v) => String(v.rca) === rca) || alvo;
    }
    let incluido = false;
    if (!alvo) {
      // vendedor da árvore do CEVEN que a Gestão ainda não tinha: entra na lista da filial (e do grupo/gerente, se houver chave própria)
      const n = p.novo || {};
      const grupo = String(n.grupo || '').toUpperCase();
      const chaves = Object.keys(base.filiais).filter((k) => sigDe(k) === filial);
      const chave = (grupo && chaves.find((k) => k.toUpperCase().includes(grupo))) || chaves.find((k) => k.toUpperCase() === filial) || chaves[0];
      if (!chave) return resp({ erro: 'Filial ' + filial + ' não existe na Gestão de Equipe.' }, 404);
      alvo = { rca: /^\d+$/.test(rca) ? Number(rca) : rca, nome: String(n.nome || '').slice(0, 120), supervisor: String(n.supervisor || '').slice(0, 120), canal: String(n.canal || '').slice(0, 10), gerente: n.gerente || undefined, grupo: n.grupo || undefined, mostra: p.mostra };
      base.filiais[chave].push(alvo);
      incluido = true;
    }
    const antes = alvo.mostra !== false;
    alvo.mostra = p.mostra;
    alvo.decidido_em = new Date().toISOString();
    alvo.decidido_por = 'Diretoria (tela de divergências)';
    if (p.mostra) delete alvo.auto_arvore;
    const usuario = 'Diretoria (tela de divergências)';
    let sim = 0, nao = 0;
    for (const lista of Object.values(base.filiais)) for (const v of lista) { if (v.mostra === false) nao++; else sim++; }
    base.usuario = usuario; base.total_sim = sim; base.total_nao = nao; base.total_vendedores = sim + nao;

    await env.DB.prepare(`INSERT INTO config_equipe_soberana (id, conteudo_json, atualizado_por, atualizado_em) VALUES (1, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET conteudo_json = excluded.conteudo_json, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em`).bind(JSON.stringify(base), usuario).run();
    try {
      await env.DB.prepare('CREATE TABLE IF NOT EXISTS audit_alteracoes_equipe (id INTEGER PRIMARY KEY AUTOINCREMENT, alterado_em TEXT, usuario TEXT, total_rcas INTEGER, resumo TEXT)').run();
      await env.DB.prepare("INSERT INTO audit_alteracoes_equipe (alterado_em, usuario, total_rcas, resumo) VALUES (datetime('now'), ?, ?, ?)")
        .bind(usuario, sim + nao, `${filial} ${rca} ${alvo.nome || ''}: ${incluido ? 'incluido' : (antes ? 'MOSTRA' : 'NAO MOSTRA') + ' ->'} ${p.mostra ? 'MOSTRA' : 'NAO MOSTRA'}`).run();
    } catch { /* trilha é secundária */ }
    return resp({ sucesso: true, filial, rca, mostra: p.mostra, incluido });
  } catch (e) {
    return resp({ erro: String(e.message || e).slice(0, 300) }, 500);
  }
}
