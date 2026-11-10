// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/confere_gestao.js
// O QUE É: confere CADA contato do JOTA (gerente, supervisor, vendedor) com a Gestão de Equipe (/api/tv-mostra) e a árvore de
//   supervisores do CEVEN (D1 arvore_supervisores). Devolve a lista de inconsistências de cada um; vazia = confere.
//   Pedido do Vitório (09/11/2026): "faça todo o check... e aponte inconsistência direto no JOTA na aba Contatos".
//   Usado em functions/api/jota-contatos.js (GET) -> coluna "Gestão" e filtro em /contatos. Só lê; não muda nada.
// =========================================================================
const sem = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/^CLT\s*-?\s*/, '').replace(/^VAGO\s*-?\s*/, '');
const pal = (x) => sem(x).split(/[^A-Z]+/).filter((w) => w.length > 2 && !/^(DOS|DAS|DES|DEL|COD|CODIGO)$/.test(w));
const bate = (a, b, n = 2) => { const p = pal(a), q = pal(b); return q.length > 0 && p.length > 0 && q.filter((w) => p.includes(w)).length >= Math.min(n, p.length, q.length); };
const num = (x) => String(Number(String(x || '').replace(/\D/g, '')) || '');

export function confereContatos(contatos, mostra, arvore) {
  const V = [];
  for (const [k, L] of Object.entries((mostra && mostra.filiais) || {})) for (const v of L) V.push({ ...v, fil: k.split('_')[0] });
  const A = arvore || [];
  const out = {};
  for (const c of contatos || []) {
    const p = [], papel = String(c.papel || '').toLowerCase(), fil = String(c.filial || '').toUpperCase();
    if (papel === 'vendedor') {
      const ex = V.find((v) => v.fil === fil && num(v.rca) === num(c.rca));
      if (!c.rca) p.push('sem RCA no cadastro');
      else if (!ex) {
        const parec = V.filter((v) => bate(c.nome, v.nome));
        p.push(`${fil} ${c.rca} não existe na Gestão` + (parec.length ? ` (na Gestão: ${parec.slice(0, 3).map((v) => v.fil + ' ' + v.rca).join(', ')})` : ''));
      } else {
        if (!bate(c.nome, ex.nome, 1) && !/^VAGO/i.test(String(ex.nome))) p.push(`nome diferente: na Gestão ${fil} ${ex.rca} é ${ex.nome}`);
        // "nao mostra" e da Liga/TV, nao do JOTA (Vitorio, 09/11/2026: "nao misture o jota com o Brasileirao... JOTA tem que responder se for o numero corporativo").
        // So aponta quem a Gestao marca como DESLIGADO da empresa.
        if (/DESLIG|DEMIT|RESCIS/i.test(String(ex.motivo || ''))) p.push(`Gestão: ${ex.motivo}`);
        if (ex.supervisor && String(c.supervisor || '').toUpperCase() !== String(ex.supervisor).toUpperCase()) p.push(`supervisor: cadastro "${c.supervisor || '-'}", Gestão "${ex.supervisor}"`);
      }
    } else if (papel === 'supervisor') {
      const naArv = A.filter((a) => bate(c.nome, a.sup_nome) || (/^VAGO/i.test(String(a.sup_nome)) && bate(c.nome, a.sup_nome, 1)));
      if (!naArv.length) {
        const vend = V.find((v) => bate(c.nome, v.nome));
        p.push('não está na árvore de supervisores do CEVEN' + (vend ? ` (na Gestão é vendedor ${vend.fil} ${vend.rca}${vend.mostra === false && vend.motivo ? ', ' + vend.motivo : ''})` : ''));
      } else if (fil && !naArv.some((a) => String(a.filial).toUpperCase() === fil)) p.push(`filial: cadastro ${fil}, árvore ${[...new Set(naArv.map((a) => a.filial))].join(', ')}`);
    } else if (papel === 'gerente') {
      const vs = V.filter((v) => v.fil === fil);
      if (!vs.length) p.push(`filial ${fil || '-'} sem equipe na Gestão`);
      else if (!vs.some((v) => bate(c.nome, v.gerente, 1))) p.push(`gerente da ${fil} na Gestão: ${[...new Set(vs.map((v) => v.gerente).filter(Boolean))].join(', ') || '-'}`);
    }
    out[c.celular] = p;
  }
  return out;
}

// CANAL DO CONTATO (Vitorio, 10/11/2026: "coluna e filtro se o vendedor e supervisor sao de varejo ou AS"), pela Gestao de Equipe:
// vendedor = canal dele (filial + RCA); supervisor = canal dos vendedores da equipe dele; gerente/diretoria = sem canal.
const GRUPO_CANAL = (c) => (/^(AS|PET AS)$/i.test(String(c || '').trim()) ? 'AS' : String(c || '').trim() ? 'Varejo' : '');
export function mapaCanais(mostra) {
  const porRca = new Map(), porSup = new Map(), nrm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  for (const [k, L] of Object.entries((mostra && mostra.filiais) || {})) for (const v of L || []) {
    const f = k.split('_')[0].toUpperCase(), g = GRUPO_CANAL(v.canal); if (!g) continue;
    porRca.set(f + '|' + String(v.rca), g);
    for (const s of [v.supervisor, v.supervisor_gestao]) if (s) { const ks = f + '|' + nrm(s), set = porSup.get(ks) || new Set(); set.add(g); porSup.set(ks, set); }
  }
  return (c) => {
    const f = String(c.filial || '').toUpperCase().split('_')[0], p = String(c.papel || '').toLowerCase();
    if (p === 'vendedor') return porRca.get(f + '|' + String(c.rca || '')) || '';
    if (p === 'supervisor') { const s = porSup.get(f + '|' + nrm(c.nome)) || porSup.get(f + '|' + nrm(c.supervisor)); return s ? [...s].sort().join(' + ') : ''; }
    return '';
  };
}
