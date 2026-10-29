import { execSync } from 'child_process';

const nomes = ['Washington', 'Alex', 'Ailton', 'Jonathan', 'Priscila'];

for (const n of nomes) {
  console.log(`\n=================== CONVERSAS DE ${n.toUpperCase()} ===================`);
  const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --command="SELECT id, datetime(quando, '-3 hours') as q, direcao, tipo, nota, texto, celular FROM bot_msgs WHERE celular IN (SELECT celular FROM bot_contatos WHERE nome LIKE '%${n}%') AND quando >= '2026-10-28 11:00:00' ORDER BY id ASC" --json`;
  try {
    const res = execSync(cmd, { maxBuffer: 20 * 1024 * 1024 });
    const rows = JSON.parse(res.toString())[0].results;
    for (const r of rows) {
      console.log(`[${r.q}] [${r.direcao.toUpperCase()}${r.nota ? ` NOTA:${r.nota}` : ''}] ${r.texto.slice(0, 160).replace(/\n/g, ' ')}`);
    }
  } catch (e) {
    console.error(`Erro ao consultar ${n}:`, e.message);
  }
}
