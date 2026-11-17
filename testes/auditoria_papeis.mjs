// AUDITORIA POR PAPEL (Vitorio, 17/11/2026: "faca uma ultra mega auditoria em tudo que fizemos... se esta tudo amarrado... vendedor / supervisor / gerente / diretor").
// Pergunta SECA ao JOTA de producao (/api/jota-seco: mesma resposta, nada enviado) e passa cada resposta na regua (testes/jota_regua.mjs).
// Tambem confere a AMARRACAO: a mesma pergunta sobre a mesma pessoa feita por papeis diferentes tem que trazer os mesmos numeros.
// Uso: JOTA_CHAVE=... node testes/auditoria_papeis.mjs (ou EVO_KEY=... no GitHub)  ->  relatorio LOCAL em saida_auditoria/ (fora do git) + D1 (/api/jota-auditoria).
// REPOSITORIO PUBLICO: o relatorio tem cliente e valores; no robo (CI) o log mostra SO contagens.
import fs from 'fs';
import { avaliar } from './jota_regua.mjs';
const CHAVE = process.env.JOTA_CHAVE || '', EVO = process.env.EVO_KEY || '', SITE = process.env.SITE || 'https://ceven-cftv-matrix.pages.dev', CI = !!process.env.CI;
if (!CHAVE && !EVO) { console.error('JOTA_CHAVE ou EVO_KEY nao definida'); process.exit(1); }
const AUT = CHAVE ? `?chave=${encodeURIComponent(CHAVE)}` : '', HDR = { 'Content-Type': 'application/json', ...(EVO && !CHAVE ? { 'X-Evo-Key': EVO } : {}) };
const P = {
  vendedor: { nome: 'TAMARA GUEDES', papel: 'vendedor', filial: 'TCV', rca: '352', celular: '5566996389884' },
  supervisor: { nome: 'WASHINGTON FLORES DA ROSA', papel: 'supervisor', filial: 'API', celular: '554187014801' },
  gerente: { nome: 'MARCELO', papel: 'gerente', filial: 'API', celular: '550000000002' },
  diretoria: { nome: 'VITORIO', papel: 'diretoria', filiais: [], celular: '554187525605' },
};
const Q = {
  vendedor: ['Bom dia', 'Como estou?', 'Quanto vendi hoje?', 'status dos pedidos', 'pedido 352001310', 'clientes sem compra com visita hoje', 'curva negativa', 'minha rota de hoje', 'metas das industrias', 'como estou na liga', 'meus cortes', 'minhas devoluções', 'recorrência', 'o que oferecer hoje'],
  supervisor: ['Matinal', 'Minha equipe hoje', 'fechamento do dia', 'zerados', 'quem falta positivar', 'visitados sem compra', 'metas das industrias da equipe', 'tendência', 'liga da minha equipe', 'pedidos bloqueados da equipe', 'Bom dia da Tamara de TCV'],
  gerente: ['Como está a filial?', 'tendência', 'positivação', 'zerados', 'indústrias de API', 'hoje', 'visitados sem compra', 'liga da filial', 'Matinal Washington de API'],
  diretoria: ['Brasil agora', 'Hoje no Brasil', 'Venda do Brasil agora', 'Tendência das filiais?', 'Positivação no Brasil comparada', 'Indústrias de TPH', 'Zerados TCA', 'Visitados sem compra TCA', 'Prospecção Vinicius de TCA', 'Como estamos de Mars Pet em TPH', 'Bom dia da Tamara de TCV', 'Matinal Washington de API', 'pedido 352001310', 'Liga'],
};
async function seco(contato, perguntas) {
  const out = [];
  for (let i = 0; i < perguntas.length; i += 3) {
    const r = await fetch(`${SITE}/api/jota-seco${AUT}`, { method: 'POST', headers: HDR, body: JSON.stringify({ contato, perguntas: perguntas.slice(i, i + 3) }), signal: AbortSignal.timeout(280000) }).then((x) => x.json()).catch((e) => perguntas.slice(i, i + 3).map((p) => ({ pergunta: p, resposta: 'ERRO: ' + e.message, ms: 0 })));
    out.push(...r);
  }
  return out;
}
const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const dia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const md = [`# Auditoria por papel — ${dia} ${hora}`, '', 'Perguntas secas ao JOTA de produção (/api/jota-seco, nada enviado) + régua (testes/jota_regua.mjs).', ''];
const resumo = [], RES = {}, FAL = [];
const R = {};
for (const [papel, perguntas] of Object.entries(Q)) {
  const rs = await seco(P[papel], perguntas); R[papel] = rs;
  let ok = 0; const sec = [`## ${papel} (${P[papel].nome}${P[papel].filial ? ' · ' + P[papel].filial : ''})`, ''];
  for (const x of rs) {
    const resp = String(x.resposta || '');
    const v = avaliar(x.pergunta, resp, { papel, hora }) || [];
    const bloq = v.filter((f) => f.severidade === 'bloqueia' || f.bloqueia), vazio = !resp.trim() || /^ERRO/.test(resp);
    const passa = !bloq.length && !vazio; if (passa) ok++; else FAL.push({ papel, pergunta: x.pergunta, regras: vazio ? ['SEM RESPOSTA'] : bloq.map((f) => `${f.id} ${f.detalhe || ''}`), resposta: resp.slice(0, 600) });
    sec.push(`### ${passa ? '✅' : '❌'} ${x.pergunta} · ${Math.round((x.ms || 0) / 1000)}s`, ...(vazio ? ['SEM RESPOSTA'] : []), ...v.map((f) => `- ${f.regra || f.id || ''} ${f.nome || ''}: ${f.detalhe || f.msg || ''}`), '```', resp.slice(0, 2500), '```', '');
  }
  resumo.push(`- **${papel}**: ${ok} de ${rs.length} ok`); RES[papel] = { ok, total: rs.length };
  md.push(...sec);
  console.log(papel, ok, 'de', rs.length);
}
// AMARRACAO: Tamara vista por ela, pelo supervisor e pela diretoria = mesmos numeros (acumulado e positivacao)
const nums = (s) => (String(s || '').match(/R\$ ?[\d.]+|\d+ de \d+/g) || []).slice(0, 6).join(' | ');
const tam = { vendedor: (R.vendedor || []).find((x) => x.pergunta === 'Bom dia'), supervisor: (R.supervisor || []).find((x) => /Tamara/.test(x.pergunta)), diretoria: (R.diretoria || []).find((x) => /Tamara/.test(x.pergunta)) };
md.splice(4, 0, '## Resumo', ...resumo, '', '## Amarração — a Tamara vista por ela, pelo supervisor e pela diretoria', ...Object.entries(tam).map(([k, x]) => `- ${k}: ${x ? nums(x.resposta) : 'sem resposta'}`), '');
if (!CI) { fs.mkdirSync('saida_auditoria', { recursive: true }); fs.writeFileSync(`saida_auditoria/AUDITORIA_PAPEIS_${dia}.md`, md.join('\n')); console.log(resumo.join('\n')); console.log(Object.entries(tam).map(([k, x]) => `${k}: ${x ? nums(x.resposta) : '-'}`).join('\n')); }
const amarra = Object.fromEntries(Object.entries(tam).map(([k, x]) => [k, x ? nums(x.resposta) : null])), iguais = new Set(Object.values(amarra).filter(Boolean)).size <= 1;
const g = await fetch(`${SITE}/api/jota-auditoria${AUT}`, { method: 'POST', headers: HDR, body: JSON.stringify({ origem: CI ? 'robo' : 'manual', resumo: RES, falhas: FAL, amarracao: { ...amarra, iguais } }) }).then((x) => x.json()).catch((e) => ({ erro: e.message }));
console.log('gravado no D1:', g.ok ? `${g.aprovadas}/${g.total} (anterior ${g.anterior || '-'})${g.piorou ? ' PIOROU' : ''}` : JSON.stringify(g), '· amarracao', iguais ? 'ok' : 'DIFERENTE');
if (g.piorou) process.exitCode = 2;
