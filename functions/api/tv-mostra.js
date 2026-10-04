// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: entrega à TV a lista de vendedores "MOSTRA" lida DIRETO do Google Drive
//          (planilha VENDEDORES AUDITADOS.xlsx, aba MOSTRA_DISPAROS) — sem depender do PC de ninguém.
// PROJETO: CFTV/TV. PREMISSA: 100% ONLINE (ver PREMISSA_ONLINE.md).
// SEGREDO (Cloudflare Pages, produção): GDRIVE_SA_JSON = conteúdo do JSON da service account do Google
//          (a mesma que o GitHub Actions usa para baixar a planilha). Pasta: GDRIVE_FOLDER_ID (opcional;
//          padrão abaixo). A service account precisa ter acesso de leitura à pasta.
// CACHE: 3 minutos (a planilha é lida do Drive no máximo 1 vez a cada 3 min).
// ORDEM DAS FONTES: 1) D1 config_equipe_soberana (salvo pela Gestao de Equipe); 2) planilha do Drive; 3) cópia estática.
// SE FALHAR: cai para public/mostra_vendedores.json (cópia publicada pelo último deploy) e a TV avisa
//            na tela que está usando cópia, não a fonte viva.
// =========================================================================
import { lerAbaXlsx, montaMostra } from '../_lib/xlsx_mostra.js';
import { aplicaNaoSupervisores } from '../_lib/nao_supervisores.js'; // nomes que NAO sao supervisores (decisao 04/10/2026)

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

export async function onRequestGet({ env, request }) {
  const resp = (o, s = 200) => new Response(JSON.stringify(s === 200 ? aplicaNaoSupervisores(o) : o), { status: s, headers: CORS });
  const url = new URL(request.url);
  const bypassCache = url.searchParams.has('nocache') || url.searchParams.has('t');
  if (!bypassCache && cache.corpo && Date.now() < cache.exp) return resp(cache.corpo);

  // FONTE DA EQUIPE (decisao do Vitorio, 03/10/2026): a tela Gestao de Equipe e a fonte. O que ela
  // salva (equipe-salvar / aprovacao em equipe-solicitacoes) vale primeiro; so se nao houver nada
  // salvo cai para a planilha do Drive e depois para a copia estatica.
  if (env.DB) {
    try {
      const row = await env.DB.prepare('SELECT conteudo_json, atualizado_por, atualizado_em FROM config_equipe_soberana WHERE id = 1').first();
      if (row && row.conteudo_json) {
        const corpo = { ...JSON.parse(row.conteudo_json), origem: 'd1', atualizado_por: row.atualizado_por, atualizado_em: row.atualizado_em, gerado_em: new Date().toISOString() };
        cache = { exp: Date.now() + 60 * 1000, corpo };
        return resp(corpo);
      }
    } catch (e) {
      // tabela ainda nao existe ou D1 indisponivel: segue para o Drive
    }
  }

  if (env.GDRIVE_SA_JSON) {
    try {
      const sa = JSON.parse(env.GDRIVE_SA_JSON);
      const tk = await tokenDrive(sa), H = { Authorization: 'Bearer ' + tk };
      const pasta = env.GDRIVE_FOLDER_ID || PASTA_PADRAO;
      const q = encodeURIComponent(`'${pasta}' in parents and name='${NOME_ARQUIVO}' and trashed=false`);
      const lista = await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,name,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: H, signal: AbortSignal.timeout(20000) })).json();
      const arq = lista.files && lista.files[0];
      if (!arq) throw new Error('planilha nao encontrada na pasta do Drive (a service account tem acesso?)');
      const bin = await fetch(`https://www.googleapis.com/drive/v3/files/${arq.id}?alt=media&supportsAllDrives=true`, { headers: H, signal: AbortSignal.timeout(30000) });
      if (!bin.ok) throw new Error('falha ao baixar a planilha: ' + bin.status);
      const linhas = await lerAbaXlsx(await bin.arrayBuffer(), 'MOSTRA_DISPAROS');
      const corpo = { origem: 'drive', gerado_em: new Date().toISOString(), planilha_em: arq.modifiedTime, ...montaMostra(linhas) };
      cache = { exp: Date.now() + 3 * 60 * 1000, corpo };
      return resp(corpo);
    } catch (e) {
      // Drive falhou: cai para a cópia publicada abaixo, sem travar a TV.
    }
  }

  // Fallback: cópia estática publicada no último deploy (gerada por gerar_mostra_tv.js).
  try {
    const assetUrl = new URL('/mostra_vendedores.json', request.url);
    const r = env.ASSETS ? await env.ASSETS.fetch(new Request(assetUrl)) : await fetch(assetUrl, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      data.origem = 'copia';
      cache = { exp: Date.now() + 60 * 1000, corpo: data };
      return resp(data);
    }
  } catch (err) {}

  return resp({ erro: 'lista MOSTRA indisponivel (Drive e copia falharam)' }, 502);
}
