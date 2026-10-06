const fs = require('fs');
const p = 'testes/rodar_testes.mjs';
let s = fs.readFileSync(p, 'utf8');
const marca = 'console.log(`\\nRESULTADO';
const i = s.indexOf(marca);
if (i < 0) throw new Error('ancora');
const add = [
  "secao('8e. Liga cravada: regras congeladas por versao, fechamento do dia (19h30) e conferencia diaria contra o CEVEN');",
  "{",
  "  const cfgTxt = ler('config/pontuacao_brasileirao.json'); const cfg = JSON.parse(cfgTxt);",
  "  const LOCK_HASH = '6862036f2f9453ae1aa1623e7514c32b6dda3a693a4220603b487dfff7cb98ff'; // sha256 do regulamento na versao 2026-10-07.1",
  "  const { createHash } = await import('node:crypto');",
  "  const hash = createHash('sha256').update(JSON.stringify(cfg)).digest('hex');",
  "  const lib = ler('functions/_lib/liga_fechamento.js');",
  "  ok(lib.includes(\"REGRAS_VERSAO = '\" + cfg.versao_regras + \"'\"), 'versao das regras: config (' + cfg.versao_regras + ') e liga_fechamento.js dizem a mesma versao');",
  "  ok(hash === LOCK_HASH, 'REGRAS CONGELADAS: o regulamento (config/pontuacao_brasileirao.json) nao mudou desde a versao ' + cfg.versao_regras + '. Se mudou de proposito: suba versao_regras e REGRAS_VERSAO, atualize LOCK_HASH aqui e avise os gerentes (hash atual ' + hash + ')');",
  "  ok(lib.includes('19 * 60 + 30') && lib.includes('INSERT OR IGNORE INTO liga_fechamento') && lib.indexOf('INSERT OR IGNORE INTO liga_dia_fechado') < lib.indexOf('INSERT OR IGNORE INTO liga_fechamento'), 'fechamento: so depois das 19h30, grava as linhas ANTES do cabecalho e nunca sobrescreve dia ja fechado');",
  "  const bl = ler('functions/api/brasileirao-lances.js');",
  "  ok(bl.includes('lerDiaFechado(env, dia, filial)') && bl.includes(\"ao_vivo') !== '1'\"), 'endpoint da liga devolve o dia FECHADO sem recalcular (so o fechamento usa ao_vivo=1)');",
  "  const cr = ler('functions/api/cron-lances.js');",
  "  ok(cr.includes('cron-fechamento-dia') && cr.includes('cron-conferencia-dia?rodar=1') && cr.includes('t.agoraMin >= 19 * 60 + 30'), 'coletor chama o fechamento e a conferencia depois das 19h30');",
  "  const cf = ler('functions/api/cron-conferencia-dia.js');",
  "  ok(cf.includes('const FATIA = 60, CONC = 6') && cf.includes('/api/rca/produtividade') && cf.includes('/api/rca/devolucoes') && !/method:\\s*['\"]POST/.test(cf), 'conferencia: so leitura do CEVEN, 6 chamadas simultaneas no maximo, fatias de 60 vendedores');",
  "  const fe = ler('functions/api/cron-fechamento-dia.js');",
  "  ok(fe.includes(\"DIA_INICIAL = '2026-10-06'\") && fe.includes('manual'), 'fechamento automatico so de 06/10/2026 em diante; dias anteriores so de proposito (manual=1)');",
  "}",
  "", ""
].join('\n');
s = s.slice(0, i) + add + s.slice(i);
fs.writeFileSync(p, s);
console.log('ok');
