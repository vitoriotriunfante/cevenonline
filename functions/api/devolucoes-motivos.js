// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: auditoria somente-leitura das devoluções do mês corrente: quantas notas existem (lista oficial
//          do CEVEN guardada pela varredura), quantas já tiveram o motivo oficial consultado e a contagem
//          por motivo. Serve para conferir "tem todas as notas desde 01/10?" sem depender de amostra.
// FONTE: varredura_central_rca.devolucoes_json (lista) + devolucao_nota_motivo (motivo por nota).
// REGRA: nunca inventa; nota sem motivo consultado aparece como "pendente".
// =========================================================================
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export async function onRequestGet({ env }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'banco indisponivel' }), { status: 503, headers: cors });
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const mes = dia.slice(0, 7);
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS devolucao_nota_motivo (rca TEXT NOT NULL, nota TEXT NOT NULL, nao_pediu INTEGER, motivos TEXT, resolvido_em TEXT, PRIMARY KEY (rca, nota))').run();
    const { results } = await env.DB.prepare('SELECT rca_codigo, filial_sigla, devolucoes_json FROM varredura_central_rca WHERE data_ref = ? AND devolucoes_json IS NOT NULL').bind(dia).all();
    const notas = new Map();
    let rcasComLista = 0, valorTotal = 0;
    for (const r of results || []) {
      let lista = null; try { lista = JSON.parse(r.devolucoes_json); } catch { continue; }
      if (!Array.isArray(lista)) continue;
      rcasComLista++;
      for (const n of lista) {
        if (!n.numnota || !String(n.data || '').startsWith(mes)) continue;
        notas.set(r.rca_codigo + '|' + n.numnota, { filial: r.filial_sigla, valor: Number(n.vl_devolvido) || 0 });
      }
    }
    const { results: mot } = await env.DB.prepare('SELECT rca, nota, motivos FROM devolucao_nota_motivo').all();
    const motivoDe = new Map((mot || []).map((x) => [x.rca + '|' + x.nota, x.motivos]));
    const porMotivo = {}, porFilial = {};
    let resolvidas = 0, zeradas = 0;
    for (const [k, n] of notas) {
      valorTotal += n.valor;
      porFilial[n.filial] = (porFilial[n.filial] || 0) + 1;
      if (!(n.valor > 0)) { zeradas++; continue; }
      const m = motivoDe.get(k);
      if (m == null) continue;
      resolvidas++;
      porMotivo[m] = (porMotivo[m] || 0) + 1;
    }
    const comValor = notas.size - zeradas;
    return new Response(JSON.stringify({
      mes, vendedores_com_lista_na_varredura: rcasComLista, notas_no_mes: notas.size, notas_valor_zero_bonificacao: zeradas,
      notas_com_valor: comValor, motivo_consultado: resolvidas, pendentes: comValor - resolvidas,
      valor_total_devolvido: Math.round(valorTotal * 100) / 100, notas_por_filial: porFilial,
      notas_por_motivo: Object.fromEntries(Object.entries(porMotivo).sort((a, b) => b[1] - a[1]))
    }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e).slice(0, 200) }), { status: 500, headers: cors });
  }
}
