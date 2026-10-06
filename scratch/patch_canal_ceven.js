const fs = require('fs');
function ed(rel, fn) { const p = rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r); return s.replace(de, () => para); };
ed('functions/api/divergencias.js', (s) => {
  s = tr(s, "    return resp({\n      gerado_em:",
`    // CANAL REAL NO CEVEN (area_atuacao), ao vivo, para cada linha da decisao (Vitório, 06/10/2026: o CEVEN diz SUP e a Gestão dizia VJ). Guardado 6 h.
    try {
      await env.DB.prepare('CREATE TABLE IF NOT EXISTS canal_ceven (filial TEXT NOT NULL, rca TEXT NOT NULL, canal TEXT, em INTEGER, PRIMARY KEY (filial, rca))').run();
      const linhas = [...decisao.nao_mostra, ...decisao.fora_da_gestao];
      const { results: cache } = await env.DB.prepare('SELECT filial, rca, canal, em FROM canal_ceven').all();
      const mapa = new Map((cache || []).map((c) => [c.filial + '|' + c.rca, c]));
      const velhas = linhas.filter((l) => { const c = mapa.get(l.filial + '|' + l.codigo); return !c || Date.now() - c.em > 6 * 3600e3; });
      const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
      for (let i = 0; i < velhas.length; i += 12) {
        await Promise.all(velhas.slice(i, i + 12).map(async (l) => {
          try {
            const x = await fetch(CEVEN_BASE + '/api/filiais/' + l.filial.toLowerCase() + '1/representante/' + l.codigo, { signal: AbortSignal.timeout(6000) });
            if (!x.ok) return;
            const j = await x.json();
            const canal = String(j.area_atuacao || '').toUpperCase();
            mapa.set(l.filial + '|' + l.codigo, { canal, em: Date.now() });
            await env.DB.prepare('INSERT OR REPLACE INTO canal_ceven (filial, rca, canal, em) VALUES (?,?,?,?)').bind(l.filial, String(l.codigo), canal, Date.now()).run();
          } catch { /* sem resposta: fica sem canal do CEVEN */ }
        }));
      }
      for (const l of linhas) {
        const c = mapa.get(l.filial + '|' + l.codigo);
        l.canal_ceven = c && c.canal ? c.canal : null;
        if (['SUP', 'GER', 'GERENTE'].includes(l.canal_ceven)) l.leitura = { tipo: 'nao_vendedor', texto: 'O CEVEN classifica como ' + l.canal_ceven + ' (supervisão/gerência), não vendedor de campo.', sinais: [] };
      }
    } catch { /* sem canal do CEVEN: a coluna mostra "—" */ }

    return resp({
      gerado_em:`, 'ret');
  return s;
});
ed('public/divergencias.html', (s) => {
  s = tr(s, "{t: 'Canal', f: l => esc(l.canal || '—')},\n    {t: 'Meta do mês'", "{t: 'Canal na Gestão', f: l => esc(l.canal || '—')}, {t: 'Canal no CEVEN', f: l => l.canal_ceven ? (l.canal_ceven !== (l.canal || '').toUpperCase() ? '<b style=\"color:var(--ruim)\">' + esc(l.canal_ceven) + ' ≠ ' + esc(l.canal || '—') + '</b>' : esc(l.canal_ceven)) : '—'},\n    {t: 'Meta do mês'", 'col');
  s = tr(s, "const cls = t.tipo === 'produzindo' ? 'mov' : (t.tipo === 'sem_atividade' ? 'ok' : 'nova');", "const cls = t.tipo === 'nao_vendedor' ? 'ok' : (t.tipo === 'produzindo' ? 'mov' : (t.tipo === 'sem_atividade' ? 'ok' : 'nova'));", 'cls');
  return s;
});
