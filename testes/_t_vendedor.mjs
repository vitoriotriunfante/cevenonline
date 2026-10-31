// teste rapido: conversa tipica do VENDEDOR em sequencia (Vitorio, 31/10/2026: "ele pergunta a curva negativa... aparece um cliente... vai querer saber o que vendeu e o que oferecer")
// uso: node testes/_t_vendedor.mjs <filial> <rca> <NOME>
import path from 'path'; import { fileURLToPath } from 'url'; import { execSync } from 'child_process';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = await carregaJota(raiz);
const U = 'https://ceven-cftv-matrix.pages.dev';
const [filial, rca, nome] = process.argv.slice(2);
const c = { nome, papel: 'vendedor', filial, rca };
// le o D1 de producao so para historico_cliente (como o bot faz, pela chave primaria)
const DB = { prepare: (sql) => ({ bind: (...a) => ({ first: async () => { if (!/FROM historico_cliente/.test(sql)) return null; const s = `SELECT json, atualizado_em FROM historico_cliente WHERE filial='${a[0]}' AND id_cliente='${a[1]}'`; return JSON.parse(execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --json --command "${s}"`, { maxBuffer: 1 << 26 }).toString())[0].results[0] || null; }, run: async () => ({}), all: async () => ({ results: [] }) }), first: async () => null, run: async () => ({}), all: async () => ({ results: [] }) }) };
const pergunta = async (q, ant, ult) => { const B = J._teste.criaBase(U, { DB });B.ultOut = ult || null; let r; try { r = await J._teste.respostaPronta(B, c, q, ant); } catch (e) { r = 'ERRO ' + e.message; } return r == null ? null : String(r); };
const curva = await pergunta('curva negativa', [], null);
console.log('==== curva negativa\n' + String(curva).slice(0, 420));
const linha = String(curva).split('\n').find((l) => / · .*(dias|\+60)/.test(l)) || '';
const cli = linha.split(' · ')[0];
console.log('\n[cliente da lista: ' + cli + ']');
const seq = [cli, 'o que ele comprou?', 'o que oferecer?', 'últimos pedidos dele', `o que oferecer para ${cli}`, `histórico do cliente ${cli}`, 'meus últimos pedidos', 'meu check-in de hoje', 'prospects', 'minha rota hoje', '+mix', 'como estou'];
let ant = ['curva negativa'], ult = curva;
for (const q of seq) { const r = await pergunta(q, ant, ult); console.log(`\n==== ${q}\n${r == null ? 'SEM RESPOSTA PRONTA (cai na IA)' : r.slice(0, 300)}`); ant = [q, ...ant].slice(0, 4); if (r) ult = r; }
J.limpa();
