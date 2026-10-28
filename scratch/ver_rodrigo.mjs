import { execSync } from 'child_process';

const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --command="SELECT id, datetime(quando, '-3 hours') as q, direcao, tipo, texto, celular FROM bot_msgs WHERE celular IN (SELECT celular FROM bot_contatos WHERE nome LIKE '%Rodrigo%') ORDER BY id DESC LIMIT 10" --json`;
const res = execSync(cmd, { encoding: 'utf-8' });
console.log(res);
