// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_horario.mjs   (roda no GitHub Actions: .github/workflows/gerot-horario.yml)
// O QUE É: SONDA LEVE DO GEROT (~1,2 MB via HTTP puro, ZERO Playwright).
//   1) Login POST /api/login -> /painel + /painel/manifesto + bloco 0 -> le geradoEm, cargaBanco e posicao
//   2) Grava no D1 (/api/gerot-carga, chave 'horario'); se mudou desde a ultima coleta, dispara gerot-coleta.yml
// SEGURANÇA: repositorio publico -> o log so mostra horas e status.
// =========================================================================
import { loginGerot, lerSondaPainel } from './gerot_motor_lib.mjs';

const API = (process.env.SITE_CFTV || 'https://ceven-cftv-matrix.pages.dev') + '/api/gerot-carga';
const KEY = process.env.EVO_KEY, EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  if (!EMAIL || !SENHA) throw new Error('GEROT_EMAIL / GEROT_SENHA nao configurados');
  const t0 = Date.now();
  let r = { ok: false };
  try {
    const cookie = await loginGerot(EMAIL, SENHA);
    const s = await lerSondaPainel(cookie);
    r = {
      ok: !!s.ok,
      lido_em: new Date().toISOString(),
      ultima: s.ultima,
      carga: s.carga,
      posicao: s.posicao,
      segundos: Math.round((Date.now() - t0) / 1000)
    };
  } catch (e) {
    r = {
      ok: false,
      lido_em: new Date().toISOString(),
      erro: String(e && e.message || e).slice(0, 160),
      segundos: Math.round((Date.now() - t0) / 1000)
    };
  }
  log('GEROT sonda HTTP:', JSON.stringify(r));
  if (KEY) {
    const resp = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Evo-Key': KEY },
      body: JSON.stringify({ horario: r })
    }).then((x) => x.text()).catch((e) => 'erro ' + e.message);
    log('D1:', String(resp).slice(0, 160));
    let j = {}; try { j = JSON.parse(resp); } catch { j = {}; }
    if (j.coletar && process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
      const d = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/gerot-coleta.yml/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'gerot-sonda'
        },
        body: JSON.stringify({ ref: 'main' })
      }).then((x) => x.status).catch((e) => 'erro ' + e.message);
      log('GEROT mudou -> coleta disparada:', d);
    } else log('GEROT sem mudanca desde a ultima coleta');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
