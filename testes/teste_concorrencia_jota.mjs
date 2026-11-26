// Concorrencia QA do JOTA (24 chamadas simultaneas nos 4 papeis)
// Uso: node testes/teste_concorrencia_jota.mjs   (usa env JOTA_CHAVE ou %TEMP%\.tk)
import fs from 'fs';
import path from 'path';

const SITE = process.env.JOTA_URL || 'https://ceven-cftv-matrix.pages.dev';
const CHAVE = (process.env.JOTA_CHAVE || (() => {
  try { return fs.readFileSync(path.join(process.env.TEMP || '', '.tk'), 'utf8'); } catch { return ''; }
})()).trim();
if (!CHAVE) {
  console.error('ERRO: sem JOTA_CHAVE nem %TEMP%\\.tk');
  process.exit(2);
}

const FILIAIS = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];

const BASE_CHAMADAS = [
  // Vendedores (6)
  { c: { nome: 'TAMARA GUEDES', papel: 'vendedor', filial: 'TCV', rca: '352', grupo: null }, p: 'Como estou', rx: /faturad|meta/i },
  { c: { nome: 'PRISCILA DE BONFIM CORDEIRO', papel: 'vendedor', filial: 'TPH', rca: '66', grupo: null }, p: 'Cliven clientes', rx: /cliven|carteira|positiv/i },
  { c: { nome: 'ANDRÉ MARTINS RODRIGUES', papel: 'vendedor', filial: 'TSJ', rca: '25', grupo: null }, p: 'RFV', rx: /rfv|campe|cliente/i },
  { c: { nome: 'EDSON DOS SANTOS MACHADO', papel: 'vendedor', filial: 'TBE', rca: '1094', grupo: null }, p: 'Desvio do mes', rx: /desvio|meta/i },
  { c: { nome: 'VANEZA DE LIMA KVASNEY', papel: 'vendedor', filial: 'TCV', rca: '354', grupo: null }, p: 'FEFO', rx: /acesso gerencial|restrita/i },
  { c: { nome: 'PATRIK SANTOS', papel: 'vendedor', filial: 'ABC', rca: '212', grupo: null }, p: 'Batalha naval', rx: /acesso gerencial|restrita/i },

  // Supervisores (6)
  { c: { nome: 'WASHINGTON FLORES DA ROSA', papel: 'supervisor', filial: 'API', rca: null, grupo: null }, p: 'Como ta minha equipe', rx: /faturad|meta/i },
  { c: { nome: 'EDER LUCAS DAS FLORES DE OLIVEIRA', papel: 'supervisor', filial: 'ABC', rca: null, grupo: null }, p: 'Cliven', rx: /cliven|aproveit|carteira/i },
  { c: { nome: 'IGOR RODRIGUES DUARTE', papel: 'supervisor', filial: 'TBL', rca: null, grupo: null }, p: 'Desvio do mes', rx: /desvio|meta/i },
  { c: { nome: 'JORGE BONI', papel: 'supervisor', filial: 'TCV', rca: null, grupo: null }, p: 'Bloqueados da equipe', rx: /bloquead/i },
  { c: { nome: 'ANDERSON GIOVANI FERREIRA BOLTER', papel: 'supervisor', filial: 'TPA', rca: null, grupo: null }, p: 'DRE', rx: /dre|margem/i },
  { c: { nome: 'WASHINGTON FLORES DA ROSA', papel: 'supervisor', filial: 'API', rca: null, grupo: null }, p: 'Ranking de redes', rx: /rede/i },

  // Gerentes / Gerentes de Grupo (6)
  { c: { nome: 'MARCELO', papel: 'gerente', filial: 'API', rca: null, grupo: null }, p: 'Como ta a filial', rx: /faturad|meta/i },
  { c: { nome: 'DIEGO', papel: 'gerente', filial: 'TBE', rca: null, grupo: null }, p: 'Batalha naval', rx: /batalha|gap/i },
  { c: { nome: 'SALDANHA', papel: 'gerente', filial: 'TSJ', rca: null, grupo: null }, p: 'Carrinho ideal', rx: /carrinho|sku/i },
  { c: { nome: 'VAGNER', papel: 'gerente', filial: 'TPH', rca: null, grupo: 'VAGNER' }, p: 'Desvio do mes', rx: /desvio|meta/i },
  { c: { nome: 'CLEVERSON', papel: 'gerente', filial: 'MCD', rca: null, grupo: 'CLEVERSON' }, p: 'FEFO', rx: /fefo|lote|venc/i },
  { c: { nome: 'ADRIANO', papel: 'gerente', filial: 'MCD', rca: null, grupo: 'ADRIANO' }, p: 'PMI', rx: /pmi|potencial/i },

  // Diretoria (6)
  { c: { nome: 'VITORIO', papel: 'diretoria', filial: null, rca: null, grupo: null }, p: 'Faturado Brasil', rx: /faturad|meta/i },
  { c: { nome: 'VITORIO', papel: 'diretoria', filial: null, rca: null, grupo: null }, p: 'Pedidos Bloqueados abertos por filial', rx: /bloquead/i },
  { c: { nome: 'EVANDRO SERVAT', papel: 'diretoria', filial: null, rca: null, grupo: null }, p: 'Desvio do mes', rx: /desvio|meta/i },
  { c: { nome: 'VITORIO', papel: 'diretoria', filial: null, rca: null, grupo: null }, p: 'Batalha naval', rx: /batalha|gap/i },
  { c: { nome: 'EVANDRO SERVAT', papel: 'diretoria', filial: null, rca: null, grupo: null }, p: 'Ranking de redes', rx: /rede/i },
  { c: { nome: 'VITORIO', papel: 'diretoria', filial: null, rca: null, grupo: null }, p: 'TMF', rx: /tmf|dias/i }
];

const t0 = Date.now();
const results = await Promise.all(BASE_CHAMADAS.map(async (item, i) => {
  const s = Date.now();
  const contato = { ...item.c, celular: `5500088${String(Date.now() % 1e5).padStart(5, '0')}${String(i).padStart(3, '0')}` };
  if (contato.papel === 'diretoria') contato.filiais = [];
  try {
    const res = await fetch(`${SITE}/api/jota-seco`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-chave': CHAVE },
      body: JSON.stringify({ contato, perguntas: [item.p] }),
      signal: AbortSignal.timeout(45000)
    });
    const ms = Date.now() - s;
    const j = res.ok ? await res.json().catch(() => null) : null;
    const resp = Array.isArray(j) ? String(j[0]?.resposta || '') : '';
    const vazouFilial = item.c.papel !== 'diretoria' && item.c.filial
      ? FILIAIS.some((f) => f !== item.c.filial && new RegExp(`\\b${f}\\b`).test(resp))
      : false;
    const ok = res.status === 200 && resp.trim().length > 10 && !/^ERRO/i.test(resp) && item.rx.test(resp) && !vazouFilial;
    return { i, papel: item.c.papel, p: item.p, status: res.status, ms, ok, vazouFilial, trecho: resp.replace(/\n+/g, ' ').slice(0, 120) };
  } catch (e) {
    return { i, papel: item.c.papel, p: item.p, status: 0, ms: Date.now() - s, ok: false, vazouFilial: false, trecho: e.message };
  }
}));

const totalMs = Date.now() - t0;
const lat = results.map((r) => r.ms).sort((a, b) => a - b);
const p50 = lat[Math.floor(lat.length * 0.5)] || 0;
const p95 = lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] || 0;
const oks = results.filter((r) => r.ok).length;

console.log(`=== CONCORRENCIA JOTA: ${oks}/${results.length} OK em ${totalMs} ms ===`);
console.log(`Latencia (ms): min=${lat[0]} · p50=${p50} · p95=${p95} · max=${lat[lat.length - 1]}`);
for (const r of results.filter((x) => !x.ok)) {
  console.log(`FALHA #${r.i} [${r.papel}] "${r.p}" HTTP=${r.status} vazou=${r.vazouFilial}: ${r.trecho}`);
}
process.exit(oks === results.length ? 0 : 1);
