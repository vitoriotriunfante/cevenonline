import { carregaJota } from '../testes/_jota_loader.mjs';

const J = await carregaJota('.');
const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {});

async function testar() {
  console.log('=================== TESTE 1: PRISCILA (VER MAIS & PAGINAÇÃO) ===================');
  const cPriscila = { papel: 'supervisor', filial: 'TPH', nome: 'Priscila Strapasson', supervisor: 'Priscila Strapasson' };
  const r1 = await J._teste.respostaPronta(B, cPriscila, 'Sem compra setor 97', []);
  console.log('R1 (25 clientes):', r1.split('\n').slice(0, 5).join('\n'), '... total linhas:', r1.split('\n').length);
  const r2 = await J._teste.respostaPronta(B, cPriscila, 'Ver mais', ['Sem compra setor 97']);
  console.log('R2 (expandido):', r2.split('\n').slice(0, 8).join('\n'), '... total linhas:', r2.split('\n').length);
  const r3 = await J._teste.respostaPronta(B, cPriscila, 'ver mais 32 do vendedor ederson', ['Sem compra setor 97']);
  console.log('R3 (ver mais 32):', r3.split('\n').slice(0, 8).join('\n'));

  console.log('\n=================== TESTE 2: AILTON COD 1037 (SALA DE VENDAS TODA) ===================');
  const cAilton = { papel: 'supervisor', filial: 'TPH', nome: 'Ailton Luiz Arendt Junior', supervisor: 'Ailton Luiz Arendt Junior' };
  const rAilton = await J._teste.respostaPronta(B, cAilton, 'Equipe', []);
  console.log('R Ailton Equipe:\n' + rAilton.split('\n').slice(0, 10).join('\n'));

  console.log('\n=================== TESTE 3: ALEX SANDRO (MEU TIME HOJE) ===================');
  const cAlex = { papel: 'supervisor', filial: 'TBE', nome: 'Alex Elias', supervisor: 'Alex Elias' };
  const rAlex = await J._teste.respostaPronta(B, cAlex, 'Oi , como está o meu time hoje?', []);
  console.log('R Alex Time Hoje:', rAlex.split('\n').slice(0, 6).join('\n'));

  console.log('\n=================== TESTE 4: WASHINGTON (POSITIVADOS EM SETEMBRO) ===================');
  const cWash = { papel: 'supervisor', filial: 'API', nome: 'Washington Rosa', supervisor: 'Washington Rosa' };
  const rWash = await J._teste.respostaPronta(B, cWash, 'Clientes positivados em setembro,  vendedora Ana , todos', []);
  console.log('R Washington Setembro:', rWash.split('\n').slice(0, 10).join('\n'), '... total linhas:', rWash.split('\n').length);

  console.log('\n=================== TESTE 5: JONATHAN (RECORRÊNCIA REGRAS & LISTA) ===================');
  const cJon = { papel: 'supervisor', filial: 'TPH', nome: 'Jonathan Fernandes', supervisor: 'Jonathan Fernandes' };
  const rRegra = await J._teste.respostaPronta(B, cJon, 'como o cliente é escolhido para recorrência', []);
  console.log('R Jonathan Regra:', rRegra);
  const rLista124 = await J._teste.respostaPronta(B, cJon, 'listagem completa dos cliente recorrência desse mês do vendedor 124', []);
  console.log('\nR Jonathan Lista 124:', rLista124.split('\n').slice(0, 15).join('\n'));
  const rMetaRec = await J._teste.respostaPronta(B, cJon, 'qual a minha meta de recorrência?', []);
  console.log('\nR Jonathan Meta Recorrência:', rMetaRec.split('\n').slice(0, 15).join('\n'));
}

testar().catch(console.error).finally(() => J.limpa());
