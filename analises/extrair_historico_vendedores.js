/**
 * FICHA DO ARQUIVO
 * O QUE É: HISTÓRICO DO VENDEDOR, EXPANDIDO (últimos meses), CEVEN por CEVEN, vendedor por vendedor, gravado no banco
 *          analises/pedidos_historico_ceven.db (mesmas tabelas e mesma chave do extrator por cliente: FILIAL1_cliente_pedido).
 * POR QUE (Vitório, 19/10/2026: "entre em CEVEN por CEVEN... vendedor por vendedor... cliente por cliente... tudo precisa estar gravado"):
 *          o histórico por cliente devolve só os 3 últimos pedidos; o do vendedor com expandido=true devolve TODOS os pedidos dos últimos
 *          meses (o mesmo do botão "Ver mais (últimos 6 meses)" do app), com os SKUs. Um RCA = uma chamada (~600 no grupo, ~7 min).
 *          Também recupera o buraco de 08/10 a 18/10 (o Data Lake gravou zero porque ia sem o header X-App-Secret).
 * LÊ: analises/hierarquia_completa_ceven.json (árvore viva, gerada no 1º passo do orquestrador) + /api/rca/historico-vendedor?expandido=true.
 * LIMITE DO CEVEN: 100 chamadas/minuto por IP (X-RateLimit-Limit). Este script faz no máximo 80/min e respeita o 429 (espera o reset).
 * TRAVA: falha em mais de 5% dos vendedores ou ZERO pedidos = sai com erro (o workflow fica vermelho). Nunca mais falha em silêncio.
 * Uso: node analises/extrair_historico_vendedores.js   (o header X-App-Secret vem de pipeline/ceven_header.js)
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HIER = JSON.parse(fs.readFileSync(path.join(__dirname, 'hierarquia_completa_ceven.json'), 'utf8'));
const db = new Database(path.join(__dirname, 'pedidos_historico_ceven.db'));
const POR_MINUTO = 80;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function buscar(url) {
  for (let t = 1; t <= 4; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
      if (r.status === 429) { await espera(((Number(r.headers.get('x-ratelimit-reset')) || 30) + 2) * 1000); continue; }
      if (!r.ok) return { erro: 'HTTP ' + r.status };
      return { dados: await r.json() };
    } catch (e) { await espera(3000 * t); }
  }
  return { erro: 'sem resposta' };
}
const iso = (s) => {
  s = String(s || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
const br = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');

async function main() {
  const insPed = db.prepare(`INSERT OR REPLACE INTO pedidos_historico (chave, num_pedido, filial_codigo, filial_sigla, id_cliente, cnpj_cliente, nome_cliente,
    rca_id, rca_nome, supervisor_nome, gerente_nome, data_pedido, data_pedido_br, status_pedido, categoria_corte, vl_faturado, vl_cortado, total_clube, qtd_skus, qtd_cortados)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insItem = db.prepare(`INSERT INTO pedidos_historico_itens (chave_pedido, num_pedido, filial_codigo, id_cliente, tipo_registro, codprod, descricao, quantidade, valor_total) VALUES (?,?,?,?,?,?,?,?,?)`);
  const delItens = db.prepare('DELETE FROM pedidos_historico_itens WHERE chave_pedido = ?');
  const cnpjDe = db.prepare('SELECT cnpj FROM clientes_completo WHERE id_cliente = ? AND filial_codigo = ?');

  const rcas = [];
  for (const f of HIER) for (const s of f.supervisores || []) for (const r of s.rcas || []) if (r.rcaId) rcas.push({ sigla: String(f.filial).toUpperCase().slice(0, 3), key: f.codigoFilial, fcod: String(f.codigoFilial).toUpperCase(), ger: f.gerentes || '', sup: s.supervisorNome || '', id: r.rcaId, nome: r.rcaNome || '' });
  console.log(`📦 HISTÓRICO DO VENDEDOR (expandido): ${rcas.length} RCAs em ${HIER.length} filiais`);

  let pedidos = 0, itens = 0, falhas = [], semPedido = 0, menor = null, maior = null;
  const t0 = Date.now();
  for (let i = 0; i < rcas.length; i++) {
    const r = rcas[i];
    const alvo = t0 + (i * 60000) / POR_MINUTO; if (Date.now() < alvo) await espera(alvo - Date.now());
    const { dados, erro } = await buscar(`${CEVEN}/api/rca/historico-vendedor?filial=${r.key}&id=${r.id}&expandido=true`);
    if (erro || !dados || !Array.isArray(dados.ultimas_visitas)) { falhas.push(`${r.sigla} ${r.id} (${erro || 'resposta sem ultimas_visitas'})`); continue; }
    const vis = dados.ultimas_visitas.filter((v) => String(v.num_pedido || '').trim());
    if (!vis.length) semPedido++;
    db.transaction(() => {
      for (const v of vis) {
        const num = String(v.num_pedido).trim(), idc = String(v.id_cliente || ''), d = iso(v.data_visita || v.data_pedido || v.data);
        const chave = `${r.fcod}_${idc}_${num}`;
        const skus = Array.isArray(v.skus) ? v.skus : (Array.isArray(v.skus_winthor) ? v.skus_winthor : []);
        const cortes = Array.isArray(v.itens_cortados) ? v.itens_cortados : [];
        const fat = parseFloat(v.vl_faturado_winthor || v.vl_faturado || 0) || 0;
        const cli = cnpjDe.get(idc, r.fcod);
        insPed.run(chave, num, r.fcod, r.sigla, idc, cli ? cli.cnpj : '', v.nome_cliente || '', r.id, r.nome, r.sup, r.ger, d, br(d),
          v.status_pedido || v.status || 'FATURADO', v.categoria_corte || 'SEM CORTE', fat, parseFloat(v.vl_perdido_logistica || 0) || 0, parseFloat(v.total_clube) || fat, skus.length, cortes.length);
        delItens.run(chave);
        for (const s of skus) { insItem.run(chave, num, r.fcod, idc, 'VENDA', String(s.codigo || s.codprod || ''), s.descricao || '', parseFloat(s.quantidade || 1) || 1, parseFloat(s.total || s.valor || 0) || 0); itens++; }
        for (const c of cortes) insItem.run(chave, num, r.fcod, idc, 'CORTE', String(c.codprod || c.codigo || ''), c.descricao || '', parseFloat(c.qtdev || c.quantidade || 1) || 1, parseFloat(c.vl_devolvido || c.valor_cortado || 0) || 0);
        pedidos++;
        if (d) { if (!menor || d < menor) menor = d; if (!maior || d > maior) maior = d; }
      }
    })();
    if ((i + 1) % 50 === 0 || i + 1 === rcas.length) console.log(`  ${i + 1}/${rcas.length} RCAs | pedidos ${pedidos} | itens ${itens} | falhas ${falhas.length}`);
  }
  console.log(`✅ Pedidos gravados: ${pedidos} (de ${menor} a ${maior}) | itens ${itens} | RCAs sem pedido no período ${semPedido} | falhas ${falhas.length}`);
  if (falhas.length) console.log('   Falhas: ' + falhas.slice(0, 40).join(', '));
  db.close();
  if (!pedidos) { console.error('❌ ZERO pedidos gravados: o CEVEN recusou ou mudou o formato. NÃO é sucesso.'); process.exit(1); }
  if (falhas.length > rcas.length * 0.05) { console.error(`❌ ${falhas.length} de ${rcas.length} RCAs falharam (mais de 5%).`); process.exit(1); }
}
main().catch((e) => { console.error('❌ ERRO:', e.message); process.exit(1); });
