import { execSync } from 'child_process';

console.log('=== BOT CONTATOS AILTON ===');
const c1 = execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --json --command "SELECT * FROM bot_contatos WHERE nome LIKE '%Ailton%'"`, { maxBuffer: 10*1024*1024 });
console.log(JSON.stringify(JSON.parse(c1.toString())[0].results, null, 2));

console.log('=== ARVORE SUPERVISORES 1037 OU AILTON ===');
const c2 = execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --json --command "SELECT * FROM arvore_supervisores WHERE sup_nome LIKE '%Ailton%' OR sup_id IN ('1037', '102')"`, { maxBuffer: 10*1024*1024 });
console.log(JSON.stringify(JSON.parse(c2.toString())[0].results, null, 2));
