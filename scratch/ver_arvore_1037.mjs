import { execSync } from 'child_process';

const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --json --command "SELECT * FROM arvore_supervisores WHERE rca = '1037'"`;
const res = execSync(cmd, { maxBuffer: 10*1024*1024 });
console.log('Arvore 1037:', JSON.stringify(JSON.parse(res.toString())[0].results, null, 2));
