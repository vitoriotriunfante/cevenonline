const fs = require('fs');
const { JSDOM } = require('c:/tmp/teste-jsdom/node_modules/jsdom');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/';
for (const pg of ['tvapp.html', 'matrizapp.html']) {
  const anim = fs.readFileSync(R + 'animacoes/tv-animacoes.js', 'utf8');
  const html = fs.readFileSync(R + pg, 'utf8').replace('<script src="/animacoes/tv-animacoes.js"></script>', '<script>' + anim.replace(/<\/script>/g, '<\/script>') + '</script>');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/tv?filial=TBL', beforeParse(w) { w.fetch = async () => ({ ok: true, json: async () => ({}) }); w.HTMLCanvasElement.prototype.getContext = () => null; } });
  setTimeout(() => {
    const w = dom.window;
    const v = { id: 343, nome: 'MONICA KUNZEL TOLFO', sup: 'GIANI GREGOLIN', canal: 'VJ', carteira: '', cl: [], d: { industrias_dia: [{ n: 'A', v: 100 }, { n: 'B', v: 90 }, { n: 'C', v: 80 }, { n: 'D', v: 70 }, { n: 'E', v: 60 }] } };
    for (const sub of ['goleada', 'super_pedido', 'relampago', 'hattrick', 'campeao']) {
      const T = w.telaVAR({ tipo: sub === 'hattrick' ? 'hattrick' : 'gol', sig: 'TBL', v, a: { subtipo: sub, v }, subtipo: sub, sub: 'teste' });
      console.log(pg, sub.padEnd(12), (T.dec.match(/class="sp">([^<]*)</) || [])[1], (T.dec.match(/nv-([a-z]+)/) || [])[1] || '(sem nivel)');
    }
    process.exit(0);
  }, 1500);
  break;
}
