import fs from 'fs';
const r = JSON.parse(fs.readFileSync(process.argv[2]))[0].results;
const N = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const FALTA = [
  [/COMISS|SALARI|\bRMV\b|\bRV\b|REMUNERA|BONIFIC|GANHO/, 'comissão/RV em R$'],
  [/ENTREG|RASTREI|FRETEIRO|CHEGAD|CHEGOU|CANHOTO/, 'entrega (está no NEXUS, não no CEVEN)'],
  [/ESTOQUE/, 'estoque'], [/EXCEL/, 'arquivo Excel'], [/CORT/, 'cortes do pedido'],
  [/2025|DEZEMBRO/, 'histórico de 2025'], [/SUGESTAO DE PEDIDO/, 'sugestão de pedido'],
  [/APENAS MARS|SO MARS/, 'clientes que compraram só uma indústria'], [/PROMOC|COMBO/, 'promoções/combos'],
  [/CADASTRO DE (CLIENTES E )?PRODUTO|REDES/, 'cadastro/redes'], [/FASEAMENTO/, 'faseamento da semana'], [/Q2/, 'Q2'],
  [/BLOQUEIO COMERCIAL/, 'valor em bloqueio comercial'], [/DIFERENCA EM PONTOS/, 'diferença de pontos para o concorrente'],
];
const VAGO = /^(\.+|TODAS?( AS PERGUNTAS)?|ESTOU SATISFEITO|PARA DEPOIS PERGUNTO,?|ATE QUE ENFIM|BOA TARDE J|AUXILIO E DADOS PARA CLIENTES|TODAS REFERENTES.*|ATUALIZE MEUS DADOS AI)$/;
const out = { feita: [], atencao: [], nao_vai: [] };
for (const x of r) {
  const t = N(x.texto).replace(/\[PASSAPORTE JOTA - INDICADORES DESEJADOS\]\s*/, '').replace(/\[SEM RESPOSTA\]\s*/, '').replace(/\s+/g, ' ').trim();
  const falta = FALTA.filter(([re]) => re.test(t)).map(([, n]) => n);
  let sit, resp;
  if (x.papel === 'diretoria' && !VAGO.test(t)) { sit = 'atencao'; resp = 'Diretoria: revisar à parte'; }
  else if (VAGO.test(t) || t.length < 4) { sit = 'nao_vai'; resp = 'Sem pedido concreto. O menu do Jota (digite menu) mostra tudo o que já dá para ver.'; }
  else if (falta.length) { sit = 'atencao'; resp = 'Já no Jota: o resto do pedido (digite menu). Ainda falta: ' + falta.join(', ') + '.'; }
  else { sit = 'feita'; resp = 'Já está no Jota: digite menu e escolha o número.'; }
  out[sit].push({ id: x.id, quem: `${x.papel} ${x.filial || ''} ${x.nome}`, t: t.slice(0, 110), resp });
}
fs.writeFileSync('scratch/sugestoes_simulacao.json', JSON.stringify(out, null, 1));
const cont = {}; for (const a of out.atencao) for (const f of (a.resp.split('Ainda falta: ')[1] || 'diretoria').replace('.', '').split(', ')) cont[f] = (cont[f] || 0) + 1;
console.log('feita', out.feita.length, 'atencao', out.atencao.length, 'nao_vai', out.nao_vai.length); console.log(cont);
for (const k of ['atencao', 'nao_vai']) { console.log('==', k); for (const a of out[k]) console.log(a.id, a.quem, '|', a.t.slice(0, 70), '=>', a.resp.split('Ainda falta: ')[1] || ''); }
