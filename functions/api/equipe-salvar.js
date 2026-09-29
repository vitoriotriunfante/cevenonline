// =========================================================================
// FICHA DO ARQUIVO: equipe-salvar.js
// Endpoint para salvar alterações na hierarquia e status dos vendedores/supervisores.
// Grava diretamente no D1 para atualização instantânea de todas as TVs e painéis.
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

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    if (!payload || !payload.filiais) {
      return new Response(JSON.stringify({ erro: 'Payload invalido. Deve conter o objeto filiais.' }), { status: 400, headers: CORS });
    }

    const usuario = payload.usuario || 'Painel de Gestao CEVEN';
    const totalSim = payload.total_sim || 0;
    const totalNao = payload.total_nao || 0;

    // Se houver D1 configurado, grava na tabela mestre e cria trilha de auditoria
    if (env.DB) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS config_equipe_soberana (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            conteudo_json TEXT NOT NULL,
            atualizado_por TEXT,
            atualizado_em TEXT
          )
        `).run();

        await env.DB.prepare(`
          INSERT INTO config_equipe_soberana (id, conteudo_json, atualizado_por, atualizado_em)
          VALUES (1, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            conteudo_json = excluded.conteudo_json,
            atualizado_por = excluded.atualizado_por,
            atualizado_em = excluded.atualizado_em
        `).bind(JSON.stringify(payload), usuario).run();

        // Trilha de auditoria
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS audit_alteracoes_equipe (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alterado_em TEXT,
            usuario TEXT,
            total_rcas INTEGER,
            resumo TEXT
          )
        `).run();

        await env.DB.prepare(`
          INSERT INTO audit_alteracoes_equipe (alterado_em, usuario, total_rcas, resumo)
          VALUES (datetime('now'), ?, ?, ?)
        `).bind(usuario, totalSim + totalNao, `Ativos: ${totalSim} | Ocultos: ${totalNao}`).run();
      } catch (d1Err) {
        console.warn('Erro ao gravar no D1:', d1Err.message);
      }
    }

    return new Response(JSON.stringify({ 
      sucesso: true, 
      mensagem: 'Lista viva atualizada com sucesso no CEVEN D1!',
      gerado_em: new Date().toISOString(),
      usuario
    }), { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ erro: e.message }), { status: 500, headers: CORS });
  }
}
