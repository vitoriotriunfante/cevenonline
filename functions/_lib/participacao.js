// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/participacao.js
// O QUE É: UM ÚNICO ponto de decisão de "este vendedor participa de quê?". Lido por lances, Liga, incentivo, Semana Invicta,
//          mapa da Executiva, WhatsApp e telas. Nenhuma tela decide por conta própria.
// POR QUE (Vitório, 12/10/2026): REPRESENTANTE (tipo "R" na planilha DEPARA, coluna P) NÃO pode ser cobrado: o Vitório vê meta, vendas e painel,
//          mas ele não pode receber cartão, pênalti, entrar na Liga, no incentivo, em zerados nem na cobrança do WhatsApp (risco jurídico).
// CAMPOS na Gestão de Equipe (config_equipe_soberana), por vendedor:
//   vinculo : 'CLT' (padrão, ausente = CLT) | 'REPRESENTANTE'
//   participa : { flag: true|false } — sobrescreve o padrão do vínculo, uma flag por vez (opcional)
// FLAGS: painel, meta_e_vendas, lances, cartoes_penaltis, zerados, liga, incentivo, whatsapp, ronda
// PADRÕES: PROMOTOR = nada (nunca aparece). REPRESENTANTE = tudo, igual ao CLT (liberado pelo jurídico em 13/10/2026; antes: só painel + meta_e_vendas). CLT e INTERNO = tudo. mostra=false (oculto) = só meta_e_vendas (regra antiga: soma nos totais, fora das listas).
// =========================================================================
export const FLAGS = ['painel', 'meta_e_vendas', 'lances', 'cartoes_penaltis', 'zerados', 'liga', 'incentivo', 'whatsapp', 'ronda'];
export const VINCULOS = ['CLT', 'INTERNO', 'REPRESENTANTE', 'PROMOTOR'];
const SO_ACOMPANHA = new Set(['painel', 'meta_e_vendas']);

// Tipo vendedor da planilha DEPARA (coluna P): E = CLT, R = REPRESENTANTE, I = INTERNO (televendas/loja: cobrado como CLT), P = PROMOTOR (nunca aparece, em nenhum painel).
export function vinculoDe(v) {
  const x = String((v && v.vinculo) || '').trim().toUpperCase();
  if (x === 'REPRESENTANTE' || x === 'REP' || x === 'R') return 'REPRESENTANTE';
  if (x === 'PROMOTOR' || x === 'PROMO' || x === 'P') return 'PROMOTOR';
  if (x === 'INTERNO' || x === 'I') return 'INTERNO';
  return 'CLT';
}
export const ehRepresentante = (v) => vinculoDe(v) === 'REPRESENTANTE';
export const ehPromotor = (v) => vinculoDe(v) === 'PROMOTOR';

// true se o vendedor participa da flag. v = item da lista da Gestão ({ rca, mostra, vinculo, participa }).
export function participa(v, flag) {
  if (!v) return false;
  if (ehPromotor(v)) return false;                              // promotor: fora de TUDO, ate dos paineis (Vitorio, 12/10/2026)
  const ov = v.participa && typeof v.participa === 'object' ? v.participa[flag] : undefined;
  if (typeof ov === 'boolean') return ov;                       // decisão individual do Vitório vence
  // representante: LIBERADO pelo jurídico em 13/10/2026 (Vitório: "tira a trava dos representantes") — participa de tudo, como o CLT
  if (v.mostra === false) return flag === 'meta_e_vendas';      // oculto: só soma nos totais
  return true;
}

// conjunto "FILIAL|RCA" de quem NÃO participa da flag (formato igual ao de equipe_ocultos.js)
export function setSemParticipacao(mostraJson, flag) {
  const set = new Set();
  for (const [k, lista] of Object.entries((mostraJson && mostraJson.filiais) || {})) {
    for (const v of Array.isArray(lista) ? lista : []) {
      if (v && v.rca != null && !participa(v, flag)) set.add(String(k).split('_')[0].toUpperCase() + '|' + v.rca);
    }
  }
  return set;
}
