// =========================================================================
// JOTA · functions/_lib/jota/acabamento.js
// O QUE É: o ACABAMENTO UNICO de toda resposta do JOTA — o mesmo no WhatsApp (functions/api/whatsapp/bot.js) e na auditoria seca (/api/jota-seco).
//   18/11/2026: o rodape do Clube, a hora da leitura nos zeros do dia, o "Vago" e o singular so existiam no bot.js; a auditoria via outra resposta
//   (R03 56x, R15 6x, R18 9x na auditoria ampla 3). Uma saida so, igual para quem pergunta e para quem audita.
// =========================================================================
const horaSP = (d) => d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const ZERO_DIA = [/(digitado|vendido|vendeu|hoje)[^\n]{0,25}R\$ 0(?![\d,.])/i, /(?<![\d.,])0 pedidos?\b/i, /visitas?:?\s*\*?0 de \d/i, /(?<![\d.,])0\/\d+ vis/i, /\bsem rota\b/i, /n[aã]o tem clientes na rota de hoje/i, /visitou 0 de/i];
const SING = { pontos: 'ponto', clientes: 'cliente', pedidos: 'pedido', vendedores: 'vendedor', visitas: 'visita', lances: 'lance', dias: 'dia', notas: 'nota', 'indústrias': 'indústria', produtos: 'produto', itens: 'item', supervisores: 'supervisor', filiais: 'filial', motivos: 'motivo' };

export async function acabamento(B, env, resp) {
  if (!resp || typeof resp !== 'string') return resp;
  // 12/11/2026: vendas e visitas de HOJE vindas do Clube da Venda — sempre com a hora da leitura
  if (B && B._clube && !/Clube da Venda/.test(resp)) { const dc = new Date(B._clube); resp += `\n\n_🟢 Hoje (Clube da Venda${isNaN(dc) ? '' : ' · ' + horaSP(dc)}): pedidos colocados._`; }
  // 18/11/2026 (R03): ZERO do dia sem a hora da leitura -> hora da ultima leitura do Clube de HOJE (rota, visitas e pedidos do dia vem do Clube). Sem leitura de hoje, nada.
  if (!/Clube da Venda/.test(resp) && ZERO_DIA.some((re) => re.test(resp)) && env && env.DB) {
    try { const hj = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); const u = await env.DB.prepare('SELECT MAX(lido_em) l FROM clube_rodada WHERE dia = ?').bind(hj).first(); const dc = u && u.l ? new Date(u.l) : null;
      if (dc && !isNaN(dc)) resp += `\n\n_🟢 Hoje (Clube da Venda · ${horaSP(dc)})_`; } catch (e) { /* sem leitura: sem rodape */ }
  }
  // 21/11/2026 (Vitorio: 'inclua o horario da atualizacao quando citar o GEROT... so nao precisa colocar a data completa'): 'GEROT (posicao 21/11/2026)' -> 'GEROT · 16:34'
  if (/GEROT/.test(resp) && env && env.DB) {
    try {
      const st = await env.DB.prepare('SELECT posicao, em FROM gerot_coleta_status ORDER BY id DESC LIMIT 1').first();
      const m = String((st && st.posicao) || '').match(/atualizado\s+[\d/]+\s+(\d{1,2}:\d{2})/);
      const hG = m ? m[1].padStart(5, '0') : st && st.em ? horaSP(new Date(st.em)) : '';
      resp = resp.replace(/\s*\(posição[^)]*\)/g, '').replace(/\s*·?\s*posição\s+\d{2}\/\d{2}\/\d{4}/g, '');
      if (hG) resp = resp.split('\n').map((l) => (/GEROT/.test(l) && !/\d{1,2}:\d{2}/.test(l) && /^\s*_/.test(l) ? l.replace(/GEROT/, `GEROT · ${hG}`) : l)).join('\n');
    } catch (e) { /* sem status: fica como esta */ }
  }
  // 18/11/2026 (R15/R18): "Vago" nunca aparece como nome ("Setor Vago" = setor sem titular; "Vago Gabriel" = quem cobre a vaga) e "1 clientes" vira "1 cliente"
  resp = resp.replace(/\bSetor Vago\b/gi, 'Setor sem titular').replace(/\bVAGO\s*(\(\s*SUP\s*\)\s*)?[-–:]?\s*(?=[A-Za-zÀ-ú]{2,})/gi, '').replace(/\bvago\b/gi, 'sem titular');
  resp = resp.replace(/(^|[^\d.,])1 (pontos|clientes|pedidos|vendedores|visitas|lances|dias|notas|indústrias|produtos|itens|supervisores|filiais|motivos)\b/g, (m, a, w) => `${a}1 ${SING[w]}`);
  return resp;
}
