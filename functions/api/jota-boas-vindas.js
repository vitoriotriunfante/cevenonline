// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-boas-vindas.js
// O QUE É: mensagem de boas-vindas do JOTA para os SUPERVISORES cadastrados (Vitório, 25/10/2026: "amanhã cedo").
//   GET  ?k=<BOT_WEBHOOK_KEY>&previa=1       -> o texto que vai ser enviado (nada é enviado)
//   GET  ?k=<BOT_WEBHOOK_KEY>                -> lista de quem ainda NÃO recebeu (supervisor ativo)
//   POST ?k=<BOT_WEBHOOK_KEY>&celular=55...  -> envia para UM (texto + figurinha "Oi, eu sou o Jota") e marca como enviado
// Quem chama: workflow .github/workflows/jota-boas-vindas.yml (segunda 26/10/2026, 07:30, 15 s entre um e outro). Nunca reenvia.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
const FIG = 'https://ceven-cftv-matrix.pages.dev/jota/figurinhas/01_oi_eu_sou_o_jota.webp';
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
function texto(c) {
  const n = titulo(String(c.nome || '').split(' ')[0]);
  return `Bom dia, ${n}! Eu sou o *Jota*, o novo reforço do Comercial da Triunfante. Prazer! 💪\n\n` +
    `A partir de hoje eu sou seu parceiro de campo aqui no WhatsApp. Eu enxergo a *sua equipe* (${c.filial}) com os mesmos números da TV e do CEVEN, na hora:\n\n` +
    `• "como está minha equipe?"\n• "quem está zerado?" · "quem falta visitar?"\n• "vendedor Fulano" (faturado, positivação, rota, Liga)\n• "quais clientes ela visitou e não vendeu?"\n• "quanto falta pra meta?" · "liga"\n\n` +
    `Pode escrever do seu jeito ou mandar *áudio* 🎙️ que eu entendo.\n` +
    `Se eu não tiver um dado, eu falo. Número eu não invento.\n\n_Meu DNA é Triunfante!_`;
}
async function evo(env, rota, corpo) {
  return (await R.evolution(R.evoCfg(env), rota, corpo)).ok; // true so se a Evolution aceitou (antes era sempre verdadeiro)
}
// autoriza pela chave do JOTA (?k=) OU pela chave da Evolution no header X-Evo-Key (o GitHub ja tem EVO_KEY; sem segredo novo)
const autorizado = async (request, env) => { const u = new URL(request.url); return (env.BOT_WEBHOOK_KEY && u.searchParams.get('k') === env.BOT_WEBHOOK_KEY) || await chaveEvoValida(request, env); };
const pendentes = (env) => env.DB.prepare("SELECT c.celular, c.nome, c.filial, c.papel FROM bot_contatos c WHERE c.papel = 'supervisor' AND c.ativo = 1 AND NOT EXISTS (SELECT 1 FROM bot_msgs m WHERE m.celular = c.celular AND m.tipo = 'boas_vindas') ORDER BY c.filial, c.nome").all();
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!(await autorizado(request, env))) return new Response('nao autorizado', { status: 401 });
  if (u.searchParams.get('previa') === '1') return new Response(texto({ nome: 'WASHINGTON', filial: 'API' }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const { results } = await pendentes(env);
  return new Response(JSON.stringify({ pendentes: (results || []).map((c) => c.celular), total: (results || []).length }), { headers: { 'Content-Type': 'application/json' } });
}
export async function onRequestPost({ request, env }) {
  const u = new URL(request.url);
  if (!(await autorizado(request, env))) return new Response('nao autorizado', { status: 401 });
  const cel = String(u.searchParams.get('celular') || '').replace(/\D/g, '');
  const { results } = await pendentes(env);
  const c = (results || []).find((x) => x.celular === cel);
  if (!c) return new Response(JSON.stringify({ ok: false, motivo: 'nao pendente (ja recebeu, inativo ou nao e supervisor)' }), { headers: { 'Content-Type': 'application/json' } });
  const t = texto(c);
  const ok = await evo(env, '/message/sendText', { number: cel, text: t });
  if (ok) { await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)').bind(cel, c.nome, 'out', t, 'boas_vindas').run(); const f = await evo(env, '/message/sendSticker', { number: cel, sticker: FIG }); if (f) await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)').bind(cel, c.nome, 'figurinha', '01_oi_eu_sou_o_jota', 'boas_vindas').run(); }
  return new Response(JSON.stringify({ ok, celular: cel }), { headers: { 'Content-Type': 'application/json' } });
}
