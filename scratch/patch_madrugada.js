const fs = require('fs');
const p = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/functions/api/cron-lances.js';
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const de = "  const forcar = new URL(request.url).searchParams.has('forcar');\n";
if (s.split(de).length !== 2) throw new Error('ancora');
s = s.replace(de, () =>
"  // TRAVA DA MADRUGADA (06/10/2026): a meia-noite o CEVEN ainda serve o roteiro de ONTEM com o dia novo; o coletor registrava os lances de ontem como se\n" +
"  // fossem de hoje (845 lances em 06/10, 793 repetidos de 05/10; 1.813 em 01/10). Antes das 06h nao ha venda do dia: nao coleta nada.\n" +
"  if (t.h < 6 && !new URL(request.url).searchParams.has('madrugada')) {\n" +
"    return new Response(JSON.stringify({ status: 'MADRUGADA_SEM_COLETA', dia: t.dia, hora: t.hms }), { headers: cors });\n" +
"  }\n" + de);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
