// =========================================================================
// FICHA DO ARQUIVO: public/regras.js — BIBLIOTECA ÚNICA DE REGRAS (Vitório, 25/10/2026: "tudo único!!!!")
// O QUE É: o ÚNICO lugar onde ficam as regras que TV, Matriz, JOTA, Liga e o motor do WhatsApp precisam
//          aplicar igual. Ninguém reescreve isso em outro arquivo: o teste testes/regra_unica.mjs FALHA se
//          aparecer a lista de canais, a data de Brasília ou o envio da Evolution escritos à mão em outro lugar.
// QUEM USA:  telas (<script src="/regras.js"> -> window.REGRAS), Functions (import R from '.../public/regras.js'),
//            motor/scripts Node (require('../public/regras.js')).
// NÃO PÕE AQUI: senha, chave ou token (este arquivo é público no site).
// =========================================================================
(function (raiz) {
  // CANAIS (CEVEN area_atuacao). Rota/visita/eficácia = só VAREJO. AS = grandes contas. GER/SUP = contas de gestão.
  const CANAIS_VAREJO = ['VJ', 'PET VJ', 'FARMA', 'ESP'];
  const CANAIS_AS = ['AS', 'PET AS'];
  const CANAIS_GESTAO = ['GER', 'SUP'];
  const SKU_IGNORADO = '12229'; // sempre fora (REGRAS_DE_NEGOCIO_CEVEN.md)
  const up = (c) => String(c == null ? '' : c).trim().toUpperCase();
  const ehVarejo = (c) => CANAIS_VAREJO.includes(up(c));
  const ehAS = (c) => CANAIS_AS.includes(up(c));
  const ehGestao = (c) => CANAIS_GESTAO.includes(up(c));
  const canalCurto = (c) => (ehVarejo(c) ? 'varejo' : ehAS(c) ? 'AS' : up(c) ? up(c).toLowerCase() : '');

  // RELÓGIO DE BRASÍLIA — a virada do dia é a mesma em toda tela e no motor.
  const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false });
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function relogioSP(d) {
    const p = {};
    FMT.formatToParts(d || new Date()).forEach((x) => (p[x.type] = x.value));
    const h = (+p.hour) % 24, m = +p.minute, s = +p.second;
    const hh = String(h).padStart(2, '0');
    return { dia: `${p.year}-${p.month}-${p.day}`, h, m, s, min: h * 60 + m, hm: `${hh}:${p.minute}`, hms: `${hh}:${p.minute}:${p.second}`, dow: DOW[p.weekday] };
  }
  const hojeSP = (d) => relogioSP(d).dia;
  const horaSP = (d) => relogioSP(d).h;

  // DINHEIRO — "R$ 1.234" (inteiro, padrão das mensagens e telas)
  const brl = (v) => (v == null || !isFinite(v) ? 'sem dado' : 'R$ ' + Math.round(Number(v)).toLocaleString('pt-BR'));

  // EVOLUTION (WhatsApp) — único jeito de chamar. cfg = { url, key, instancia }. caminho ex.: '/message/sendText'.
  async function evolution(cfg, caminho, corpo, ms) {
    const base = String(cfg && cfg.url || '').replace(/\/$/, '');
    if (!base || !cfg.key) return { ok: false, status: 0, erro: 'Evolution não configurada' };
    try {
      const r = await fetch(`${base}${caminho}/${cfg.instancia || 'ceven-noc'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.key }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(ms || 20000) });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { ok: r.ok, status: r.status, resposta: j };
    } catch (e) { return { ok: false, status: 0, erro: String(e && e.message || e) }; }
  }
  async function evolutionGet(cfg, caminho, query, ms) {
    const base = String(cfg && cfg.url || '').replace(/\/$/, '');
    if (!base || !cfg.key) return { ok: false, status: 0, erro: 'Evolution não configurada' };
    try {
      const qs = query ? '?' + new URLSearchParams(query).toString() : '';
      const r = await fetch(`${base}${caminho}/${cfg.instancia || 'ceven-noc'}${qs}`, { method: 'GET', headers: { apikey: cfg.key }, signal: AbortSignal.timeout(ms || 20000) });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { ok: r.ok, status: r.status, resposta: j };
    } catch (e) { return { ok: false, status: 0, erro: String(e && e.message || e) }; }
  }
  const evoCfg = (env) => ({ url: env.EVO_URL, key: env.EVO_KEY, instancia: env.EVO_INSTANCE || 'ceven-noc' });
  const enviarTexto = (cfg, numero, texto) => evolution(cfg, '/message/sendText', { number: String(numero).includes('@g.us') ? String(numero).trim() : String(numero).replace(/\D/g, ''), text: texto });

  const R = { CANAIS_VAREJO, CANAIS_AS, CANAIS_GESTAO, SKU_IGNORADO, ehVarejo, ehAS, ehGestao, canalCurto, relogioSP, hojeSP, horaSP, brl, evolution, evolutionGet, evoCfg, enviarTexto };
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
  raiz.REGRAS = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
