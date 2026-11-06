import fs from 'fs';
import { resolverIndustria } from './dicionario_industrias.js';

const base = JSON.parse(fs.readFileSync('pipeline/base_historica_gerot.json', 'utf-8'));

export function consultarIndustriaHistorico(termo) {
  const alvo = resolverIndustria(termo);
  console.log(`\n🔎 Termo buscado: "${termo}" -> Mapeado para: "${alvo}"`);

  const meses = ['2026-08', '2026-09', '2026-10', '2026-11'];
  const resultado = [];

  for (const cod of meses) {
    const dadosMes = base.meses[cod];
    if (!dadosMes) continue;

    // Procurar fornecedor na lista
    const item = dadosMes.fornecedores.find(f => 
      f.fornecedor.toUpperCase().includes(alvo.toUpperCase())
    );

    if (item) {
      resultado.push({
        mes: dadosMes.mes,
        fornecedorOficial: item.fornecedor,
        mediaPonderada: item.mediaPonderada,
        faturado: item.faturado,
        faturadoCarteira: item.faturadoCarteira,
        captacao: item.captacao,
        positivacao: item.positivacao,
        mix: item.mix,
        devolucao: item.devolucao,
        cortes: item.cortes
      });
    }
  }

  return resultado;
}

// Testes rápidos com o que o usuário pediu:
console.log('--- TESTE 1: "MP" (Marcas Próprias Triunfante) ---');
console.table(consultarIndustriaHistorico('MP'));

console.log('--- TESTE 2: "Baly" (Bebidas Grassi) ---');
console.table(consultarIndustriaHistorico('baly'));

console.log('--- TESTE 3: "Mars" (Masterfoods) ---');
console.table(consultarIndustriaHistorico('mars'));

console.log('--- TESTE 4: "Ferrero" ---');
console.table(consultarIndustriaHistorico('ferrero'));

