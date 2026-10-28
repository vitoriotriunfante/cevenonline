import fs from 'fs';

const dialogos = JSON.parse(fs.readFileSync('scratch/dialogos_hoje.json', 'utf8'));

// Categorias temáticas
const categorias = {
  'Industria e Produtos': [],
  'Rota, Visitas e Clientes': [],
  'Recorrencia e Tags': [],
  'Vendedor e Equipe': [],
  'Pedidos, Bloqueados e Faturamento': [],
  'Devolucao': [],
  'Liga e Premiacao': [],
  'Contexto e Sequencias': [],
  'Outros': []
};

for (const d of dialogos) {
  const p = (d.pergunta || '').toUpperCase();
  if (/ROTA|VISITA|CLIENTE/.test(p) && !/RECORRENCIA/.test(p)) {
    categorias['Rota, Visitas e Clientes'].push(d);
  } else if (/RECORRENCIA/.test(p)) {
    categorias['Recorrencia e Tags'].push(d);
  } else if (/MONDELEZ|MARS|ARCOR|BAGLEY|CONDOR|FERRERO|NESTLE|HERSHEY|FINI|DORI|PEPSICO|KELLOGG|LACTA|BIS|SNICKERS|TURRON|PRODUTO|SKU|INDUSTRIA/.test(p)) {
    categorias['Industria e Produtos'].push(d);
  } else if (/DEVOLU/.test(p)) {
    categorias['Devolucao'].push(d);
  } else if (/BLOQUEAD|LIBERAD|FATUR|PEDIDO|DIGITAD/.test(p)) {
    categorias['Pedidos, Bloqueados e Faturamento'].push(d);
  } else if (/LIGA|CHAMPIONS|LANCE|GOL|PENALTI|PREMIA|RV|INCENTIVO|110/.test(p)) {
    categorias['Liga e Premiacao'].push(d);
  } else if (/^E\b|^\+|QUAIS\??$|E O MES|E HOJE|DELE|DELA/.test(p)) {
    categorias['Contexto e Sequencias'].push(d);
  } else if (/VENDEDOR|EQUIPE|FILIAL|GERENTE|SUPERVISOR/.test(p)) {
    categorias['Vendedor e Equipe'].push(d);
  } else {
    categorias['Outros'].push(d);
  }
}

const relatorio = [];
for (const [cat, lista] of Object.entries(categorias)) {
  relatorio.push({
    categoria: cat,
    total: lista.length,
    amostras: lista.slice(0, 10).map(x => ({
      hora: x.hora ? x.hora.slice(11, 16) : '',
      nome: x.nome,
      papel: x.papel,
      filial: x.filial,
      pergunta: x.pergunta.replace(/\n/g, ' '),
      tipo: x.tipo_resp,
      tamanho_resposta: x.resposta ? x.resposta.length : 0,
      resposta_resumo: x.resposta ? x.resposta.slice(0, 180).replace(/\n/g, ' / ') : 'SEM RESPOSTA'
    }))
  });
}

fs.writeFileSync('scratch/resumo_auditoria.json', JSON.stringify(relatorio, null, 2));
console.log('Classificação concluída:');
for (const [cat, lista] of Object.entries(categorias)) {
  console.log(`- ${cat}: ${lista.length} perguntas`);
}
