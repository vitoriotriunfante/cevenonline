// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/liga_fechamento.js
// O QUE É: FECHAMENTO DO DIA da Liga Triunfante (Vitório, 06/10/2026: "a partir do momento que divulgarmos tem que estar tudo cravado").
//          Depois das 22h (ou em qualquer dia anterior) o dia é CONGELADO: os lances que contam, com os pontos que valiam naquele dia e a versão das regras,
//          são gravados em liga_dia_fechado. O endpoint /api/brasileirao-lances passa a devolver o dia fechado, sem recalcular: mudança futura de regra,
//          de supervisor ou lance que chegue atrasado NÃO mexe mais num dia já fechado. Só se reabre por decisão explícita (apagar a linha de liga_fechamento).
// NUNCA inventa: o que é gravado é exatamente o que o endpoint calculou com os dados reais daquele dia.
// =========================================================================

// Versão das regras da liga (config/pontuacao_brasileirao.json -> "versao_regras"). Um teste automático confere que as duas batem e que as regras não mudaram sem subir a versão.
export const REGRAS_VERSAO = '2026-10-08.1';

export function agoraSP() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  const h = (+p.hour) % 24;
  return { dia: `${p.year}-${p.month}-${p.day}`, h, m: +p.minute, min: h * 60 + +p.minute };
}

export async function garanteTabelasFechamento(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS liga_fechamento (dia TEXT PRIMARY KEY, fechado_em TEXT, regras_versao TEXT, total_lances INTEGER, total_pontos REAL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS liga_dia_fechado (dia TEXT NOT NULL, chave TEXT NOT NULL, filial TEXT NOT NULL, lance_json TEXT NOT NULL, PRIMARY KEY (dia, chave, filial))').run();
}

// Lances congelados do dia (ou null se o dia ainda está aberto). Mesmo formato do endpoint ao vivo.
export async function lerDiaFechado(env, dia, filial) {
  try {
    const cab = await env.DB.prepare('SELECT fechado_em, regras_versao, total_lances, total_pontos FROM liga_fechamento WHERE dia = ?').bind(dia).first();
    if (!cab) return null;
    let sql = 'SELECT lance_json FROM liga_dia_fechado WHERE dia = ?';
    const params = [dia];
    if (filial && filial !== 'TODAS' && /^[A-Z]{3}$/.test(filial)) { sql += ' AND filial = ?'; params.push(filial); }
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    const lances = (results || []).map((r) => { try { return JSON.parse(r.lance_json); } catch { return null; } }).filter(Boolean)
      .sort((a, b) => String(b.hora || '').localeCompare(String(a.hora || '')));
    return { cab, lances };
  } catch { return null; /* tabela ainda nao existe: dia aberto */ }
}

// Fecha o dia. Idempotente: se já está fechado não mexe. Só fecha se o dia já passou ou se já são 22h de hoje.
export async function fechaDia(env, origin, dia, { forcar = false } = {}) {
  await garanteTabelasFechamento(env);
  const ja = await env.DB.prepare('SELECT fechado_em FROM liga_fechamento WHERE dia = ?').bind(dia).first();
  if (ja) return { dia, status: 'JA_FECHADO', fechado_em: ja.fechado_em };
  const t = agoraSP();
  if (!forcar && !(dia < t.dia || (dia === t.dia && t.min >= 22 * 60))) return { dia, status: 'AINDA_ABERTO', motivo: 'o dia só fecha depois das 22h (vendedor que sincroniza o aparelho tarde ainda conta; depois das 23h o CEVEN já virou o dia)' };
  const r = await fetch(`${origin}/api/brasileirao-lances?dia=${dia}&ao_vivo=1`, { signal: AbortSignal.timeout(40000) });
  const j = await r.json().catch(() => null);
  if (!j || !Array.isArray(j.lances)) return { dia, status: 'FALHOU', motivo: 'nao consegui ler os lances do dia' };
  if (!j.lances.length) return { dia, status: 'SEM_LANCES' }; // fim de semana/feriado: nada a fechar
  const agora = new Date().toISOString();
  const stmts = j.lances.map((l) => env.DB.prepare('INSERT OR IGNORE INTO liga_dia_fechado (dia, chave, filial, lance_json) VALUES (?, ?, ?, ?)').bind(dia, String(l.chave || ''), String(l.filial || ''), JSON.stringify(l)));
  for (let i = 0; i < stmts.length; i += 80) await env.DB.batch(stmts.slice(i, i + 80));
  const pontos = j.lances.reduce((s, l) => s + (Number(l.pontos) || 0), 0);
  // o cabeçalho é gravado POR ÚLTIMO: só vale como "fechado" depois de todas as linhas gravadas
  await env.DB.prepare('INSERT OR IGNORE INTO liga_fechamento (dia, fechado_em, regras_versao, total_lances, total_pontos) VALUES (?, ?, ?, ?, ?)').bind(dia, agora, REGRAS_VERSAO, j.lances.length, pontos).run();
  return { dia, status: 'FECHADO', lances: j.lances.length, pontos, regras_versao: REGRAS_VERSAO };
}
