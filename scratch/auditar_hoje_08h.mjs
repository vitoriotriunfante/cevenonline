import fs from 'fs';
import { execSync } from 'child_process';

console.log('Extraindo mensagens e sugestões desde 2026-10-28 08:00 BRT (11:00 UTC)...');

// 1. Mensagens desde 08:00 BRT (11:00 UTC)
const sqlMsgs = `SELECT m.id, datetime(m.quando, '-3 hours') as hora_brt, m.celular, COALESCE(c.nome, m.nome) as nome, COALESCE(c.papel, 'desconhecido') as papel, COALESCE(c.filial, 'sem filial') as filial, m.direcao, m.tipo, m.nota, m.ajudou, m.texto FROM bot_msgs m LEFT JOIN bot_contatos c ON c.celular = m.celular WHERE m.quando >= '2026-10-28 11:00:00' ORDER BY m.id ASC`;

const resMsgs = execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --json --command "${sqlMsgs}"`, { maxBuffer: 50 * 1024 * 1024 });
const msgs = JSON.parse(resMsgs.toString())[0].results;

// 2. Sugestões registradas hoje
const sqlSug = `SELECT id, datetime(quando, '-3 hours') as hora_brt, celular, nome, papel, filial, texto, sobre FROM bot_sugestoes WHERE quando >= '2026-10-28 11:00:00' ORDER BY id ASC`;
const resSug = execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --json --command "${sqlSug}"`, { maxBuffer: 50 * 1024 * 1024 });
const sugestoes = JSON.parse(resSug.toString())[0].results;

// 3. Agrupar diálogos (in -> out)
const porCel = new Map();
for (const m of msgs) {
  if (!porCel.has(m.celular)) porCel.set(m.celular, []);
  porCel.get(m.celular).push(m);
}

const dialogos = [];
for (const [cel, lista] of porCel) {
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].direcao === 'in') {
      const pergunta = lista[i];
      // Acha a resposta subsequente mais próxima
      const resposta = lista.slice(i + 1).find(x => x.direcao === 'out' || x.direcao === 'erro');
      dialogos.push({
        id: pergunta.id,
        hora: pergunta.hora_brt,
        celular: cel,
        nome: pergunta.nome,
        papel: pergunta.papel,
        filial: pergunta.filial,
        pergunta: pergunta.texto,
        tipo_resp: resposta ? resposta.tipo : 'sem_resposta',
        nota: resposta ? resposta.nota : null,
        ajudou: resposta ? resposta.ajudou : null,
        resposta: resposta ? resposta.texto : null
      });
    }
  }
}

fs.writeFileSync('scratch/auditoria_hoje_08h.json', JSON.stringify({ total_msgs: msgs.length, total_dialogos: dialogos.length, sugestoes, dialogos }, null, 2));

console.log(`\n=== RESUMO DE HOJE (desde 08:00 BRT) ===`);
console.log(`Total de mensagens trafegadas: ${msgs.length}`);
console.log(`Total de perguntas/diálogos: ${dialogos.length}`);
console.log(`Total de sugestões gravadas: ${sugestoes.length}`);

// Notas
const notas = msgs.filter(m => m.nota != null);
console.log(`Total de notas recebidas: ${notas.length}`);
for (const n of notas) {
  console.log(`- [Nota ${n.nota}] ${n.nome} (${n.filial}): celular ${n.celular}`);
}

// Reclamações / Não Ajudou
const naoAjudou = dialogos.filter(d => d.ajudou === 0);
console.log(`Total marcados como "não ajudou": ${naoAjudou.length}`);

console.log('\n--- SUGESTÕES REGISTRADAS ---');
for (const s of sugestoes) {
  console.log(`[${s.hora_brt}] ${s.nome} (${s.papel} ${s.filial}): "${s.texto}" (sobre: "${s.sobre}")`);
}
