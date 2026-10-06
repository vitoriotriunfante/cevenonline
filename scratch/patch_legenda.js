const fs = require('fs');
const p = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/brasileirao.html';
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
// cabecalhos com a explicacao escrita embaixo (nao so no mouse)
s = s.replace(/<th style="text-align:center" title="Quantidade de gols de Super Pedido[^"]*">Super Pedidos<\/th>/g,
  '<th style="text-align:center;line-height:1.25">Super Pedido<br><small style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--tx-mut)">dias com R$ 15 mil+</small></th>');
s = s.replace(/<th style="text-align:center" title="Quantidade de clientes inativos[^"]*">Inativos resgatados<\/th>/g,
  '<th style="text-align:center;line-height:1.25">Inativos<br><small style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--tx-mut)">clientes recuperados</small></th>');
const LEG = '<div style="margin:8px 0 0;padding:10px 14px;border-radius:10px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);font-size:13px;line-height:1.55;color:#cbd5e1">' +
  '<b style="color:#fff">Super Pedido</b> = quantos <b>dias</b> o vendedor digitou <b>R$ 15 mil ou mais</b> no dia (cada dia conta 1; vale +5 pontos na liga).<br>' +
  '<b style="color:#fff">Inativos</b> = quantos <b>clientes parados há mais de 30 dias</b> voltaram a comprar com ele (cada cliente recuperado conta 1; vale +6 pontos, ou mais com o Gol Qualificado).<br>' +
  '<span style="color:var(--tx-mut)">As duas colunas contam desde o início da temporada (28/09/2026) e são usadas como critério de desempate quando dois vendedores empatam em pontos.</span></div>';
const ancora = '<div class="table-subtitle">Você contra o seu próprio dia • Vitória no Dia (3 pts) • Bônus de Constância</div>';
const n = s.split(ancora).length - 1;
if (n < 1) throw new Error('ancora subtitulo ' + n);
s = s.split(ancora).join(ancora + '\n          ' + LEG);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok, legendas:', n);
