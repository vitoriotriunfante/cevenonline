const fs = require('fs');
const path = require('path');

const harPath = path.join(__dirname, 'ceven.drivetriunfante-locomotiva.com.br.har');
if (!fs.existsSync(harPath)) {
  console.error('Arquivo HAR não encontrado em:', harPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(harPath, 'utf-8'));
const entries = data.log.entries || [];

console.log(`\n======================================================`);
console.log(`  📊 RELATÓRIO COMPLETO DO HAR (${entries.length} Requisições)`);
console.log(`======================================================\n`);

const endpoints = [];
entries.forEach(e => {
  const url = e.request.url;
  const method = e.request.method;
  const status = e.response.status;
  const mime = e.response.content.mimeType || '';
  const text = e.response.content.text || '';
  
  if (url.includes('/api/') || mime.includes('json') || url.includes('ceven')) {
    let jsonSample = '';
    try {
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          jsonSample = `Array(${parsed.length}) Ex: ` + JSON.stringify(parsed[0]).substring(0, 100);
        } else if (typeof parsed === 'object') {
          jsonSample = 'Keys: ' + Object.keys(parsed).join(', ');
        }
      }
    } catch (_) {}

    endpoints.push({ method, status, url, mime, jsonSample });
  }
});

console.log(`Total de rotas de dados encontradas: ${endpoints.length}\n`);
endpoints.forEach((ep, idx) => {
  console.log(`[${idx + 1}] ${ep.method} ${ep.status} -> ${ep.url}`);
  if (ep.jsonSample) {
    console.log(`    ↳ Estrutura: ${ep.jsonSample}`);
  }
});
console.log(`\n======================================================\n`);
