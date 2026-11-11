// INDICE LIMITADO DO VENDEDOR (09/11/2026): conversa em sequencia, producao SO LEITURA.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
// 3 MOMENTOS: forca cada momento para cada vendedor (producao, so leitura)
const MO = await import('../functions/_lib/jota/respostas/momentos.js'), { carregaEscopo } = await import('../functions/_lib/jota/escopo.js');
for (const [fil, rca, nome] of [['TCV', '352', 'TAMARA GUEDES'], ['TBL', '181', 'GIOVANA BATISTA DA SILVA']]) {
  const c = { nome, papel: 'vendedor', filial: fil, rca };
  for (const mo of ['plano', 'meio', 'fechamento']) {
    const B = _teste.criaBase(ORIGIN, { DB });
    const Ev = await carregaEscopo(B, { nome, filiais: [fil], grupo: null, supervisor: null, rca, nacional: false });
    console.log(`===== ${nome} · ${mo} (qualMomento agora: ${MO.qualMomento(Ev.vend[0])})`);
    let txt; try { const m = await MO.respMomento(B, c, Ev, mo); txt = m.texto + `\n\n[figurinha de comemoracao: ${m.comemora ? 'sim' : 'nao'}]`; } catch (e) { txt = 'ERRO ' + e.stack; }
    console.log(txt);
    // AUDITORIA (Vitorio, 11/11/2026): 1 MD por momento na pasta do vendedor
    const dir = `auditoria/${nome} - ${fil} ${rca}`; fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/M - ${mo}.md`, `# 3 momentos — ${mo}\n\n- Vendedor: ${nome} (${fil} ${rca})\n- Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (dados de producao, so leitura; momento forcado para auditar)\n- O vendedor digitou: "bom dia" / "oi Jota" / "boa tarde"\n- Momento que sairia agora: ${MO.qualMomento(Ev.vend[0])}\n\n## Resposta do Jota\n\n\`\`\`\n${txt}\n\`\`\`\n`);
  }
}
limpa();
