const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// regulamento: cada 3 vendas seguidas = 1 Hat-Trick (15 vendas seguidas = 5)
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) ed(rel, (s) => {
  s = tr(s, '"motivo": "3 vendas seguidas: 3 clientes visitados em sequência, todos com venda, sem nenhuma visita sem venda entre eles, no mesmo dia (sem limite de tempo)."', '"motivo": "Cada 3 vendas seguidas é um Hat-Trick: 3 clientes visitados em sequência, todos com venda, sem nenhuma visita sem venda entre eles, no mesmo dia, sem limite de tempo. Vale por trinca completa e sem repetir venda: 6 vendas seguidas = 2 Hat-Tricks; 15 = 5."', 'motivo'); JSON.parse(s); return s;
});
ed('public/brasileirao.html', (s) => s.split("3 vendas seguidas (3 clientes visitados em sequência, todos com venda)").join("cada 3 vendas seguidas é um Hat-Trick (6 seguidas = 2; 15 = 5)"));

// coletor: uma trinca por bloco de 3 vendas consecutivas; chave pelo NUMERO da trinca no dia (nao depende da hora: check-in sincronizado tarde nao duplica)
ed('functions/api/cron-lances.js', (s) => {
  const a = s.indexOf("      for (let i = 0; i + 2 < visitas.length; i++) {\n        if (visitas[i].venda && visitas[i + 1].venda && visitas[i + 2].venda && t.agoraMin >= visitas[i + 2].horaMin) {");
  const b = s.indexOf("\n    }\n", a);
  if (a < 0 || b < 0) throw new Error('hat coletor');
  const novo = `      let corrida = [], numero = 0; // corrida = vendas consecutivas; a cada 3 fecha uma trinca (6 seguidas = 2 hat-tricks; 15 = 5)
      for (const vis of visitas) {
        if (!vis.venda) { corrida = []; continue; }
        corrida.push(vis);
        if (corrida.length % 3 === 0 && t.agoraMin >= vis.horaMin) {
          numero++;
          const tri = corrida.slice(-3), janelaMin = tri[2].horaMin - tri[0].horaMin;
          out.push({ chave: \`gol_hattrick|\${v.id}|\${numero}\`, nivel: 'hattrick', v, prova: comQ(v, \`3 vendas seguidas (3 check-ins em \${janelaMin} min): \${tri[0].hms}, \${tri[1].hms}, \${tri[2].hms} (trinca \${numero} do dia)\`) });
        }
      }`;
  return s.slice(0, a) + novo + s.slice(b);
});

// remove o "um por dia" (estava errado: cada trinca vale)
ed('functions/api/brasileirao-lances.js', (s) => {
  const a = s.indexOf("    // HAT-TRICK = UM POR VENDEDOR POR DIA (08/10/2026)");
  const b = s.indexOf("    const lancesRaw = [...grupos.values()]", a);
  if (a < 0 || b < 0) throw new Error('api');
  return s.slice(0, a) + s.slice(b);
});
ed('functions/api/tv-lances.js', (s) => {
  const a = s.indexOf("    // Hat-trick: UM por vendedor por dia");
  const b = s.indexOf("    const antes = validos.length;", a);
  if (a < 0 || b < 0) throw new Error('tvl');
  return s.slice(0, a) + s.slice(b);
});
console.log('tudo ok');
