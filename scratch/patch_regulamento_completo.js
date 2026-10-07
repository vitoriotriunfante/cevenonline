const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ===== regulamento: texto do Gol Qualificado corrigido na CONFIG (versao 2026-10-08.1 ainda nao entrou em vigor: so o texto) =====
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) {
  ed(rel, (s) => {
    s = tr(s, 'Gol de cliente (Resgate, Dobrou o Mix, Quinzenas): indústrias do pedido do cliente. Gol do dia (Super Pedido, Goleada, Relâmpago, Acréscimos, Meta do 1º Tempo, Máquina de Conversão, Hat-Trick): indústrias de todos os pedidos do vendedor no dia.', 'Gol de cliente (Resgate de Inativo, Dobrou o Mix, Dobradinha das Quinzenas, Gol de Marca Própria): indústrias do pedido do cliente. Gol do dia (Super Pedido, Goleada, Relâmpago, Acréscimos, Meta do 1º Tempo, Máquina de Conversão, Hat-Trick): indústrias de todos os pedidos do vendedor no dia. No AS (Autosserviço) valem só o Super Pedido (R$ 75.000 no dia), o Gol de Mix (+2 SKUs), o Resgate, a Dobradinha das Quinzenas e o Gol de Marca Própria.', 'texto');
    JSON.parse(s); return s;
  });
}

ed('public/brasileirao.html', (s) => {
  // ----- texto do Gol Qualificado: por canal, e com o Gol de Marca Propria -----
  const linhas = s.split('\n'); const i = linhas.findIndex((l) => l.startsWith("      if (pq) pq.textContent = 'Vale para TODOS os gols e para o Pedido Feito na Rota"));
  if (i < 0) throw new Error('ancora pq');
  linhas.splice(i, 1, "      CFG_PONTOS = cfg; montaTextoGolQualificado();");
  s = linhas.join('\n');
  s = tr(s, "function montaRegulamentoAS() {", `let CFG_PONTOS = null;
function montaTextoGolQualificado() {
  const pq = document.getElementById('txt-gol-qualificado'), gq = CFG_PONTOS && CFG_PONTOS.gol_qualificado; if (!pq || !gq) return;
  const base = gq.regra + ' ' + gq.carteira_so_mondelez;
  pq.textContent = CANAL === 'AS'
    ? 'No AS vale para os gols do AS (Super Pedido, Gol de Mix +2 SKUs, Resgate de Inativo, Dobradinha das Quinzenas e Gol de Marca Própria) e para o Pedido Feito na Rota. ' + base + ' Gol de cliente (Resgate, Gol de Mix, Quinzenas, Marca Própria): indústrias do pedido do cliente. Super Pedido (gol do dia): indústrias de todos os pedidos do vendedor no dia.'
    : 'Vale para TODOS os gols e para o Pedido Feito na Rota, menos o Campeão da Rodada (que é do mês). ' + base + ' Gol de cliente (Resgate de Inativo, Dobrou o Mix, Dobradinha das Quinzenas, Gol de Marca Própria): indústrias do pedido do cliente. Gol do dia (Super Pedido, Goleada, Relâmpago, Acréscimos, Meta do 1º Tempo, Conversão, Hat-Trick): indústrias de todos os pedidos do vendedor no dia.';
  const v = document.getElementById('reg-versao'); if (v) v.textContent = CFG_PONTOS.versao_regras || '—';
  const d = document.getElementById('reg-desde'); if (d && CFG_PONTOS.vigente_desde) d.textContent = String(CFG_PONTOS.vigente_desde).split('-').reverse().join('/');
}

function montaRegulamentoAS() {`, 'fn');
  s = tr(s, "  filtrarSupervisores(); filtrarVendedores(); montaRegulamentoAS(); filtraRegrasAS();\n", "  filtrarSupervisores(); filtrarVendedores(); montaRegulamentoAS(); filtraRegrasAS(); montaTextoGolQualificado();\n", 'chama');

  // ----- cartoes novos do regulamento -----
  s = tr(s, "      <div class=\"rule-card\" id=\"reg-as\" style=\"display:none\">", `      <div class="rule-card">
        <h3>📌 Informações oficiais desta versão</h3>
        <p>
          <strong>Versão do regulamento:</strong> <span id="reg-versao">—</span> · <strong>Liga oficial desde:</strong> <span id="reg-desde">07/10/2026</span>. O que veio antes foi <strong>pré-temporada</strong> e não vale remuneração. Regra, pontuação ou score novos só entram com <strong>nova versão</strong> e aviso aos gerentes; no período de estabilidade só se corrige erro.
          <br><br>
          🔒 <strong>Dia fechado:</strong> às <strong>22h</strong> o dia é congelado (lances que contam, pontos e versão das regras). Depois disso nada muda naquele dia: nem lance que chegue atrasado, nem troca de supervisor, nem regra nova.
          <br>
          🧾 <strong>Sem comprovação não tem lance:</strong> todo lance guarda a prova (pedido, nota, horário, valor, motivo oficial) e é conferido automaticamente lance a lance, mais de uma vez por dia. Lance sem prova é apontado e pode ser retirado da liga.
          <br>
          🆚 <strong>Dados:</strong> tudo vem do CEVEN, sem estimativa. Há conferência diária contra o CEVEN (digitado e devoluções do dia).
          <br>
          🛒 <strong>Canais:</strong> o canal de cada vendedor é o do CEVEN. <strong>Varejo</strong> = VJ, FARMA, PET VJ e ESP · <strong>AS</strong> = AS e PET AS · fora da liga: contas de supervisor (SUP), de gerente (GER) e quem o CEVEN não classifica. <strong>Série A (filiais) e Campeonato de Gerências somam todos</strong> os vendedores.
          <br>
          🙈 <strong>Quem está oculto na Gestão de Equipe</strong> (afastado, férias, conta de teste) não disputa a liga e não gera lance.
        </p>
      </div>

      <div class="rule-card">
        <h3>⭐ Gol de Marca Própria (a partir de 08/10/2026 · Varejo e AS)</h3>
        <p>
          Marca Própria é foco da empresa. Pedido do cliente no dia com <strong>R$ 50 ou mais de Marca Própria Triunfante</strong> vale um gol próprio: <strong>+8 pontos</strong>, o mais valioso dos gols, mais o extra do <strong>nível (bronze a platina)</strong> pelas indústrias do pedido. Ele ganha a <strong>⭐ estrela</strong> e é <strong>sempre exibido na TV</strong>: na frente de qualquer outro lance, um a um, sem esperar intervalo e nunca dentro de resumo.
        </p>
      </div>

      <div class="rule-card" id="reg-as" style="display:none">`, 'cartoes');
  // desempate e Plus do supervisor
  s = tr(s, "• <strong>Gerente:</strong> Base = Todos os vendedores da sua filial (em TPH e MCD, que têm 2 gerentes, os vendedores de cada gerente).", "• <strong>Gerente:</strong> Base = Todos os vendedores da sua filial (em TPH e MCD, que têm 2 gerentes, os vendedores de cada gerente).\n          <br><br>\n          🏅 <strong>Plus de Liderança do supervisor (critério de desempate, não soma pontos na tabela):</strong> Compromisso Matinal até as 10h = <strong>+5</strong> e início/execução do RET de campo = <strong>+5</strong> por dia útil. É só bônus: quem não faz fica com 0, sem punição.", 'plus');
  return s;
});
console.log('tudo ok');
