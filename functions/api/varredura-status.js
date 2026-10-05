// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: diagnóstico de FRESCOR da coleta central (varredura_central_rca), SÓ LEITURA do D1. Responde a pergunta
//          "quantos minutos a TV está atrás do CEVEN?": idade (em segundos) da leitura de cada RCA de hoje.
// POR QUE: pedido do Vitório (05/10/2026) — medir o atraso com número, para decidir como reduzi-lo sem passar do
//          teto de chamadas ao CEVEN. Não chama o CEVEN, não grava nada.
// COMO LER: `mais_antigo_s` = o RCA lido há mais tempo (é o atraso do pior caso); `mediana_s`/`p90_s` = o típico;
//           `duracao_varredura_s` = diferença entre o primeiro e o último RCA gravado numa mesma rodada (quanto tempo
//           a varredura leva para percorrer todos). Quem tem mais de 15 min de idade a TV ignora e lê ao vivo
//           (tv-vendedor.js, lerCentral).
// =========================================================================
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });

function dataHojeBrasilia() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return `${p.year}-${p.month}-${p.day}`;
}
const quantil = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : null);

export async function onRequestGet({ env }) {
  if (!env.DB) return resp({ erro: 'D1 (env.DB) não configurado' }, 503);
  try {
    const dia = dataHojeBrasilia();
    const { results } = await env.DB.prepare('SELECT rca_codigo, updated_at FROM varredura_central_rca WHERE data_ref = ?').bind(dia).all();
    const agora = Date.now();
    const t = (results || []).map((r) => Date.parse(String(r.updated_at).replace(' ', 'T') + 'Z')).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!t.length) return resp({ data_ref: dia, rcas: 0, aviso: 'sem leituras hoje ainda' });
    const idades = t.map((x) => Math.round((agora - x) / 1000)).sort((a, b) => a - b);
    // agrupa em rodadas: um buraco de mais de 90 s entre gravações separa uma rodada da outra
    const rodadas = [];
    let ini = t[0], ult = t[0];
    for (const x of t.slice(1)) { if (x - ult > 90000) { rodadas.push({ inicio: ini, fim: ult }); ini = x; } ult = x; }
    rodadas.push({ inicio: ini, fim: ult });
    return resp({
      data_ref: dia,
      agora: new Date(agora).toISOString(),
      rcas: t.length,
      mais_novo_s: idades[0],
      mediana_s: quantil(idades, 0.5),
      p90_s: quantil(idades, 0.9),
      mais_antigo_s: idades[idades.length - 1],
      acima_de_15min: idades.filter((s) => s > 900).length,
      rodadas_hoje: rodadas.length,
      ultimas_rodadas: rodadas.slice(-6).map((r) => ({ inicio: new Date(r.inicio).toISOString(), fim: new Date(r.fim).toISOString(), duracao_varredura_s: Math.round((r.fim - r.inicio) / 1000) }))
    });
  } catch (e) {
    return resp({ erro: 'falha ao ler a varredura: ' + e.message }, 500);
  }
}
