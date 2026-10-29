import { respostaPronta } from '../functions/_lib/jota/entende.js';
import { carregaBaseSync } from '../testes/carrega_base_mock.mjs';

const B = carregaBaseSync();
const contato = {
  nome: 'Priscila Strapasson',
  celular: '5541999999999',
  papel: 'supervisor',
  filial: 'TPH',
  supervisor: 'Priscila Strapasson',
  grupo: 'varejo'
};

async function testar() {
  console.log('--- TESTE 1: Sem compra setor 97 ---');
  const r1 = await respostaPronta(B, contato, 'Sem compra setor 97', []);
  console.log('R1:', r1.slice(0, 200));

  console.log('\n--- TESTE 2: Ver mais (com anterior = "Sem compra setor 97") ---');
  const r2 = await respostaPronta(B, contato, 'Ver mais', ['Sem compra setor 97']);
  console.log('R2:', r2.slice(0, 300));

  console.log('\n--- TESTE 3: ver mais 32 do vendedor ederson ---');
  const r3 = await respostaPronta(B, contato, 'ver mais 32 do vendedor ederson', ['Sem compra setor 97']);
  console.log('R3:', r3.slice(0, 300));
}

testar().catch(console.error);
