const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) {
  const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
  s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel);
}
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

const BLOCO =
'  "gol_qualificado": {\n' +
'    "decisao": "Vitorio, 05/10/2026. Vale para lances gravados de 05/10/2026 em diante (o passado nao e refeito).",\n' +
'    "gols_que_qualificam": ["gol_inativo (Resgate)", "gol_mix (Dobrou o Mix)", "gol_quinzenas (Dobradinha das Quinzenas)"],\n' +
'    "gols_que_nao_qualificam": "Gols do dia inteiro (Super Pedido, Goleada, Meta do 1o Tempo, etc.) continuam como estao.",\n' +
'    "regra": "Conta as INDUSTRIAS diferentes no pedido do cliente no dia. 1 produto da industria ja conta (sem valor minimo); linha com valor R$ 0 (bonificacao) nao conta.",\n' +
'    "carteira_so_mondelez": "Vendedor de carteira so Mondelez (TBE e parte de TCG/TSJ, campo na Gestao de Equipe) conta CATEGORIAS da Mondelez (chocolate, biscoito, goma e bala, refresco, sobremesa e fermento, pao e snack), com a mesma escada.",\n' +
'    "escada": [\n' +
'      { "nivel": "BRONZE", "industrias": "1", "extra": 0 },\n' +
'      { "nivel": "PRATA", "industrias": "2", "extra": 1 },\n' +
'      { "nivel": "OURO", "industrias": "3", "extra": 2 },\n' +
'      { "nivel": "DIAMANTE", "industrias": "4", "extra": 3 },\n' +
'      { "nivel": "PLATINA", "industrias": "5 ou mais", "extra": 4 }\n' +
'    ],\n' +
'    "fonte_industrias": "public/catalogo_industrias.json (gerado de config/catalogo_produtos_por_filial.csv por gerar_catalogo_industrias.js)"\n' +
'  },\n';
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) {
  ed(rel, (s) => {
    s = tr(s, '    "gol_quinzenas": {', '    "gol_quinzenas": {', rel + ' ancora gq'); // so confere
    // ancora do bloco: antes de "pontos_por_lance" nao e estavel; insere logo apos a abertura do objeto raiz
    const i = s.indexOf('\n  "pontos_por_lance"');
    if (i < 0) throw new Error('sem pontos_por_lance em ' + rel);
    s = s.slice(0, i + 1) + BLOCO + s.slice(i + 1);
    s = s.replace(/("gol_mix": \{[^\n]*?"motivo": ")([^"]*)"/, (m, a, b) => a + b + ' QUALIFICADO: ganha nivel (bronze a platina) e extra de pontos pelas industrias do pedido (ver Gol Qualificado).' + '"');
    s = s.replace(/("gol_quinzenas": \{[^\n]*?"motivo": ")([^"]*)"/, (m, a, b) => a + b + ' QUALIFICADO (ver Gol Qualificado).' + '"');
    s = s.replace(/("gol_inativo": \{[^\n]*?"motivo": ")([^"]*)"/, (m, a, b) => a + b + ' QUALIFICADO (ver Gol Qualificado).' + '"');
    JSON.parse(s); // valida
    return s;
  });
}

ed('public/brasileirao.html', (s) => {
  s = tr(s, '        <small style="color:var(--tx-mut)">Valores oficiais em <code>config/pontuacao_brasileirao.json</code>',
    '        <h3 style="margin:22px 0 6px">💎 Gol Qualificado (a partir de 05/10/2026)</h3>\n' +
    '        <p id="txt-gol-qualificado" style="color:#cbd5e1;font-size:13.5px;line-height:1.5"></p>\n' +
    '        <table class="tabela-pontos"><thead><tr><th>Nível</th><th>Indústrias no pedido do cliente</th><th style="text-align:center">Extra no gol</th></tr></thead><tbody id="tbody-gol-qualificado"></tbody></table>\n' +
    '        <small style="color:var(--tx-mut)">Valores oficiais em <code>config/pontuacao_brasileirao.json</code>', 'html');
  s = tr(s, "    const itens = Object.values(cfg.pontos_por_lance || {}).sort((a, b) => b.pontos - a.pontos);\n",
    "    const itens = Object.values(cfg.pontos_por_lance || {}).sort((a, b) => b.pontos - a.pontos);\n" +
    "    const gq = cfg.gol_qualificado;\n" +
    "    if (gq) {\n" +
    "      const tq = document.getElementById('tbody-gol-qualificado');\n" +
    "      if (tq) tq.innerHTML = (gq.escada || []).map(e => `<tr><td style=\"font-weight:700;color:#fff\">${esc(e.nivel)}</td><td>${esc(e.industrias)}</td><td style=\"text-align:center\"><b style=\"color:#22c55e;font-family:'JetBrains Mono',monospace\">+${e.extra}</b></td></tr>`).join('');\n" +
    "      const pq = document.getElementById('txt-gol-qualificado');\n" +
    "      if (pq) pq.textContent = 'Vale para o Resgate de Inativo, Dobrou o Mix e Dobradinha das Quinzenas. ' + gq.regra + ' ' + gq.carteira_so_mondelez;\n" +
    "    }\n", 'js');
  return s;
});
console.log('regulamento ok');
