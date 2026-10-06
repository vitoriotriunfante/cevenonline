const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// tabela da semana: coluna de filial quando a lista mistura filiais
ed('public/animacoes/tv-animacoes.js', (s) => {
  s = tr(s, "return '<tr><td class=\"n\">' + e(s.nome) + '</td>' + tds", "return '<tr><td class=\"n\">' + (s.filial ? '<b style=\"color:var(--acc,#38bdf8);margin-right:8px\">' + e(s.filial) + '</b>' : '') + e(s.nome) + '</td>' + tds", 'filial');
  return s;
});

ed('public/matrizapp.html', (s) => {
  const i = s.indexOf('function renderSupFormatoFilial() {');
  const f = s.indexOf('function renderSupView() {', i);
  if (i < 0 || f < 0) throw new Error('bloco sup');
  const novo =
`// Estado da tela de Supervisores: filtro (GIRAR = troca sozinha entre as filiais; TODAS; ou uma filial travada) e "so pendentes"
let SUP_FILTRO = 'GIRAR', SUP_SO_PEND = false, SUP_HTML = '';
window.supFiltro = (v) => { SUP_FILTRO = v; SUP_HTML = ''; render(); };
window.supSoPend = () => { SUP_SO_PEND = !SUP_SO_PEND; SUP_HTML = ''; render(); };
window.supTravar = () => { SUP_FILTRO = SUP_FILTRO === 'GIRAR' ? ORDEM[idxFil % ORDEM.length] : 'GIRAR'; SUP_HTML = ''; render(); };
function renderSupFormatoFilial() {
  const el = $('det');
  const girando = SUP_FILTRO === 'GIRAR';
  const siglas = girando ? [ORDEM[idxFil % ORDEM.length]] : SUP_FILTRO === 'TODAS' ? ORDEM : [SUP_FILTRO];
  const sups = (sig) => (SUPS[sig] || []).filter(x => !ehSupFalso(x.nome));
  const pendente = (x) => !x.fez_compromisso || !x.iniciou_ret;
  const totSup = siglas.reduce((a, sig) => a + sups(sig).length, 0), totPend = siglas.reduce((a, sig) => a + sups(sig).filter(pendente).length, 0);
  const carregado = siglas.some(sig => SUPS[sig]);
  const semana = siglas.flatMap(sig => ((SEMANA && SEMANA.filiais && SEMANA.filiais[sig]) || []).map(x => ({...x, filial: siglas.length > 1 ? sig : ''})));
  const opc = (v, t) => '<option value="' + v + '"' + (SUP_FILTRO === v ? ' selected' : '') + '>' + t + '</option>';
  const controles = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:2px 0 8px">' +
    '<select onchange="supFiltro(this.value)" style="background:#0f1626;color:#e8eefc;border:1px solid #38bdf8;border-radius:8px;padding:6px 10px;font-weight:700">' + opc('GIRAR', '🔄 Girar entre as filiais') + opc('TODAS', '📋 Todas as filiais') + ORDEM.map(sg => opc(sg, sg)).join('') + '</select>' +
    '<button onclick="supTravar()" style="background:' + (girando ? '#334155' : '#b45309') + ';color:#fff;border:0;border-radius:8px;padding:7px 12px;font-weight:800;cursor:pointer" title="Trava a tela na filial que está aparecendo (ou volta a girar)">' + (girando ? '🔓 Girando · clique para travar nesta filial' : '🔒 Travado · clique para voltar a girar') + '</button>' +
    '<button onclick="supSoPend()" style="background:' + (SUP_SO_PEND ? '#b91c1c' : '#334155') + ';color:#fff;border:0;border-radius:8px;padding:7px 12px;font-weight:800;cursor:pointer">' + (SUP_SO_PEND ? '⚠ Só pendentes (ligado)' : 'Só pendentes') + '</button></div>';
  const titulo = (girando ? siglas[0] + ' · ' + ((idxFil % ORDEM.length) + 1) + ' de ' + ORDEM.length : SUP_FILTRO === 'TODAS' ? 'todas as filiais' : SUP_FILTRO);
  // painel gerencial no TOPO, fixo (sticky) enquanto os cards rolam por baixo
  const topo = '<div style="position:sticky;top:26px;z-index:6;background:var(--card);padding-bottom:6px;border-bottom:1px solid var(--line);max-height:44vh;overflow:auto">' +
    '<h2 style="margin:4px 0 2px"><span>Painel gerencial da semana · ' + titulo + '</span><b>fez = matinal + rota</b></h2>' + supSemanaHtml(semana, SEMANA) + '</div>';
  let cards = '';
  for (const sig of siglas) {
    let l = sups(sig); if (SUP_SO_PEND) l = l.filter(pendente);
    if (!SUPS[sig]) { cards += '<div style="color:var(--mut);padding:8px 0">' + sig + ': aguardando dados dos supervisores…</div>'; continue; }
    if (siglas.length > 1) cards += '<h2 style="margin:10px 0 4px"><span>' + sig + '</span><b>' + sups(sig).filter(pendente).length + ' pendente(s) de ' + sups(sig).length + '</b></h2>';
    cards += l.length ? supCardsHtml(l) : '<div style="color:var(--mut);padding:6px 0">' + (SUP_SO_PEND ? 'Nenhum pendente.' : 'Sem supervisores.') + '</div>';
  }
  const html = '<h2><span>Supervisores · matinal (compromisso) e rota (RET)</span><b>' + (carregado ? totPend + ' pendente(s) de ' + totSup : 'carregando…') + '</b></h2>' + controles + topo + cards;
  if (html !== SUP_HTML) { SUP_HTML = html; el.innerHTML = html; } // so redesenha quando muda: o menu aberto e a rolagem nao se perdem a cada segundo
}
`;
  s = s.slice(0, i) + novo + s.slice(f);
  return s;
});
console.log('tudo ok');
