// Igual ao _pergunta.mjs, mas com o relogio deslocado para uma hora de HOJE (Brasilia). Uso: node testes/_pergunta_hora.mjs 07:00 '<json do contato>' 'pergunta'
// Serve para ver a resposta da manha (plano), do meio-dia ou do fechamento sem esperar o horario. SO LEITURA.
const [hhmm] = process.argv.splice(2, 1);
const RealDate = Date, agora = new RealDate();
const hojeSP = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const alvo = new RealDate(`${hojeSP}T${hhmm}:00-03:00`).getTime(), desloc = alvo - agora.getTime();
class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + desloc); } static now() { return RealDate.now() + desloc; } }
globalThis.Date = FakeDate;
await import('./_pergunta.mjs');
