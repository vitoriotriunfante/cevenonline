import fs from 'fs';

const avaliacoes = JSON.parse(fs.readFileSync('scratch/auditoria_completa_perguntas.json', 'utf8'));

console.log('=== AMOSTRA DE PERGUNTAS COM PROBLEMA DE CONTEXTO ===');
const ctx = avaliacoes.filter(x => x.status === 'ERRO_CONTEXTO');
for (const x of ctx.slice(0, 5)) {
  console.log(`\n[${x.hora}] ${x.quem}`);
  console.log(`P: "${x.pergunta}"`);
  console.log(`Problemas: ${x.problemas.join('; ')}`);
  console.log(`Início Resp: ${x.resposta_inicio}`);
}

console.log('\n=== AMOSTRA DE PERGUNTAS QUE CAÍRAM NA IA ===');
const ia = avaliacoes.filter(x => x.status === 'CAIU_NA_IA');
for (const x of ia.slice(0, 5)) {
  console.log(`\n[${x.hora}] ${x.quem}`);
  console.log(`P: "${x.pergunta}"`);
  console.log(`Problemas: ${x.problemas.join('; ')}`);
  console.log(`Início Resp: ${x.resposta_inicio}`);
}

console.log('\n=== AMOSTRA DE PERGUNTAS COM PROBLEMA DE UI/UX (TEXTÃO / CÓDIGOS SOLTOS) ===');
const ux = avaliacoes.filter(x => x.problemas.some(p => p.startsWith('UI/UX')));
for (const x of ux.slice(0, 5)) {
  console.log(`\n[${x.hora}] ${x.quem}`);
  console.log(`P: "${x.pergunta}" (Tam: ${x.resposta_tamanho} chars)`);
  console.log(`Problemas: ${x.problemas.join('; ')}`);
  console.log(`Início Resp: ${x.resposta_inicio}`);
}
