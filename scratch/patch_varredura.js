const fs = require('fs');
const f = 'functions/api/cron-varredura-central.js';
let s = fs.readFileSync(f, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const a = s.indexOf("      const ENDPOINTS = ['roteiro-hoje', 'produtividade', 'dashboard', 'devolucoes'];");
const b = s.indexOf("      return resp({ status: 'ATUALIZADO', modo: 'completa'", a);
const b2 = s.indexOf('\n', b);
if (a < 0 || b < 0) throw new Error('ancoras');
const novo = `      const ENDPOINTS = ['roteiro-hoje', 'produtividade', 'dashboard', 'devolucoes'];
      // PARTIDA A FRIO EM FATIAS QUE JA GRAVAM (07/10-08/10/2026): antes a varredura completa buscava 4 endpoints x ~600 RCAs (2.400 chamadas, 4 a 7 min) e so GRAVAVA no
      // fim; o gatilho cortava em 170 s e nada era gravado, entao a base ficava VAZIA a manha toda (08/10: 0 linhas ate as 09h40; WhatsApp, TV e liga sem a base unica).
      // Agora: so quem ainda nao esta gravado hoje (ou todos, com ?forcar=1), em fatias de 20 RCAs, gravando cada fatia assim que volta, ate o orcamento de tempo; a proxima rodada continua de onde parou.
      const faltam = forcar ? rcas : rcas.filter((r) => !ant.has(String(r.codigo)));
      let ok = 0, comFalha = 0, feitos = 0;
      for (let i = 0; i < faltam.length && Date.now() - t0 < ORCAMENTO_TICK_MS; i += 20) {
        const fatia = faltam.slice(i, i + 20);
        const tarefas = [];
        for (const rca of fatia) for (const ep of ENDPOINTS) tarefas.push(() => getJson(urlRca(ep, rca)));
        const respostas = await poolLimitado(tarefas, CONC);
        const stmts = [];
        fatia.forEach((rca, idx) => {
          const roteiro = respostas[idx * 4], produtividade = respostas[idx * 4 + 1], dashboard = respostas[idx * 4 + 2], devolucoes = respostas[idx * 4 + 3];
          const falhas = [];
          if (!Array.isArray(roteiro)) falhas.push('roteiro');
          if (!produtividade) falhas.push('produtividade');
          if (!dashboard) falhas.push('dashboard');
          if (!Array.isArray(devolucoes)) falhas.push('devolucoes');
          if (falhas.length === 4) { comFalha++; return; }
          ok++;
          stmts.push(upsertParcial(env, dataRef, rca, {
            roteiro_json: JSON.stringify(roteiro || null), produtividade_json: JSON.stringify(produtividade || null),
            dashboard_json: JSON.stringify(dashboard || null), devolucoes_json: JSON.stringify(devolucoes || null), falhas: falhas.join(',')
          }));
        });
        if (stmts.length) await gravaLote(env, stmts);
        feitos += fatia.length;
      }
      if (!ok && feitos && comFalha === feitos) return resp({ erro: 'CEVEN não respondeu nenhum RCA', rcas_total: rcas.length }, 502);
      return resp({ status: 'ATUALIZADO', modo: 'completa', data_ref: dataRef, rcas_total: rcas.length, faltavam: faltam.length, processados: feitos, rcas_gravados: ok, rcas_sem_nenhuma_resposta: comFalha, restam: Math.max(0, faltam.length - feitos), duracao_ms: Date.now() - t0 });`;
s = s.slice(0, a) + novo + s.slice(b2);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('ok');
