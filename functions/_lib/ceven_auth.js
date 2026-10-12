// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/ceven_auth.js
// O QUE É: segredo de aplicativo e cabeçalhos padrão para chamadas à API do CEVEN.
//          Em 09/10/2026 o backend do CEVEN passou a exigir o header 'X-App-Secret'
//          (definido no bundle do ceven-app: http-wAwdTsSE.js). Sem este header,
//          qualquer requisição a /api/* é bloqueada com 401 'Acesso não autorizado'.
// =========================================================================

export const CEVEN_APP_SECRET = '23bae7bff90221ee91885ea3fc07ac9e0e2b498696b7a3f34ab6466b7da9190d';

export const CEVEN_HDR = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json',
  'X-App-Secret': CEVEN_APP_SECRET
};
