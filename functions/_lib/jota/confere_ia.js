// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/confere_ia.js
// O QUE E: confere o texto livre da IA antes do envio (01/11/2026: em 31/10 a IA montou uma "Curva negativa" com clientes que nao existem na rota do vendedor).
// REGRA: toda data dd/mm e todo valor em R$ da resposta tem que estar na fonte (dossie, historico ou pergunta). O que nao bate derruba a resposta inteira: melhor sem resposta do que dado inventado.
// LIMITE: nao confere nome solto sem data nem valor, nem percentual.
// =========================================================================
const datas = (t) => [...String(t).matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)].map((m) => Number(m[1]) + '/' + Number(m[2]));
const valor = (num, escala) => {
  const n = Number(num.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return n * (/^mi/i.test(escala || '') ? 1e6 : /^(mil|k)/i.test(escala || '') ? 1e3 : 1);
};
const valores = (t) => [...String(t).matchAll(/R\$\s*(\d[\d.,]*\d|\d)\s*(milh\w*|mi\b|mil\b|k\b)?/gi)].map((m) => valor(m[1], m[2])).filter((n) => Number.isFinite(n));

export function confereIA(resposta, fonte) {
  const f = String(fonte || '');
  const dF = new Set(datas(f)), vF = valores(f);
  const dataFora = datas(resposta).find((d) => !dF.has(d));
  if (dataFora) return { ok: false, motivo: 'data ' + dataFora };
  const valorFora = valores(resposta).find((v) => !vF.some((x) => Math.abs(x - v) <= Math.max(1, x * 0.006)));
  if (valorFora != null) return { ok: false, motivo: 'valor ' + valorFora };
  return { ok: true };
}
