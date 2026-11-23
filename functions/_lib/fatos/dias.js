// =========================================================================
// FATOS · functions/_lib/fatos/dias.js
// O QUE É: a conta ÚNICA de dias úteis do mês (docs/DICIONARIO_KPIS.md §2), na convenção do GEROT.
// Dia útil = segunda a sexta, sem feriado nacional (functions/_lib/feriados.js).
// Convenção do GEROT (medida no D1 em 22/11 domingo e 23/11 segunda):
//   decorridos = dias úteis do dia 1 até HOJE, contando hoje se hoje for útil
//   restantes  = total − decorridos (hoje NÃO entra nos restantes)
//   Ex.: novembro/2026 tem 19. Domingo 22/11: 13 decorridos e 6 restantes. Segunda 23/11: 14 e 5.
//   Conferido: "Meta Ideal captação" = meta × decorridos ÷ total e "Necessidade dia captação" = (meta − captação) ÷ restantes.
// =========================================================================
import { ehFeriado } from '../feriados.js';

// data de hoje em São Paulo (AAAA-MM-DD)
export function hojeBRT() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// é dia útil? (seg–sex e não feriado)
export function ehDiaUtil(iso) {
  const [y, m, d] = iso.split('-').map(Number), w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w > 0 && w < 6 && !ehFeriado(iso);
}

// { total, decorridos, restantes } do mês de `hoje` (padrão: hoje em SP), convenção do GEROT
export function diasUteis(hoje = hojeBRT()) {
  const [y, m, d] = hoje.split('-').map(Number), fim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let total = 0, decorridos = 0;
  for (let i = 1; i <= fim; i++) {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    if (!ehDiaUtil(iso)) continue;
    total++; if (i <= d) decorridos++;
  }
  return { total, decorridos, restantes: total - decorridos };
}
