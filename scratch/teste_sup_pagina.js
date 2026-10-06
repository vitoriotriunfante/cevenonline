const fs = require('fs');
const { JSDOM } = require('c:/tmp/teste-jsdom/node_modules/jsdom');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/';
let html = fs.readFileSync(R + 'supervisores.html', 'utf8');
const anim = fs.readFileSync(R + 'animacoes/tv-animacoes.js', 'utf8');
html = html.replace('<script src="/animacoes/tv-animacoes.js"></script>', '<script>' + anim.replace(/<\/script>/g, '<\\/script>') + '</script>');
const dia = (data, estado, comp, ret) => ({ data, estado, comp, ret });
const dias = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
const sem = { hoje: '2026-10-06', dias, filiais: { TBL: [{ id: 1, nome: 'ANA TESTE', dias: [dia(dias[0], 'passado', true, true), dia(dias[1], 'passado', true, false), dia(dias[2], 'futuro', null, null), dia(dias[3], 'futuro', null, null), dia(dias[4], 'futuro', null, null)] }] } };
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/supervisores',
  beforeParse(w) {
    w.fetch = async (u) => ({ ok: true, json: async () => (String(u).includes('semana') ? sem : String(u).includes('filial=TBL') ? { supervisores: [{ nome: 'ANA TESTE', fez_compromisso: true, iniciou_ret: false, retDetalhe: null }, { nome: 'GERENTE TBL', fez_compromisso: false, iniciou_ret: false }] } : { supervisores: [] }) });
  }
});
setTimeout(() => {
  const d = dom.window.document;
  console.log('cards:', d.querySelectorAll('#cards .sxc').length, '| linhas semana:', d.querySelectorAll('#semana tr').length, '| kpis:', d.querySelectorAll('.kpi').length, '| status:', d.getElementById('status').textContent);
  console.log('GERENTE fora:', !d.body.textContent.includes('GERENTE TBL'), '| tem PARCIAL:', d.getElementById('semana').textContent.includes('PARCIAL'));
  process.exit(0);
}, 1500);
