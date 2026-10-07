const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ===== servidor: gol de mix do AS = 2 SKUs a mais que a media do cliente =====
ed('functions/api/tv-vendedor.js', (s) => {
  s = tr(s, "function mixDobrado(skusAtual, mediaHistorica) {\n  if (skusAtual == null || mediaHistorica == null) return false;\n", "// AS (Autosservico, Vitório 07/10/2026): cliente tem 100+ SKUs cadastrados, dobrar nao existe; 2 SKUs a MAIS que a media do cliente ja e gol.\nfunction mixDobrado(skusAtual, mediaHistorica, canal) {\n  if (skusAtual == null || mediaHistorica == null) return false;\n  if (canal === 'AS') return skusAtual >= mediaHistorica + 2;\n", 'mix');
  s = tr(s, "function analisaPedido(historico, cat, rca, hoje) {", "function analisaPedido(historico, cat, rca, hoje, canal) {", 'ana');
  s = tr(s, "dobrouMix: mediaHistorica != null ? mixDobrado(skusAtual, mediaHistorica) : false,", "dobrouMix: mediaHistorica != null ? mixDobrado(skusAtual, mediaHistorica, canal) : false,", 'ana2');
  s = tr(s, "const analise = analisaPedido(resultados[i], catalogo, id, dataHojeBrasilia());", "const analise = analisaPedido(resultados[i], catalogo, id, dataHojeBrasilia(), canalVend);", 'chama');
  s = tr(s, "  const usarCentral = url.searchParams.get('central') === '1';\n", "  const usarCentral = url.searchParams.get('central') === '1';\n  const canalVend = String(url.searchParams.get('canal') || '').toUpperCase() === 'AS' ? 'AS' : '';\n", 'canal');
  return s;
});
// o coletor passa o canal de cada vendedor
ed('functions/api/cron-lances.js', (s) => tr(s, "const d = await getJson(`${origin}/api/tv-vendedor?filial=${filial}&id=${codigo}&central=1`);", "const d = await getJson(`${origin}/api/tv-vendedor?filial=${filial}&id=${codigo}&central=1${(canalMapa.get(String(codigo)) || {}).canal === 'AS' ? '&canal=AS' : ''}`);", 'cron'));
// as TVs (filial e Matriz) tambem
ed('public/tvapp.html', (s) => tr(s, "const d = await j(`/api/tv-vendedor?filial=${FIL}&id=${r.id}&central=1`);", "const d = await j(`/api/tv-vendedor?filial=${FIL}&id=${r.id}&central=1${(r.canal || '').toUpperCase() === 'AS' ? '&canal=AS' : ''}`);", 'tv'));
ed('public/matrizapp.html', (s) => tr(s, "const d = await j(`/api/tv-vendedor?filial=${sig}&id=${r.id}&central=1`);", "const d = await j(`/api/tv-vendedor?filial=${sig}&id=${r.id}&central=1${(r.canal || '').toUpperCase() === 'AS' ? '&canal=AS' : ''}`);", 'mz'));

// ===== gerador: Campeao da Rodada tambem fora do AS =====
ed('scratch/build_brasileirao_dataset.py', (s) => tr(s, "'gol_conversao', 'gol_goleada')\ndef semana_as", "'gol_conversao', 'gol_goleada', 'gol_campeao')\ndef semana_as", 'gen'));
// ===== tela: Campeao fora; Dobrou o Mix vira "Gol de Mix (+2 SKUs)" no AS =====
ed('public/brasileirao.html', (s) => {
  s = tr(s, "'gol_conversao', 'gol_goleada'];", "'gol_conversao', 'gol_goleada', 'gol_campeao'];", 'tipos');
  s = tr(s, "'cartao vermelho / abandono', 'expulsao'];", "'cartao vermelho / abandono', 'expulsao', 'campeao da rodada'];", 'regras');
  // nome do gol de mix no AS (lances e gabarito)
  s = tr(s, "  lances = lances.filter(l => lanceDoCanal(l, setAS));\n  if (CANAL === 'AS') lances.sort(", "  lances = lances.filter(l => lanceDoCanal(l, setAS));\n  if (CANAL === 'AS') lances.forEach(l => { if (/^dobrou o mix/i.test(String(l.pontos_nome || ''))) { l.pontos_nome = String(l.pontos_nome).replace(/^Dobrou o Mix/i, NOME_MIX_AS); l.pontos_motivo = 'AS: pedido com 2 ou mais SKUs a mais que a média do cliente.'; } });\n  if (CANAL === 'AS') lances.sort(", 'lances');
  s = tr(s, "const semAcento = (x) =>", "const NOME_MIX_AS = 'Gol de Mix (+2 SKUs)';\nconst semAcento = (x) =>", 'nome');
  s = tr(s, ".filter(r => !(CANAL === 'AS' && regraForaDoAS(r.nome))).map(r => ({ ...r, n: norm(r.nome), qtd: 0, soma: 0 }))", ".filter(r => !(CANAL === 'AS' && regraForaDoAS(r.nome))).map(r => (CANAL === 'AS' && /^dobrou o mix/i.test(semAcento(r.nome)) ? { ...r, nome: NOME_MIX_AS, motivo: 'AS: pedido com 2 ou mais SKUs a mais que a média histórica do cliente. QUALIFICADO (nível por indústrias).' } : r)).map(r => ({ ...r, n: norm(r.nome), qtd: 0, soma: 0 }))", 'gab');
  // regulamento: linha do Dobrou o Mix troca de nome/criterio no AS e volta no Varejo
  s = tr(s, "  tb.querySelectorAll('tr').forEach(tr => { const c = tr.querySelector('td'); tr.style.display = (CANAL === 'AS' && c && regraForaDoAS(c.textContent)) ? 'none' : ''; });\n", "  tb.querySelectorAll('tr').forEach(tr => {\n    const tds = tr.querySelectorAll('td'), c = tds[0]; if (!c) return;\n    if (!c.dataset.orig) { c.dataset.orig = c.innerHTML; if (tds[2]) tds[2].dataset.orig = tds[2].innerHTML; }\n    const mix = /^dobrou o mix/i.test(semAcento(c.textContent).replace(/^[^a-z0-9]+/, ''));\n    if (CANAL === 'AS' && mix) { c.innerHTML = '📦 ' + NOME_MIX_AS; if (tds[2]) tds[2].textContent = 'AS: pedido com 2 ou mais SKUs a mais que a média histórica do cliente (cliente do AS tem 100+ SKUs, dobrar não existe). QUALIFICADO: nível e extra de pontos pelas indústrias do pedido.'; } else { c.innerHTML = c.dataset.orig; if (tds[2] && tds[2].dataset.orig) tds[2].innerHTML = tds[2].dataset.orig; }\n    tr.style.display = (CANAL === 'AS' && regraForaDoAS(c.dataset.orig ? semAcento(c.dataset.orig.replace(/<[^>]*>/g, '')) : c.textContent)) ? 'none' : '';\n  });\n", 'filtra');
  s = tr(s, "<strong>Valem iguais ao Varejo:</strong> Resgate de Inativo, Dobrou o Mix, Dobradinha das Quinzenas, Defesa, Super Pedido, Pedido Feito na Rota, devoluções, pênaltis e impedimento de GPS.", "<strong>Também fora no AS:</strong> Campeão da Rodada (o bônus de 100% da meta já cumpre esse papel). <strong>Gol de Mix (+2 SKUs):</strong> no AS o \"Dobrou o Mix\" é trocado por pedido com 2 ou mais SKUs a mais que a média do cliente (+4, qualificado por indústrias). <strong>Valem iguais ao Varejo:</strong> Resgate de Inativo, Dobradinha das Quinzenas, Defesa, Super Pedido (valor do AS em definição), Pedido Feito na Rota, devoluções, pênaltis e impedimento de GPS.", 'regtexto');
  s = tr(s, "gol de SKUs (2 a mais que a média, no lugar do \"dobrou o mix\"), marca própria", "marca própria", 'regtexto2');
  return s;
});
console.log('tudo ok');
