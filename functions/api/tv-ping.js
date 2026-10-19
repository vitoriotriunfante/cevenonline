// =========================================================================
// FICHA DO ARQUIVO: functions/api/tv-ping.js
// O QUE É: SINAL DE VIDA das TVs (Vitório, 19/10/2026: TV da TSJ ficou com número velho e "113 lances aguardando"; "as TVs ficam ligadas lá...
//          precisa recarregar sempre que atualizarmos"). Cada TV (tvapp/matrizapp) manda a cada 1 min: filial, grupo, versão que está rodando,
//          se o VAR está ocupado, tamanho da fila, quantos vendedores carregou e a hora dos dados. Assim dá para ver de longe a TV parada ou velha.
//   POST /api/tv-ping  {filial, grupo, versao, ocupado, espera, vendedores, dados_de}
//   GET  /api/tv-ping  -> lista das TVs vistas nas últimas 24 h, com a versão atual do site para comparar
// =========================================================================
import { VERSION } from './version.js';
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });
const garante = async (env) => {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS tv_ping (chave TEXT PRIMARY KEY, filial TEXT, grupo TEXT, tela TEXT, versao TEXT, ocupado INTEGER, espera INTEGER, vendedores INTEGER, dados_de TEXT, ip TEXT, visto_em TEXT)').run();
  for (const col of ['aparelho TEXT', 'tipo TEXT', 'ua TEXT']) { try { await env.DB.prepare('ALTER TABLE tv_ping ADD COLUMN ' + col).run(); } catch (e) { /* ja existe */ } }
};
// TV ou COMPUTADOR (19/10/2026: o Vitorio tirou a TV da Matriz da tomada e o sinal continuou vindo de um computador com a Matriz aberta).
// Pelo navegador: Smart TV (Tizen, webOS, Android TV, BRAVIA, Roku, Fire TV, Chromecast...) = 'tv'; celular = 'celular'; o resto = 'computador'.
const tipoAparelho = (ua) => {
  const u = String(ua || '');
  if (/SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|AFT[A-Z]|Android TV|GoogleTV|CrKey|Roku|HbbTV|VIDAA|Hisense|TCL|PhilipsTV|AppleTV|TV Safari|Large Screen/i.test(u)) return 'tv';
  if (/Mobi|iPhone|Android(?!.*TV)/i.test(u)) return 'celular';
  return 'computador';
};

export async function onRequestPost({ request, env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  let b; try { b = await request.json(); } catch { return resp({ erro: 'json invalido' }, 400); }
  const filial = String(b.filial || '').toUpperCase().slice(0, 3), grupo = String(b.grupo || '').toUpperCase().slice(0, 30), tela = String(b.tela || 'tv').slice(0, 10);
  if (!/^[A-Z]{3}$/.test(filial)) return resp({ erro: 'filial invalida' }, 400);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const aparelho = String(b.aparelho || ip).slice(0, 40), tipo = tipoAparelho(request.headers.get('user-agent'));
  await garante(env);
  await env.DB.prepare('INSERT OR REPLACE INTO tv_ping (chave, filial, grupo, tela, versao, ocupado, espera, vendedores, dados_de, ip, visto_em, aparelho, tipo, ua) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind([tela, filial, grupo, aparelho].join('|'), filial, grupo, tela, String(b.versao || '').slice(0, 40), b.ocupado ? 1 : 0, Number(b.espera) || 0, Number(b.vendedores) || 0, String(b.dados_de || '').slice(0, 20), ip, new Date().toISOString(), aparelho, tipo, String(request.headers.get('user-agent') || '').slice(0, 200)).run();
  return resp({ ok: true, versao_atual: VERSION });
}

export async function onRequestGet({ env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  await garante(env);
  const { results } = await env.DB.prepare("SELECT filial, grupo, tela, versao, ocupado, espera, vendedores, dados_de, visto_em, COALESCE(tipo, '?') AS tipo, aparelho, ua FROM tv_ping WHERE visto_em > ? ORDER BY filial, grupo").bind(new Date(Date.now() - 24 * 3600e3).toISOString()).all();
  const agora = Date.now();
  return resp({ versao_atual: VERSION, tvs: (results || []).map((t) => ({ ...t, minutos_sem_sinal: Math.round((agora - Date.parse(t.visto_em)) / 60000), versao_velha: t.versao !== VERSION })) });
}
