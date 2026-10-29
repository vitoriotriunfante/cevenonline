import { execSync } from 'child_process';

const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --json --command "SELECT id, texto FROM bot_msgs WHERE celular IN (SELECT celular FROM bot_contatos WHERE nome LIKE '%Jonathan%') AND direcao = 'out' AND id > 2690 ORDER BY id ASC LIMIT 3"`;
const res = execSync(cmd, { maxBuffer: 10*1024*1024 });
const rows = JSON.parse(res.toString())[0].results;
for (const r of rows) {
  console.log('--- RESPOSTA ID', r.id, '---');
  console.log(r.texto);
}
