import fs from 'fs';

const dialogos = JSON.parse(fs.readFileSync('scratch/dialogos_hoje.json', 'utf8'));

// Filtra apenas perguntas significativas (ignora nota de 1 a 5, sim, ok, oi)
const uteis = dialogos.filter(d => {
  const p = (d.pergunta || '').trim().toLowerCase();
  return p.length > 3 && !/^(nota\s*)?[1-5]$|^sim$|^não$|^nao$|^ok$|^obrigado$|^bom dia$|^boa tarde$/.test(p);
});

console.log(`Total de perguntas de negócio avaliadas: ${uteis.length}`);

// Avaliação de cada pergunta:
// 1. O que foi perguntado
// 2. Quem perguntou
// 3. O que o Jota respondeu
// 4. Diagnóstico crítico: Acerto, Falha de UI/UX, Falha de contexto, Falha de dado
const avaliacoes = uteis.map(d => {
  const p = d.pergunta;
  const r = d.resposta || '';
  const tipo = d.tipo_resp;
  
  let status = 'OK';
  let problemas = [];
  
  // Detecção de anomalias
  if (!r || tipo === 'sem_resposta') {
    status = 'SEM_RESPOSTA';
    problemas.push('Robô não respondeu nada.');
  } else if (tipo === 'ia') {
    status = 'CAIU_NA_IA';
    problemas.push('Caiu no modelo de IA genérico (sem resposta determinística com dados exatos).');
  } else if (/Peço desculpas|Não tenho acesso/i.test(r)) {
    status = 'FALHA';
    problemas.push('Robô pediu desculpas ou disse que não tem acesso.');
  }
  
  // Problemas de UX (tamanho excessivo, textão)
  if (r.length > 1200) {
    problemas.push('UI/UX: Resposta excessivamente longa (> 1200 caracteres), vira textão no WhatsApp.');
  }
  
  // Códigos soltos sem nome
  if (/\(\d{2,4}\)\s*·\s*\(\d{2,4}\)/.test(r) || /RCA\s*\d{2,4}(?!\s*-\s*[A-Za-z])/.test(r)) {
    problemas.push('UI/UX: Exibe código de RCA/vendedor solto sem o nome da pessoa.');
  }
  
  // Falha de Negação
  if (/não comprou|sem compra|nao comprou/i.test(p) && !/sem compra|não compraram|ainda não|recuperação/i.test(r)) {
    status = 'ERRO_NEGACAO';
    problemas.push('Dados: Usuário perguntou quem NÃO comprou, mas resposta trouxe quem comprou ou resumo positivo.');
  }
  
  // Falha de Contexto
  if (/^e\b|^\+|quais\??$|deles|dele|dela/i.test(p) && /Brasil|11 filiais/i.test(r) && !/Brasil/i.test(p)) {
    status = 'ERRO_CONTEXTO';
    problemas.push('Contexto: Pergunta de continuação perdeu o escopo e caiu no Brasil inteiro.');
  }

  return {
    id: d.id,
    hora: d.hora ? d.hora.slice(11, 16) : '',
    quem: `${d.nome} (${d.papel} · ${d.filial})`,
    pergunta: p,
    status: status,
    problemas: problemas,
    resposta_tamanho: r.length,
    resposta_inicio: r.slice(0, 140).replace(/\n/g, ' / '),
    resposta_completa: r
  };
});

fs.writeFileSync('scratch/auditoria_completa_perguntas.json', JSON.stringify(avaliacoes, null, 2));

const sumario = {
  total: avaliacoes.length,
  ok: avaliacoes.filter(x => x.status === 'OK' && x.problemas.length === 0).length,
  com_problema_ux: avaliacoes.filter(x => x.problemas.some(p => p.startsWith('UI/UX'))).length,
  caiu_ia: avaliacoes.filter(x => x.status === 'CAIU_NA_IA').length,
  erro_contexto: avaliacoes.filter(x => x.status === 'ERRO_CONTEXTO').length,
  erro_negacao: avaliacoes.filter(x => x.status === 'ERRO_NEGACAO').length
};

console.log('Sumário da Auditoria:', sumario);
