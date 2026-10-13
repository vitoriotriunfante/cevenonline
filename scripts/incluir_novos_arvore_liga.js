// =========================================================================
// FICHA DO ARQUIVO: scripts/incluir_novos_arvore_liga.js
// O QUE É: inclui na Gestão de Equipe (D1 config_equipe_soberana) os RCAs que estão na ÁRVORE VIVA do CEVEN mas ainda não estavam na Gestão
//          (aparecem em /api/tv-mostra com novo_na_arvore=true, mostra=false). Entram com mostra=true, canal/supervisor/gerente da árvore e jogam a Liga.
// DECISÃO: Vitório, 13/10/2026 ("coloque todos na liga... MENOS os REPRESENTANTES... dai vamos tirar depois"). Representante e promotor NUNCA entram por aqui.
// COMO RODAR: node scripts/incluir_novos_arvore_liga.js [--dry]     (--dry só mostra; idempotente)
// SEGURANÇA: lê o JSON atual e MESCLA (só acrescenta); cópia de segurança em scratch/backup_equipe_*.json; grava em partes (SQLITE_TOOBIG) num UPDATE só.
// =========================================================================
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dry = process.argv.includes('--dry');
const aspas = (a) => (process.platform === 'win32' && /[\s'"*]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a);
const wrangler = (args) => execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'ceven_noc_d1', '--remote', ...args].map(aspas), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' });

(async () => {
  // 1) quem a árvore tem e a Gestão não (o próprio /api/tv-mostra marca novo_na_arvore)
  const tm = await (await fetch('https://ceven-cftv-matrix.pages.dev/api/tv-mostra', { cache: 'no-store' })).json();
  const novos = [];
  for (const [fil, lista] of Object.entries(tm.filiais || {})) for (const x of lista) {
    if (!x.novo_na_arvore) continue;
    if (x.vinculo === 'PROMOTOR') continue;   // representante liberado em 13/10/2026
    novos.push({ filial: fil, ...x });
  }
  console.log('Novos na árvore a incluir:', novos.length, novos.map((n) => `${n.filial} ${n.rca} ${n.nome}`).join(' | '));
  if (!novos.length) return;

  // 2) Gestão atual + cópia de segurança
  const bruto = wrangler(['--json', '--command', 'SELECT conteudo_json FROM config_equipe_soberana WHERE id = 1']);
  const dados = JSON.parse(JSON.parse(bruto.slice(bruto.indexOf('[')))[0].results[0].conteudo_json);
  fs.mkdirSync(path.join(__dirname, '..', 'scratch'), { recursive: true });
  const bkp = path.join(__dirname, '..', 'scratch', `backup_equipe_${new Date().toISOString().slice(0, 16).replace(':', '-')}.json`);
  fs.writeFileSync(bkp, JSON.stringify(dados));
  console.log('Cópia de segurança:', bkp);

  // 3) acrescenta (nunca duplica)
  const jaTem = new Set();
  for (const [k, lista] of Object.entries(dados.filiais)) for (const v of lista) jaTem.add(k.split('_')[0] + '|' + String(v.rca));
  let incluidos = 0;
  for (const n of novos) {
    if (jaTem.has(n.filial + '|' + String(n.rca))) continue;
    const chave = Object.keys(dados.filiais).find((k) => k === n.filial) || Object.keys(dados.filiais).find((k) => k.split('_')[0] === n.filial);
    if (!chave) { console.warn('Filial desconhecida, ignorado:', n.filial, n.rca); continue; }
    dados.filiais[chave].push({ rca: /^\d+$/.test(String(n.rca)) ? Number(n.rca) : n.rca, grupo: n.grupo || '', nome: n.nome, supervisor: n.supervisor || '', gerente: n.gerente || '', canal: n.canal || '',
      mostra: true, motivo: 'Incluído na Liga (Vitório 13/10/2026): novo na árvore do CEVEN; revisar depois', origem_inclusao: 'arvore_ceven_2026-10-13' });
    incluidos++;
  }
  let sim = 0, nao = 0;
  for (const lista of Object.values(dados.filiais)) for (const v of lista) { if (v.mostra === false) nao++; else sim++; }
  dados.total_sim = sim; dados.total_nao = nao;
  console.log(`Incluídos: ${incluidos} | SIM ${sim} / NÃO ${nao}`);
  if (dry || !incluidos) { console.log(dry ? '--dry: nada gravado.' : 'Nada a gravar.'); return; }

  // 4) grava em partes + trilha de auditoria
  const sqlArq = path.join(__dirname, '..', 'scratch', 'seed_novos_arvore.sql');
  const esc = (t) => t.replace(/'/g, "''");
  const json = JSON.stringify(dados);
  const partes = []; for (let i = 0; i < json.length; i += 40000) partes.push(json.slice(i, i + 40000));
  const sql = [
    'CREATE TABLE IF NOT EXISTS config_equipe_apoio (parte INTEGER PRIMARY KEY, txt TEXT NOT NULL);',
    'DELETE FROM config_equipe_apoio;',
    ...partes.map((t, i) => `INSERT INTO config_equipe_apoio (parte, txt) VALUES (${i}, '${esc(t)}');`),
    `UPDATE config_equipe_soberana SET conteudo_json = (SELECT group_concat(txt, '') FROM (SELECT txt FROM config_equipe_apoio ORDER BY parte)), atualizado_por = 'Novos da arvore na Liga (13/10)', atualizado_em = datetime('now') WHERE id = 1;`,
    'DELETE FROM config_equipe_apoio;',
    `INSERT INTO audit_alteracoes_equipe (alterado_em, usuario, total_rcas, resumo) VALUES (datetime('now'),'Novos da arvore',${sim + nao},'${incluidos} RCAs novos da arvore do CEVEN incluidos na Liga (mostra=SIM), exceto representante/promotor; SIM ${sim} / NAO ${nao}');`,
  ].join('\n') + '\n';
  fs.writeFileSync(sqlArq, sql);
  console.log(wrangler(['--file', sqlArq]).split('\n').slice(-6).join('\n'));
  fs.unlinkSync(sqlArq);
  console.log('OK: Gestão atualizada. As telas pegam em até 1 min.');
})();
