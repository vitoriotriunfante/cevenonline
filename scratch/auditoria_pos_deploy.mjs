import path from 'path';
import { fileURLToPath } from 'url';
import { carregaJota } from '../testes/_jota_loader.mjs';

const raiz = process.cwd();
const J = await carregaJota(raiz);
const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {});

const testes = [
  {
    nome: '1. Caso Mars / Fabio Sereia (Negação de Indústria)',
    perfil: { nome: 'VITORIO', papel: 'diretoria', filial: 'TBL', supervisor: null },
    pergunta: 'quem não comprou Mars em TBL do vendedor Fabio Sereia?',
    deveConter: ['Recuperação — Masterfoods Brasil Alimentos', '550 - Fabio Sereia (varejo)', '43 clientes', 'Dimax Distribuidora'],
    naoPodeConter: ['Faturado:', 'SKUs que mais positivam', '1.027 clientes']
  },
  {
    nome: '2. Caso Produto Sem / Marcia (Eliminação de falso positivo)',
    perfil: { nome: 'WASHINGTON FLORES DA ROSA', papel: 'supervisor', filial: 'API', supervisor: 'WASHINGTON FLORES DA ROSA' },
    pergunta: 'clientes sem compra da vendedora Marcia',
    deveConter: ['Curva negativa — 244 - Marcia Martins Goncalves', 'ainda não compraram: 74', 'Cezar E Pra Ltda Me'],
    naoPodeConter: ['📦 *Sem*', 'preço médio R$ 7/un']
  },
  {
    nome: '3. Caso Ficha do Vendedor Ivan TBL (Redução de textão)',
    perfil: { nome: 'IGOR RODRIGUES DUARTE', papel: 'supervisor', filial: 'TBL', supervisor: 'IGOR RODRIGUES DUARTE' },
    pergunta: 'Como esta o vendedor Ivan da filial TBL ?',
    deveConter: ['186 - Ivan Fagundes Da Silva', 'Faturado:', 'Positivação:', 'Faltam 18 positivações'],
    naoPodeConter: ['Supermercado Labaski Ltda', 'Supermercado Criolo', 'Mercearia Centro'], // Clientes nominais só no "ver mais"
    maxTamanho: 1100
  },
  {
    nome: '4. Caso Sequência "ver mais" após Ivan',
    perfil: { nome: 'IGOR RODRIGUES DUARTE', papel: 'supervisor', filial: 'TBL', supervisor: 'IGOR RODRIGUES DUARTE' },
    pergunta: 'ver mais',
    anteriores: ['Como esta o vendedor Ivan da filial TBL ?'],
    deveConter: ['Faltam 18 positivações', 'Na rota de hoje e sem compra', 'Mercearia Centro', 'Já visitados no mês e sem compra'],
    naoPodeConter: ['Faturado: *R$', 'Liga: 148º']
  },
  {
    nome: '5. Caso Recorrência Ivayr TCA (Abertura por vendedor com nomes)',
    perfil: { nome: 'IVAYR PRINCIPE FREITAS DE MIRANDA', papel: 'supervisor', filial: 'TCA', supervisor: 'IVAYR PRINCIPE FREITAS DE MIRANDA' },
    pergunta: 'Só quero saber quantos clientes eu tenho no mês de outubro com tag recorrência',
    deveConter: ['Recorrência — Equipe Ivayr Miranda', '*99 clientes* com a tag RECORRÊNCIA', 'Mega Plus Confeitaria — *378 - Moises Gaspar', 'Recorrência por vendedor:', '378 - Moises Gaspar'],
    naoPodeConter: ['(378) · Supermercado Modelo (410)', 'peça "recorrência por vendedor" para abrir']
  }
];

console.log('=====================================================');
console.log('🔬 AUDITORIA COMPLETA DE VALIDAÇÃO PÓS-DEPLOY');
console.log('=====================================================\n');

let total = testes.length;
let ok = 0;

for (const t of testes) {
  console.log(`▶️ Executando: ${t.nome}`);
  const resp = String(await J._teste.respostaPronta(B, t.perfil, t.pergunta, t.anteriores || []));
  const tam = resp.length;
  
  const faltou = (t.deveConter || []).filter(item => !resp.includes(item));
  const sobrou = (t.naoPodeConter || []).filter(item => resp.includes(item));
  const estourou = t.maxTamanho && tam > t.maxTamanho;

  if (!faltou.length && !sobrou.length && !estourou) {
    ok++;
    console.log(`   ✅ PASSOU! (Tamanho: ${tam} caracteres)`);
  } else {
    console.log(`   ❌ FALHOU!`);
    if (faltou.length) console.log(`      Faltou conter: ${faltou.join(' | ')}`);
    if (sobrou.length) console.log(`      Não podia conter: ${sobrou.join(' | ')}`);
    if (estourou) console.log(`      Estourou tamanho: ${tam} > ${t.maxTamanho}`);
  }
  console.log(`   Amostra da resposta:\n   ${resp.slice(0, 150).replace(/\n/g, ' / ')}...\n`);
}

J.limpa();
console.log('=====================================================');
console.log(`RESULTADO DA AUDITORIA: ${ok} de ${total} testes passaram (${Math.round(ok / total * 100)}%)`);
console.log('=====================================================');
