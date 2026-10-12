// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/concorrencia.js
// O QUE É: concorrência ADAPTATIVA da coleta ao CEVEN (Frente B do plano de 12/10/2026). A cota do CEVEN é por chave e não é publicada:
//          em vez de chutar um número, a varredura mede (429 por rodada) e ajusta sozinha — reduz rápido, sobe devagar (AIMD simplificado).
// REGRAS:
//   - menos de 60 chamadas na rodada = pouca informação: não muda nada;
//   - mais de 5% das chamadas com 429 = reduz 1 (mínimo CONC_MIN);
//   - nenhum 429 em 3 rodadas calmas seguidas (com 60+ chamadas) = sobe 1 (máximo CONC_MAX = limite prático medido, 6);
//   - 401/403 NÃO é cota: não mexe (é a chave; o /saude avisa).
// ESTADO: tabela coleta_estado (chave, valor). Nunca derruba a coleta: qualquer erro de banco devolve o padrão.
// =========================================================================
export const CONC_MIN = 2, CONC_MAX = 6, CONC_PADRAO = 4;
export const MIN_CHAMADAS = 60, LIMIAR_429 = 0.05, CALMOS_PARA_SUBIR = 3;

export function proximaConc({ conc, calmos = 0, chamadas = 0, r429 = 0 }) {
  const c = Math.min(CONC_MAX, Math.max(CONC_MIN, Math.round(Number(conc) || CONC_PADRAO)));
  if (chamadas < MIN_CHAMADAS) return { conc: c, calmos, motivo: 'pouca informação' };
  if (r429 / chamadas > LIMIAR_429) return { conc: Math.max(CONC_MIN, c - 1), calmos: 0, motivo: `429 em ${Math.round((r429 / chamadas) * 100)}% das chamadas: reduz` };
  if (r429 === 0) {
    const n = calmos + 1;
    if (n >= CALMOS_PARA_SUBIR && c < CONC_MAX) return { conc: c + 1, calmos: 0, motivo: `${n} rodadas sem 429: sobe` };
    return { conc: c, calmos: n, motivo: `calmo (${n}/${CALMOS_PARA_SUBIR})` };
  }
  return { conc: c, calmos: 0, motivo: 'alguns 429, abaixo do limiar: mantém' };
}

async function garante(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS coleta_estado (chave TEXT PRIMARY KEY, valor REAL, motivo TEXT, atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP)').run();
}

export async function lerEstado(env) {
  try {
    await garante(env);
    const { results } = await env.DB.prepare("SELECT chave, valor, motivo, atualizado_em FROM coleta_estado WHERE chave IN ('conc', 'conc_calmos')").all();
    const m = new Map((results || []).map((r) => [r.chave, r]));
    const c = m.get('conc');
    return { conc: c ? Math.min(CONC_MAX, Math.max(CONC_MIN, Math.round(Number(c.valor)))) : CONC_PADRAO, calmos: m.get('conc_calmos') ? Number(m.get('conc_calmos').valor) : 0, motivo: c ? c.motivo : null, em: c ? c.atualizado_em : null };
  } catch { return { conc: CONC_PADRAO, calmos: 0, motivo: null, em: null }; }
}

export async function gravaEstado(env, { conc, calmos, motivo }) {
  try {
    await garante(env);
    const up = (k, v, m) => env.DB.prepare("INSERT INTO coleta_estado (chave, valor, motivo, atualizado_em) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, motivo = excluded.motivo, atualizado_em = CURRENT_TIMESTAMP").bind(k, v, m);
    await env.DB.batch([up('conc', conc, motivo), up('conc_calmos', calmos, null)]);
  } catch { /* estado e so otimizacao */ }
}
