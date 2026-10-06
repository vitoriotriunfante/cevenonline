const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

const CSS =
"#ov .dec .vd{margin-top:2vh;font-size:min(2.4vw,34px);font-weight:800;color:#fca5a5}\n" +
"/* POPUP COMPACTO (Vitório, 06/10/2026: \"muita informação, reorganiza\"): campos curtos lado a lado em 3 colunas, rótulo pequeno em cima; texto longo em linha inteira; nunca passa da tela */\n" +
"#ov .dec{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));column-gap:2vw;row-gap:0;align-content:start;width:min(1750px,96vw);max-height:94vh;overflow:auto;padding:2vh 2.2vw}\n" +
"#ov .dec>h1,#ov .dec>.vd,#ov .dec>div:not(.ln){grid-column:1/-1}\n" +
"#ov .dec>h1{font-size:min(2.6vw,42px);margin-bottom:1vh}\n" +
"#ov .dec .ln{grid-column:span 2;display:block;font-size:min(1.9vw,30px);padding:.8vh 0;line-height:1.15;min-width:0;overflow-wrap:anywhere}\n" +
"#ov .dec .ln.w{grid-column:1/-1}\n" +
"#ov .dec .ln b{display:block;min-width:0;font-size:.52em;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.15em}\n" +
"#ov .dec>.vd{font-size:min(2.1vw,32px);margin-top:1.2vh}\n";

ed('public/animacoes/tv-animacoes.js', (s) => s + `
// Marca como linha inteira (.w) os campos de texto longo do popup de decisão; os curtos ficam lado a lado (ver CSS "POPUP COMPACTO")
window.compactaDecHtml = function (dec) {
  return String(dec).replace(/<div class="ln([^"]*)"><b>([^<]*)<\\/b><span>([\\s\\S]*?)<\\/span><\\/div>/g, function (m, cls, lab, val) {
    const txt = val.replace(/<[^>]*>/g, '');
    const larga = /LANCE|CLIENTE|QUALIFIC|PEDIDO|QUINZENA|FATURAMENTO|MOTIVO|DEVOLU|PROVA|ANULADO|ALERTA|SEMANA|ITENS|DETALHE/i.test(lab) || txt.length > 34;
    return larga ? m.replace('class="ln' + cls + '"', 'class="ln' + cls + ' w"') : m;
  });
};
`);

for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => {
    s = tr(s, '#ov .dec .vd{margin-top:2vh;font-size:min(2.4vw,34px);font-weight:800;color:#fca5a5}\n', CSS, rel + ' css');
    s = tr(s, '  return {titulo, sub, dec, veredito, cls};', "  if (typeof compactaDecHtml === 'function' && typeof dec === 'string') dec = compactaDecHtml(dec);\n  return {titulo, sub, dec, veredito, cls};", rel + ' ret');
    return s;
  });
}

// Matriz: gol de cliente sem repetir cliente (ja esta no LANCE) nem o valor (ja esta no PEDIDO DE HOJE)
ed('public/matrizapp.html', (s) => {
  s = tr(s, "    if (cObj && cObj.nome) {\n      linhasExtra += `<div class=\"ln\"><b>CLIENTE</b><span>${esc(cObj.nome)}</span></div>`;\n    }\n", "    // CLIENTE nao repete: o nome ja vai no LANCE\n", 'cliente');
  s = tr(s, '      if (vVendaReal > 0) {', '      if (vVendaReal > 0 && !(cObj && cObj.pedidoHoje && cObj.pedidoHoje.num)) { // com pedido de hoje o valor ja esta na linha PEDIDO DE HOJE', 'valor');
  return s;
});
console.log('tudo ok');
