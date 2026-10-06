// =========================================================================
// FICHA DO ARQUIVO: functions/api/cron-notificacoes-supervisores.js
// O QUE É: envia, a cada UMA hora, para o sino do CEVEN, UMA notificação por supervisor com TODOS os lances da equipe dele ainda não avisados
//          (Vitório, 06/10/2026). Origem na notificação: "Brasileirão Triunfante". A notificação chega a todos de Master/Gerente/Supervisor da filial; o texto cita o supervisor.
// COMO LIGA:  precisa estar LIGADO em config_flags ('notif_supervisores' = '1'); desligado por padrão. O coletor de lances chama este endpoint no começo de cada hora (09h a 20h).
// USO:    GET ?simular=1[&filial=TBL][&supervisor=KLEBERSON]  -> mostra as mensagens que sairiam, SEM enviar nada e SEM gravar nada
//         GET ?rodar=1                                          -> envia (se ligado); cada lance é avisado UMA vez só (notif_lance_enviado)
// REGRAS:  1ª rodada do dia: avisa só os lances da última hora e marca os mais antigos como já avisados (não despeja o dia inteiro de uma vez).
//          Nunca envia mensagem vazia; supervisor sem lance novo não recebe nada. O segredo do webhook vem de env.CEVEN_WEBHOOK_SECRET (nunca no código).
// =========================================================================
import { enviaNotificacao } from '../_lib/ceven_notificacao.js';
import { montaMensagens } from '../_lib/notif_supervisores.js';
import { agoraSP } from '../_lib/liga_fechamento.js';
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });
const hms = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
const secDe = (h) => { const [a, b, c] = String(h || '0:0:0').split(':').map(Number); return (a || 0) * 3600 + (b || 0) * 60 + (c || 0); };

export async function onRequestGet({ env, request }) {
  if (!env.DB) return resp({ erro: 'D1 nao configurado' }, 503);
  const u = new URL(request.url), t = agoraSP(), simular = u.searchParams.get('simular') === '1', rodar = u.searchParams.get('rodar') === '1';
  if (!simular && !rodar) return resp({ erro: 'use ?simular=1 ou ?rodar=1' }, 400);
  const fFil = (u.searchParams.get('filial') || '').toUpperCase(), fSup = (u.searchParams.get('supervisor') || '').toUpperCase();
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS config_flags (chave TEXT PRIMARY KEY, valor TEXT)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS notif_lance_enviado (dia TEXT NOT NULL, filial TEXT NOT NULL, chave TEXT NOT NULL, enviado_em TEXT, PRIMARY KEY (dia, filial, chave))').run();
    const flag = async (k) => { const r = await env.DB.prepare('SELECT valor FROM config_flags WHERE chave = ?').bind(k).first(); return r ? r.valor : null; };
    if (rodar) {
      if ((await flag('notif_supervisores')) !== '1') return resp({ status: 'DESLIGADO', motivo: "config_flags 'notif_supervisores' nao esta ligado" });
      if (t.h < 9 || t.min > 20 * 60) return resp({ status: 'FORA_DO_HORARIO', motivo: 'so de 09h as 20h' });
      const ult = await flag('notif_supervisores_ultimo');
      if (ult && ult.startsWith(t.dia) && secDe(hms()) - secDe(ult.slice(11, 19)) < 55 * 60) return resp({ status: 'AGUARDANDO', motivo: 'ultimo envio ha menos de 55 min', ultimo: ult });
    }
    const r = await fetch(`${u.origin}/api/brasileirao-lances?dia=${t.dia}`, { signal: AbortSignal.timeout(40000) });
    const j = await r.json().catch(() => null);
    if (!j || !Array.isArray(j.lances)) return resp({ status: 'FALHOU', motivo: 'nao consegui ler os lances do dia' });
    const { results } = await env.DB.prepare('SELECT filial, chave FROM notif_lance_enviado WHERE dia = ?').bind(t.dia).all();
    const enviados = new Set((results || []).map((x) => x.filial + '|' + x.chave));
    const primeira = enviados.size === 0;
    const agora = hms(), limite = secDe(agora) - 65 * 60;
    let lances = j.lances, silenciosos = [];
    if (primeira) { // 1a rodada do dia: so a ultima hora vira aviso; o resto e marcado como ja avisado
      silenciosos = j.lances.filter((l) => secDe(l.hora) < limite);
      lances = j.lances.filter((l) => secDe(l.hora) >= limite);
    }
    let msgs = montaMensagens(lances, enviados, { de: primeira ? '' : (await flag('notif_supervisores_ultimo') || '').slice(11, 19), ate: agora });
    if (fFil) msgs = msgs.filter((m) => m.filial === fFil);
    if (fSup) msgs = msgs.filter((m) => m.supervisor.toUpperCase().includes(fSup));
    if (simular) return resp({ status: 'SIMULACAO', primeira_rodada_do_dia: primeira, mensagens: msgs.map((m) => ({ filial: m.filial, supervisor: m.supervisor, lances: m.qtd, pontos: m.pontos, texto: m.texto })) });

    const saida = [];
    const marca = (filial, chaves) => chaves.map((c) => env.DB.prepare("INSERT OR IGNORE INTO notif_lance_enviado (dia, filial, chave, enviado_em) VALUES (?, ?, ?, datetime('now'))").bind(t.dia, filial, String(c)));
    for (const m of msgs) {
      const e = await enviaNotificacao(env, m.filial, 'Brasileirão Triunfante', m.texto);
      saida.push({ filial: m.filial, supervisor: m.supervisor, lances: m.qtd, ok: e.ok, status: e.status || e.erro });
      if (e.ok) { const st = marca(m.filial, m.chaves); for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80)); }
    }
    if (silenciosos.length) { const por = {}; for (const l of silenciosos) if (/^[A-Z]{3}$/.test(String(l.filial || ''))) (por[l.filial] = por[l.filial] || []).push(l.chave); for (const [f, cs] of Object.entries(por)) { const st = marca(f, cs); for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80)); } }
    await env.DB.prepare("INSERT OR REPLACE INTO config_flags (chave, valor) VALUES ('notif_supervisores_ultimo', ?)").bind(`${t.dia} ${agora}`).run();
    return resp({ status: 'ENVIADO', primeira_rodada_do_dia: primeira, notificacoes: saida.length, ok: saida.filter((x) => x.ok).length, falhas: saida.filter((x) => !x.ok), silenciosos: silenciosos.length });
  } catch (e) {
    return resp({ erro: String(e.message || e).slice(0, 300) }, 500);
  }
}
