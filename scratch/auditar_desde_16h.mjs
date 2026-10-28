import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('./scratch/auditoria_conversas.json', 'utf8'));
const convs = raw.conversas || [];

// 16:00 BRT em 27/10 é 19:00 UTC
const desde16h = convs.filter(c => c.quando >= '2026-10-27 19:00:00');

console.log('Total de conversas desde 27/10 16:00 BRT (19:00 UTC):', desde16h.length);

const stats = {
  total: desde16h.length,
  prontas: 0,
  ia: 0,
  ajuda: 0,
  sem_resposta: 0,
  nota_msg: 0,
  notas_dadas: [],
  nao_ajudou: 0,
  por_pessoa: {}
};

for (const c of desde16h) {
  if (c.tipo === 'pronta') stats.prontas++;
  else if (c.tipo === 'ia') stats.ia++;
  else if (c.tipo === 'ajuda') stats.ajuda++;
  else if (c.tipo === 'sem resposta') stats.sem_resposta++;
  else if (c.tipo === 'nota') stats.nota_msg++;

  if (c.nota != null) stats.notas_dadas.push({ quem: c.quem, nota: c.nota, pergunta: c.pergunta });
  if (c.nao_ajudou) stats.nao_ajudou++;

  if (!stats.por_pessoa[c.quem]) stats.por_pessoa[c.quem] = [];
  stats.por_pessoa[c.quem].push(c);
}

console.log('Estatísticas:', JSON.stringify(stats, (k, v) => k === 'por_pessoa' ? Object.keys(v).length + ' pessoas' : v, 2));

console.log('\n--- DETALHE DE CADA CONVERSA DESDE 16:00 BRT ---');
// Ordena cronológica crescente para entender o diálogo
desde16h.sort((a, b) => a.quando.localeCompare(b.quando));

for (let i = 0; i < desde16h.length; i++) {
  const c = desde16h[i];
  console.log(`\n========================================================================`);
  console.log(`[#${i + 1}] Data: ${c.quando} | Contato: ${c.quem} (${c.papel || 's/ papel'} - ${c.filial || 's/ filial'}) | Tel: ${c.celular}`);
  console.log(`PERGUNTA: "${c.pergunta}"`);
  console.log(`STATUS: tipo=${c.tipo} | ajudou=${c.ajudou} | nota=${c.nota} | nao_ajudou=${c.nao_ajudou}`);
  console.log(`RESPOSTA:\n${c.resposta ? c.resposta.trim() : '[SEM RESPOSTA]'}`);
}
