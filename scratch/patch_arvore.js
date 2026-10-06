const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// tv-mostra: o supervisor vem da arvore viva do CEVEN (a Gestao segue mandando em mostra, canal e gerente/grupo)
ed('functions/api/tv-mostra.js', (s) => {
  s = tr(s, "import { aplicaNaoSupervisores } from '../_lib/nao_supervisores.js';", "import { aplicaNaoSupervisores } from '../_lib/nao_supervisores.js';\nimport { aplicaArvore } from '../_lib/arvore_ceven.js'; // supervisor = arvore viva do CEVEN (muda todo dia)", 'imp');
  s = tr(s, "        const corpo = { ...JSON.parse(row.conteudo_json), origem: 'd1', atualizado_por: row.atualizado_por, atualizado_em: row.atualizado_em, gerado_em: new Date().toISOString() };\n",
    "        const corpo = { ...JSON.parse(row.conteudo_json), origem: 'd1', atualizado_por: row.atualizado_por, atualizado_em: row.atualizado_em, gerado_em: new Date().toISOString() };\n        await aplicaArvore(env, corpo); // 06/10/2026: o supervisor guardado na Gestao estava velho (equipes de TPA trocadas); vale o do CEVEN de hoje\n", 'corpo');
  return s;
});

// coletor de lances: renova a arvore (so se passou de 45 min) depois de coletar
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "import { qualificaGol, carteiraEfetiva } from '../_lib/qualificacao_gol.js';", "import { qualificaGol, carteiraEfetiva } from '../_lib/qualificacao_gol.js';\nimport { garanteArvore } from '../_lib/arvore_ceven.js';", 'imp');
  s = tr(s, "  return new Response(JSON.stringify({\n    status: 'ATUALIZADO', dia: t.dia, hora: t.hms, semana_invicta: invicta,",
    "  // Arvore viva do CEVEN (supervisor de cada vendedor muda todo dia): renova se passou de 45 min\n  let arvore = 'pulado';\n  try { if (t.h >= 5) { const a = await garanteArvore(env, 45); arvore = a.status + (a.filiais_falharam && a.filiais_falharam.length ? ' (falharam: ' + a.filiais_falharam.join(',') + ')' : ''); } } catch { arvore = 'falhou'; }\n\n  return new Response(JSON.stringify({\n    status: 'ATUALIZADO', dia: t.dia, hora: t.hms, semana_invicta: invicta, arvore,", 'resp');
  return s;
});

// motor do WhatsApp (Projeto B, por ordem do Vitorio 06/10/2026): supervisor = CEVEN de hoje, nunca o nome guardado na Gestao
ed('pipeline/ceven_unified_engine.js', (s) => {
  const de = "      const supNovo = String(r.supervisor || '').toUpperCase().trim();\n      if (supNovo && supNovo !== val.supNome) {\n        val.supNome = supNovo;\n        corrigidos++;\n      }\n";
  return tr(s, de,
    "      // SUPERVISOR = ARVORE VIVA DO CEVEN (Vitorio, 06/10/2026: \"temos que reorganizar as arvores do CEVEN diariamente, pois mudam\"). A Gestao de Equipe NAO sobrescreve mais o supervisor:\n" +
    "      // o nome guardado nela estava velho (11 de 14 vendedores de TPA com supervisor errado) e bagunçava os envios. Mostra, grupo/gerente e canal continuam vindo da Gestao.\n", 'engine');
});
console.log('tudo ok');
