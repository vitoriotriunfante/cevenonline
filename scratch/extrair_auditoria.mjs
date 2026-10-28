import fs from 'fs';
import { execSync } from 'child_process';

console.log('Extraindo mensagens de hoje do D1...');
const sql = "SELECT m.id, datetime(m.quando, '-3 hours') as hora, m.celular, COALESCE(c.nome, m.nome) as nome, COALESCE(c.papel, 'desconhecido') as papel, COALESCE(c.filial, 'sem filial') as filial, m.direcao, m.tipo, m.nota, m.ajudou, m.texto FROM bot_msgs m LEFT JOIN bot_contatos c ON c.celular = m.celular WHERE m.quando >= '2026-10-27 00:00' ORDER BY m.id ASC";

const res = execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --json --command "${sql}"`, { maxBuffer: 50 * 1024 * 1024 });
const rows = JSON.parse(res.toString())[0].results;

// Agrupar por conversa (celular) em pares de Pergunta -> Resposta
const conversasPorCel = new Map();
for (const r of rows) {
  if (!conversasPorCel.has(r.celular)) conversasPorCel.set(r.celular, []);
  conversasPorCel.get(r.celular).push(r);
}

const dialogos = [];
for (const [cel, msgs] of conversasPorCel) {
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].direcao === 'in') {
      const pergunta = msgs[i];
      const resposta = msgs[i + 1] && msgs[i + 1].direcao === 'out' ? msgs[i + 1] : null;
      dialogos.push({
        id: pergunta.id,
        hora: pergunta.hora,
        nome: pergunta.nome,
        papel: pergunta.papel,
        filial: pergunta.filial,
        celular: cel,
        pergunta: pergunta.texto,
        tipo_resp: resposta ? resposta.tipo : 'sem_resposta',
        nota: resposta ? resposta.nota : null,
        ajudou: resposta ? resposta.ajudou : null,
        resposta: resposta ? resposta.texto : null
      });
    }
  }
}

fs.writeFileSync('scratch/dialogos_hoje.json', JSON.stringify(dialogos, null, 2));
console.log(`Extraídos ${dialogos.length} diálogos de hoje!`);
