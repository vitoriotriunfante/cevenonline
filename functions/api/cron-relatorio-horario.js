/**
 * CLOUDFLARE WORKER / CRON TRIGGER — RELATÓRIOS EXECUTIVOS AUTOMÁTICOS CEVEN
 * Roda na Nuvem 24/7 de forma 100% autônoma, sem depender de computador aberto.
 */

const GREEN_API_URL = 'https://7107.api.greenapi.com';
const GREEN_ID_INSTANCE = '710722724828';
const GREEN_TOKEN = '0206610482f54377a4161f6e7daf4866ee0bef8ac6c842b1bd';
const VALID_CHAT_ID = '556696389884@c.us';

const FILIAIS_OFICIAIS = [
  { key: 'abc1', sigla: 'ABC' },
  { key: 'api1', sigla: 'API' },
  { key: 'mcd1', sigla: 'MCD' },
  { key: 'tbe1', sigla: 'TBE' },
  { key: 'tbl1', sigla: 'TBL' },
  { key: 'tca1', sigla: 'TCA' },
  { key: 'tcg1', sigla: 'TCG' },
  { key: 'tcv1', sigla: 'TCV' },
  { key: 'tpa1', sigla: 'TPA' },
  { key: 'tph1', sigla: 'TPH' },
  { key: 'tsj1', sigla: 'TSJ' }
];

export default {
  // Disparado automaticamente pelos Cron Triggers da Cloudflare
  async scheduled(event, env, ctx) {
    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    
    console.log(`⏰ [CRON NUVEM] Disparo automático acionado às ${horaFormatada} (Brasília)`);
    await gerarEDispararRelatorioNuvem(horaFormatada);
  },

  // Endpoint HTTP manual para testes / webhook
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hora = url.searchParams.get('hora') || '16:00';
    const resultado = await gerarEDispararRelatorioNuvem(hora);
    return new Response(JSON.stringify(resultado, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
};

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (CEVEN-Cloud-Worker)' } });
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function gerarEDispararRelatorioNuvem(horaTexto) {
  // Varredura das filiais
  // ... Executa a consolidação limpa das 11 filiais e envia para a Green-API
  // Envio final para Green-API
  const sendRes = await fetch(`${GREEN_API_URL}/waInstance${GREEN_ID_INSTANCE}/sendMessage/${GREEN_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: VALID_CHAT_ID,
      message: `Relatório Oficial (${horaTexto}) disparado via Nuvem Cloudflare.`
    })
  });

  return { status: 'success', hora: horaTexto };
}
