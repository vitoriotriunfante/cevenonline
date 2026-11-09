// TESTE DO PEDIDO DE ACESSO DE SUPERVISOR PELA MENSAGEM (09/11/2026: vendedores viraram supervisor pelo codigo).
// Supervisor pode pedir pela mensagem; vendedor NUNCA (so pelo link do passaporte). Casos reais do dia.
import { cadastraPorCodigo } from '../functions/_lib/jota/persona.js';
globalThis.fetch = async () => ({ json: async () => ({ filiais: { TPH: [{ rca: '93', nome: 'ALAIS APARECIDA TELES' }], API: [{ rca: '283', nome: 'GLACILDA FARIA CRUZ' }, { rca: '27', nome: 'RODRIGO FARIAS' }] } }) });
const ARV = [{ filial: 'MCD', sup_id: '58', sup_nome: 'JONATAS DA SILVA DE OLIVEIRA' }, { filial: 'MCD', sup_id: '93', sup_nome: 'GERENTE MCD' }, { filial: 'API', sup_id: '27', sup_nome: 'RODRIGO FARIAS' }];
const mk = () => ({ DB: { prepare: (sql) => { let b = []; const o = { bind: (...a) => { b = a; return o; }, all: async () => ({ results: /WHERE sup_id IN/.test(sql) ? ARV.filter((r) => b.includes(r.sup_id)) : /arvore_supervisores/.test(sql) ? ARV : [] }), first: async () => null, run: async () => ({}) }; return o; } } });
let falhas = 0;
for (const [txt, esp] of [['Simone schimiloski Código 58', 0], ['Alais Aparecida teles 93', 0], ['Glacilda Faria Cruz-cod 27', 0], ['Glacilda Faria Cruz Código 283', 0], ['Jonatas Oliveira cod 58', 1], ['Rodrigo Farias - 27', 1]]) {
  const r = await cadastraPorCodigo(mk(), '5500000000000', txt, null); const ok = !!r === !!esp; if (!ok) falhas++;
  console.log((ok ? '  ok     - ' : '  FALHOU - ') + txt + ' => ' + (r ? 'pedido de supervisor ' + r.nome : 'nao cadastra'));
}
console.log(falhas ? `CADASTRO: ${falhas} FALHARAM` : 'CADASTRO: todos ok'); process.exit(falhas ? 1 : 0);
