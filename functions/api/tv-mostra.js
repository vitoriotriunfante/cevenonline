// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: entrega à TV a lista de vendedores "MOSTRA" lida DIRETO do Google Drive
//          (planilha VENDEDORES AUDITADOS.xlsx, aba MOSTRA_DISPAROS) — sem depender do PC de ninguém.
// PROJETO: CFTV/TV. PREMISSA: 100% ONLINE (ver PREMISSA_ONLINE.md).
// SEGREDO (Cloudflare Pages, produção): GDRIVE_SA_JSON = conteúdo do JSON da service account do Google
//          (a mesma que o GitHub Actions usa para baixar a planilha). Pasta: GDRIVE_FOLDER_ID (opcional;
//          padrão abaixo). A service account precisa ter acesso de leitura à pasta.
// CACHE: 3 minutos (a planilha é lida do Drive no máximo 1 vez a cada 3 min).
// SE FALHAR: devolve erro; a TV cai para public/mostra_vendedores.json e mostra um aviso na tela.
// =========================================================================
import { lerAbaXlsx, montaMostra } from '../_lib/xlsx_mostra.js';

const PASTA_PADRAO = '1sqzFpWEKb1WKhT9MksQcQl8RuY94DQum';
const NOME_ARQUIVO = 'VENDEDORES AUDITADOS.xlsx';
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
let cache = { exp: 0, corpo: null };
let tokenCache = { exp: 0, t: null };

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const b64uTxt = (s) => b64u(new TextEncoder().encode(s));

async function tokenDrive(sa) {
  if (tokenCache.t && Date.now() < tokenCache.exp) return tokenCache.t;
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64uTxt(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64uTxt(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const chave = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const jwt = corpo + '.' + b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(corpo)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (!j.access_token) throw new Error('token do Google recusado: ' + (j.error_description || j.error || r.status));
  tokenCache = { t: j.access_token, exp: Date.now() + 50 * 60 * 1000 };
  return j.access_token;
}

export async function onRequestGet({ env }) {
  const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });
  if (cache.corpo && Date.now() < cache.exp) return resp(cache.corpo);
  if (!env.GDRIVE_SA_JSON) return resp({ erro: 'GDRIVE_SA_JSON nao configurado' }, 503);
  try {
    const sa = JSON.parse(env.GDRIVE_SA_JSON);
    const tk = await tokenDrive(sa), H = { Authorization: 'Bearer ' + tk };
    const pasta = env.GDRIVE_FOLDER_ID || PASTA_PADRAO;
    const q = encodeURIComponent(`'${pasta}' in parents and name='${NOME_ARQUIVO}' and trashed=false`);
    const lista = await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,name,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: H, signal: AbortSignal.timeout(20000) })).json();
    const arq = lista.files && lista.files[0];
    if (!arq) return resp({ erro: 'planilha nao encontrada na pasta do Drive (a service account tem acesso?)' }, 404);
    const bin = await fetch(`https://www.googleapis.com/drive/v3/files/${arq.id}?alt=media&supportsAllDrives=true`, { headers: H, signal: AbortSignal.timeout(30000) });
    if (!bin.ok) return resp({ erro: 'falha ao baixar a planilha: ' + bin.status }, 502);
    const linhas = await lerAbaXlsx(await bin.arrayBuffer(), 'MOSTRA_DISPAROS');
    const corpo = { origem: 'drive', gerado_em: new Date().toISOString(), planilha_em: arq.modifiedTime, ...montaMostra(linhas) };
    cache = { exp: Date.now() + 3 * 60 * 1000, corpo };
    return resp(corpo);
  } catch (e) {
    return resp({ erro: 'falha ao ler o Drive: ' + e.message }, 502);
  }
}
