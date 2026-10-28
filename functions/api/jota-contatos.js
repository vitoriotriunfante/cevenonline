// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-contatos.js   (GET/POST /api/jota-contatos — tela /contatos)
// O QUE É: gestão dos contatos do JOTA (Vitório, 25/10/2026: "precisamos ter dentro da tela saúde os contatos dos gerentes, supervisores e vendedores
//          (segundo passo) já ligados a um setor e filial, para que eu gerencie"; "cadastro automático: aqui eu vou precisar dar o OK").
// SENHA: a mesma da Gestão de Equipe (header X-Equipe-Senha). Sem senha, nada.
// GET  -> { contatos: [...], supervisores_arvore: [{filial, sup_id, sup_nome, grupo}] }
// POST { acao: 'salvar' | 'aprovar' | 'recusar' | 'desativar' | 'ativar', celular, nome, papel, filial, grupo, supervisor, rca }
//      'aprovar' libera um pedido pendente e avisa a pessoa no WhatsApp. Toda alteração fica em bot_contatos_log.
// TABELA: bot_contatos (do JOTA, nao e esquema compartilhado) + colunas situacao ('ativo'|'pendente'|'inativo'|'recusado') e rca.
// =========================================================================
import { exigeSenhaEquipe } from '../_lib/senha_equipe.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import R from '../../public/regras.js'; // regras unicas (public/regras.js)

const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Equipe-Senha', 'Cache-Control': 'no-store' };
const PAPEIS = ['diretoria', 'gerente', 'supervisor', 'vendedor'];
const FILIAIS = ['TPH', 'ABC', 'API', 'TBL', 'TCV', 'TSJ', 'TCA', 'TBE', 'TPA', 'MCD', 'TCG'];
const so = (x) => String(x || '').replace(/\D/g, '');
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });

async function garante(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_contatos (celular TEXT PRIMARY KEY, nome TEXT, papel TEXT, filial TEXT, grupo TEXT, supervisor TEXT, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  for (const c of ['situacao TEXT', 'rca TEXT', 'atualizado_em TEXT']) { try { await db.prepare(`ALTER TABLE bot_contatos ADD COLUMN ${c}`).run(); } catch (e) { /* ja existe */ } }
  // supervisores da arvore que NAO devem aparecer em 'Sem acesso' (gerente, inativo...): decisao do Vitorio pela tela (26/10/2026)
  await db.prepare('CREATE TABLE IF NOT EXISTS bot_sem_acesso_excluidos (filial TEXT NOT NULL, sup_id TEXT NOT NULL, sup_nome TEXT, motivo TEXT, em TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (filial, sup_id))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS bot_contatos_log (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, acao TEXT, antes TEXT, depois TEXT)').run();
}
const situacao = (c) => c.situacao || (c.ativo ? 'ativo' : 'inativo');

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestGet({ request, env }) {
  const adminOk = await chaveAdminOk(env, request);
  if (!adminOk) {
    const negado = await exigeSenhaEquipe(request, env, CORS); if (negado) return negado;
  }
  await garante(env.DB);
  const { results } = await env.DB.prepare('SELECT * FROM bot_contatos ORDER BY papel, filial, nome').all();
  const { results: arv } = await env.DB.prepare('SELECT DISTINCT filial, sup_id, sup_nome FROM arvore_supervisores ORDER BY filial, sup_nome').all().catch(() => ({ results: [] }));
  const { results: uso } = await env.DB.prepare("SELECT celular, COUNT(*) n, MAX(quando) ult FROM bot_msgs WHERE direcao = 'in' GROUP BY celular").all().catch(() => ({ results: [] }));
  const U = new Map((uso || []).map((r) => [r.celular, r]));
  const { results: exc } = await env.DB.prepare('SELECT * FROM bot_sem_acesso_excluidos').all().catch(() => ({ results: [] }));
  return j({ sem_acesso_excluidos: exc || [], contatos: (results || []).map((c) => ({ ...c, situacao: situacao(c), perguntas: (U.get(c.celular) || {}).n || 0, ultima: (U.get(c.celular) || {}).ult || null })), supervisores_arvore: arv || [], papeis: PAPEIS, filiais: FILIAIS });
}

async function enviar(env, numero, texto) {
  if (!env.EVO_URL || !env.EVO_KEY) return false;
  return (await R.evolution(R.evoCfg(env), '/message/sendText', { number: numero, text: texto })).ok;
}

export async function onRequestPost({ request, env }) {
  const adminOk = await chaveAdminOk(env, request);
  if (!adminOk) {
    const negado = await exigeSenhaEquipe(request, env, CORS); if (negado) return negado;
  }
  await garante(env.DB);
  let b; try { b = await request.json(); } catch { return j({ erro: 'json invalido' }, 400); }
  // ABA "SEM ACESSO" (26/10/2026): excluir/reincluir da lista e enviar a lista para o(s) gerente(s) ativo(s) da filial pelo WhatsApp
  if (b.acao === 'excluir_sem_acesso' || b.acao === 'reincluir_sem_acesso') {
    const f = String(b.filial || '').toUpperCase(), id = String(b.sup_id || '');
    if (!FILIAIS.includes(f) || !id) return j({ erro: 'filial e codigo obrigatorios' }, 400);
    if (b.acao === 'excluir_sem_acesso') await env.DB.prepare('INSERT OR REPLACE INTO bot_sem_acesso_excluidos (filial, sup_id, sup_nome, motivo) VALUES (?,?,?,?)').bind(f, id, String(b.sup_nome || ''), String(b.motivo || '')).run();
    else await env.DB.prepare('DELETE FROM bot_sem_acesso_excluidos WHERE filial = ? AND sup_id = ?').bind(f, id).run();
    return j({ ok: true });
  }
  if (b.acao === 'enviar_sem_acesso') {
    const f = String(b.filial || '').toUpperCase(), lista = Array.isArray(b.lista) ? b.lista.slice(0, 40) : [];
    if (!FILIAIS.includes(f) || !lista.length) return j({ erro: 'filial e lista obrigatorias' }, 400);
    const { results: ger } = await env.DB.prepare("SELECT celular, nome FROM bot_contatos WHERE papel = 'gerente' AND filial = ? AND COALESCE(situacao, CASE WHEN ativo = 1 THEN 'ativo' ELSE 'inativo' END) = 'ativo'").bind(f).all();
    if (!ger || !ger.length) return j({ erro: 'nenhum gerente ativo cadastrado para ' + f }, 404);
    const tit = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());
    const texto = `📲 *Jota — supervisores da ${f} ainda sem acesso*\n\nPara liberar, cada um manda no WhatsApp do Jota (este número) o *nome + código de supervisor*, por exemplo: "Maria Silva, supervisora, código 45".\n\n` + lista.map((s) => `• ${tit(s.sup_nome)} (código ${s.sup_id})`).join('\n');
    const enviados = []; for (const g of ger) { if (await enviar(env, g.celular, texto)) enviados.push(g.nome); }
    return j({ ok: true, enviados });
  }
  const cel = so(b.celular);
  if (cel.length < 12 || cel.length > 13 || !cel.startsWith('55')) return j({ erro: 'celular deve ter DDI 55 + DDD + numero (ex.: 5541999998888)' }, 400);
  const antes = await env.DB.prepare('SELECT * FROM bot_contatos WHERE celular = ?').bind(cel).first();
  const log = (acao, depois) => env.DB.prepare('INSERT INTO bot_contatos_log (celular, acao, antes, depois) VALUES (?,?,?,?)').bind(cel, acao, JSON.stringify(antes || null), JSON.stringify(depois || null)).run();
  const acao = String(b.acao || '');
  if (acao === 'salvar') {
    const papel = String(b.papel || '').toLowerCase();
    if (!PAPEIS.includes(papel)) return j({ erro: 'papel invalido' }, 400);
    const filial = papel === 'diretoria' ? null : String(b.filial || '').toUpperCase();
    if (papel !== 'diretoria' && !FILIAIS.includes(filial)) return j({ erro: 'filial obrigatoria para ' + papel }, 400);
    const nome = String(b.nome || '').trim().toUpperCase(); if (!nome) return j({ erro: 'nome obrigatorio' }, 400);
    const sup = papel === 'supervisor' ? String(b.supervisor || nome).trim().toUpperCase() : papel === 'vendedor' ? String(b.supervisor || '').trim().toUpperCase() || null : null;
    const grupo = b.grupo ? String(b.grupo).trim().toUpperCase() : null, rca = papel === 'vendedor' ? so(b.rca) || null : null;
    if (papel === 'vendedor' && !rca) return j({ erro: 'vendedor precisa do codigo RCA' }, 400);
    const sit = antes ? situacao(antes) : 'ativo';
    await env.DB.prepare(`INSERT INTO bot_contatos (celular, nome, papel, filial, grupo, supervisor, rca, ativo, situacao, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(celular) DO UPDATE SET nome=excluded.nome, papel=excluded.papel, filial=excluded.filial, grupo=excluded.grupo, supervisor=excluded.supervisor, rca=excluded.rca, atualizado_em=CURRENT_TIMESTAMP`)
      .bind(cel, nome, papel, filial, grupo, sup, rca, sit === 'ativo' ? 1 : 0, sit).run();
    await log('salvar', { nome, papel, filial, grupo, sup, rca });
    return j({ ok: true });
  }
  if (!antes) return j({ erro: 'contato nao encontrado' }, 404);
  const muda = async (ativo, sit) => { await env.DB.prepare('UPDATE bot_contatos SET ativo = ?, situacao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE celular = ?').bind(ativo, sit, cel).run(); await log(acao, { situacao: sit }); };
  if (acao === 'aprovar' || acao === 'ativar') {
    await muda(1, 'ativo');
    let avisado = false;
    if (acao === 'aprovar') { const p = String(antes.nome || '').split(' ')[0]; avisado = await enviar(env, cel, `Fala, ${p.charAt(0) + p.slice(1).toLowerCase()}! Seu acesso ao *Jota* foi liberado ⚽\nVocê vê ${antes.papel === 'supervisor' ? 'a sua equipe' : antes.papel === 'gerente' ? 'a sua filial' : 'os seus dados'}.\n\nExperimenta: "como está minha equipe?", "zerados", "faltam visitar", "vendedor Nome", "liga".\n_Meu DNA é Triunfante!_`); }
    return j({ ok: true, avisado });
  }
  if (acao === 'recusar') { await muda(0, 'recusado'); return j({ ok: true }); }
  if (acao === 'desativar') { await muda(0, 'inativo'); return j({ ok: true }); }
  return j({ erro: 'acao invalida' }, 400);
}
