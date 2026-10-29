import { execSync } from 'child_process';

const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --json --command "SELECT DISTINCT filial, sup_id, sup_nome FROM arvore_supervisores WHERE filial = 'API' OR sup_id = '1037' OR sup_nome LIKE '%Ailton%'"`;
const res = execSync(cmd, { maxBuffer: 10*1024*1024 });
console.log(JSON.stringify(JSON.parse(res.toString())[0].results, null, 2));
