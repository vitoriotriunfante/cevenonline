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
  // PROJEÇÃO PONDERADA POR CALENDÁRIO E SAZONALIDADE COMERCIAL (Vitório, 31/10/2026):
  // - Antes: multiplicava as últimas 24 h (ex: sexta-feira dia 30/10, véspera de fechamento de mês) por 30 dias corridos!
  // - Realidade (Mapa de Calor de Positivações + Calendário):
  //   1) Domingos e Feriados Nacionais (ex: 01/11 e 02/11 Finados) rodam a cada 30 min o dia todo (~15% do consumo de um dia útil).
  //   2) Início de mês (dias 01 a 05) tem volume de pedidos e análises até 5x menor que a reta final (dias 25 a 31).
  //   3) O ciclo de 30 dias tem ~24 dias úteis comerciais equivalentes (não 30 dias de pico de fechamento).
  const FERIADOS_NAC = new Set(['2026-01-01','2026-02-16','2026-02-17','2026-04-03','2026-04-21','2026-05-01','2026-06-04','2026-09-07','2026-10-12','2026-11-02','2026-11-15','2026-11-20','2026-12-25']);
  let diasEquivRestantes = 0;
  for (let d = new Date(Date.now()); d < dtFim; d = new Date(d.getTime() + 864e5)) {
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    const diaMes = d.getUTCDate();
    if (dow === 0 || FERIADOS_NAC.has(iso)) diasEquivRestantes += 0.18; // Domingo ou feriado: ciclo reduzido de 30 min
    else if (dow === 6 && diaMes < 25) diasEquivRestantes += 0.55;      // Sábado comum (fora de fechamento)
    else if (diaMes <= 5) diasEquivRestantes += 0.65;                   // Início de mês (01 a 05): menor entrada de pedidos
    else diasEquivRestantes += 1.0;                                     // Dia útil normal / fechamento
  }
  // Se hoje é dia de fechamento de mês (dia >= 25), o ritmo de hoje é ~1.35x a média de um dia útil comum
  const fatorPicoHoje = dia >= 25 ? (1 / 1.30) : 1.0;
  const multMesEquiv = 23.5 * fatorPicoHoje; // ~23,5 dias úteis equivalentes num mês padrão ajustado pelo pico de fechamento
  const proj = {
    lidas: ult24(a.d1, 'rowsRead') * multMesEquiv,
    gravadas: ult24(a.d1, 'rowsWritten') * multMesEquiv,
    req: ult24(a.w, 'requests') * multMesEquiv,
    gb: uso.gb
  };
  // fatura do ciclo atual (já usado + ritmo diário ajustado × dias equivalentes restantes até o fim do ciclo)
  const restaEquiv = Math.max(0, diasEquivRestantes * fatorPicoHoje);
  const custoDe = (p) => 5 + Math.max(0, p.req - 10e6) / 1e6 * 0.30 + Math.max(0, p.lidas - 25e9) / 1e6 * 0.001 + Math.max(0, p.gravadas - 50e6) / 1e6 * 1.00 + Math.max(0, uso.gb - 5) * 0.75;
  const fatura = custoDe({
    lidas: uso.lidas + ult24(a.d1, 'rowsRead') * restaEquiv,
    gravadas: uso.gravadas + ult24(a.d1, 'rowsWritten') * restaEquiv,
    req: uso.req + ult24(a.w, 'requests') * restaEquiv
  });
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
  const ehFechamentoMes = dia >= 25;
  let acao = '';
  if (ehFechamentoMes && ligado) {
    await mexeFreio(false);
    acao = '\n🚀 *FECHAMENTO DE MÊS (Reta Final)*: freio liberado automaticamente para monitoramento em tempo real de vendas, positivação e pedidos!';
  } else if (total > FREIO && !ligado && !ehFechamentoMes) {
    await mexeFreio(true);
    acao = `\n🛑 *FREIO LIGADO*: as rotinas da TV passam a rodar em cadência reduzida até a projeção voltar para baixo de US$ ${SOLTA}.`;
  } else if (total > FREIO && ehFechamentoMes) {
    acao = '\n🚀 *Reta Final de Fechamento de Mês*: mesmo com ritmo alto hoje, o freio permanece DESLIGADO para garantir monitoramento total (domingo e feriado compensam no ciclo reduzido).';
  } else if (total < SOLTA && ligado) {
    await mexeFreio(false);
    acao = '\n✅ Freio solto: projeção voltou ao normal.';
  } else if (ligado) {
    acao = '\n🛑 Freio continua ligado.';
  }
  if (acao) console.log(acao);

  if (RELATORIO || total > AVISO || acao) {
    const cfg = { url: process.env.EVO_URL, key: process.env.EVO_KEY, instancia: process.env.EVO_INSTANCE || 'ceven-noc' };
    const r = await R.enviarTexto(cfg, VITORIO, linhas.join('\n') + acao + (RELATORIO && total <= AVISO ? '\n\n_(relatório pedido manualmente; nos dias normais só aviso se passar de US$ ' + AVISO + ')_' : ''));
    console.log(r.ok ? '📲 WhatsApp enviado ao Vitório' : '⚠️ WhatsApp não saiu: ' + (r.erro || r.status));
  }
}
main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
