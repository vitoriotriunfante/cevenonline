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
} else {
  console.log('⚠️ CEVEN_APP_SECRET ausente: o CEVEN vai recusar as chamadas (401).');
}
