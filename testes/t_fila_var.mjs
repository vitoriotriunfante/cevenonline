// Teste funcional da FILA DO VAR (tvapp.html e matrizapp.html): depois das 15h gol/hat-trick/defesa saem sozinhos e na frente; lance ruim so em resumo, no maximo 1 a cada 10 min.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function (ok) {
  for (const arq of ['public/tvapp.html', 'public/matrizapp.html']) {
    const t = readFileSync(join(RAIZ, arq), 'utf8').replace(/\r\n/g, '\n');
    const a = t.indexOf("const varGapS = "), b = t.indexOf('\n', t.indexOf('const varMaxH = '));
    const c = t.indexOf('const ehBomLance'), d0 = t.indexOf('function liberaEspera'), d = t.indexOf('\n}\n', d0) + 3;
    // matriz: liberaEspera fecha com "\n}\n" tambem; o corpo usa $('fila') / $('toast') (stubs abaixo)
    const codigo = t.slice(a, b) + '\n' + t.slice(c, d);
    const roda = (h, itens, relogioMs) => {
      const estado = { chamadas: 0, FILA: [], VARS: [], ESPERA: itens.map((x) => ({ ...x })) };
      const fn = new Function('sp', 'P', 'ESPERA', 'VARS', 'FILA', 'proximoVAR', '$', 'emVARget', 'Date_', `
        let emVAR = false; const Date = { now: Date_ };
        ${codigo.replace(/!emVAR/g, '!emVARget()')}
        return { liberaEspera, ruimLiberadoGet: () => ruimLiberado(), setUlt: (v) => { ULT_RUIM = v; } };`);
      let agora = relogioMs;
      const api = fn(() => ({ h }), new URLSearchParams(''), estado.ESPERA, estado.VARS, estado.FILA, () => { estado.chamadas++; estado.FILA.length = 0; }, () => null, () => false, () => agora);
      return { estado, api, avanca: (ms) => { agora += ms; } };
    };
    const gol = { tipo: 'gol', score: 60 }, def = { tipo: 'defesa', score: 40 }, pen = { tipo: 'penalti', score: 20 }, amar = { tipo: 'amarelos', score: 10 };
    // 16h: ruim e bom na espera -> sai o bom primeiro, sozinho (nunca dentro de resumo)
    let r = roda(16, [pen, amar, { tipo: 'impedimento', score: 5 }, gol, def], 1e12);
    r.api.liberaEspera();
    ok(r.estado.chamadas === 1 && r.estado.ESPERA.length === 4 && !r.estado.ESPERA.some((x) => x.tipo === 'gol'), arq + ' FILA: 5 na espera -> sai o GOL sozinho primeiro (os ruins nao viram resumo com ele)');
    r.avanca(31e3); r.api.liberaEspera();
    ok(r.estado.chamadas === 2 && !r.estado.ESPERA.some((x) => x.tipo === 'defesa'), arq + ' FILA: 31 s depois (depois das 15h) sai a DEFESA, intervalo curto entre lances bons');
    // so ruins: depois das 15h so em resumo e 1 a cada 10 min (e o intervalo normal de 90 s entre lances ruins)
    r.avanca(91e3); r.api.liberaEspera();
    ok(r.estado.chamadas === 3 && r.estado.ESPERA.length === 0, arq + ' FILA: sobrando so lance ruim, sai UM resumo com todos (nao um por um)');
    r.estado.ESPERA.push({ ...pen }, { ...amar });
    r.avanca(2 * 60e3); r.api.liberaEspera();
    ok(r.estado.chamadas === 3 && r.estado.ESPERA.length === 2, arq + ' FILA: 2 min depois, lance ruim novo ESPERA (so 1 resumo a cada 10 min)');
    r.avanca(9 * 60e3); r.api.liberaEspera();
    ok(r.estado.chamadas === 4 && r.estado.ESPERA.length === 0, arq + ' FILA: passados 10 min o resumo dos ruins sai');
    // gol novo nao espera os 10 min dos ruins
    r.estado.ESPERA.push({ ...pen }, { ...gol });
    r.avanca(31e3); r.api.liberaEspera();
    ok(r.estado.chamadas === 5 && r.estado.ESPERA.some((x) => x.tipo === 'penalti'), arq + ' FILA: gol novo sai na hora, o ruim continua esperando');
    // antes das 15h: comportamento antigo (ruim sai normal)
    r = roda(10, [pen], 1e12);
    r.api.liberaEspera();
    ok(r.estado.chamadas === 1, arq + ' FILA: antes das 15h o lance ruim sai normalmente');
  }
}
