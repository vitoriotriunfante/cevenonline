const fs = require('fs');
const { JSDOM } = require('c:/tmp/teste-jsdom/node_modules/jsdom');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/';
const SP = process.env.SP;
const anim = fs.readFileSync(R + 'animacoes/tv-animacoes.js', 'utf8');
let html = fs.readFileSync(R + 'tvapp.html', 'utf8').replace('<script src="/animacoes/tv-animacoes.js"></script>', '<script>' + anim.replace(/<\/script>/g, '<\/script>') + '</script>');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/tv?filial=TSJ', beforeParse(w) { w.fetch = async () => ({ ok: true, json: async () => ({}) }); w.HTMLCanvasElement.prototype.getContext = () => null; } });
setTimeout(() => {
  const w = dom.window;
  const css = [...w.document.querySelectorAll('style')].map((s) => s.textContent).join('\n') + '\n' + (fs.readFileSync(R + 'animacoes/tv-animacoes.js', 'utf8').match(/css\.textContent =[\s\S]*?;\n/) || [''])[0];
  const v = { id: 1021, nome: 'JANAINA FONTES MONTESI', sup: 'ANA CRISTINA DOS SANTOS YAMATO', canal: 'VJ', rota: 20, feitas: 3, dig: 0, pos: 0 };
  const it = { tipo: 'penalti', v, itens: [{ nivel: 'penalti', c: { nome: 'LUIZ CARLOS R DE SOUZA MOGI DAS CRUZES', motivo: 'ESTABELECIMENTO TEMPORARIAMENTE FECHADO' }, dias: 90 }, { nivel: 'penalti', c: { nome: 'ADEGA CAMINHO', motivo: 'ENCERROU AS ATIVIDADES' }, dias: 305 }] };
  const T = w.telaVAR(it);
  fs.writeFileSync(SP + '/shots/real_pen.html', `<!doctype html><meta charset="utf-8"><style>${css}</style><body style="margin:0;background:#070b14"><div id="ov" class="show"><div class="dec"><h1>${T.titulo} · DECISÃO DO VAR</h1>${T.dec}<div class="vd">${T.veredito}</div></div><small>clique para fechar · fecha em 18s</small></div></body>`);
  console.log('ok pen');
  process.exit(0);
}, 1500);
