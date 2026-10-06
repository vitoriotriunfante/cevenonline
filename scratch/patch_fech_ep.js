const fs = require('fs');
const rel = 'functions/api/brasileirao-lances.js';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r); s = s.replace(de, () => para); };
tr("import { lerQualif } from '../_lib/qualificacao_gol.js';", "import { lerQualif } from '../_lib/qualificacao_gol.js';\nimport { lerDiaFechado } from '../_lib/liga_fechamento.js';", 'imp');
tr("  try {\n    let query = `SELECT chave, filial, nivel, rca,", "  // DIA FECHADO (congelado as 19h30, ver _lib/liga_fechamento.js): devolve o que foi gravado no fechamento, sem recalcular. ?ao_vivo=1 ignora o congelamento (so o proprio fechamento usa).\n  if (u.searchParams.get('ao_vivo') !== '1') {\n    const f = await lerDiaFechado(env, dia, filial);\n    if (f) { const porNivel = {}; for (const l of f.lances) porNivel[l.nivel] = (porNivel[l.nivel] || 0) + 1; return resp({ dia, filial: filial || 'TODAS', total: f.lances.length, duplicados_removidos: 0, porNivel, lances: f.lances, fechado: true, fechado_em: f.cab.fechado_em, regras_versao: f.cab.regras_versao }); }\n  }\n\n  try {\n    let query = `SELECT chave, filial, nivel, rca,", 'corpo');
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
