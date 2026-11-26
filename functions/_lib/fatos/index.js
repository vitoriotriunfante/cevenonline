// =========================================================================
// FATOS · functions/_lib/fatos/index.js
// Camada única de leitura dos KPIs (docs/DICIONARIO_KPIS.md). Toda tela e toda resposta do JOTA leem por aqui.
//   diasUteis()            -> { total, decorridos, restantes } na convenção do GEROT (§2)
//   kpisMes(db, recorte)   -> R$ do mês + ritmo + necessidade + positivação pela regra do dicionário (§3)
//   carteira(db, escopo)   -> carteira por situação só de gerot_carteira (3.11)
//   linhasQueFecham(t, L)  -> acrescenta a linha "fora das equipes" para total = soma das linhas (§0 regra 2)
// Só lê o D1. Não chama o CEVEN nem outra fonte externa.
// =========================================================================
export { diasUteis, ehDiaUtil, hojeBRT } from './dias.js';
export { CAMPO, kpisMes, carteira, linhasQueFecham, positivacaoPorGrupos, positivacaoRegra4, posicaoGerot, vendedoresGerot, filiaisGerot, supervisoresGerot, historicoFilialGerot } from './kpis.js';
