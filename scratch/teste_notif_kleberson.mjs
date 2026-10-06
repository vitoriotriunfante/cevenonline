// TESTE UNICO (autorizado pelo Vitorio em 06/10/2026): manda para a filial TBL a notificacao no formato real, com os lances de hoje da equipe do Kleberson.
// O segredo vem da variavel de ambiente SEGREDO (nao fica gravado em arquivo).
import { montaMensagens } from '../functions/_lib/notif_supervisores.js';
import { enviaNotificacao } from '../functions/_lib/ceven_notificacao.js';
const r = await fetch('https://ceven-cftv-matrix.pages.dev/api/brasileirao-lances?dia=2026-10-06');
const j = await r.json();
const L = j.lances.filter((l) => String(l.supervisor).toUpperCase().includes('KLEBERSON') && l.filial === 'TBL');
const m = montaMensagens(L, new Set(), { de: '06:00:00', ate: '17:15:00' })[0];
const texto = '[TESTE — pode ignorar] ' + m.texto;
console.log(texto.length, 'caracteres\n' + texto);
if (process.argv[2] === 'enviar') {
  const e = await enviaNotificacao({ CEVEN_WEBHOOK_SECRET: process.env.SEGREDO }, 'TBL', 'Brasileirão Triunfante', texto);
  console.log('ENVIO:', JSON.stringify(e));
}
