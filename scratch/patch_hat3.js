const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
const VER = '2026-10-13.2';

// ===== regulamento: Hat-Trick = 3 VENDAS SEGUIDAS (sem limite de tempo) =====
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) ed(rel, (s) => {
  s = tr(s, '"motivo": "3 pedidos digitados em sequência em um curto intervalo (até 120 minutos)."', '"motivo": "3 vendas seguidas: 3 clientes visitados em sequência, todos com venda, sem nenhuma visita sem venda entre eles, no mesmo dia (sem limite de tempo)."', 'motivo');
  s = tr(s, '"versao_regras": "2026-10-13.1"', '"versao_regras": "' + VER + '"', 'versao');
  JSON.parse(s); return s;
});
ed('functions/_lib/liga_fechamento.js', (s) => tr(s, "REGRAS_VERSAO = '2026-10-13.1'", "REGRAS_VERSAO = '" + VER + "'", 'rv'));

// ===== servidor: coletor =====
ed('functions/api/cron-lances.js', (s) => {
  const a = s.indexOf("    if (checkins.length >= 3) {\n      for (let i = 0; i <= checkins.length - 3; i++) {");
  const b = s.indexOf("\n    }\n", s.indexOf("break;", a));
  if (a < 0 || b < 0) throw new Error('bloco hat');
  const novo = `    // HAT-TRICK = 3 VENDAS SEGUIDAS (Vitorio, 08/10/2026: "nao precisa ser em 2 horas, tem que ser 3 vendas seguidas"): 3 visitas CONSECUTIVAS do dia, todas com venda, sem visita sem venda no meio. Vale o dia todo.
    {
      const visitas = (v.cl || []).filter((c) => !['AGENDADO', 'ABERTO'].includes(c.status) && c.checkin_horario).map((c) => {
        const [h, m] = String(c.checkin_horario).split(':').map(Number);
        return Number.isNaN(h) || Number.isNaN(m) ? null : { horaMin: h * 60 + m, hms: c.checkin_horario, venda: ['POSITIVADO', 'EFETIVADO'].includes(c.status) };
      }).filter(Boolean).sort((a, b) => a.horaMin - b.horaMin);
      for (let i = 0; i + 2 < visitas.length; i++) {
        if (visitas[i].venda && visitas[i + 1].venda && visitas[i + 2].venda && t.agoraMin >= visitas[i + 2].horaMin) {
          const janelaMin = visitas[i + 2].horaMin - visitas[i].horaMin;
          out.push({ chave: \`gol_hattrick|\${v.id}|\${visitas[i + 2].hms}\`, nivel: 'hattrick', v, prova: comQ(v, \`3 vendas seguidas (3 check-ins em \${janelaMin} min): \${visitas[i].hms}, \${visitas[i + 1].hms}, \${visitas[i + 2].hms}\`) });
          break;
        }
      }
    }`;
  return s.slice(0, a) + novo + s.slice(b + "\n    }".length);
});

// ===== auditoria: sem teto de 120 min =====
ed('functions/_lib/auditoria_lance.js', (s) => tr(s, "if (+m[1] < 3) falha(`hat-trick com ${m[1]} check-ins`); if (+m[2] > 120) falha(`hat-trick em ${m[2]} min (máximo 120)`);", "if (+m[1] < 3) falha(`hat-trick com ${m[1]} check-ins`); // 08/10/2026: sem teto de tempo; o que vale e serem 3 vendas seguidas", 'aud'));

// ===== telas: TV e Matriz =====
const NOVO_TV = (sig) => `    // --- LANCE G06: HAT-TRICK = 3 VENDAS SEGUIDAS (08/10/2026, Vitorio: "nao precisa ser em 2 horas"): 3 visitas consecutivas do dia, todas com venda, sem visita sem venda no meio ---
    {
      const visitas = (v.cl || []).filter(c => !['AGENDADO', 'ABERTO'].includes(c.status) && c.checkin_horario).map(c => {
        const [h, m] = String(c.checkin_horario).split(':').map(Number);
        return Number.isNaN(h) || Number.isNaN(m) ? null : {horaMin: h * 60 + m, hms: c.checkin_horario, valor: c.valor_ultima || null, venda: ['POSITIVADO', 'EFETIVADO'].includes(c.status)};
      }).filter(Boolean).sort((a, b) => a.horaMin - b.horaMin);
      for (let i = 0; i + 2 < visitas.length; i++) {
        if (visitas[i].venda && visitas[i + 1].venda && visitas[i + 2].venda && agoraMin >= visitas[i + 2].horaMin) {
          const chave = \`${sig}gol_hattrick|\${v.id}|\${visitas[i + 2].hms}\`;
          if (!out.some(o => o.key === chave)) {
            out.push({key: chave, ${sig ? 'sig, ' : ''}nivel: 'hattrick', subtipo: 'hattrick', v, horaReal: visitas[i + 2].hms, valores: [visitas[i].valor, visitas[i + 1].valor, visitas[i + 2].valor]});
          }
          break;
        }
      }
    }
`;
function patchTela(s, ini, fim, sig) {
  const a = s.indexOf(ini), b = s.indexOf(fim, a);
  if (a < 0 || b < 0) throw new Error('tela ' + ini.slice(0, 30));
  s = s.slice(0, a) + NOVO_TV(sig) + s.slice(b);
  s = tr(s, "if (subtipo === 'hattrick') return `Hat-Trick (3 visitas com venda em até 2h, última checkin ${horaReal})`;", "if (subtipo === 'hattrick') return `Hat-Trick (3 vendas seguidas, última checkin ${horaReal})`;", 'texto');
  return s;
}
ed('public/tvapp.html', (s) => patchTela(s, "    // --- LANCE G06: HAT-TRICK (3 visitas com venda em até 120min", "    // --- LANCE G11: META 1º TEMPO", ''));
ed('public/matrizapp.html', (s) => {
  const a = s.indexOf("    // --- LANCE G06: HAT-TRICK (3 visitas com venda em até 120min");
  if (a < 0) throw new Error('mz');
  const b = s.indexOf("    // --- LANCE", a + 20);
  if (b < 0) throw new Error('mz2');
  s = s.slice(0, a) + NOVO_TV('${sig}|').replace("`${sig}|gol_hattrick", "`${sig}|gol_hattrick") + s.slice(b);
  s = tr(s, "if (subtipo === 'hattrick') return `Hat-Trick (3 visitas com venda em até 2h, última checkin ${horaReal})`;", "if (subtipo === 'hattrick') return `Hat-Trick (3 vendas seguidas, última checkin ${horaReal})`;", 'texto');
  return s;
});
// regras exibidas na tela da liga
ed('public/brasileirao.html', (s) => s.split("3 pedidos seguidos em curto intervalo").join("3 vendas seguidas (3 clientes visitados em sequência, todos com venda)"));
console.log('tudo ok');
