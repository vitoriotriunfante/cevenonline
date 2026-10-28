import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('./scratch/auditoria_conversas.json', 'utf8'));
const convs = raw.conversas || [];

const desde16h = convs.filter(c => c.quando >= '2026-10-27 19:00:00');
desde16h.sort((a, b) => a.quando.localeCompare(b.quando));

const problemas = [];
const porPessoa = {};

for (const c of desde16h) {
  if (!porPessoa[c.quem]) porPessoa[c.quem] = [];
  porPessoa[c.quem].push(c);

  let problema = null;
  // Casos evidentes de falha / ruído
  if (c.tipo === 'sem resposta') {
    problema = 'Sem resposta do Jota';
  } else if (c.nota != null && c.nota <= 2) {
    problema = `Nota baixa (${c.nota})`;
  } else if (c.tipo === 'ia') {
    problema = 'Caiu na IA genérica';
  } else if (c.tipo === 'ajuda') {
    problema = 'Caiu no menu de ajuda';
  } else if (/não cadastrado/i.test(c.papel) || !c.cadastrado) {
    problema = 'Contato não cadastrado ou não reconhecido';
  } else if (/^oi! eu sou o \*jota\*/i.test(c.resposta || '')) {
    problema = 'Mensagem de boas-vindas / não reconheceu código ou nome';
  } else if (c.pergunta && /bom diaa?/i.test(c.pergunta) && /recuperação — bom/i.test(c.resposta || '')) {
    problema = 'Entendeu "Bom dia" como produto "Bom" (recuperação de cliente)';
  } else if (c.pergunta && /como está a positivação dos sem compra de hoje/i.test(c.pergunta) && /preço médio/i.test(c.resposta || '')) {
    problema = 'Entendeu "sem compra" como produto "Sem"';
  }

  if (problema) {
    problemas.push({ ...c, motivo_problema: problema });
  }
}

console.log(`Total geral desde 16h: ${desde16h.length}`);
console.log(`Total com problemas identificados: ${problemas.length}`);

console.log('\n--- PROBLEMAS IDENTIFICADOS ---');
for (const p of problemas) {
  console.log(`\n[${p.quando}] ${p.quem} (${p.papel} - ${p.filial}) [${p.motivo_problema}]`);
  console.log(`P: "${p.pergunta}"`);
  console.log(`R (${p.tipo}): "${p.resposta ? p.resposta.slice(0, 150) : 'null'}"`);
}
