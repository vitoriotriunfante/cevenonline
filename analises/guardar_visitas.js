/**
 * FICHA DO ARQUIVO: analises/guardar_visitas.js
 * O QUE É: guarda, dia a dia, TODA visita da rota com STATUS e JUSTIFICATIVA (motivo do "visitou e não vendeu") — pedido do
 *          Vitório em 23/09/2026 e reforçado em 25/10/2026: "preciso dele guardado uai... inclusive para análises".
 *          O CEVEN só mostra a rota do dia; o que não for guardado se perde.
 * LÊ (uma fonte só, sem chamar o CEVEN de novo): /api/central-snapshot?filial=X&dia=AAAA-MM-DD (rota que a varredura central já
 *          gravou no D1, desde 29/09/2026) + /api/tv-mostra (Gestão de Equipe: nome, supervisor, grupo, canal).
 * ESCREVE: analises/historico_visitas.db (SQLite, tabela visitas; chave dia+filial+rca+cliente). Fica no DRIVE (tem nome de cliente e
 *          CNPJ — LGPD: nunca vai para o GitHub). Rodar de novo o mesmo dia SUBSTITUI (status final do dia).
 * RODA: workflow guardar-visitas.yml, todo dia às 22h de Brasília. Recupera sozinho os dias que faltarem desde 29/09/2026.
 * Uso: node analises/guardar_visitas.js [AAAA-MM-DD inicial]
 */
const path = require('path');
const Database = require('better-sqlite3');
const R = require('../public/regras.js');

const SITE = process.env.SITE || 'https://ceven-cftv-matrix.pages.dev';
const FILIAIS = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
const INICIO_BASE = '2026-09-29'; // primeiro dia guardado pela varredura central no D1
const DB_PATH = path.join(__dirname, 'historico_visitas.db');

const getJson = async (u, tent = 3) => {
  for (let i = 1; i <= tent; i++) {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(90000) }); if (r.ok) return await r.json(); } catch (e) {}
    await new Promise((ok) => setTimeout(ok, 3000 * i));
  }
  return null;
};
const diasEntre = (a, b) => { const out = []; for (let d = new Date(a + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= b; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; };

async function main() {
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS visitas (
    dia TEXT, filial TEXT, rca TEXT, id_cliente TEXT, vendedor TEXT, supervisor TEXT, grupo TEXT, canal TEXT,
    cliente TEXT, razao_social TEXT, cnpj TEXT, ordem INTEGER, status TEXT, motivo TEXT, observacao TEXT,
    checkin TEXT, checkout TEXT, tempo_visita TEXT, data_ultima_compra TEXT, valor_ultima_compra REAL,
    gravado_em TEXT, PRIMARY KEY (dia, filial, rca, id_cliente));
    CREATE INDEX IF NOT EXISTS ix_visitas_motivo ON visitas (dia, motivo);`);
  const hoje = R.hojeSP();
  // dias a gravar: o pedido na linha de comando, senão desde o último dia guardado (regrava o último: pode ter fechado depois)
  const ult = (db.prepare('SELECT MAX(dia) d FROM visitas').get() || {}).d;
  const de = process.argv[2] || (ult && ult > INICIO_BASE ? ult : INICIO_BASE);
  const dias = diasEntre(de, hoje);

  const mostra = await getJson(`${SITE}/api/tv-mostra`);
  if (!mostra || !mostra.filiais) { console.error('❌ Gestão de Equipe (/api/tv-mostra) não respondeu: nada gravado (nunca gravo sem saber quem é quem).'); process.exit(1); }
  const equipe = new Map();
  for (const [f, lista] of Object.entries(mostra.filiais)) for (const v of lista || []) equipe.set(f + '|' + v.rca, v);

  const ins = db.prepare(`INSERT OR REPLACE INTO visitas VALUES (@dia,@filial,@rca,@id_cliente,@vendedor,@supervisor,@grupo,@canal,@cliente,@razao_social,@cnpj,@ordem,@status,@motivo,@observacao,@checkin,@checkout,@tempo_visita,@data_ultima_compra,@valor_ultima_compra,@gravado_em)`);
  const agora = new Date().toISOString();
  let total = 0, comMotivo = 0, semDado = [];
  for (const dia of dias) {
    let doDia = 0;
    for (const fil of FILIAIS) {
      const s = await getJson(`${SITE}/api/central-snapshot?filial=${fil}&dia=${dia}`);
      if (!s || !s.rcas) { semDado.push(`${dia} ${fil}`); continue; }
      if (s.dia && s.dia !== dia) { semDado.push(`${dia} ${fil} (veio ${s.dia})`); continue; }
      const linhas = [];
      for (const [rca, v] of Object.entries(s.rcas)) {
        const p = equipe.get(fil + '|' + rca) || {};
        for (const c of v.roteiro || []) {
          linhas.push({ dia, filial: fil, rca: String(rca), id_cliente: String(c.id_cliente ?? c.id ?? ''), vendedor: p.nome || null, supervisor: p.supervisor || null, grupo: p.grupo || null, canal: p.canal || null,
            cliente: c.nome_cliente || null, razao_social: c.razao_social || null, cnpj: c.cnpj || null, ordem: c.ordem ?? null, status: c.status || null,
            motivo: (c.motivo_nao_visita || '').trim() || null, observacao: (c.observacao_nao_visita || '').trim() || null,
            checkin: c.checkin_horario || null, checkout: c.checkout_horario || null, tempo_visita: c.tempo_visita == null ? null : String(c.tempo_visita),
            data_ultima_compra: c.data_ultima_compra ? String(c.data_ultima_compra).slice(0, 10) : null, valor_ultima_compra: c.valor_ultima_compra == null ? null : Number(c.valor_ultima_compra), gravado_em: agora });
        }
      }
      db.transaction((ls) => { for (const l of ls) ins.run(l); })(linhas);
      doDia += linhas.length; comMotivo += linhas.filter((l) => l.motivo).length;
    }
    total += doDia;
    console.log(`📅 ${dia}: ${doDia} visitas na rota`);
  }
  const resumo = db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT dia) d, SUM(motivo IS NOT NULL) m FROM visitas').get();
  console.log(`✅ gravadas nesta rodada: ${total} (${comMotivo} com justificativa). Banco: ${resumo.n} visitas, ${resumo.d} dias, ${resumo.m} com justificativa.`);
  if (semDado.length) console.log(`⚠️ sem dado (não inventado, fica de fora): ${semDado.join(', ')}`);
  db.close();
}
main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
