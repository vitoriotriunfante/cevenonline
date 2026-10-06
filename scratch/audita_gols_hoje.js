const fs = require('fs');
const T = process.env.TEMP || '/tmp';
const raw = fs.readFileSync(T + '/gols_hoje.json', 'utf8');
const linhas = JSON.parse(raw.slice(raw.indexOf('[')))[0].results;
const B = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HOJE = process.argv[2] || '2026-10-06';
const dono = (n, rca) => { n = String(n || ''); rca = String(rca); const r = n.length - rca.length; return n.startsWith(rca) && r >= 5 && r <= 7 && /^[0-9]+$/.test(n.slice(rca.length)); };
async function g(u) { try { return await (await fetch(B + u, { signal: AbortSignal.timeout(25000) })).json(); } catch { return null; } }
(async () => {
  const falsos = [], ok = [], sem = [];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < linhas.length) {
      const l = linhas[i++];
      const h = await g(`/api/rca/historico-cliente/${l.cliente_id}?filial=${l.filial.toLowerCase()}1&id=${l.rca}`);
      if (!h) { sem.push(l); continue; }
      const tem = (h.ultimas_visitas || []).some((v) => String(v.data_visita).slice(0, 10) === HOJE && dono(v.num_pedido, l.rca));
      (tem ? ok : falsos).push(l);
    }
  }));
  console.log('com pedido de hoje do proprio vendedor:', ok.length, '| SEM pedido de hoje (gol falso):', falsos.length, '| sem resposta:', sem.length);
  falsos.forEach((l) => console.log(l.filial, l.chave, l.vendedor, '|', l.cliente, l.hora_sp));
  fs.writeFileSync(T + '/gols_falsos.json', JSON.stringify(falsos.map((l) => ({ filial: l.filial, chave: l.chave }))));
})();
