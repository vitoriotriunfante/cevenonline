const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

ed('functions/api/divergencias.js', (s) => {
  s = tr(s, "const cors = {", "import { aplicaArvore } from '../_lib/arvore_ceven.js';\nconst cors = {", 'imp');
  s = tr(s, "    return resp({\n      gerado_em: new Date().toISOString(), dia, planilha_lida: planilhaOk,",
`    // ÁRVORE VIVA DO CEVEN x GESTÃO (Vitório, 06/10/2026: "coloca aqui as divergências"): vendedores novos que entraram sozinhos, supervisor que o CEVEN trocou e
    // vendedores que só a Gestão tem (fora da cascata do CEVEN). Somente leitura; quem decide mostra / não mostra é a Gestão de Equipe.
    const arvore = { disponivel: false, atualizado_em: null, novos: [], supervisor_mudou: [], so_gestao: [] };
    try {
      const row = await env.DB.prepare('SELECT conteudo_json FROM config_equipe_soberana WHERE id = 1').first();
      const base = JSON.parse(row.conteudo_json);
      const cop = JSON.parse(JSON.stringify(base));
      await aplicaArvore(env, cop);
      const { results: ar } = await env.DB.prepare('SELECT filial, rca FROM arvore_supervisores').all();
      if (ar && ar.length) {
        arvore.disponivel = true;
        arvore.atualizado_em = cop.arvore_viva && cop.arvore_viva.atualizado_em;
        const naArv = new Set(ar.map((r) => r.filial + '|' + r.rca));
        for (const k of Object.keys(cop.filiais)) {
          const sig = k.split('_')[0].toUpperCase();
          for (const v of cop.filiais[k] || []) {
            if (v.auto_arvore) arvore.novos.push({ filial: sig, codigo: v.rca, nome: v.nome, supervisor: v.supervisor, canal: v.canal || '', gerente: v.gerente || '', grupo: v.grupo || '', mostra: v.mostra !== false });
            else if (v.supervisor_gestao != null) arvore.supervisor_mudou.push({ filial: sig, codigo: v.rca, nome: v.nome, supervisor_gestao: v.supervisor_gestao, supervisor_ceven: v.supervisor, mostra: v.mostra !== false });
          }
        }
        for (const k of Object.keys(base.filiais || {})) {
          const sig = k.split('_')[0].toUpperCase();
          for (const v of base.filiais[k] || []) if (!naArv.has(sig + '|' + v.rca)) arvore.so_gestao.push({ filial: sig, codigo: v.rca, nome: v.nome, supervisor: v.supervisor || '', canal: v.canal || '', mostra: v.mostra !== false, motivo: v.motivo || '' });
        }
      }
    } catch { /* sem arvore: a secao some */ }

    return resp({
      gerado_em: new Date().toISOString(), dia, planilha_lida: planilhaOk, arvore,`, 'resp');
  return s;
});

ed('public/divergencias.html', (s) => {
  s = tr(s, "  const pct = (x, m) => m > 0", `  // --- ÁRVORE VIVA DO CEVEN x GESTÃO ---
  const ar = d.arvore || {};
  const aviso = ar.disponivel ? '' : '<div class="vazio">A árvore do CEVEN ainda não foi baixada hoje. Ela se atualiza sozinha a cada 45 minutos.</div>';
  const A0 = tabela([
    {t: 'Filial', f: l => esc(l.filial)}, {t: 'Código', f: l => esc(l.codigo)}, {t: 'Nome', f: l => esc(l.nome)},
    {t: 'Supervisor (CEVEN)', f: l => esc(l.supervisor)}, {t: 'Canal', f: l => esc(l.canal || '—')},
    {t: 'Gerente', f: l => esc(l.gerente || '—') + (l.grupo ? ' / ' + esc(l.grupo) : '')},
    {t: 'Na tela', f: l => '<span class="tag ok">MOSTRA</span>'}
  ], ar.novos || [], 'Nenhum vendedor novo: todo vendedor da árvore do CEVEN já está na Gestão de Equipe.');
  const A1 = tabela([
    {t: 'Filial', f: l => esc(l.filial)}, {t: 'Código', f: l => esc(l.codigo)}, {t: 'Nome', f: l => esc(l.nome)},
    {t: 'Supervisor na Gestão (antigo)', f: l => esc(l.supervisor_gestao || '—')}, {t: 'Supervisor no CEVEN (vale)', f: l => '<b>' + esc(l.supervisor_ceven || '—') + '</b>'},
    {t: 'Mostra', f: l => l.mostra ? 'SIM' : 'NÃO'}
  ], ar.supervisor_mudou || [], 'Nenhuma troca: o supervisor da Gestão de Equipe é o mesmo do CEVEN em todos os vendedores.');
  const A2 = tabela([
    {t: 'Filial', f: l => esc(l.filial)}, {t: 'Código', f: l => esc(l.codigo)}, {t: 'Nome', f: l => esc(l.nome)}, {t: 'Canal', f: l => esc(l.canal || '—')},
    {t: 'Supervisor (Gestão)', f: l => esc(l.supervisor || '—')}, {t: 'Mostra', f: l => l.mostra ? 'SIM' : 'NÃO'}, {t: 'Motivo', f: l => esc(l.motivo || '')}
  ], ar.so_gestao || [], 'Nenhum: todo vendedor da Gestão de Equipe está na árvore do CEVEN.');
  const pct = (x, m) => m > 0`, 'blocoA');
  s = tr(s, "  $('corpo').innerHTML =\n", "  $('corpo').innerHTML = aviso +\n    secao('0. Árvore do CEVEN: vendedores NOVOS (já entraram nas telas)', 'Estão na árvore viva do CEVEN e ainda não estavam na Gestão de Equipe: entram sozinhos, com MOSTRA = SIM e o supervisor do CEVEN. Se algum não deve aparecer, é só ocultar na Gestão de Equipe.', A0) +\n    secao('0.1 Árvore do CEVEN: supervisor trocado (vale o do CEVEN)', 'O CEVEN reorganiza a árvore todo dia. Aqui estão os vendedores cujo supervisor na Gestão de Equipe estava diferente do CEVEN: todas as telas, os lances e o WhatsApp já usam o do CEVEN.', A1) +\n    secao('0.2 Só na Gestão de Equipe (fora da árvore do CEVEN)', 'Vendedores que a Gestão tem e a árvore do CEVEN não traz (a cascata do CEVEN não é completa: nenhum foi removido). Confira se ainda existem; os que não existem mais podem ser ocultados.', A2) +\n", 'corpo');
  s = tr(s, "    ['Na Gestão de Equipe e fora do banco', r.planilha_fora_do_banco, 'precisam ser cadastrados'],", "    ['Vendedores novos da árvore do CEVEN', (ar.novos || []).length, 'já entraram nas telas'],\n    ['Supervisor trocado pelo CEVEN', (ar.supervisor_mudou || []).length, 'vale o do CEVEN'],\n    ['Só na Gestão (fora da árvore)', (ar.so_gestao || []).length, 'conferir se ainda existem'],\n    ['Na Gestão de Equipe e fora do banco', r.planilha_fora_do_banco, 'precisam ser cadastrados'],", 'chips');
  s = tr(s, "  $('rodape').textContent = `Gerado em ${new Date(d.gerado_em).toLocaleString('pt-BR')}", "  $('rodape').textContent = `Árvore do CEVEN atualizada em ${ar.atualizado_em ? new Date(ar.atualizado_em).toLocaleString('pt-BR') : '—'} · Gerado em ${new Date(d.gerado_em).toLocaleString('pt-BR')}", 'rodape');
  return s;
});
console.log('tudo ok');
