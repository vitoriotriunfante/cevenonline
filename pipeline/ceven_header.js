// =========================================================================
// FICHA DO ARQUIVO: pipeline/ceven_header.js
// O QUE É: carregado ANTES de todo script dos workflows (NODE_OPTIONS=--require ./pipeline/ceven_header.js).
//          Põe o header X-App-Secret em TODA chamada ao CEVEN (fetch e axios), sem mexer em cada script.
// POR QUE: desde 09/10/2026 o CEVEN recusa (401) chamada sem esse header; o WhatsApp de sexta abortou por isso.
// CHAVE:   secret CEVEN_APP_SECRET do GitHub (nunca escrita no código).
// =========================================================================
const SEGREDO = process.env.CEVEN_APP_SECRET || '';
const DOMINIO = 'ceven.drivetriunfante-locomotiva.com.br';
const ehCeven = (u) => { try { return String(u && (u.url || u.href || u)).includes(DOMINIO); } catch { return false; } };

if (SEGREDO) {
  if (typeof globalThis.fetch === 'function') {
    const original = globalThis.fetch;
    globalThis.fetch = (input, init = {}) => {
      if (!ehCeven(input)) return original(input, init);
      const headers = new Headers((init && init.headers) || (input && input.headers) || {});
      headers.set('X-App-Secret', SEGREDO);
      return original(input, { ...init, headers });
    };
  }
  try {
    const axios = require('axios');
    const instalar = (inst) => inst.interceptors.request.use((config) => {
      const url = (config.baseURL || '') + (config.url || '');
      if (ehCeven(url)) { config.headers = config.headers || {}; config.headers['X-App-Secret'] = SEGREDO; }
      return config;
    });
    instalar(axios);
    const criar = axios.create.bind(axios);
    axios.create = (...a) => { const inst = criar(...a); instalar(inst); return inst; };
  } catch { /* script sem axios instalado: so o fetch */ }
  // https.get / https.request (19/10/2026): o extrator de historico do Data Lake (analises/extrair_historico_completo_11_filiais.js) e outros
  // usam o modulo https cru; sem isto iam SEM o header, levavam 401 e o banco gravou ZERO pedidos de 08/10 a 18/10 sem acusar erro.
  try {
    const https = require('https');
    const embrulha = (orig) => function (...args) {
      try {
        let i = 0;
        const alvo = args[0];
        const host = typeof alvo === 'string' || alvo instanceof URL ? String(alvo) : (alvo && (alvo.hostname || alvo.host)) || '';
        if (ehCeven(host)) {
          if (typeof args[1] === 'object' && args[1] !== null && typeof args[1] !== 'function') i = 1;
          else if (typeof alvo === 'object' && !(alvo instanceof URL)) i = 0;
          else { args.splice(1, 0, {}); i = 1; }
          args[i].headers = { ...(args[i].headers || {}), 'X-App-Secret': SEGREDO };
        }
      } catch { /* nunca quebra a chamada original */ }
      return orig.apply(this, args);
    };
    https.request = embrulha(https.request);
    https.get = embrulha(https.get);
  } catch { /* sem modulo https: nada a fazer */ }
} else {
  console.log('⚠️ CEVEN_APP_SECRET ausente: o CEVEN vai recusar as chamadas (401).');
}
