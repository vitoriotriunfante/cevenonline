// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/pedido_status.js
// O QUE É: LINHA DO TEMPO DO STATUS DE CADA PEDIDO (Vitorio, 26/10/2026: "os que estao como bloqueados ou liberados a gente precisa rechecar... isso precisa ficar
//   registrado com os timelines... se nao tem para tras comece a fazer a partir de hoje"). FATURADO = status final; BLOQUEADO/LIBERADO/AGUARDANDO = rechecar.
// GRAVA (D1):
//   pedido_status       1 linha por pedido: ultimo status, valor, corte, quando foi visto pela 1a vez e pela ultima, e se ja e final.
//   pedido_status_hist  1 linha por MUDANCA de status (num, status, visto_em): a linha do tempo. So grava quando muda (custo D1 = linhas gravadas).
// QUEM CHAMA: toda leitura do historico do cliente no CEVEN (tv-vendedor, chamado pelo coletor de lances). O historico traz os ultimos pedidos do cliente,
//   entao cada leitura atualiza tambem os pedidos antigos daquele cliente, sem chamada extra.
// =========================================================================
export const STATUS_FINAL = /FATURAD|CANCELAD|DEVOLVID/i;

export async function garanteTabelasPedido(env) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pedido_status (num TEXT PRIMARY KEY, filial TEXT, rca TEXT, id_cliente TEXT, data_pedido TEXT, status TEXT, valor REAL, valor_winthor REAL, categoria_corte TEXT, itens_cortados INTEGER, final INTEGER DEFAULT 0, primeiro_em TEXT, atualizado_em TEXT, rechecado_em TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pedido_status_hist (num TEXT NOT NULL, status TEXT NOT NULL, visto_em TEXT NOT NULL, PRIMARY KEY (num, visto_em))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_pedido_status_final ON pedido_status (final, rechecado_em)')
  ]);
}

// visitas = historico.ultimas_visitas do CEVEN (cada uma com num_pedido, status_pedido, data_visita, total_clube, itens_cortados...)
export async function gravaStatusPedidos(env, filialKey, rca, idCliente, visitas) {
  if (!env || !env.DB || !Array.isArray(visitas)) return 0;
  const lim = new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10);   // so pedidos dos ultimos 15 dias
  const V = visitas.filter((v) => v && v.num_pedido && v.status_pedido && String(v.data_visita || '').slice(0, 10) >= lim);
  if (!V.length) return 0;
  await garanteTabelasPedido(env);
  const nums = V.map((v) => String(v.num_pedido));
  const { results } = await env.DB.prepare(`SELECT num, status FROM pedido_status WHERE num IN (${nums.map(() => '?').join(',')})`).bind(...nums).all();
  const antes = new Map((results || []).map((r) => [r.num, r.status]));
  const agora = new Date().toISOString(), st = [];
  for (const v of V) {
    const num = String(v.num_pedido), status = String(v.status_pedido).toUpperCase().trim(), ant = antes.get(num);
    const cort = Array.isArray(v.itens_cortados) ? v.itens_cortados.length : 0;
    st.push(env.DB.prepare(`INSERT INTO pedido_status (num, filial, rca, id_cliente, data_pedido, status, valor, valor_winthor, categoria_corte, itens_cortados, final, primeiro_em, atualizado_em, rechecado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (num) DO UPDATE SET status = excluded.status, valor = excluded.valor, valor_winthor = excluded.valor_winthor,
      categoria_corte = excluded.categoria_corte, itens_cortados = excluded.itens_cortados, final = excluded.final, rechecado_em = excluded.rechecado_em,
      atualizado_em = CASE WHEN pedido_status.status = excluded.status THEN pedido_status.atualizado_em ELSE excluded.atualizado_em END`)
      .bind(num, String(filialKey).replace(/1$/, '').toUpperCase(), String(rca), String(idCliente), String(v.data_visita || '').slice(0, 10), status, Number(v.total_clube) || null,
        Number(v.vl_faturado_winthor) || null, v.categoria_corte || null, cort, STATUS_FINAL.test(status) ? 1 : 0, agora, agora, agora));
    if (ant !== status) st.push(env.DB.prepare('INSERT OR IGNORE INTO pedido_status_hist (num, status, visto_em) VALUES (?, ?, ?)').bind(num, status, agora));
  }
  await env.DB.batch(st);
  return st.length;
}
