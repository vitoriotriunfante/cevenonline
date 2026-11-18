// AUDITORIA AMPLA POR PAPEL (Vitorio, 17/11/2026: "auditou todas as conversas? validou todas as perguntas? em no minimo 4 vendedores por filial... 2 supervisores...
// gerentes e etc? eu preciso te pedir isso?"). 4 vendedores por filial (varejo e AS), 2 supervisores por filial, todos os gerentes e a diretoria, cada um com as
// perguntas do proprio menu + perguntas livres reais. Pergunta SECA ao JOTA de producao (/api/jota-seco, nada enviado) e passa na regua.
// Relatorio LOCAL (saida_auditoria/, fora do git) + resumo e falhas no D1 (/api/jota-auditoria). 2 chamadas por vez (o D1 nao aguenta mais).
// Uso: JOTA_CHAVE=... node testes/auditoria_ampla.mjs
import fs from 'fs';
import { avaliar } from './jota_regua.mjs';
const CHAVE = process.env.JOTA_CHAVE, SITE = 'https://ceven-cftv-matrix.pages.dev';
if (!CHAVE) { console.error('JOTA_CHAVE nao definida'); process.exit(1); }
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const tit = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
const mostra = await (await fetch(`${SITE}/api/tv-mostra`)).json();
const FIL = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
const pessoas = [];
for (const f of FIL) {
  const L = Object.entries(mostra.filiais || {}).filter(([k]) => k.startsWith(f)).flatMap(([, l]) => l || []).filter((v) => v.mostra && v.na_arvore !== false && !/VAGO|SETOR/i.test(v.nome));
  const vj = L.filter((v) => /VJ|ESP|FARMA/.test(v.canal)).sort((a, b) => Number(a.rca) - Number(b.rca)), as = L.filter((v) => /AS/.test(v.canal));
  const pega = (arr, n) => { const out = []; for (let i = 0; i < n && arr.length; i++) out.push(arr[Math.floor((i + 0.5) * arr.length / n)]); return out; };
  const vend = [...pega(vj, as.length ? 3 : 4), ...pega(as, as.length ? 1 : 0)];
  for (const v of vend) pessoas.push({ papel: 'vendedor', c: { nome: v.nome, papel: 'vendedor', filial: f, rca: String(v.rca), celular: '5500' + f.charCodeAt(0) + v.rca }, extra: [] });
  const sups = [...new Set(L.map((v) => v.supervisor).filter(Boolean))].slice(0, 2);
  for (const s of sups) { const um = L.find((v) => v.supervisor === s && /VJ/.test(v.canal)) || L.find((v) => v.supervisor === s); pessoas.push({ papel: 'supervisor', c: { nome: s, papel: 'supervisor', filial: f, supervisor: s, grupo: um && um.grupo || null, celular: '5501' + f.charCodeAt(0) + sups.indexOf(s) }, extra: um ? [`onde está ${tit(um.nome).split(' ')[0]} ${um.rca}`] : [] }); }
  const sup1 = sups[0];
  pessoas.push({ papel: 'gerente', c: { nome: 'GERENTE ' + f, papel: 'gerente', filial: f, celular: '5502' + f.charCodeAt(0) }, extra: [`indústrias de ${f}`, ...(sup1 ? [`matinal ${tit(sup1).split(' ')[0]} de ${f}`] : [])] });
}
pessoas.push({ papel: 'diretoria', c: { nome: 'VITORIO', papel: 'diretoria', filiais: [], celular: '554187525605' }, extra: [] });
const Q = {
  vendedor: ['Bom dia', 'Como estou?', 'Quanto vendi hoje?', 'status dos pedidos', 'clientes sem compra com visita hoje', 'curva negativa', 'minha rota de hoje', 'metas das industrias', 'como estou na liga', 'meus cortes', 'minhas devoluções', 'recorrência', 'o que oferecer hoje', 'prospecção', 'minha carteira', 'campanhas do mês', 'quem falta visitar hoje'],
  supervisor: ['Matinal', 'Minha equipe hoje', 'fechamento do dia', 'zerados', 'quem falta positivar', 'visitados sem compra', 'metas das industrias da equipe', 'tendência', 'liga da minha equipe', 'pedidos bloqueados da equipe', 'devoluções da equipe', 'bom dia', 'justificativas por vendedor', 'cortes da equipe', 'gap dos clientes contra a média de 3 meses'],
  gerente: ['Como está a filial?', 'tendência', 'positivação', 'zerados', 'hoje', 'visitados sem compra', 'liga da filial', 'bom dia', 'margem', 'devolução por motivo', 'cortes', 'faturamento até a data', 'carteira por status'],
  diretoria: ['Brasil agora', 'Hoje no Brasil', 'Venda do Brasil agora', 'Tendência das filiais?', 'Positivação no Brasil comparada', 'Indústrias de TPH', 'Zerados TCA', 'Visitados sem compra TCA', 'Prospecção Vinicius de TCA', 'Como estamos de Mars Pet em TPH', 'Bom dia da Tamara de TCV', 'Matinal Washington de API', 'onde está a Fernanda de TSJ', 'Liga', 'bom dia', 'margem por filial', '% de atingimento por filial', 'devolução por motivo', 'cortes por filial', 'faturamento até a data contra a média dos 3 meses', 'gap dos clientes contra a média de 3 meses TPH', 'justificativas por vendedor TCV', 'plano de visitas por filial', 'carteira por status e motivo'],
};
const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const res = { porPapel: {}, porRegra: {}, falhas: [], tot: 0, ok: 0 };
const fila = pessoas.map((p) => ({ p, q: [...Q[p.papel], ...p.extra] }));
let prox = 0;
async function trabalhador() {
  while (prox < fila.length) {
    const { p, q } = fila[prox++];
    for (let i = 0; i < q.length; i += 3) {
      const lote = q.slice(i, i + 3);
      const rs = await fetch(`${SITE}/api/jota-seco?chave=${encodeURIComponent(CHAVE)}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ contato: p.c, perguntas: lote }), signal: AbortSignal.timeout(290000) }).then((x) => x.json()).catch((e) => lote.map((x) => ({ pergunta: x, resposta: 'ERRO: ' + e.message })));
      for (const x of Array.isArray(rs) ? rs : []) {
        res.tot++; const pp = (res.porPapel[p.papel] = res.porPapel[p.papel] || { ok: 0, total: 0 }); pp.total++;
        const resp = String(x.resposta || ''), v = avaliar(x.pergunta, resp, { papel: p.papel, hora }) || [];
        const bloq = v.filter((f) => f.severidade === 'bloqueia'), vazio = !resp.trim() || /^ERRO/.test(resp);
        if (!bloq.length && !vazio) { res.ok++; pp.ok++; continue; }
        for (const f of (vazio ? [{ id: 'VAZIO' }] : bloq)) res.porRegra[f.id] = (res.porRegra[f.id] || 0) + 1;
        res.falhas.push({ papel: p.papel, quem: `${p.c.nome} ${p.c.filial || ''}${p.c.rca ? ' ' + p.c.rca : ''}`, pergunta: x.pergunta, regras: vazio ? ['VAZIO'] : bloq.map((f) => `${f.id} ${f.detalhe || ''}`), resposta: resp.slice(0, 600) });
      }
      fs.mkdirSync('saida_auditoria', { recursive: true }); fs.writeFileSync('saida_auditoria/AUDITORIA_AMPLA_PARCIAL.json', JSON.stringify(res));
      process.stdout.write(`\r${res.ok}/${res.tot}`);
    }
  }
}
console.log('pessoas:', pessoas.length, JSON.stringify(pessoas.reduce((a, p) => ({ ...a, [p.papel]: (a[p.papel] || 0) + 1 }), {})), '· perguntas:', fila.reduce((a, x) => a + x.q.length, 0));
await Promise.all([trabalhador(), trabalhador()]);
console.log(`\nAPROVADAS ${res.ok} de ${res.tot} (${(res.ok / Math.max(1, res.tot) * 100).toFixed(1)}%)`);
console.log('por papel', JSON.stringify(res.porPapel)); console.log('por regra', JSON.stringify(res.porRegra));
fs.writeFileSync('saida_auditoria/AUDITORIA_AMPLA.json', JSON.stringify(res, null, 1));
await fetch(`${SITE}/api/jota-auditoria?chave=${encodeURIComponent(CHAVE)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origem: 'auditoria ampla', resumo: res.porPapel, falhas: res.falhas.slice(0, 200) }) }).catch(() => null);
