import { execSync } from 'child_process';

const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --json --command="SELECT id, datetime(quando, '-3 hours') as q, direcao, tipo, nota, texto, celular FROM bot_msgs WHERE celular IN (SELECT celular FROM bot_contatos WHERE nome LIKE '%Jonathan%') AND quando >= '2026-10-27 00:00:00' ORDER BY id ASC"`;
try {
  const res = execSync(cmd, { maxBuffer: 20 * 1024 * 1024 });
  const rows = JSON.parse(res.toString())[0].results;
  for (const r of rows) {
    console.log(`[${r.q}] [${r.direcao.toUpperCase()}${r.nota ? ` NOTA:${r.nota}` : ''}] ${r.texto.slice(0, 160).replace(/\n/g, ' ')}`);
  }
} catch (e) {
  console.error(e);
}
