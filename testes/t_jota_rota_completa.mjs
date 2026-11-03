import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregaJota } from './_jota_loader.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = await carregaJota(raiz);
const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dataUltimaCompra = new Date(Date.parse(`${hoje}T12:00:00Z`) - 84 * 864e5).toISOString().slice(0, 10);
const hojeNumero = Number(hoje.replace(/-/g, ''));
const clientes = [
  { id_cliente: '1001', nome_cliente: 'Mercearia Sao Francisco', cnpj: '11111111111111', data_visita: hoje, data_ultima_compra: hoje, status: 'ABERTO', focos: [] },
  { id_cliente: '1002', nome_cliente: 'Mercado Berte', cnpj: '22222222222222', data_visita: hoje, status: 'ABERTO', focos: [] }
];
const fichas = [
  { id_cliente: '1001', ultima_compra: dataUltimaCompra },
  { id_cliente: '1002', ultima_compra: hoje }
];
const DB = {
  prepare(sql) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async all() {
        if (!sql.includes('FROM ficha_cliente')) return { results: [] };
        const ids = new Set(args.slice(1).map(String));
        return { results: fichas.filter((f) => ids.has(f.id_cliente)) };
      }
    };
  }
};
const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', { DB });
B.snap = async () => ({
  rcas: {
    '352': {
      dashboard: { financeiro: {}, positivacao: {} },
      produtividade: { dia: {}, mes: {} },
      roteiro: clientes
    }
  }
});
B.mostra = async () => ({
  filiais: {
    TCV: [{ rca: '352', nome: 'TAMARA GUEDES', supervisor: 'SUPERVISOR', sup_cod: '543', canal: 'VJ', gerente: 'GERENTE', mostra: true }]
  }
});
B.raw = async (arquivo) => {
  if (arquivo === 'public/vendas_mes/TCV.json') {
    return JSON.stringify({ ate: hoje, l: [[hojeNumero, '352', '1002', '888', 1, 123.45]] });
  }
  if (arquivo === 'public/mix_hist/TCV.json') return JSON.stringify({ c: {} });
  return null;
};

try {
  assert.equal(J._teste.podeUsarIAPraEstrategia(
    'diretoria',
    'Como está a rota da vendedora 352 de TCV hoje?'
  ), false);
  assert.equal(J._teste.podeUsarIAPraEstrategia(
    'gerente',
    'Qual plano de ação para melhorar a positivação da equipe?'
  ), true);
  assert.equal(J._teste.podeUsarIAPraEstrategia(
    'vendedor',
    'Qual plano de ação para melhorar a positivação da equipe?'
  ), false);

  const resposta = String(await J._teste.respostaPronta(
    B,
    { nome: 'VITORIO', papel: 'diretoria', filial: null },
    'Como está a rota da vendedora 352 de TCV hoje?',
    []
  ));
  assert.match(resposta, /rota de hoje: \*2 clientes\*/i);
  assert.match(resposta, /Mercearia Sao Francisco/);
  assert.match(resposta, /84 dias sem compra/);
  assert.match(resposta, /Mercado Berte/);
  assert.match(resposta, /Já compraram no mês/);
  assert.doesNotMatch(resposta, /visitas \d+ de \d+|zerados|faturado|plano de ação/i);
  console.log('ok — rota é determinística; IA restrita a pedidos explícitos de estratégia de gerência/diretoria');
} finally {
  J.limpa();
}
