// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/equipe_ocultos.js
// O QUE É: conjunto de vendedores que a Gestão de Equipe OCULTA (mostra = NÃO), no formato "FILIAL|RCA". Vitório, 07/10/2026: um vendedor em Afastamento/Férias (oculto) aparecia na lista
//          de cartões amarelos da Matriz. Quem está oculto NÃO gera lance nem aparece em lista de lances. Cache de 60 s (a Gestão muda pouco).
// =========================================================================
let cache = { ate: 0, set: new Set() };
export async function ocultosDaEquipe(origin) {
  if (Date.now() < cache.ate) return cache.set;
  try {
    const r = await fetch(origin + '/api/tv-mostra', { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const set = new Set();
    for (const [k, lista] of Object.entries((j && j.filiais) || {})) for (const v of Array.isArray(lista) ? lista : []) if (v && v.rca != null && v.mostra === false) set.add(k.split('_')[0].toUpperCase() + '|' + v.rca);
    cache = { ate: Date.now() + 60000, set };
    return set;
  } catch { return cache.set; /* sem resposta: usa o ultimo conhecido (nunca tira lance por engano) */ }
}
// filial real do lance: a do proprio lance, ou o prefixo "TBL|" da chave quando a Matriz (MTZ) gravou
export function filialDoLance(l) {
  const m = /^([A-Z]{3})[|]/.exec(String(l.chave || ''));
  return l.filial && l.filial !== 'MTZ' ? String(l.filial).toUpperCase() : (m ? m[1] : String(l.filial || '').toUpperCase());
}
export const lanceDeOculto = (l, set) => l && l.rca != null && set.has(filialDoLance(l) + '|' + l.rca);
