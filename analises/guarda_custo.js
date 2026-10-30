/**
 * FICHA DO ARQUIVO: analises/guarda_custo.js — GUARDA DE CUSTO DA CLOUDFLARE
 * POR QUÊ: conta de US$ 170 em out/2026. Vitório, 25/10/2026: "aceito gastar até uns 20 dólares... no máximo do máximo do máximo".
 *          A Cloudflare não tem teto de gasto (o billing notification só avisa), então o teto é nosso:
 *   - lê o consumo REAL do mês (API de analytics, token só leitura CF_API_TOKEN) e projeta até o fim do mês;
 *   - projeção > US$ 10 → WhatsApp para o Vitório com o que está pesando;
 *   - projeção > US$ 15 → LIGA O FREIO (/api/custo-freio): as rotinas da TV rodam a cada 30 min o dia todo (como de madrugada);
 *   - projeção < US$ 12 → solta o freio (no mês novo a projeção recomeça e ele solta sozinho).
 * PREÇOS (Workers Paid, out/2026): US$ 5 fixos; requisições 10 mi inclusas + US$ 0,30/mi; D1 linhas lidas 25 bi + US$ 0,001/mi;
 *   D1 linhas gravadas 50 mi + US$ 1,00/mi; D1 armazenamento 5 GB + US$ 0,75/GB. Mês = mês do calendário (aproximação do ciclo de cobrança).
 * RODA: workflow guarda-custo.yml (08h e 20h de Brasília). Manual (--relatorio) sempre manda o relatório no WhatsApp.
 */
const R = require('../public/regras.js');

const TOKEN = process.env.CF_API_TOKEN;
const D1_ID = '6112e60c-3546-41dd-aae1-ef44958596b7';
const SITE = process.env.SITE || 'https://ceven-cftv-matrix.pages.dev';
const VITORIO = '5541987525605';
const AVISO = 10, FREIO = 15, SOLTA = 12;
const RELATORIO = process.argv.includes('--relatorio');

const cf = async (caminho, opt = {}) => {
  const r = await fetch('https://api.cloudflare.com/client/v4' + caminho, { ...opt, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok || (j && j.errors && j.errors.length)) throw new Error(`${caminho}: HTTP ${r.status} ${JSON.stringify(j && j.errors || j).slice(0, 300)}`);
  return j;
};
const gql = async (query, variables) => {
  const j = await cf('/graphql', { method: 'POST', body: JSON.stringify({ query, variables }) });
  return j.data;
};
const mi = (n) => (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const usd = (n) => 'US$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  if (!TOKEN) throw new Error('segredo CF_API_TOKEN ausente');
  // conta: a que tem o banco do projeto
  // conta das Pages/D1 do projeto (não é segredo; token pessoal nem sempre lista contas)
  const conta = { id: process.env.CF_ACCOUNT_ID || 'bd949e0c32a033372ff64b74521e2fe1' };
  let banco;
  try { banco = (await cf(`/accounts/${conta.id}/d1/database/${D1_ID}`)).result; }
  catch (e) {
    let v = ''; try { v = JSON.stringify((await cf('/user/tokens/verify')).result); } catch (e2) { v = 'token inválido: ' + e2.message; }
    throw new Error(`o token não lê o banco D1 (${e.message}). Token: ${v}. Confira as permissões Account Analytics Read + D1 Read e se a conta escolhida em "Account Resources" é a ${conta.id}.`);
  }

  const c = R.relogioSP();
  const [ano, mes, dia] = c.dia.split('-').map(Number);
  // Ciclo da Cloudflare: o plano Paid do Vitório fecha todo dia 25 (período "Nov 2026" no painel = 25/10 a 24/11)
  const DIA_CICLO = Number(process.env.CF_BILLING_CYCLE_DAY || 25);
  let iniAno = ano, iniMes = mes;
  let fimAno = ano, fimMes = mes + 1;
  if (dia < DIA_CICLO) {
    iniMes = mes - 1;
    if (iniMes === 0) { iniMes = 12; iniAno = ano - 1; }
    fimMes = mes;
  } else {
    if (fimMes === 13) { fimMes = 1; fimAno = ano + 1; }
  }
  const ini = `${iniAno}-${String(iniMes).padStart(2, '0')}-${String(DIA_CICLO).padStart(2, '0')}`;
  const dtIni = new Date(Date.UTC(iniAno, iniMes - 1, DIA_CICLO));
  const dtFim = new Date(Date.UTC(fimAno, fimMes - 1, DIA_CICLO));
  const diasCiclo = Math.round((dtFim - dtIni) / 864e5);
  const decorrido = Math.max(0, (Date.now() - dtIni.getTime()) / 864e5);
  const nomeCiclo = `${String(fimMes).padStart(2, '0')}/${fimAno}`;

  const d = await gql(`query ($conta: string!, $ini: Date!, $fim: Date!) { viewer { accounts(filter: { accountTag: $conta }) {
      d1: d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $ini, date_leq: $fim }) { dimensions { date } sum { readQueries writeQueries rowsRead rowsWritten } }
      w: workersInvocationsAdaptive(limit: 10000, filter: { date_geq: $ini, date_leq: $fim }) { dimensions { date } sum { requests } }
    } } }`, { conta: conta.id, ini, fim: new Date().toISOString().slice(0, 10) });
  const a = d.viewer.accounts[0] || {};
  const soma = (lista, campo) => (lista || []).reduce((s, x) => s + Number((x.sum || {})[campo] || 0), 0);
  const uso = { lidas: soma(a.d1, 'rowsRead'), gravadas: soma(a.d1, 'rowsWritten'), req: soma(a.w, 'requests'), gb: Number(banco.file_size || 0) / 1e9 };
  // RITMO DE AGORA (o freio olha isto): últimas 24 h (dia UTC de hoje + parte proporcional de ontem) × 30. O que já foi gasto no mês não volta;
  // se o freio olhasse a média do mês, um estouro antigo (o de antes de 25/10) deixaria o freio ligado o mês inteiro sem motivo.
  const agoraUtc = new Date(), hojeUtc = agoraUtc.toISOString().slice(0, 10), ontemUtc = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const fracHoje = (agoraUtc.getUTCHours() * 60 + agoraUtc.getUTCMinutes()) / 1440;
  const doDia = (lista, campo, dd) => (lista || []).filter((x) => x.dimensions && x.dimensions.date === dd).reduce((s, x) => s + Number((x.sum || {})[campo] || 0), 0);
  const ult24 = (lista, campo) => doDia(lista, campo, hojeUtc) + doDia(lista, campo, ontemUtc) * (1 - fracHoje);
  const proj = { lidas: ult24(a.d1, 'rowsRead') * 30, gravadas: ult24(a.d1, 'rowsWritten') * 30, req: ult24(a.w, 'requests') * 30, gb: uso.gb };
  // fatura do ciclo atual (já usado + ritmo de agora até o fim do ciclo)
  const resta = Math.max(0, diasCiclo - decorrido) / 30;
  const custoDe = (p) => 5 + Math.max(0, p.req - 10e6) / 1e6 * 0.30 + Math.max(0, p.lidas - 25e9) / 1e6 * 0.001 + Math.max(0, p.gravadas - 50e6) / 1e6 * 1.00 + Math.max(0, uso.gb - 5) * 0.75;
  const fatura = custoDe({ lidas: uso.lidas + proj.lidas * resta, gravadas: uso.gravadas + proj.gravadas * resta, req: uso.req + proj.req * resta });
  const extra = {
    'requisições': Math.max(0, proj.req - 10e6) / 1e6 * 0.30,
    'D1 linhas lidas': Math.max(0, proj.lidas - 25e9) / 1e6 * 0.001,
    'D1 linhas gravadas': Math.max(0, proj.gravadas - 50e6) / 1e6 * 1.00,
    'D1 armazenamento': Math.max(0, proj.gb - 5) * 0.75,
  };
  const total = 5 + Object.values(extra).reduce((s, x) => s + x, 0);
  const pesa = Object.entries(extra).sort((x, y) => y[1] - x[1]).filter((x) => x[1] > 0);
  const linhas = [
    `💰 *Guarda de custo Cloudflare* — ${c.dia.split('-').reverse().join('/')} ${c.hm}`,
    `Ritmo de agora (últimas 24 h × 30): *${usd(total)}/mês* (teto: US$ 20 · aviso: US$ ${AVISO} · freio: US$ ${FREIO})`,
    `Fatura do ciclo ${nomeCiclo} (já usado + ritmo de agora até o fim do ciclo): *${usd(fatura)}*`,
    '',
    `• Requisições: ${mi(uso.req)} mi no ciclo · ritmo ${mi(proj.req)} mi/mês (10 mi inclusas)`,
    `• D1 linhas gravadas: ${mi(uso.gravadas)} mi no ciclo · ritmo ${mi(proj.gravadas)} mi/mês (50 mi inclusas)`,
    `• D1 linhas lidas: ${mi(uso.lidas)} mi no ciclo · ritmo ${mi(proj.lidas)} mi/mês (25.000 mi inclusas)`,
    `• D1 armazenamento: ${uso.gb.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB (5 GB inclusos)`,
    pesa.length ? `\nO que pesa no ritmo de agora: ${pesa.map(([k, v]) => `${k} (+${usd(v)})`).join(', ')}` : '\nNo ritmo de agora, tudo dentro do plano de US$ 5.',
    fatura > 20 ? `\n⚠️ A fatura deste ciclo projeta passar de US$ 20. O freio segura os consumos pesados automaticamente.` : '',
  ].filter((x) => x !== '');
  console.log(linhas.join('\n'));

  // freio
  let freio = null;
  try { freio = await (await fetch(SITE + '/api/custo-freio')).json(); } catch (e) {}
  const ligado = !!(freio && freio.ligado);
  const mexeFreio = async (ligar) => {
    const r = await fetch(SITE + '/api/custo-freio', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Evo-Key': process.env.EVO_KEY || '' }, body: JSON.stringify({ ligado: ligar, projecao: Math.round(total * 100) / 100 }) });
    if (!r.ok) throw new Error('não consegui mexer no freio: HTTP ' + r.status);
  };
  let acao = '';
  if (total > FREIO && !ligado) { await mexeFreio(true); acao = `\n🛑 *FREIO LIGADO*: as rotinas da TV passam a rodar a cada 30 min o dia todo até a projeção voltar para baixo de US$ ${SOLTA}.`; }
  else if (total < SOLTA && ligado) { await mexeFreio(false); acao = '\n✅ Freio solto: projeção voltou ao normal.'; }
  else if (ligado) acao = '\n🛑 Freio continua ligado.';
  if (acao) console.log(acao);

  if (RELATORIO || total > AVISO || acao) {
    const cfg = { url: process.env.EVO_URL, key: process.env.EVO_KEY, instancia: process.env.EVO_INSTANCE || 'ceven-noc' };
    const r = await R.enviarTexto(cfg, VITORIO, linhas.join('\n') + acao + (RELATORIO && total <= AVISO ? '\n\n_(relatório pedido manualmente; nos dias normais só aviso se passar de US$ ' + AVISO + ')_' : ''));
    console.log(r.ok ? '📲 WhatsApp enviado ao Vitório' : '⚠️ WhatsApp não saiu: ' + (r.erro || r.status));
  }
}
main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
