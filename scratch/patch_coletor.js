const fs = require('fs');
const f = 'functions/api/cron-lances.js';
let s = fs.readFileSync(f, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); s = s.replace(de, () => para); };

// 1) o coletor so pula se o PROPRIO coletor rodou ha menos de 3 min (antes pulava sempre que qualquer TV gravasse lance: quase nunca rodava de dia)
tr(`    const ultima = await env.DB.prepare("SELECT MAX(visto_em) as u FROM tv_lances WHERE dia = ?").bind(t.dia).first();
    if (ultima && ultima.u) {
      const idadeMs = Date.now() - new Date(ultima.u).getTime();
      if (idadeMs < 4 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'CACHE_FRESCO', idade_s: Math.round(idadeMs / 1000) }), { headers: cors });
      }
    }`,
`    // PULA SO SE O PROPRIO COLETOR RODOU HA MENOS DE 3 MIN (08/10/2026): antes olhava o ultimo lance gravado por QUALQUER tela; com as TVs abertas isso acontecia o tempo todo e o coletor
    // quase nunca rodava (hat-tricks do time do Gessandro em 07/10 nao foram gravados; ~11% dos lances ficaram sem prova). O gatilho e de 5 em 5 min, entao isto so evita rodadas duplicadas.
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS coletor_estado (id INTEGER PRIMARY KEY CHECK (id = 1), ultima_exec TEXT)').run();
    const ult = await env.DB.prepare('SELECT ultima_exec FROM coletor_estado WHERE id = 1').first();
    if (ult && ult.ultima_exec) {
      const idadeMs = Date.now() - new Date(ult.ultima_exec).getTime();
      if (idadeMs < 3 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'CACHE_FRESCO', idade_s: Math.round(idadeMs / 1000) }), { headers: cors });
      }
    }
    await env.DB.prepare("INSERT INTO coletor_estado (id, ultima_exec) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET ultima_exec = excluded.ultima_exec").bind(new Date().toISOString()).run();`, 'cache');

// 2) hat-trick: vale o dia inteiro (a chave leva a hora do 3o check-in: nunca duplica); sem exigir que o 3o check-in seja dos ultimos 30 min
tr("if (janelaMin <= 120 && janelaMin >= 0 && t.agoraMin - checkins[i + 2].horaMin <= FRESCOR_MAX_MIN) {", "if (janelaMin <= 120 && janelaMin >= 0 && t.agoraMin >= checkins[i + 2].horaMin) { // vale o dia todo: a chave leva a hora do 3o check-in (nao duplica) e o popup so aparece para lance recente", 'hat');
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('ok');
