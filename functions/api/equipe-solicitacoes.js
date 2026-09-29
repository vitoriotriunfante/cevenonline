// =========================================================================
// FICHA DO ARQUIVO: equipe-solicitacoes.js
// Workflow Soberano de Solicitação de Ajustes pelos Gerentes de Filial
// e Aprovação Centralizada pela Diretoria (Vitório Neto).
// Impede alterações descontroladas na base da TV, WhatsApp e Brasileirão.
// =========================================================================

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function garantirTabela(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS solicitacoes_ajuste_equipe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      criado_em TEXT,
      filial TEXT NOT NULL,
      gerente_nome TEXT,
      rca_id TEXT NOT NULL,
      rca_nome TEXT NOT NULL,
      tipo_acao TEXT NOT NULL,
      motivo TEXT,
      dados_extras TEXT,
      status TEXT DEFAULT 'PENDENTE',
      respondido_por TEXT,
      respondido_em TEXT,
      parecer_diretoria TEXT
    )
  `).run();
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return new Response(JSON.stringify({ solicitacoes: [], total_pendentes: 0, modo: 'sem_d1' }), { status: 200, headers: CORS });
  }

  try {
    await garantirTabela(env.DB);
    const url = new URL(request.url);
    const filial = url.searchParams.get('filial');
    const status = url.searchParams.get('status') || 'TODOS';

    let query = "SELECT * FROM solicitacoes_ajuste_equipe WHERE 1=1";
    const params = [];

    if (filial && filial !== 'DIRETORIA' && filial !== 'TODAS') {
      query += " AND filial = ?";
      params.push(filial);
    }

    if (status !== 'TODOS') {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY id DESC LIMIT 200";

    const { results } = await env.DB.prepare(query).bind(...params).all();

    const pendentesRow = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM solicitacoes_ajuste_equipe WHERE status = 'PENDENTE'"
    ).first();

    return new Response(JSON.stringify({
      solicitacoes: results || [],
      total_pendentes: pendentesRow ? pendentesRow.cnt : 0
    }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return new Response(JSON.stringify({ erro: 'Banco D1 não disponível' }), { status: 500, headers: CORS });
  }

  try {
    await garantirTabela(env.DB);
    const body = await request.json();

    // 1. DECISÃO DA DIRETORIA (APROVAÇÃO OU REJEIÇÃO)
    if (body.acao === 'APROVAR' || body.acao === 'REJEITAR') {
      const id = body.solicitacao_id;
      const decisao = body.acao === 'APROVAR' ? 'APROVADO' : 'REJEITADO';
      const usuario = body.usuario || 'Vitório Neto (Diretoria)';
      const parecer = body.parecer || (decisao === 'APROVADO' ? 'Aprovado pela Diretoria' : 'Rejeitado pela Diretoria');

      const item = await env.DB.prepare("SELECT * FROM solicitacoes_ajuste_equipe WHERE id = ?").bind(id).first();
      if (!item) {
        return new Response(JSON.stringify({ erro: 'Solicitação não encontrada' }), { status: 404, headers: CORS });
      }

      await env.DB.prepare(`
        UPDATE solicitacoes_ajuste_equipe
        SET status = ?, respondido_por = ?, respondido_em = datetime('now'), parecer_diretoria = ?
        WHERE id = ?
      `).bind(decisao, usuario, parecer, id).run();

      // SE APROVADO, APLICA IMEDIATAMENTE NA BASE SOBERANA D1
      if (decisao === 'APROVADO') {
        let baseData = null;
        const configRow = await env.DB.prepare("SELECT conteudo_json FROM config_equipe_soberana WHERE id = 1").first();
        if (configRow && configRow.conteudo_json) {
          baseData = JSON.parse(configRow.conteudo_json);
        } else {
          // Busca asset local
          const assetUrl = new URL('/mostra_vendedores.json', request.url);
          const r = await env.ASSETS.fetch(new Request(assetUrl));
          if (r.ok) baseData = await r.json();
        }

        if (baseData && baseData.filiais) {
          const fil = item.filial;
          if (!baseData.filiais[fil]) baseData.filiais[fil] = [];

          if (item.tipo_acao === 'OCULTAR') {
            const v = baseData.filiais[fil].find(x => String(x.rca) === String(item.rca_id));
            if (v) {
              v.mostra = false;
              v.motivo = item.motivo || 'Oculto aprovado pela Diretoria';
            }
          } else if (item.tipo_acao === 'ATIVAR') {
            const v = baseData.filiais[fil].find(x => String(x.rca) === String(item.rca_id));
            if (v) {
              v.mostra = true;
              v.motivo = '';
            }
          } else if (item.tipo_acao === 'NOVO_VENDEDOR') {
            let extras = {};
            try { extras = JSON.parse(item.dados_extras || '{}'); } catch(e){}
            baseData.filiais[fil].unshift({
              rca: item.rca_id,
              nome: item.rca_nome,
              canal: extras.canal || 'VJ',
              supervisor: extras.supervisor || `SUPERVISOR ${fil}`,
              gerente: item.gerente_nome || 'Gerente Filial',
              mostra: true,
              motivo: 'Cadastrado e aprovado pela Diretoria'
            });
          }

          // Recalcula totais
          let sim = 0, nao = 0;
          Object.values(baseData.filiais).forEach(list => {
            list.forEach(v => { if (v.mostra) sim++; else nao++; });
          });
          baseData.total_sim = sim;
          baseData.total_nao = nao;
          baseData.total_vendedores = sim + nao;
          baseData.atualizado_em = new Date().toISOString();

          // Salva no D1
          await env.DB.prepare(`
            INSERT INTO config_equipe_soberana (id, conteudo_json, atualizado_por, atualizado_em)
            VALUES (1, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              conteudo_json = excluded.conteudo_json,
              atualizado_por = excluded.atualizado_por,
              atualizado_em = excluded.atualizado_em
          `).bind(JSON.stringify(baseData), usuario).run();

          // Auditoria
          await env.DB.prepare(`
            INSERT INTO audit_alteracoes_equipe (alterado_em, usuario, total_rcas, resumo)
            VALUES (datetime('now'), ?, ?, ?)
          `).bind(usuario, sim + nao, `Aprovado ajuste ID #${id}: ${item.tipo_acao} RCA ${item.rca_id} (${item.filial})`).run();
        }
      }

      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: `Solicitação #${id} ${decisao.toLowerCase()} com sucesso!`,
        id,
        status: decisao
      }), { status: 200, headers: CORS });
    }

    // 2. ENVIO DE SOLICITAÇÃO POR GERENTE DE FILIAL
    const solicitacoes = Array.isArray(body.solicitacoes) ? body.solicitacoes : [body];
    let inseridos = 0;

    for (const sol of solicitacoes) {
      if (!sol.filial || !sol.rca_id) continue;
      await env.DB.prepare(`
        INSERT INTO solicitacoes_ajuste_equipe (
          criado_em, filial, gerente_nome, rca_id, rca_nome,
          tipo_acao, motivo, dados_extras, status
        ) VALUES (
          datetime('now'), ?, ?, ?, ?,
          ?, ?, ?, 'PENDENTE'
        )
      `).bind(
        sol.filial,
        sol.gerente_nome || 'Gerente',
        String(sol.rca_id),
        sol.rca_nome || `RCA ${sol.rca_id}`,
        sol.tipo_acao || 'OCULTAR',
        sol.motivo || '',
        JSON.stringify(sol.dados_extras || {})
      ).run();
      inseridos++;
    }

    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: `${inseridos} solicitação(ões) enviada(s) com sucesso para a Diretoria!`,
      total: inseridos
    }), { status: 200, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), { status: 500, headers: CORS });
  }
}
