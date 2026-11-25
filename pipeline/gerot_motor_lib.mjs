// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_motor_lib.mjs
// O QUE É: cliente HTTP puro em Node.js para o servidor GEROT (:8009), ZERO Playwright.
//   1) loginGerot(email, senha) -> sessao por cookie via POST /api/login
//   2) lerSondaPainel(cookie) -> ~1.2 MB (manifesto + bloco 0) -> versao/hora oficial sem browser
//   3) carregarCuboEMotor(cookie) -> baixa apenas blocos novos (cache SHA-256), extrai JS criarMotor(cubo) e cuboGerot
// SEGURANÇA (repo publico): nunca imprime e-mail, senha, cookie, nomes de clientes ou valores em stdout.
// =========================================================================
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export const URL_GEROT = 'https://gerot.triunfanteadmvendas.com.br:8009';

function habilitaTlsPortal() {
  // :8009 usa certificado interno da Triunfante (antes usava ignoreHTTPSErrors: true no Playwright)
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
}

export async function loginGerot(email, senha) {
  if (!email || !senha) throw new Error('GEROT_EMAIL / GEROT_SENHA nao configurados');
  habilitaTlsPortal();
  const res = await fetch(URL_GEROT + '/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'gerot',
      Origin: URL_GEROT,
      Referer: URL_GEROT + '/login'
    },
    body: JSON.stringify({ email: String(email).trim().toLowerCase(), senha: String(senha) }),
    signal: AbortSignal.timeout(45000)
  });
  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`login GEROT recusado (HTTP ${res.status}): ${errTxt.slice(0, 120)}`);
  }
  const j = await res.json().catch(() => ({}));
  if (j && j.trocarSenha) throw new Error('GEROT pediu troca de senha');
  const setCookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  const cookie = setCookies.map((c) => String(c).split(';')[0].trim()).filter(Boolean).join('; ');
  if (!cookie) throw new Error('login GEROT nao devolveu cookie de sessao');
  return cookie;
}

const fmtIsoBrData = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const fmtIsoHora = (iso, comAno = true) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return '';
  return comAno ? `${m[3]}/${m[2]}/${m[1].slice(2)} ${m[4]}:${m[5]}h` : `${m[3]}/${m[2]} ${m[4]}:${m[5]}h`;
};

async function reqGerot(cookie, caminho, esperaMs = 60000) {
  habilitaTlsPortal();
  const r = await fetch(URL_GEROT + caminho, {
    headers: { Cookie: cookie, 'X-Requested-With': 'gerot' },
    signal: AbortSignal.timeout(esperaMs)
  });
  if (r.status === 401) throw new Error('sessao GEROT expirada (401)');
  if (!r.ok) throw new Error(`GEROT ${caminho} HTTP ${r.status}`);
  return r;
}

export async function lerSondaPainel(cookie) {
  const painelHtml = await (await reqGerot(cookie, '/painel', 30000)).text();
  const mP = painelHtml.match(/const\s+P\s*=\s*(\{[\s\S]*?\})\s*;/);
  const P = mP ? JSON.parse(mP[1]) : {};
  const manifesto = await (await reqGerot(cookie, '/painel/manifesto', 30000)).json();
  const hash0 = manifesto && Array.isArray(manifesto.blocos) && manifesto.blocos[0] ? manifesto.blocos[0][0] : null;
  if (!hash0) throw new Error('manifesto sem bloco 0');
  const b0 = Buffer.from(await (await reqGerot(cookie, '/painel/bloco/' + hash0, 60000)).arrayBuffer()).toString('utf8');
  const idx = b0.indexOf('id="cuboGerot"');
  if (idx < 0) throw new Error('bloco 0 sem cabecalho cuboGerot');
  const head = b0.slice(idx, idx + 2500);
  const ext = (k) => (head.match(new RegExp(`"${k}":"([^"]+)"`)) || [])[1] || '';
  const geradoEm = ext('geradoEm');
  const cargaBanco = ext('cargaBanco');
  const posIso = ext('posicaoD0') || ext('posicao');
  const ultima = fmtIsoHora(geradoEm, true) || fmtIsoHora(P.quando ? new Date(Date.parse(P.quando) - 3 * 3600e3).toISOString() : '', true) || null;
  const carga = fmtIsoHora(cargaBanco, false) || null;
  const posBr = fmtIsoBrData(posIso);
  const posicao = posBr ? `Atual · ${posBr}` : null;
  return {
    ok: !!(ultima || carga),
    v: P.v || manifesto.v || null,
    tam: P.tam || manifesto.tam || null,
    quando: P.quando || null,
    ultima,
    carga,
    posicao,
    geradoEm: geradoEm || null,
    cargaBanco: cargaBanco || null
  };
}

function extrairMotorECubo(cacheFiles, log) {
  const bufs = cacheFiles.map((fp) => fs.readFileSync(fp));
  const full = Buffer.concat(bufs);
  bufs.length = 0;

  const headSlice = full.subarray(0, Math.min(full.length, 4 * 1024 * 1024)).toString('utf8');
  const idxCuboTag = headSlice.indexOf('<script id="cuboGerot"');
  if (idxCuboTag < 0) throw new Error('tag cuboGerot nao encontrada nos blocos');
  const mjsEndRel = headSlice.lastIndexOf('</script>', idxCuboTag);
  const mjsStartRel = headSlice.lastIndexOf('<script>', mjsEndRel);
  if (mjsStartRel < 0 || mjsEndRel < 0) throw new Error('bloco JS criarMotor nao encontrado');
  const mjs = headSlice.slice(mjsStartRel + 8, mjsEndRel);

  const marker = Buffer.from('<script id="cuboGerot" type="application/json">');
  let start = full.indexOf(marker);
  if (start < 0) {
    const markerAlt = Buffer.from('<script id="cuboGerot"');
    const p = full.indexOf(markerAlt);
    if (p < 0) throw new Error('inicio do JSON cuboGerot nao encontrado');
    const gt = full.indexOf(0x3e, p); // '>'
    start = gt + 1;
  } else {
    start += marker.length;
  }
  const end = full.indexOf(Buffer.from('</script>'), start);
  if (end < 0) throw new Error('fechamento </script> do cuboGerot nao encontrado');
  const jsonBytes = end - start;
  log(`decodificando cubo JSON (${(jsonBytes / 1048576).toFixed(1)} MB)...`);
  const jsonStr = full.toString('utf8', start, end);
  return { mjs, jsonStr };
}

function limpaCacheAntigo(cacheDir, blocosAtuais, maxBytes = 900 * 1024 * 1024) {
  try {
    const vivos = new Set(blocosAtuais.map(([h]) => h));
    const arqs = fs.readdirSync(cacheDir).map((n) => {
      const p = path.join(cacheDir, n);
      try { const st = fs.statSync(p); return { n, p, size: st.size, mtime: st.mtimeMs }; } catch { return null; }
    }).filter(Boolean);
    const total = arqs.reduce((s, a) => s + a.size, 0);
    if (total <= maxBytes) return 0;
    let rem = 0;
    for (const a of arqs.sort((x, y) => x.mtime - y.mtime)) {
      if (vivos.has(a.n) || a.n.endsWith('.tmp')) continue;
      try { fs.unlinkSync(a.p); rem++; } catch {}
    }
    return rem;
  } catch { return 0; }
}

export async function carregarCuboEMotor(cookie, opts = {}) {
  const log = opts.log || ((...a) => console.log(new Date().toISOString().slice(11, 19), ...a));
  const conc = Number(opts.conc) || 12;
  const cacheDir = opts.cacheDir || path.join(os.homedir(), '.cache', 'gerot-blocos');
  fs.mkdirSync(cacheDir, { recursive: true });

  const manifesto = await (await reqGerot(cookie, '/painel/manifesto', 45000)).json();
  const blocos = Array.isArray(manifesto && manifesto.blocos) ? manifesto.blocos : [];
  if (!blocos.length) throw new Error('manifesto vazio');

  const falta = [];
  const files = [];
  for (const [hash, bytes] of blocos) {
    const fp = path.join(cacheDir, hash);
    files.push(fp);
    let ok = false;
    try {
      if (fs.existsSync(fp) && fs.statSync(fp).size === bytes) ok = true;
    } catch {}
    if (!ok) falta.push({ hash, bytes, fp });
  }

  const t0 = Date.now();
  let baixados = 0, bytesBaixados = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < falta.length) {
      const it = falta[cursor++];
      let ok = false, lastErr = null;
      for (let t = 1; t <= 4; t++) {
        try {
          const r = await reqGerot(cookie, '/painel/bloco/' + it.hash, 90000);
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.byteLength !== it.bytes) throw new Error(`tamanho ${buf.byteLength} != ${it.bytes}`);
          const sha = crypto.createHash('sha256').update(buf).digest('hex');
          if (sha !== it.hash) throw new Error('sha256 divergente');
          const tmp = it.fp + '.tmp-' + process.pid;
          fs.writeFileSync(tmp, buf);
          fs.renameSync(tmp, it.fp);
          baixados++;
          bytesBaixados += buf.byteLength;
          ok = true;
          break;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 1000 * t));
        }
      }
      if (!ok) throw lastErr || new Error('falha ao baixar bloco');
    }
  };

  await Promise.all(Array.from({ length: Math.min(conc, Math.max(1, falta.length)) }, worker));
  log(`blocos GEROT: total ${blocos.length} · cache ${blocos.length - falta.length} · baixados ${baixados} (${(bytesBaixados / 1048576).toFixed(1)} MB em ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  limpaCacheAntigo(cacheDir, blocos);

  const { mjs, jsonStr } = extrairMotorECubo(files, log);
  const cubo = JSON.parse(jsonStr);
  const fnCriarMotor = new Function(mjs + '\nreturn criarMotor;');
  const criarMotor = fnCriarMotor();
  const motor = criarMotor(cubo);

  const meta = {
    v: manifesto.v || null,
    geradoEm: cubo.geradoEm || null,
    cargaBanco: cubo.cargaBanco || null,
    mes: cubo.mes || null,
    meses: cubo.meses || [],
    posicao: cubo.posicao || null,
    posicaoD0: cubo.posicaoD0 || null,
    temD0: !!cubo.temD0
  };
  log('motor instanciado:', JSON.stringify(meta));
  return { manifesto, cubo, motor, meta };
}
