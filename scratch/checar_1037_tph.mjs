import { execSync } from 'child_process';

const snapCmd = `npx wrangler d1 execute ceven_noc_d1 --remote --json --command "SELECT json_extract(dados, '$.rcas.1037') as rca1037 FROM central_snapshots WHERE filial = 'TPH'"`;
const snapRes = execSync(snapCmd, { maxBuffer: 10*1024*1024 });
console.log('RCA 1037 em TPH:', snapRes.toString());
