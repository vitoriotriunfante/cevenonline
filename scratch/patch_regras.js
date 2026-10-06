const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ---------- 1) regulamento (config + copia publica) ----------
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) {
  ed(rel, (s) => {
    s = tr(s, '"motivo": "Advertência: vendedor com rota ativa sem nenhuma venda até as 10h00 (11h00 no fuso)." }',
      '"motivo": "Advertência às 10h00 (11h00 no fuso): vendedor com rota ativa sem nenhum pedido e/ou sem nenhuma visita (inclui quem não fez nenhum check-in de varejo)." }', rel + ' amarelo');
    s = tr(s, '"nome": "🚨 Pênalti (Estoque Suficiente)", "pontos": -6, "motivo": "Justificativa de não venda \\"ESTOQUE SUFICIENTE\\" em cliente parado há mais de 30 dias sem compra." }',
      '"nome": "🚨 Pênalti (Estoque Suficiente)", "pontos": -4, "motivo": "Justificativa de não venda \\"ESTOQUE SUFICIENTE\\" em cliente parado há mais de 30 dias sem compra. Vale -4 a partir de 06/10/2026 (antes -6)." }', rel + ' pen1');
    s = tr(s, '"nome": "🚨 Pênalti (Cliente Fechado)", "pontos": -6, "motivo": "Justificativa \\"ESTABELECIMENTO FECHADO / ENCERROU\\" em cliente parado há mais de 45 dias sem compra." }',
      '"nome": "🚨 Pênalti (Cliente Fechado)", "pontos": -4, "motivo": "Justificativa \\"ESTABELECIMENTO FECHADO / ENCERROU\\" em cliente parado há mais de 45 dias sem compra. Vale -4 a partir de 06/10/2026 (antes -6)." }', rel + ' pen2');
    s = tr(s, 'Vendedor com rota ativa que chegou às 10h00 sem nenhuma visita feita (abandono de campo) OU rota finalizada sem nenhuma venda.', 'Vendedor com rota ativa que chegou às 11h00 (12h00 no fuso) sem nenhuma visita feita (abandono de campo) OU rota finalizada sem nenhuma venda. Vale a partir de 06/10/2026 (antes 10h00).', rel + ' vermelho');
    JSON.parse(s);
    return s;
  });
}

// ---------- 2) endpoint de pontos: penalti -4 a partir de 06/10/2026 (dias anteriores continuam -6) ----------
ed('functions/api/brasileirao-lances.js', (s) => {
  s = tr(s, "      const pont = q ? { ...pont0, pontos: pont0.pontos + q.extra, nome: pont0.nome + ' ' + q.nivel } : pont0;\n",
    "      let pont = q ? { ...pont0, pontos: pont0.pontos + q.extra, nome: pont0.nome + ' ' + q.nivel } : pont0;\n" +
    "      // Penalti vale -4 a partir de 06/10/2026 (Vitorio); os dias anteriores continuam -6 (nao se refaz o passado)\n" +
    "      if (dia >= '2026-10-06' && (l.nivel === 'penalti' || /^pen[|]/.test(String(l.chave || '').replace(/^[A-Z]{3}[|]/, '')))) pont = { ...pont, pontos: -4 };\n", 'pen');
  return s;
});

// ---------- 3) coletor do servidor: amarelo 10h (sem pedido e/ou sem visita), vermelho 11h (sem nenhuma visita) ----------
ed('functions/api/cron-lances.js', (s) => {
  const ini = s.indexOf('    const limiteHora = v.fuso1h ? 11 : 10;');
  const fim = s.indexOf('  });\n  return out;', ini);
  if (ini < 0 || fim < 0) throw new Error('bloco horas cron');
  const novo =
"    // Amarelo as 10h (11h no fuso): rota ativa sem nenhum pedido e/ou sem nenhuma visita (inclui quem nao fez nenhum check-in de varejo).\n" +
"    // Vermelho de abandono as 11h (12h no fuso): rota ativa ainda sem nenhuma visita feita. Regra de 06/10/2026 (antes o vermelho era as 10h).\n" +
"    const limAmarelo = v.fuso1h ? 11 : 10, limVermelho = v.fuso1h ? 12 : 11;\n" +
"    const hh = String(t.h).padStart(2, '0');\n" +
"    if (v.campo && v.temRota && t.h >= limAmarelo && t.h < 19 && (v.feitas === 0 || (!(v.dig > 0) && !(v.pos > 0)))) {\n" +
"      out.push({ chave: `ven10|${v.id}`, nivel: 'amarelo', v, prova: v.feitas === 0 ? `nenhuma visita nem check-in de varejo (${v.cl.length} clientes na rota) as ${hh}h (limite ${limAmarelo}h)` : `${v.feitas} visitas feitas, 0 pedidos e digitado R$ 0 as ${hh}h (limite ${limAmarelo}h)` });\n" +
"    }\n" +
"    if (v.campo && v.temRota && t.h >= limVermelho && t.h < 19 && v.feitas === 0) {\n" +
"      out.push({ chave: `vis10|${v.id}`, nivel: 'vermelho', v, prova: `${v.cl.length} clientes na rota, 0 visitas feitas as ${hh}h (limite ${limVermelho}h)` });\n" +
"    }\n";
  return s.slice(0, ini) + novo + s.slice(fim);
});

// ---------- 4) telas (TV e Matriz): mesma regra nos popups + texto de pontos ----------
function regraLocal(s, keyPrefix, sigField) {
  const velho =
"    const naJanelaMatinal = horaAtualDecimal >= limiteHora && horaAtualDecimal < limiteHoraFim;\n" +
"    if (v.campo && v.temRota && naJanelaMatinal) {\n" +
"      if (v.feitas === 0) out.push({key: `" + keyPrefix + "vis10|${v.id}`, " + sigField + "nivel: 'vermelho', subtipo: 'abandono_campo', v});\n" +
"      else if (!(v.dig > 0) && !(v.pos > 0)) out.push({key: `" + keyPrefix + "ven10|${v.id}`, " + sigField + "nivel: 'amarelo', subtipo: 'sem_venda', v});\n" +
"    }\n";
  const novo =
"    // Amarelo (10h; 11h no fuso): sem pedido e/ou sem visita (inclui sem check-in de varejo). Vermelho de abandono (11h; 12h no fuso): sem nenhuma visita. Regra de 06/10/2026.\n" +
"    const limVerm = limiteHora + 1, limVermFim = limiteHoraFim + 1;\n" +
"    if (v.campo && v.temRota && horaAtualDecimal >= limiteHora && horaAtualDecimal < limiteHoraFim && (v.feitas === 0 || (!(v.dig > 0) && !(v.pos > 0)))) out.push({key: `" + keyPrefix + "ven10|${v.id}`, " + sigField + "nivel: 'amarelo', subtipo: v.feitas === 0 ? 'sem_checkin' : 'sem_venda', v});\n" +
"    if (v.campo && v.temRota && horaAtualDecimal >= limVerm && horaAtualDecimal < limVermFim && v.feitas === 0) out.push({key: `" + keyPrefix + "vis10|${v.id}`, " + sigField + "nivel: 'vermelho', subtipo: 'abandono_campo', v});\n";
  return tr(s, velho, novo, 'regra local ' + keyPrefix);
}
ed('public/tvapp.html', (s) => {
  s = regraLocal(s, '', '');
  s = tr(s, "if (tipo === 'penalti') return { nome: 'Pênalti', pts: '-6 PONTOS NA LIGA'", "if (tipo === 'penalti') return { nome: 'Pênalti', pts: '-4 PONTOS NA LIGA'", 'pen txt');
  s = tr(s, "if (a.nivel === 'amarelo') return `Rota ativa sem vendas às ${LIMITE_H}h`;", "if (a.nivel === 'amarelo') return a.subtipo === 'sem_checkin' ? `Nenhuma visita/check-in de varejo às ${LIMITE_H}h` : `Rota ativa sem pedidos às ${LIMITE_H}h`;", 'amarelo txt');
  s = tr(s, "if (a.nivel === 'vermelho') return `0/${a.v.rota} visitas · nenhum cliente visitado às ${LIMITE_H}h`;", "if (a.nivel === 'vermelho') return `0/${a.v.rota} visitas · nenhum cliente visitado às ${LIMITE_H + 1}h`;", 'verm txt');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = regraLocal(s, '${sig}|', 'sig, ');
  s = tr(s, "if (tipo === 'penalti') return { nome: 'Pênalti', pts: '-6 PONTOS NA LIGA'", "if (tipo === 'penalti') return { nome: 'Pênalti', pts: '-4 PONTOS NA LIGA'", 'pen txt');
  return s;
});

// ---------- 5) Brasileirao: tabelas que cabem na tela, cabecalhos explicados, recarrega quando ha versao nova ----------
ed('public/brasileirao.html', (s) => {
  s = tr(s, '#tab-lances .tb-league td:nth-child(n+4) { white-space: normal; word-break: break-word; }\n#tab-lances .tb-league td { padding: 10px 12px; }',
`#tab-lances .tb-league, #tab-gabarito .tb-league { table-layout: fixed; width: 100%; }
#tab-lances .tb-league td, #tab-lances .tb-league th, #tab-gabarito .tb-league td, #tab-gabarito .tb-league th { white-space: normal; word-break: break-word; padding: 9px 10px; }
#tab-lances .tb-league th:nth-child(1) { width: 62px; } #tab-lances .tb-league th:nth-child(2) { width: 58px; } #tab-lances .tb-league th:nth-child(3) { width: 118px; }
#tab-lances .tb-league th:nth-child(4) { width: 16%; } #tab-lances .tb-league th:nth-child(5) { width: 13%; } #tab-lances .tb-league th:nth-child(6) { width: 19%; }
#tab-lances .tb-league th:nth-child(7) { width: 72px; } #tab-lances .tb-league th:nth-child(8) { width: 70px; }
#tab-lances .tb-league td:nth-child(9) { font-size: 12px; color: #cbd5e1; }`, 'css lances');
  s = s.split('<th style="width:80px">Hora</th>').join('<th>Hora</th>').split('<th style="width:70px">Filial</th>').join('<th>Filial</th>').split('<th style="width:130px">Tipo</th>').join('<th>Tipo</th>');
  s = s.split('<th style="text-align:center;width:90px">Pontos</th>').join('<th style="text-align:center">Pontos</th>');
  s = s.split('<th style="text-align:center">Super Ped.</th>').join('<th style="text-align:center" title="Quantidade de gols de Super Pedido (pedido de valor muito alto no dia, 15 mil ou mais). Critério de desempate da tabela.">Super Pedidos</th>');
  s = s.split('<th style="text-align:center">Inativos</th>').join('<th style="text-align:center" title="Quantidade de clientes inativos (parados há mais de 30 dias) que o vendedor reativou: gols de Resgate de Inativo. Critério de desempate da tabela.">Inativos resgatados</th>');
  s = tr(s, '<th style="text-align:center;width:90px">Lances hoje</th><th style="text-align:center;width:120px">Pontos no dia</th>', '<th style="text-align:center;width:90px">Lances hoje</th><th style="text-align:center;width:110px">Pontos no dia</th>', 'th gab');
  // recarrega sozinha quando sai versao nova (a pagina aberta o dia todo ficava com o visual antigo)
  s = tr(s, '</body>', `<script>
// Atualiza sozinha quando sai uma versao nova do site (mesma regra das TVs)
(function () { let v0 = null; async function chk() { try { const r = await fetch('/api/version', { cache: 'no-store' }); const j = await r.json(); if (v0 && j.version && j.version !== v0 && !document.activeElement.matches('input,select,textarea')) location.reload(); v0 = v0 || j.version; } catch (e) {} } chk(); setInterval(chk, 60000); })();
</script>
</body>`, 'reload');
  return s;
});
console.log('tudo ok');
