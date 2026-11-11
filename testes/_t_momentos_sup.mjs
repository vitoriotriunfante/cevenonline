// INDICE LIMITADO DO VENDEDOR (09/11/2026): conversa em sequencia, producao SO LEITURA.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
// 3 MOMENTOS DO SUPERVISOR: forca cada momento (producao, so leitura) e grava a auditoria
const MO = await import('../functions/_lib/jota/respostas/momentos.js'), { carregaEscopo } = await import('../functions/_lib/jota/escopo.js');
const SUPS = process.argv.slice(2).length ? [process.argv.slice(2)] : [['TSJ', 'VICTOR HUGO FONSECA CARVALHO'], ['TBL', 'SERGIO LOPES DE OLIVEIRA']];
for (const [fil, nome] of SUPS) {
  const c = { nome, papel: 'supervisor', filial: fil, supervisor: nome };
  for (const mo of ['abertura', 'meio', 'fechamento']) {
    const B = _teste.criaBase(ORIGIN, { DB });
    const Ev = await carregaEscopo(B, { nome: 'Equipe ' + nome, filiais: [fil], grupo: null, supervisor: nome, nacional: false });
    let txt; try { const m = await MO.respMomentoSupervisor(B, c, Ev, mo); txt = m ? m.texto + `\n\n[figurinha: ${m.comemora ? 'comemora' : m.incentiva ? 'incentiva' : 'nenhuma'}]` : 'SEM RESPOSTA (equipe vazia)'; } catch (e) { txt = 'ERRO ' + e.stack; }
    console.log(`===== ${nome} · ${mo} (agora sairia: ${MO.qualMomentoEquipe(Ev.vend || [])})\n${txt}`);
    const dir = `auditoria/SUPERVISOR ${nome} - ${fil}`; fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/M - ${mo}.md`, `# 3 momentos do supervisor — ${mo}\n\n- Supervisor: ${nome} (${fil})\n- Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (producao, so leitura; momento forcado para auditar)\n- Digitou: "bom dia" / "oi Jota" / "boa tarde"\n\n## Resposta do Jota\n\n\`\`\`\n${txt}\n\`\`\`\n`);
  }
}
limpa();
