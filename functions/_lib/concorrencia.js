// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/concorrencia.js
// O QUE É: concorrência ADAPTATIVA da coleta ao CEVEN (Frente B do plano de 12/10/2026). A cota do CEVEN é por chave e não é publicada:
//          em vez de chutar um número, a varredura mede (429 por rodada) e ajusta sozinha — reduz rápido, sobe devagar (AIMD simplificado).
// REGRAS:
//   - menos de 60 chamadas na rodada = pouca informação: não muda nada;
//   - mais de 20% das chamadas com 429 = reduz 1 (mínimo CONC_MIN = 4);
//   - até 5% de 429 em 3 rodadas seguidas (com 60+ chamadas) = sobe 1 (máximo CONC_MAX = limite prático medido, 6);
//   - entre 5% e 20% = mantém. MEDIDO em 12/10/2026: com concorrência 4 e ~10% de 429 a base ficou completa (7 leituras com +15 min);
//     com 2 ficou para trás (97). O objetivo é COBERTURA da base, não zero 429 — o 429 só custa uma pausa e a chamada é refeita.
//   - 401/403 NÃO é cota: não mexe (é a chave; o /saude avisa).
// ESTADO: tabela coleta_estado (chave, valor). Nunca derruba a coleta: qualquer erro de banco devolve o padrão.
// =========================================================================
export const CONC_MIN = 2, CONC_MAX = 6, CONC_PADRAO = 3;   // 13/10 10:50: o CEVEN limita por IP e o volume por rodada caiu (so quem mudou); sob 429 alto vale ir devagar   // piso 4: medido em 12/10, com 3 ou 2 a base fica atrasada (54 a 241 leituras velhas), com 4 fica completa
export const MIN_CHAMADAS = 60, LIMIAR_REDUZ = 0.20, LIMIAR_CALMO = 0.05, CALMOS_PARA_SUBIR = 3;

export function proximaConc({ conc, calmos = 0, chamadas = 0, r429 = 0 }) {
  const c = Math.min(CONC_MAX, Math.max(CONC_MIN, Math.round(Number(conc) || CONC_PADRAO)));
  if (chamadas < MIN_CHAMADAS) return { conc: c, calmos, motivo: 'pouca informação' };
  const razao = r429 / chamadas;
  if (razao > LIMIAR_REDUZ) return { conc: Math.max(CONC_MIN, c - 1), calmos: 0, motivo: `429 em ${Math.round((r429 / chamadas) * 100)}% das chamadas: reduz` };
  if (razao <= LIMIAR_CALMO) {
    const n = calmos + 1;
    if (n >= CALMOS_PARA_SUBIR && c < CONC_MAX) return { conc: c + 1, calmos: 0, motivo: `${n} rodadas com 429 baixo: sobe` };
    return { conc: c, calmos: n, motivo: `calmo (${n}/${CALMOS_PARA_SUBIR})` };
  }
  return { conc: c, calmos: 0, motivo: `429 em ${Math.round(razao * 100)}%: mantém (cobertura vale mais que zero 429)` };
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
