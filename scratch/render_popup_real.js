const fs = require('fs');
const { JSDOM } = require('c:/tmp/teste-jsdom/node_modules/jsdom');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/';
const SP = process.env.SP;
const anim = fs.readFileSync(R + 'animacoes/tv-animacoes.js', 'utf8');
let html = fs.readFileSync(R + (process.argv[2] || 'tvapp.html'), 'utf8');
html = html.replace('<script src="/animacoes/tv-animacoes.js"></script>', '<script>' + anim.replace(/<\/script>/g, '<\\/script>') + '</script>');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/tv?filial=TBL', beforeParse(w) { w.fetch = async () => ({ ok: true, json: async () => ({}) }); w.HTMLCanvasElement.prototype.getContext = () => null; } });
setTimeout(() => {
  const w = dom.window;
  const css = [...w.document.querySelectorAll('style')].map((s) => s.textContent).join('\n') + '\n' + fs.readFileSync(R + 'animacoes/tv-animacoes.js', 'utf8').match(/css\.textContent =[\s\S]*?;\n/) ;
  const casos = {
    gol: { tipo: 'gol', v: { id: 420, nome: 'CRISTIAN DE OLIVEIRA VARANDA', sup: 'FLAVIO RUFINO', canal: 'VJ', carteira: '' }, sub: 'PANIFICADORA E CONF MILENA · Drible da Vaca! Inativo há mais de 90 dias recuperado!', c: { nome: 'PANIFICADORA E CONF MILENA', checkin_horario: '08:40', checkout_horario: null, tempo_visita: null, pedidoHoje: { num: '105000638', status_pedido: 'LIBERADO', valor: 318 }, industrias: [{ n: 'MASTERFOODS BRASIL', v: 107.6 }, { n: 'HEINZ BRASIL', v: 104.1 }, { n: 'HARIBO BRASIL', v: 65.88 }, { n: 'ENERGIZER', v: 40.32 }] }, a: { subtipo: 'drible_vaca' } },
    imp: { tipo: 'impedimento', v: { id: 356, nome: 'WESLEI DE SOUZA ZANATTA', sup: 'ROSIVAL JESUINO DA SILVA', canal: 'VJ' }, c: { nome: 'AGRO SHOP STI', id: 12278, checkin_horario: '09:52', checkout_horario: '09:52', tempo_visita: '00:00' }, sub: 'Visita 00:00 no cliente AGRO SHOP STI', a: { subtipo: 'visita0', c: { nome: 'AGRO SHOP STI', id: 12278, checkin_horario: '09:52', checkout_horario: '09:52', tempo_visita: '00:00' } } },
    am: { tipo: 'amarelos', l: [{ v: { id: 1, nome: 'ANDRE LUIS SOUZA', sup: 'IGOR RODRIGUES DUARTE', feitas: 0, rota: 12 }, subtipo: 'sem_checkin' }, { v: { id: 2, nome: 'MARCOS PAULO LIMA', sup: 'SERGIO LOPES', feitas: 3, rota: 14 }, subtipo: 'sem_venda' }] }
  };
  for (const [nome, item] of Object.entries(casos)) {
    let T; try { T = w.telaVAR(item); } catch (e) { console.log('ERRO telaVAR', nome, e.message); continue; }
    const pagina = `<!doctype html><meta charset="utf-8"><style>${css}</style><body style="margin:0;background:#070b14"><div id="ov" class="show"><div class="dec"><h1>${T.titulo} · DECISÃO DO VAR</h1>${T.dec}<div class="vd">${T.veredito}</div></div><small>clique para fechar · fecha em 18s</small></div></body>`;
    fs.writeFileSync(SP + '/shots/real_' + nome + '.html', pagina);
    console.log('ok', nome, '| selo:', /class="selo"/.test(T.dec), '| pontos:', (T.dec.match(/class="sp">([^<]*)</) || [])[1]);
  }
  process.exit(0);
}, 1500);
