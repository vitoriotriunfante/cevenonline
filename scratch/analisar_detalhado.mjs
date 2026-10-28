import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('./scratch/auditoria_conversas.json', 'utf8'));
const convs = raw.conversas || [];

// 16:00 BRT em UTC é 19:00 UTC (ou 18:00 para pegar margem)
const filtradas = convs.filter(c => c.quando >= '2026-10-27 18:00:00');

console.log('Total a partir de 27/10 ~15:00/16:00 BRT:', filtradas.length);

for (let i = 0; i < filtradas.length; i++) {
  const c = filtradas[i];
  console.log(`\n========================================================================`);
  console.log(`ITEM #${i + 1}: [${c.quando}] ${c.quem} | Papel: ${c.papel} | Filial: ${c.filial} | Tel: ${c.celular}`);
  console.log(`PERGUNTA: ${c.pergunta}`);
  console.log(`TIPO: ${c.tipo} | AJUDOU: ${c.ajudou} | NOTA: ${c.nota} | NAO_AJUDOU: ${c.nao_ajudou}`);
  console.log(`RESPOSTA:\n${c.resposta}`);
}
