// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: painel gerencial dos SUPERVISORES na semana (Vitório, 06/10/2026): para cada supervisor, de segunda a sexta,
//          fez / não fez o compromisso matinal (até 10h) e a rota (RET). Alimenta a tela da Matriz e a da filial.
// PROJETO: CFTV/TV. LÊ: CEVEN /api/admin/login + matriz-compromissos e matriz-ret (um período de segunda a sexta, todas as filiais).
// PARÂMETROS: ?filial=SIG (opcional; vazio = todas) · ?semana=AAAA-MM-DD (qualquer dia da semana; padrão = hoje) · ?debug=1 (amostra crua)
// REGRA: nunca inventa dado. Dia futuro = null (a tela mostra "—"); feriado nacional = 'feriado'; sem resposta do CEVEN = erro.
// =========================================================================
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const FERIADOS = ['2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25'];
let cacheTk = { token: null, exp: 0 };
let cacheDados = { chave: '', exp: 0, corpo: null };

async function token(env) {
  if (cacheTk.token && Date.now() < cacheTk.exp) return cacheTk.token;
  const r = await fetch(`${CEVEN}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ username: env.CEVEN_ADMIN_USER, password: env.CEVEN_ADMIN_PASS }), signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.access_token) return null;
  cacheTk = { token: j.access_token, exp: Date.now() + 10 * 60 * 1000 };
  return cacheTk.token;
}
async function getJson(url, tk) {
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
const limpa = (n) => String(n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();
const iso = (d) => d.toISOString().slice(0, 10);

function hojeBrt() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return `${p.year}-${p.month}-${p.day}`;
}
// segunda a sexta da semana que contem 'ref' (AAAA-MM-DD)
function diasDaSemana(ref) {
  const d = new Date(ref + 'T12:00:00Z');
  const dow = d.getUTCDay() || 7; // 1=segunda ... 7=domingo
  const seg = new Date(d.getTime() - (dow - 1) * 86400000);
  return Array.from({ length: 5 }, (_, i) => iso(new Date(seg.getTime() + i * 86400000)));
}
const feitoNoDia = (s, i) => !!(s && ((s.porDia && s.porDia[i]) || (s.dias && s.dias[i])));

export async function onRequestGet({ request, env }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  const url = new URL(request.url);
  const filial = (url.searchParams.get('filial') || '').toLowerCase().replace(/1$/, '');
  const hoje = hojeBrt();
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('semana') || '') ? url.searchParams.get('semana') : hoje;
  const debug = url.searchParams.has('debug');
  if (filial && !/^[a-z]{3}$/.test(filial)) return new Response(JSON.stringify({ erro: 'filial (sigla) invalida' }), { status: 400, headers: cors });
  if (!env.CEVEN_ADMIN_USER || !env.CEVEN_ADMIN_PASS) return new Response(JSON.stringify({ erro: 'segredos não configurados' }), { status: 503, headers: cors });

  const dias = diasDaSemana(ref);
  const chave = dias[0] + '|' + (debug ? 'd' : '');
  let comp, ret;
  if (!debug && cacheDados.chave === chave && Date.now() < cacheDados.exp) ({ comp, ret } = cacheDados.corpo);
  else {
    const tk = await token(env);
    if (!tk) return new Response(JSON.stringify({ erro: 'login no CEVEN falhou' }), { status: 502, headers: cors });
    [comp, ret] = await Promise.all([
      getJson(`${CEVEN}/api/admin/supervisores/matriz-compromissos?dataInicio=${dias[0]}&dataFim=${dias[4]}`, tk),
      getJson(`${CEVEN}/api/admin/supervisores/matriz-ret?dataInicio=${dias[0]}&dataFim=${dias[4]}`, tk)
    ]);
    if (!comp || !ret) return new Response(JSON.stringify({ erro: 'CEVEN não respondeu (compromissos/RET)' }), { status: 502, headers: cors });
    cacheDados = { chave, exp: Date.now() + 3 * 60 * 1000, corpo: { comp, ret } };
  }
  if (debug) {
    const a = (comp.supervisores || [])[0], b = (ret.supervisores || [])[0];
    return new Response(JSON.stringify({ dias, chaves_comp: Object.keys(comp), exemplo_comp: a, chaves_ret: Object.keys(ret), exemplo_ret: b }), { headers: cors });
  }

  const estadoDia = (data) => (FERIADOS.includes(data) ? 'feriado' : data > hoje ? 'futuro' : 'passado');
  const porFilial = {};
  for (const s of comp.supervisores || []) {
    const sig = String(s.filial || '').replace(/1$/, '').toUpperCase();
    if (!sig || (filial && sig.toLowerCase() !== filial)) continue;
    const nome = limpa(s.nome);
    if (/^(GERENTE\b|RCAS INATIVOS|VENDA EMPRESA|SEM SUPERVISOR)/i.test(nome)) continue; // "GERENTE xxx" = vendedor ligado direto ao gerente, nao e supervisor
    const r = (ret.supervisores || []).find((x) => x.id === s.id || x.nome === s.nome);
    const lista = (porFilial[sig] = porFilial[sig] || []);
    lista.push({
      id: s.id, nome,
      dias: dias.map((data, i) => {
        const e = estadoDia(data);
        if (e === 'feriado' || e === 'futuro') return { data, estado: e, comp: null, ret: null };
        return { data, estado: 'passado', comp: feitoNoDia(s, i), ret: feitoNoDia(r, i) };
      })
    });
  }
  for (const l of Object.values(porFilial)) l.sort((a, b) => a.nome.localeCompare(b.nome));
  return new Response(JSON.stringify({ hoje, dias, filiais: porFilial, consultado_em: new Date().toISOString() }), { headers: cors });
}
