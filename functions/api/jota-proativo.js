// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-proativo.js
// O QUE E: mensagens proativas do JOTA para os vendedores do piloto (tabela jota_piloto, a estrelinha em /contatos). Vitorio, 01/11/2026.
//   manha = "minha rota"; almoco = status dos pedidos; fim = quanto falta. O texto sai das mesmas respostas do JOTA, sem conta nova.
// MODOS: padrao = ENSAIO, so devolve os textos. ?enviar=teste manda para o numero de teste do Vitorio. ?enviar=piloto manda para o piloto; so com a ordem dele.
//   Protegido pela chave administrativa. Nenhum agendador chama esta rota ainda.
// =========================================================================
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { criaBase } from '../_lib/jota/fontes.js';
import { enviar } from '../_lib/jota/base.js';
import { respostaPronta } from '../_lib/jota/entende.js';

const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const j = (x, s = 200) => new Response(JSON.stringify(x, null, 1), { status: s, headers: cors });
const NUMERO_TESTE = '5566996389884';
const PERGUNTA = { manha: 'minha rota', almoco: 'status dos pedidos', fim: 'quanto falta para a minha meta' };

export async function onRequestGet({ env, request }) {
  if (!(await chaveAdminOk(env, request))) return j({ erro: 'nao autorizado' }, 401);
  const u = new URL(request.url), modo = u.searchParams.get('modo') || 'manha', destino = u.searchParams.get('enviar'), so = u.searchParams.get('rca');
  if (!PERGUNTA[modo]) return j({ erro: 'modo: manha, almoco ou fim' }, 400);
  const { results } = await env.DB.prepare("SELECT c.celular, c.nome, c.papel, c.filial, c.rca, c.supervisor FROM jota_piloto p JOIN bot_contatos c ON c.celular = p.celular WHERE c.papel = 'vendedor' AND c.ativo = 1 AND COALESCE(c.situacao,'ativo') = 'ativo'").all();   // suspenso/inativo nao recebe nada (Vitorio, 09/11/2026)
  const alvo = (results || []).filter((c) => !so || String(c.rca) === so);
  const saida = [];
  for (const c of alvo) {
    let texto = null, erro = null;
    try { texto = await respostaPronta(criaBase(u.origin, env), c, PERGUNTA[modo], []); } catch (e) { erro = String(e.message || e).slice(0, 120); }
    const item = { filial: c.filial, rca: c.rca, nome: c.nome, texto: texto == null ? null : String(texto), erro };
    if (texto && destino) {
      const para = destino === 'piloto' ? c.celular : NUMERO_TESTE;
      const prefixo = destino === 'piloto' ? '' : `[TESTE: iria para ${c.filial} ${c.rca}]\n\n`;
      const e = await enviar(env, para, prefixo + String(texto));
      item.enviado = !!e.ok;
      await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)').bind(para, c.nome, e.ok ? 'out' : 'erro', (prefixo + String(texto)).slice(0, 4000), 'proativo_' + modo).run();
      if (destino !== 'piloto') { saida.push(item); break; }   // no teste, uma mensagem basta
    }
    saida.push(item);
  }
  return j({ modo, destino: destino || 'ensaio', vendedores: alvo.length, saida });
}
