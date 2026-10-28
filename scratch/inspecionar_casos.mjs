import fs from 'fs';
const d = JSON.parse(fs.readFileSync('scratch/auditoria_hoje_08h.json', 'utf8'));
const dialogos = d.dialogos;

function verUser(nomePart) {
  console.log('=== ' + nomePart + ' ===');
  const userD = dialogos.filter(x => (x.nome || '').toUpperCase().includes(nomePart.toUpperCase()));
  for (const x of userD) {
    console.log(`[${x.hora}] ${x.nome} (${x.papel} ${x.filial}) | NOTA: ${x.nota} | TIPO: ${x.tipo_resp}`);
    console.log(`PERGUNTA: ${x.pergunta}`);
    console.log('RESPOSTA:');
    console.log(x.resposta || '[SEM RESPOSTA]');
    console.log('-----------------------------------');
  }
}

verUser('POLETTO');
verUser('ALEX SANDRO');
