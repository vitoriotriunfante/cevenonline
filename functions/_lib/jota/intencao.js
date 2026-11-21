// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/intencao.js
// O QUE É: ROTEADOR POR INTENCAO (docs/CATALOGO_RESPOSTAS_JOTA.md; plano docs/PLANO_EXECUCAO_JOTA.md, bloco 1). Roda ANTES do roteamento antigo do entende.js.
//   Reconhece a intencao, decide o alvo (eu / um vendedor / um supervisor / filial / Brasil) e chama UMA resposta. O que nao reconhece devolve null
//   e segue o caminho antigo. Chave: config_flags 'jota_intencao' = 'off' desliga.
// POR QUE (Vitorio, 17/11/2026: 15 de 25 perguntas da manha erradas): "bom dia da Brenda" virava ficha, "matinal Yasmin" virava filial, "Gonçalves em TBL"
//   virava card geral, "pare" e "sugestao" viravam listas, contestacao virava card, "tendencia das filiais" ficava presa na filial anterior.
// =========================================================================
import { FILIAIS, N, R$, hojeSP, nome2, sem, titulo, vn } from './base.js';
import { achaPessoa, carregaEscopo } from './escopo.js';

const HORA = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
const FIL_RX = /\b(TBL|TPH|TCV|ABC|TCA|MCD|TCG|API|TBE|TPA|TSJ)\b/;
const lev = (a, b) => { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
const PALAVRAS_COMANDO = /^(MATINAL|BOM|DIA|BOA|TARDE|NOITE|DA|DE|DO|DOS|DAS|EQUIPE|SUPERVISOR|SUPERVISORA|VENDEDOR|VENDEDORA|COMO|ESTA|ESTAMOS|FILIAL|HOJE|O|A|E|EM|NO|NA|PARA|PRA)$/;

// pessoa citada por NOME com tolerancia a 1 letra ("Yasmin" = "Yasmim"); devolve { tipo: 'sup'|'vend', alvo, filial } ou { erro }
async function achaPessoaTolerante(B, t, filCit) {
  const escBr = filCit ? { nome: filCit, filiais: [filCit], grupo: null, nacional: false } : { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true };
  const E = await carregaEscopo(B, escBr);
  const p = achaPessoa(E, t);
  if (p && (p.tipo === 'vend' || p.tipo === 'sup')) return { ...p, E };
  const toks = t.split(/\s+/).filter((w) => w.length >= 4 && !PALAVRAS_COMANDO.test(w) && !FIL_RX.test(w));
  if (!toks.length) return null;
  const sups = new Map(); for (const v of E.vend) if (v.supervisor) sups.set(sem(v.supervisor) + '|' + v.filial, { nome: v.supervisor, filial: v.filial });
  const cand = [];
  for (const s of sups.values()) { const ws = sem(s.nome).split(/\s+/); if (toks.every((tk) => ws.some((w) => w === tk || (w.length >= 4 && lev(w, tk) <= 1)))) cand.push({ tipo: 'sup', alvo: s.nome, filial: s.filial }); }
  for (const v of E.vend) { const ws = sem(v.nome).split(/\s+/); if (toks.every((tk) => ws.some((w) => w === tk || (w.length >= 4 && lev(w, tk) <= 1)))) cand.push({ tipo: 'vend', alvo: v, filial: v.filial }); }
  if (cand.length === 1) return { ...cand[0], E };
  if (cand.length > 1) return { varios: cand.slice(0, 6), E };
  // citou filial errada? procura no Brasil
  if (filCit) { const r = await achaPessoaTolerante(B, t, null); if (r && !r.varios && r.filial && r.filial !== filCit) return { ...r, outraFilial: filCit }; }
  return null;
}

// PROSPECTS DE UM VENDEDOR (prospects_mapa): quantos por tipo + os 10 mais perto da rota, numa resposta so (sem depender do numero digitado depois)
async function prospectsDoVendedor(B, v) {
  const cab = `📍 *Prospects — ${vn(v)}* (${v.filial})`;
  if (!B.env || !B.env.DB) return `${cab}: a base de prospecção não está disponível agora.`;
  let P = [];
  try { P = ((await B.env.DB.prepare('SELECT cnpj, json FROM prospects_mapa WHERE filial = ? AND rca = ?').bind(String(v.filial), String(v.rca)).all()).results || []).map((r) => { try { return { cnpj: r.cnpj, ...JSON.parse(r.json) }; } catch (e) { return null; } }).filter(Boolean); } catch (e) { return `${cab}: falha ao ler a base; não vou afirmar que está sem pontos.`; }
  if (!P.length) return `${cab}: ainda não há nenhum ponto coletado para esse vendedor.`;
  const tipo = (p) => titulo(String(p.cnae || 'Sem CNAE').replace(/^[\d.\-/ ]+/, '').replace(/^COM[EÉ]RCIO VAREJISTA DE /i, '').replace(/^Com[eé]rcio Varejista De /i, '').toLowerCase());
  const G = new Map(); for (const p of P) G.set(tipo(p), (G.get(tipo(p)) || 0) + 1);
  const perto = P.slice().sort((a, b) => (a.km ?? 999) - (b.km ?? 999)).slice(0, 10);
  return [cab, `*${N(P.length)}* pontos para prospectar perto da rota.`, '', '*Por tipo:*', ...[...G.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `• ${k.slice(0, 60)}: ${N(n)}`),
    '', '*Os 10 mais perto da rota:*', ...perto.map((p, i) => `${i + 1}. *${titulo(String(p.fantasia || p.razao || 'Sem nome').toLowerCase())}* · ${tipo(p).slice(0, 40)}\n   ${[p.end, p.bairro].filter(Boolean).map((s) => titulo(String(s).toLowerCase())).join(', ')}${p.km != null ? ` · ${String(p.km).replace('.', ',')} km da rota` : ''}${p.tel ? ` · 📞 ${p.tel}` : ''}`),
    '', `_O vendedor vê os mesmos pontos no item 10 do menu dele (por tipo, com mapa)._`].join('\n');
}

async function escopoSupervisor(B, nomeSup, filial) {
  return carregaEscopo(B, { nome: 'Equipe ' + titulo(String(nomeSup).split(' ').slice(0, 2).join(' ')) + ' (' + filial + ')', filiais: [filial], grupo: null, supervisor: nomeSup, nacional: false });
}

export async function rotearIntencao(B, c, t, info) {
  if (!B || !c || !t) return null;
  try { if (B.env && B.env.DB) { const f = await B.env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'jota_intencao'").first(); if (f && String(f.valor).toLowerCase() === 'off') return null; } } catch (e) { /* sem flag: ligado */ }
  const { esc, rcaV } = info || {};
  const papel = c.papel || '', acima = papel === 'diretoria' || papel === 'ceo' || papel === 'gerente' || papel === 'supervisor';
  const filCit = (t.match(FIL_RX) || [])[1] || null;
  const MO = () => import('./respostas/momentos.js');

  // A · PARE
  if (/^\W*(PARE|PARA|CHEGA|STOP|CANCELA|CANCELAR|PARE DE MANDAR)\W*$/.test(t)) return 'Ok, parei. Quando quiser, é só perguntar.';
  // A6 · SUGESTAO (com ou sem dois pontos) — registra e agradece; nunca vira consulta
  if (/^\W*SUGEST(AO|OES)?\b/.test(t) && t.replace(/^\W*SUGEST(AO|OES)?\W*/, '').length > 3) {
    try { await B.env.DB.prepare('INSERT INTO bot_sugestoes (celular, nome, papel, filial, texto, sobre) VALUES (?,?,?,?,?,?)').bind(c.celular || '', c.nome || '', papel, c.filial || '', t.slice(0, 1000), 'sugestao').run(); } catch (e) { /* segue */ }
    return `Anotado, ${nome2(c.nome || '').split(' ')[0] || ''}! Sua sugestão foi registrada e vai para quem cuida do Jota. 🙏`;
  }
  // A9 · FERIADO (auditoria 21/11: em 20/11 o JOTA mostrou 0% vermelho e '42 zerados' num dia sem rota): pergunta do DIA em feriado nacional = avisa, sem cobrar
  if (/\b(HOJE|ZERAD\w*|ROTA|VISITA\w*|BOM DIA|MATINAL|FECHAMENTO DO DIA|QUANTO VENDI)\b/.test(t) && !/\b(MES|ONTEM|SEMANA)\b/.test(t)) {
    try { const { ehFeriado } = await import('../feriados.js'); const hj = hojeSP(); if (ehFeriado(hj)) return `📅 Hoje (${hj.slice(8, 10)}/${hj.slice(5, 7)}) é *feriado nacional*: sem rota e sem cobrança do dia. Os dias úteis do mês já não contam hoje.\n\nPergunte do *mês* (ex.: "como estou no mês") ou de *ontem*.`; } catch (e) { /* segue */ }
  }
  // A8 · RESPOSTA A UM ALERTA DO MONITOR.IA (piloto 21/11/2026): "ok/feito" ou "nao procede" ate 4 h depois do alerta = registra no alerta e confirma
  if (c.celular && B.env && B.env.DB && /^\W*(OK|OKAY|FEITO|JA TRATEI|TRATADO|NAO PROCEDE|NAO PROCEDENTE|ESTA ERRADO|TA ERRADO|ERRADO)\W*$/.test(t)) {
    try {
      const a = await B.env.DB.prepare("SELECT id, regra_id FROM monitoria_envios WHERE celular = ? AND regra_id LIKE 'PILOTO:%' AND status = 'ENVIADO' AND enviado_em > ? ORDER BY id DESC LIMIT 1").bind(String(c.celular), new Date(Date.now() - 4 * 3600e3).toISOString()).first();
      if (a) {
        const ok = /^\W*(OK|OKAY|FEITO|JA TRATEI|TRATADO)\W*$/.test(t);
        await B.env.DB.prepare('UPDATE monitoria_envios SET acao_pos_alerta = ? WHERE id = ?').bind(ok ? 'FEITO' : 'NAO_PROCEDE', a.id).run();
        return ok ? '✅ Anotado: alerta tratado. Obrigado!' : '📝 Anotado como *não procede*. Vou conferir esse alerta com a diretoria. Se quiser, me diga em uma frase o que estava errado.';
      }
    } catch (e) { /* segue o roteamento normal */ }
  }
  // A7 · CONTESTACAO do dado (sem pedir outro dado) — confirma, registra e pergunta o que esperava; nunca devolve card
  if (/\b(ESTAO ERRAD[OA]S|NAO TEM (O )?(PQ|PORQUE|POR QUE)|E DO CANAL|NAO TEM O KPI|COMPRA E CENTRALIZADA|INFORMACAO .{0,30}INCORRET[OA]|ESTA INCORRET[OA]|TA DE BRINCADEIRA|DE BRINCADEIRA|NAO PROCEDE|NAO CONFERE|NAO E ISSO|NAO FOI ISSO( QUE)?( EU)? PERGUNTEI|ESTA ERRAD[OA]|TA ERRAD[OA]|DADO ERRADO|NUMERO ERRADO|INFORMACAO ERRADA|UMA MERDA|CAGADA|RESPONDEU (PRA|PARA) .{1,40} DE UM JEITO|RESPONDEU ERRADO|NAO BATE)\b/.test(t) && !/\?\s*$/.test(t)) {
    try { await B.env.DB.prepare('INSERT INTO bot_sugestoes (celular, nome, papel, filial, texto, sobre) VALUES (?,?,?,?,?,?)').bind(c.celular || '', c.nome || '', papel, c.filial || '', t.slice(0, 1000), 'contestacao').run(); } catch (e) { /* segue */ }
    return `Entendi, ${nome2(c.nome || '').split(' ')[0] || ''}. Registrei para conferir. Me diz em uma linha o que você esperava ver (ex.: "quero os clientes sem compra da rota de hoje") que eu respondo certo.`;
  }
  // A2 · MENU de outro papel (diretoria pedindo "menu do supervisor")
  if (/^\W*(MENU|MENU DO JOTA|MENU JOTA|JOTA MENU|O MENU)\W*$/.test(t)) {   // 17/11/2026 (bateria real: 'Menu do jota' vinha vazio ou com card)
    const LM = await import('./respostas/liga_mix.js');
    if (papel === 'vendedor' && LM.respMenuVendedor) return LM.respMenuVendedor(c);
    if (papel === 'supervisor' && LM.respMenuSupervisor) return LM.respMenuSupervisor(c);
  }
  if (acima && /^\W*MENU\s+(DO|DA|DE)\s+(SUPERVISOR|SUPERVISORA)\W*$/.test(t)) { const { respMenuSupervisor } = await import('./respostas/liga_mix.js'); return respMenuSupervisor({ ...c, papel: 'supervisor' }); }
  if (acima && /^\W*MENU\s+(DO|DA|DE)\s+(VENDEDOR|VENDEDORA)\W*$/.test(t)) { const { respMenuVendedor } = await import('./respostas/liga_mix.js'); return respMenuVendedor({ ...c, papel: 'vendedor' }); }

  // B1/A1 · MATINAL ou BOM DIA DE ALGUEM (diretoria/gerente: "matinal Yasmin de TCA", "bom dia da Brenda de TPA")
  const mPess = t.match(/^\W*(MATINAL|BOM DIA|BOA TARDE|BOA NOITE)\s+(D[AOE]S?\s+)?(.+?)\W*$/);
  if (acima && mPess && !/^(EQUIPE|TIME|FILIAL|BRASIL|HOJE|JOTA)\b/.test(mPess[3]) && mPess[3].replace(FIL_RX, '').trim().length >= 3) {
    const r = await achaPessoaTolerante(B, mPess[3], filCit);
    if (r && r.varios) return `Encontrei mais de uma pessoa com esse nome: ${r.varios.map((x) => x.tipo === 'sup' ? `supervisor *${titulo(x.alvo)}* (${x.filial})` : `*${vn(x.alvo)}* (${x.filial})`).join(' · ')}. Repita com a filial.`;
    if (r && r.outraFilial) { /* citou a filial errada: responde a pessoa certa e avisa */ }
    if (r && (r.tipo === 'sup')) {
      const nomeSup = typeof r.alvo === 'object' ? (r.alvo.nome || '') : r.alvo, fl = r.filial || filCit || (r.E.vend.find((v) => sem(v.supervisor) === sem(nomeSup)) || {}).filial;
      const Es = await escopoSupervisor(B, nomeSup, fl);
      // 18/11/2026: "bom dia do <supervisor>" = o mesmo bom dia consolidado que ele recebe; "matinal do <supervisor>" = os cards da reuniao
      if (/BOM DIA|BOA TARDE|BOA NOITE/.test(mPess[1])) { const V = (Es && Es.vend) || []; const r2 = await (await import('./respostas/bomdia_gestao.js')).respBomDiaGestao(B, 'supervisor', { nome: Es.nome, filiais: [fl], supCod: (V.find((v) => v.supCod) || {}).supCod || null, rcas: V.map((v) => String(v.rca)), primeiro: '' }).catch(() => null); if (r2) return (r.outraFilial ? `_${titulo(nomeSup)} é da ${fl}, não da ${r.outraFilial}._\n\n` : '') + `👤 *Como ${titulo(nomeSup)} vê:*\n\n` + r2; }
      const { respMatinal } = await import('./respostas/gestao.js');
      const txt = await respMatinal(B, Es);
      if (txt) return (r.outraFilial ? `_${titulo(nomeSup)} é da ${fl}, não da ${r.outraFilial}._\n\n` : '') + txt;
    }
    if (r && r.tipo === 'vend') {
      const v = r.alvo, cv = { nome: v.nome, papel: 'vendedor', filial: v.filial, rca: String(v.rca), celular: c.celular };
      const Ev = await carregaEscopo(B, { nome: v.nome, filiais: [v.filial], grupo: null, supervisor: null, rca: String(v.rca), nacional: false });
      const h = HORA(), mo = /MATINAL|BOM DIA/.test(mPess[1]) && h < 11 ? 'plano' : h < 15 ? 'meio' : 'fechamento';
      const m = await (await MO()).respMomento(B, cv, Ev, mo);
      if (m && m.texto) return (r.outraFilial ? `_${vn(v)} é da ${v.filial}, não da ${r.outraFilial}._\n\n` : '') + `👤 *Como ${vn(v)} vê:*\n\n` + m.texto.replace(/\n〔M:\w+〕/, '');
    }
    if (!r && /^MATINAL/.test(mPess[1])) return `🔎 Não achei *${titulo(mPess[3].replace(FIL_RX, '').trim().toLowerCase())}*${filCit ? ` na ${filCit}` : ''}. Confere o nome (ex.: "matinal Yasmim de TCA") ou mande o código do supervisor.`;
  }
  // G2 · PROSPECCAO DE ALGUEM (Vitorio, 17/11/2026: "por que nao ta buscando os prospects / prospeccao do Vinicius de TCA?" — virava o card do vendedor)
  const mPro = t.match(/^\W*(?:PROSPEC\w*|PROSPECT\w*|CADASTROS? NOVOS?|PONTOS? (?:PARA|PRA) PROSPECTAR)\s+(?:D[AOE]S?\s+)?(.+?)\W*$/);
  if (acima && mPro && mPro[1].replace(FIL_RX, '').replace(/\b(DE|DA|DO|EM|NA|NO)\b/g, '').trim().length >= 3) {
    const r = await achaPessoaTolerante(B, mPro[1], filCit);
    if (r && r.varios) return `Encontrei mais de uma pessoa com esse nome: ${r.varios.map((x) => x.tipo === 'sup' ? `supervisor *${titulo(x.alvo)}* (${x.filial})` : `*${vn(x.alvo)}* (${x.filial})`).join(' · ')}. Repita com a filial (ex.: "prospecção Vinicius de TCA").`;
    if (r && r.tipo === 'vend') return (r.outraFilial ? `_${vn(r.alvo)} é da ${r.alvo.filial}, não da ${r.outraFilial}._\n\n` : '') + await prospectsDoVendedor(B, r.alvo);
    if (r && r.tipo === 'sup') {
      const nomeSup = typeof r.alvo === 'object' ? (r.alvo.nome || '') : r.alvo, fl = r.filial || filCit;
      const { respProspectsEquipe } = await import('./respostas/segmentos_pastas.js'); return respProspectsEquipe(B, await escopoSupervisor(B, nomeSup, fl));
    }
    if (!r) return `🔎 Não achei *${titulo(mPro[1].replace(FIL_RX, '').trim().toLowerCase())}*${filCit ? ` na ${filCit}` : ''}. Confere o nome (ex.: "prospecção Vinicius de TCA").`;
  }
  // B2 · "BOM DIA" DE QUEM ESCREVE = o comeco do dia dele, o MESMO que a diretoria recebe em "bom dia da Tamara" (17/11/2026, auditoria por papel:
  // a Tamara mandava "bom dia" e recebia o menu). O menu continua a um "menu" de distancia.
  if (/^\W*(BOM DIA|BOA TARDE|BOA NOITE|OI|OLA|E AI)(\s+JOTA)?\W*$/.test(t)) {
    const h = HORA(), mo = h < 11 ? 'plano' : h < 15 ? 'meio' : 'fechamento', rodMenu = '\n\n📋 Digite *menu* para ver tudo o que eu respondo.';
    if (papel === 'vendedor' && rcaV) { const Ev = await carregaEscopo(B, esc); const m = await (await MO()).respMomento(B, c, Ev, mo).catch(() => null); if (m && m.texto) return m.texto + rodMenu; }
    // 18/11/2026 (Vitorio: "pq nao temos o mesmo bom dia cascateado? supervisor / gerente / diretoria... o que um CEO diria?"): bom dia consolidado
    // do nivel de quem pergunta (matinal continua sendo os cards da reuniao)
    if (papel === 'supervisor' || papel === 'gerente' || papel === 'diretoria' || papel === 'ceo') {
      const { respBomDiaGestao } = await import('./respostas/bomdia_gestao.js');
      let r = null;
      if (papel === 'supervisor') { const Ev = await carregaEscopo(B, esc), V = (Ev && Ev.vend) || []; r = await respBomDiaGestao(B, 'supervisor', { nome: Ev && Ev.nome || 'Equipe', filiais: [c.filial], supCod: (V.find((v) => v.supCod) || {}).supCod || null, rcas: V.map((v) => String(v.rca)), primeiro: c.nome }).catch(() => null); }
      else if (papel === 'gerente') r = await respBomDiaGestao(B, 'gerente', { nome: c.filial, filiais: [c.filial], primeiro: c.nome }).catch(() => null);
      else r = await respBomDiaGestao(B, 'diretoria', { nome: 'Brasil — 11 filiais', filiais: FILIAIS, primeiro: c.nome }).catch(() => null);
      if (r) return r;
    }
  }
  // D1 · "QUANTO VENDI HOJE" do proprio vendedor = o dia dele (Clube), nunca o card do mes (auditoria 17/11/2026: R05 periodo trocado)
  if (papel === 'vendedor' && rcaV && /\b(QUANTO|O QUE)\b.*\bVENDI\b.*\bHOJE\b|\bMINHAS? VENDAS? (DE |DO )?(HOJE|DIA)\b|\bVENDAS? (DE |DO )?(HOJE|DIA)\b|\bVENDAS?\b.*\bHOJE\b|\bMEU DIA\b|^\W*HOJE\W*$/.test(t)) {
    const Ev = await carregaEscopo(B, esc), v = Ev && Ev.vend && Ev.vend[0];
    if (v) { const { respDiaVendedor } = await import('./respostas/resumo.js'); const r = await respDiaVendedor(B, Ev, v).catch(() => null); if (r) return r; }
  }
  // G4 · ONDE ESTA / ROTA DE HOJE / VISITAS DE ALGUEM (Vitorio, 17/11/2026: "onde esta a Fernanda de TSJ" veio o card do mes e "rota dela hoje" virou a filial;
  // "gostei muito mais da resposta" do Cleverson = visitas com horario e motivo). "dela/dele" = a pessoa da pergunta anterior.
  if (acima && /\b(ONDE (ESTA|TA|ANDA|FICA|SE ENCONTRA)|LOCALIZA\w*|ROTA (DE HOJE )?(D[AOE]|DELA|DELE)|VISITAS? (DE HOJE )?(D[AOE]|DELA|DELE)|QUEM (ELA|ELE) VISITOU)\b/.test(t) && !/\b(EQUIPE|FILIAL|TIME|BRASIL)\b/.test(t)) {
    let v = null;
    if (/\b(ELA|ELE|DELA|DELE)\b/.test(t)) {
      const { pessoaVendedoraAnterior } = await import('./entende.js');
      const Eb = await carregaEscopo(B, (papel === 'diretoria' || papel === 'ceo') ? { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true } : esc);
      const pa = pessoaVendedoraAnterior(Eb, info.anteriores || []); if (pa) v = pa.alvo;
    }
    if (!v) { const r = await achaPessoaTolerante(B, t.replace(/\b(ONDE|ESTA|TA|ANDA|FICA|SE|ENCONTRA|AGORA|LOCALIZACAO|LOCALIZA|ROTA|VISITAS?|DE|DA|DO|HOJE|QUEM|VISITOU)\b/g, ' ').replace(/\s+/g, ' ').trim(), filCit).catch(() => null);
      if (r && r.varios) return `Encontrei mais de uma pessoa: ${r.varios.map((x) => x.tipo === 'sup' ? `supervisor *${titulo(x.alvo)}* (${x.filial})` : `*${vn(x.alvo)}* (${x.filial})`).join(' · ')}. Repita com a filial.`;
      if (r && r.tipo === 'vend') v = r.alvo; }
    if (v) { const { respOndeEsta } = await MO(); return respOndeEsta(B, v); }
  }
  // D2b · VARIOS ASSUNTOS NUMA MENSAGEM SO (17/11/2026, Sebastian TPA 315: "faturamento, a faturar, positivando, devolucao, rota do mes" virou a lista de pedidos):
  // 2 ou mais indicadores do mes = o card "como estou" (o item 1 do menu), que traz todos eles
  if (papel === 'vendedor' && rcaV && info.interno) {
    const temas = [/FATURAMENTO|FATURADO\b/, /A FATURAR|PENDENTE|CARTEIRA/, /POSITIVA/, /DEVOLU/, /ROTA DO MES|VISITAS DO MES/, /\bMETAS?\b/].filter((re) => re.test(t)).length;
    if (temas >= 2 && !/\b\d{7,}\b/.test(t)) return info.interno('como estou');
  }
  // B1 · MATINAL do proprio vendedor = o plano do dia dele (o mesmo do "bom dia"), nunca a matinal antiga do "ontem 13/11"
  if (papel === 'vendedor' && rcaV && /^\W*(MINHA\s+)?MATINAL\W*$/.test(t)) {
    const Ev = await carregaEscopo(B, esc); const m = await (await MO()).respMomento(B, c, Ev, HORA() < 11 ? 'plano' : HORA() < 15 ? 'meio' : 'fechamento');
    if (m && m.texto) return m.texto;
  }

  // E5 · VISITADOS HOJE E 30+ DIAS SEM COMPRAR (Vitorio, 17/11/2026: "o cara visitou o cliente, nao compra a 30 dias e vamos fazer o que com isso?")
  if (acima && /VISITAD\w* SEM COMPRA|VISITOU E NAO COMPR|30\+? DIAS SEM COMPRA/.test(t)) {
    const fil = filCit || (papel === 'gerente' ? c.filial : null);
    const E = await carregaEscopo(B, fil ? { nome: fil, filiais: [fil], grupo: null } : (papel === 'diretoria' || papel === 'ceo') ? { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true } : esc);
    const { respVisitadosSemCompra } = await import('./respostas/rota.js'); const r = await respVisitadosSemCompra(E, B); if (r) return r;
  }
  // H · GESTAO PELO GEROT E PELO CLUBE (18/11/2026: perguntas de Vitorio, Evandro Servat e Paulo Micheleto) — escopo de quem pergunta
  if (acima) {
    const G = () => import('./respostas/gestao_gerot.js');
    const escG = async () => {
      if (papel === 'diretoria' || papel === 'ceo') return { filiais: filCit ? [filCit] : FILIAIS, nome: filCit || 'Brasil', nacional: !filCit };
      const Ev = await carregaEscopo(B, esc), V = (Ev && Ev.vend) || [];
      if (papel === 'gerente') return { filiais: [c.filial], nome: Ev && Ev.nome || c.filial, rcas: c.grupo ? V.map((v) => String(v.rca)) : null };
      return { filiais: [c.filial], nome: Ev && Ev.nome || 'Equipe', rcas: V.map((v) => String(v.rca)), supCod: (V.find((v) => v.supCod) || {}).supCod || null };
    };
    // margem: so diretoria e gerente (Evandro, 18/11: "disponibilizar apenas para diretoria e gerentes")
    if (/\bMARGE[MN]/.test(t) && (papel === 'diretoria' || papel === 'ceo' || papel === 'gerente')) { const e = await escG(); const r = await (await G()).respMargemGerot(B, e.filiais, e.nome).catch(() => null); if (r) return r; }
    // percentual de atingimento por filial (Micheleto, 17/11: virava texto generico da IA)
    if ((papel === 'diretoria' || papel === 'ceo') && /ATINGIMENTO|PERCENTUAL (DA META|DE META|DE ATINGIMENTO)|% DA META/.test(t) && !filCit) { const { respBrasilGerot } = await import('./respostas/gerot_painel.js'); const r = await respBrasilGerot(B, null).catch(() => null); if (r) return r; }
    // carteira por status / motivo (Micheleto, 18/11: "bloqueio financeiro, bloqueio comercial e todos os outros motivos")
    if (/CARTEIRA|PEDIDOS? (EM CARTEIRA|PENDENTES?|BLOQUEAD)|BLOQUEIO (FINANCEIRO|COMERCIAL)/.test(t) && /STATUS|MOTIVO|BLOQUE|ABERT|SITUACAO/.test(t) && !/\b\d{7,}\b/.test(t)) { const e = await escG(); const r = await (await G()).respCarteiraStatus(B, e.filiais, e.rcas, e.nome).catch(() => null); if (r) return r; }
    // justificativas de nao venda pelo Clube (Vitorio, 18/11: "pq ate dia 16?" e "aberto por vendedor x justificativa e justificativa x vendedor")
    if (/JUSTIFICATIVA|MOTIVOS? DE NAO VENDA|NAO VENDA/.test(t)) {
      // 18/11/2026: a ORDEM das palavras decide: "vendedor x justificativa"/"por vendedor" = cada vendedor com os motivos dele; "justificativa x vendedor"/"por motivo" = cada motivo com quem mais usa
      const iV = t.search(/VENDEDOR/), iJ = t.search(/JUSTIFICATIVA|MOTIVO/), cruz = /\b(X|×|POR)\b/.test(t);
      const modo = /POR (MOTIVO|JUSTIFICATIVA)/.test(t) ? 'just' : /POR VENDEDOR/.test(t) ? 'vendedor' : cruz && iV >= 0 && iJ >= 0 ? (iJ < iV ? 'just' : 'vendedor') : iV >= 0 ? 'vendedor' : 'motivo';
      // leitura do Clube falhou (D1 ocupado): tenta de novo; se falhar outra vez avisa — nunca cai na resposta antiga do CEVEN ("ate 16/11"), que e outro numero
      const e = await escG(); let r = await (await G()).respJustificativas(B, e, modo).catch(() => null);
      if (!r) r = await (await G()).respJustificativas(B, e, modo).catch(() => null);
      return r || '⏳ Não consegui ler as justificativas do Clube da Venda agora. Pergunte de novo em 1 minuto.';
    }
    // visitas / plano de visitas / aderencia pelo Clube (Evandro, 18/11: "abrir por filial, supervisor ou vendedor; rota do dia e acumulado do mes")
    if (/\bVISITAS?\b|PLANO DE VISITA|ADERENCIA/.test(t) && !/\b(ONDE|ELA|ELE|DELA|DELE)\b/.test(t) && !/SEM COMPRA|SEM VENDA|VISITADOS/.test(t)) {
      const e = await escG(); const por = /POR VENDEDOR|VENDEDORES/.test(t) ? 'vendedor' : /POR SUPERVISOR|SUPERVISORES/.test(t) ? 'supervisor' : e.nacional ? 'filial' : papel === 'supervisor' ? 'vendedor' : 'supervisor';
      const r = await (await G()).respVisitasClube(B, e, por).catch(() => null); if (r) return r;
    }
    // devolucao por motivo (tela do GEROT; Vitorio 18/11: "vc nao abriu por motivo quando eu pedi!!!")
    if (/DEVOLU/.test(t) && /MOTIVO|NAO PEDIU/.test(t)) {
      // 18/11/2026: supervisor/grupo ou "por vendedor" (filial) = aberto por vendedor (Motivo > Filial > Supervisor > Vendedor do GEROT); sem a carga por vendedor, cai no motivo x filial
      const e = await escG();
      if ((e.rcas && e.rcas.length) || (/VENDEDOR/.test(t) && e.filiais.length === 1)) { const r = await (await G()).respDevolucaoMotivoVend(B, e).catch(() => null); if (r) return r; }
      const r = await (await G()).respDevolucaoMotivo(B, e.filiais, e.nome).catch(() => null); if (r) return r;
    }
    // devolucao com o numero do GEROT (Vitorio, 18/11: "devolucoes tambem vc esta pegando o numero correto?"); codigo de vendedor citado soma as filiais
    if (/DEVOLU/.test(t) && !/MOTIVO|NAO PEDIU|\b(HOJE|HJ)\b/.test(t)) {
      const e = await escG(); const mR = t.match(/\b(?:VENDEDOR|RCA|COD(?:IGO)?(?: DE VENDEDOR)?)\s*(?:COD\.?\s*)?(\d{1,5})\b/);
      const r = await (await G()).respDevolucaoGerot(B, mR ? { filiais: e.filiais, rca: mR[1], nome: `vendedor ${mR[1]}${filCit ? ' (' + filCit + ')' : ''}` } : { ...e, supCod: papel === 'supervisor' ? e.supCod : null }).catch(() => null); if (r) return r;
    }
    // faturado ate a data x mes passado ate a mesma data (Vitorio e Evandro, 18/11)
    // 18/11 (Vitorio: "cortes tambem tem por motivo"): cortes da gestao pelo GEROT, comercial x logistico, aberto por filial/supervisor/vendedor
    if (/\bCORTES?\b|CORTAD/.test(t) && !/\d{7,}|DEVOL|\bHOJE\b|\bHJ\b|INDUSTRIA|FORNECEDOR|PEDIDOS?\b|CLIENTE/.test(t)) { const e = await escG(); const r = await (await G()).respCortesGestao(B, e).catch(() => null); if (r) return r; }
    // 18/11 (Evandro): gap de cada cliente contra a media dos 3 meses (GEROT por cliente)
    if ((/\bGAP\b/.test(t) || (/CLIENTE/.test(t) && /ABAIXO DA MEDIA|MEDIA (DOS )?(ULTIMOS )?(3|TRES) MESES|MEDIA (DE )?3 ?M\b|\b3 ?M\b/.test(t))) && !/POSITIVA/.test(t)) { const e = await escG(); const r = await (await G()).respGapClientes(B, e).catch(() => null); if (r) return r; }
    if (/ATE A DATA|ATE HOJE|ATE O DIA|MESMO DIA|MESMA DATA/.test(t) || (/COMPARA/.test(t) && /MES (ANTERIOR|PASSADO)|OUTUBRO/.test(t) && /FATURA|VENDA/.test(t))) { const e = await escG(); const r = await (await G()).respAteData(B, e.filiais, e.nome).catch(() => null); if (r) return r; }   // 18/11: pelo faturado por FILIAL x DIA do GEROT (gerot_filial_dia; out = R$ 80,48 mi igual a tela)
  }
  // C11 · TENDENCIA DAS FILIAIS / DO BRASIL (nunca presa na filial da pergunta anterior)
  if (acima && (papel === 'diretoria' || papel === 'ceo') && /TENDENCIA/.test(t) && /\b(FILIAIS|BRASIL|TODAS|REDE|GERAL)\b/.test(t) && !filCit) {
    const { respTendencia } = await import('./respostas/gestao.js');
    const E = await carregaEscopo(B, { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true }); const r = await respTendencia(B, E); if (r) return r;
  }
  // C4 · POSITIVACAO COMPARADA (Brasil/filial): faturado + carteira e o mes anterior, pelo GEROT (nunca a base de vendas parada)
  if (/POSITIVA/.test(t) && /(COMPARA|MES(ES)? ANTERIOR|MES PASSADO|MELHOR|PIOR|OUTUBRO|CARTEIRA|BRASIL|FILIAIS|COMO ESTA|COMO ESTAMOS|\bA-?1\b|BENCH|\b3M\b|\bM-?1\b)/.test(t) && (papel === 'diretoria' || papel === 'ceo' || papel === 'gerente')) {
    const r = await respPositivacaoComparada(B, filCit || (papel === 'gerente' ? c.filial : null)); if (r) return r;
  }
  // F2 · METAS DAS INDUSTRIAS do vendedor / da equipe = painel do GEROT (17/11/2026, auditoria: liam a Premiacao/RV, fora do ar, com 'apuracao ate 20/11')
  if ((papel === 'vendedor' || papel === 'supervisor') && /^\W*(METAS? DAS? INDUSTRIAS?( DA EQUIPE)?|MINHAS INDUSTRIAS|INDUSTRIAS( DA EQUIPE)?)\W*$/.test(t)) {
    const Ev = await carregaEscopo(B, esc), v0 = Ev && Ev.vend && Ev.vend[0];
    const PI = await import('./respostas/painel_industrias.js');
    if (papel === 'vendedor' && v0) { const r = await PI.respPainelIndustrias(B.env, B, { fil: v0.filial, rca: String(v0.rca) }).catch(() => null); if (r) return r; }
    if (papel === 'supervisor' && v0 && v0.supCod) { const r = await PI.respPainelIndustrias(B.env, B, { fil: v0.filial, sup: String(v0.supCod) }).catch(() => null); if (r) return r; }
  }
  // F1 · UMA INDUSTRIA ("como estamos de Gonçalves em TBL", "meta da Arcor") — pelo GEROT, no escopo de quem pergunta
  if (/\b(COMO ESTAMOS|COMO ESTA|COMO TA|META|VENDEMOS|VENDA|RESULTADO)\b/.test(t) && !/CLIENTE|PEDIDO|\bLIGA\b/.test(t)) {
    const r = await respUmaIndustria(B, c, t, filCit, esc); if (r) return r;
  }

  // D2/D3 · VENDEDOR: a rota de hoje (quantos clientes, quantos ja compraram, os sem compra com visita hoje)
  if (papel === 'vendedor' && rcaV) {
    const Ev = await carregaEscopo(B, esc), v = Ev.vend[0];
    if (v && /SEM COMPRA|NAO COMPR|AINDA NAO/.test(t) && /\b(HOJE|HJ|ROTA|VISITA)\b/.test(t)) { const { respRotaHojeCompleta } = await import('./respostas/rota.js'); const r = await respRotaHojeCompleta(B, v, true); if (r) return r; }
    // 18/11/2026: "minhas justificativas" do vendedor = hoje e no mes por motivo + hoje cliente a cliente (Clube), a mesma conta do supervisor/gerente/diretoria
    if (v && /JUSTIFICATIV|NAO VENDA|MOTIVOS? DE NAO/.test(t)) { const { respJustificativas } = await import('./respostas/gestao_gerot.js'); const { titulo: tt } = await import('./base.js'); const r = await respJustificativas(B, { filiais: [v.filial], rcas: [String(v.rca)], nome: `${v.rca} - ${tt(String(v.nome || '').toLowerCase())}` }, 'motivo').catch(() => null); if (r) return r; }
    // 18/11/2026: "minhas devolucoes por motivo" do vendedor = o motivo de cada devolucao dele (GEROT)
    if (v && /DEVOLU/.test(t) && /MOTIVO|NAO PEDIU|POR QUE|PORQUE/.test(t)) { const { respDevolucaoMotivoVend } = await import('./respostas/gestao_gerot.js'); const r = await respDevolucaoMotivoVend(B, { filiais: [v.filial], rcas: [String(v.rca)], nome: `${v.rca} - ${v.nome}` }).catch(() => null); if (r) return r; }
    // 18/11/2026: "quem falta visitar hoje" do vendedor = so os que faltam (rota do Clube + check-in do Clube), nao a rota inteira
    if (v && /FALTA(M)? (SER )?VISITA|QUEM FALTA|A VISITAR|NAO VISITEI|AINDA NAO VISITEI/.test(t) && !/SUPERVISOR|EQUIPE|TIME/.test(t)) { const { respFaltaVisitar } = await import('./respostas/rota.js'); const r = await respFaltaVisitar(B, v); if (r) return r; }
    if (v && /QUANTOS CLIENTES/.test(t) && /\b(HOJE|HJ|ROTA)\b/.test(t)) { const { respMinhaRota } = await import('./respostas/rota.js'); const r = await respMinhaRota(B, v); if (r) return r; }
    // 17/11/2026 (auditoria ampla: 13 vendedores receberam a ficha de um cliente): direto na resposta de cortes do GEROT (o '16' fora do menu abria outra coisa)
    if (v && /^\W*(MEUS?\s+)?CORTES?( DO MES)?\W*$/.test(t)) { const { vn: vnf } = await import('./base.js'); const r = await (await import('./respostas/pedidos_gerot.js')).respCortesGerot(B, v.filial, [v.rca], vnf(v)).catch(() => null); if (r) return r; }
  }
  return null;
}

// POSITIVACAO: Brasil ou filial, com a carteira e o mes anterior (GEROT gerot_filial_mes)
async function respPositivacaoComparada(B, filial) {
  if (!B.env || !B.env.DB) return null;
  // 17/11/2026: a positivacao com todos os comparativos do GEROT (A-1, 3M, M-1, Bench, do dia) sai do modulo unico gerot_painel.js
  { const { respPositivacaoGerot } = await import('./respostas/gerot_painel.js'); const r = await respPositivacaoGerot(B, filial ? [filial] : null).catch(() => null); if (r) return r; }
  const mes = hojeSP().slice(0, 7);
  let R = []; try { R = (await B.env.DB.prepare('SELECT filial, dados FROM gerot_filial_mes WHERE mes = ?').bind(mes).all()).results || []; } catch (e) { return null; }
  if (filial) R = R.filter((x) => x.filial === filial);
  if (!R.length) return null;
  const L = R.map((x) => { let d = {}; try { d = JSON.parse(x.dados || '{}'); } catch (e) { d = {}; } return { f: x.filial, pos: Number(d['Positivação (filial + CNPJ)']) || 0, pc: Number(d['Positivação + Carteira']) || 0, m1: Number(d['Positivação M-1']) || 0, meta: Number(d['Meta de positivação']) || 0 }; });
  const s = (k) => L.reduce((a, x) => a + x[k], 0), pos = s('pos'), pc = s('pc'), m1 = s('m1'), meta = s('meta');
  const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—'), seta = (a, b) => (!b ? '' : a >= b ? ' ▲' : ' ▼');
  const out = [`👥 *Positivação — ${filial || 'Brasil'}* · ${mes.slice(5)}/${mes.slice(0, 4)}`,
    `✅ Faturado: *${N(pos)}* clientes${meta ? ` de ${N(meta)} (${pct(pos, meta)})` : ''}`,
    `⏳ Com carteira (faturado + a faturar): *${N(pc)}*${meta ? ` (${pct(pc, meta)})` : ''}`,
    m1 ? `📅 Mês passado (fechado): ${N(m1)} clientes → hoje com carteira estamos em *${pct(pc, m1)}* do mês passado${seta(pc, m1)}` : ''];
  if (!filial && L.length > 1) { out.push('', '*Por filial (faturado + carteira · mês passado):*'); for (const x of L.sort((a, b) => (b.pc / (b.m1 || 1)) - (a.pc / (a.m1 || 1)))) out.push(`• *${x.f}*: ${N(x.pc)}${x.meta ? ` de ${N(x.meta)}` : ''} · mês passado ${N(x.m1)} (${pct(x.pc, x.m1)})`); }
  out.push('_GEROT_');
  return out.filter((x) => x !== '').join('\n');
}

// UMA INDUSTRIA: acha o fornecedor no GEROT por palavra do nome (tolerante: "Gonçalves" = "GONCALV"); soma no escopo (Brasil, filial, equipe ou vendedor)
async function respUmaIndustria(B, c, t, filCit, esc) {
  if (!B.env || !B.env.DB) return null;
  const mes = hojeSP().slice(0, 7);
  let F = []; try { F = (await B.env.DB.prepare('SELECT DISTINCT fornecedor FROM gerot_vendas WHERE mes = ?').bind(mes).all()).results || []; } catch (e) { return null; }
  const STOP = /^(LTDA|LTD|S\/?A|SA|DO|DA|DE|DOS|BRASIL|INDUSTRIA|IND|COMERCIO|COM|DIST|DISTRIBUIDORA|ALIMENTOS|ALIM|PRODUTOS|E|EIRELI|ME|GRUPO)$/;
  const toks = t.split(/\s+/).filter((w) => w.length >= 5 && !PALAVRAS_COMANDO.test(w) && !FIL_RX.test(w) && !/^(ESTAMOS|RESULTADO|VENDEMOS|QUANTO|META|METAS|BRASIL|BRASILEIRO|AGORA|HOJE|ONTEM|VENDA|VENDAS|VENDIDO|GERAL|TODAS|TODOS|FILIAIS|FILIAL|SEMANA|POSITIVACAO|CLIENTES|CLIENTE|TENDENCIA|FATURAMENTO|FATURADO|CARTEIRA|PEDIDOS|PEDIDO|RITMO|NUMEROS|COMPARADA|COMPARADO|ANTERIOR|ANTERIORES|PASSADO|MESES|ATUAL|EQUIPE|SUPERVISOR|VENDEDOR|VENDEDORES|GERENTE|DIRETORIA|INDUSTRIAS|INDUSTRIA)$/.test(w));
  // 21/11/2026 (planilha "Industrias - Marcas Comerciais" do Vitorio): MARCA citada (Baly, Ype, Scotch-Brite, Leao...) -> industria pelo codigo do fornecedor
  let porMarca = [];
  try { const { MARCAS } = await import('./marcas.js'); const tt = ' ' + t.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const cods = new Set(MARCAS.filter(([m]) => m.length >= 3 && tt.includes(' ' + m.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ')).map(([, cod]) => cod));
    if (cods.size) porMarca = F.map((x) => x.fornecedor).filter((f) => [...cods].some((cod) => String(f).includes('#' + cod))); } catch (e) { porMarca = []; }
  // 17/11/2026 ("Venda do Brasil agora" virou 'Fvo Brasilia'): palavra geral nunca vira nome de industria; parecido (1 letra) so com 6+ letras
  if (!toks.length && !porMarca.length) return null;
  const achou = porMarca.length ? porMarca : F.map((x) => x.fornecedor).filter((f) => { const ws = sem(String(f).replace(/^[A-Z]\s*-\s*/, '').replace(/#\d+/, '')).split(/[\s.]+/).filter((w) => w.length >= 4 && !STOP.test(w)); return toks.some((tk) => ws.some((w) => w === tk || (w.length >= 5 && (tk.startsWith(w) || w.startsWith(tk))) || (tk.length >= 6 && lev(w, tk) <= 1))); });
  if (!achou.length || achou.length > 4) return null;
  const fil = filCit ? [filCit] : (esc && esc.filiais) || FILIAIS;
  const qs = fil.map(() => '?').join(','), qf = achou.map(() => '?').join(',');
  let R = []; try { R = (await B.env.DB.prepare(`SELECT filial, rca, supervisor, json_extract(dados, '$."Meta (R$)"') m, json_extract(dados, '$."Faturado líquido (R$)"') fa, json_extract(dados, '$."Carteira pendente (R$)"') ca, json_extract(dados, '$."Positivação (filial + CNPJ)"') p FROM gerot_vendas WHERE mes = ? AND filial IN (${qs}) AND fornecedor IN (${qf})`).bind(mes, ...fil, ...achou).all()).results || []; } catch (e) { return null; }
  if (esc && esc.supervisor) { const sa = sem(esc.supervisor); R = R.filter((x) => sem(x.supervisor || '').includes(sa.split(' ')[0])); }
  if (esc && esc.rca) R = R.filter((x) => String(x.rca) === String(esc.rca));
  // 21/11/2026: marca citada sem venda no escopo = dizer onde ela vende (antes caia em outra resposta ou mostrava zero)
  if (!R.length && porMarca.length) { let onde = []; try { onde = ((await B.env.DB.prepare(`SELECT filial FROM gerot_vendas WHERE mes = ? AND fornecedor IN (${qf}) GROUP BY filial HAVING SUM(json_extract(dados, '$."Faturado líquido (R$)"')) > 0`).bind(mes, ...achou).all()).results || []).map((x) => x.filial); } catch (e) { onde = []; } const nmF = titulo(String(achou[0]).replace(/^[A-Z]\s*-\s*/, '').replace(/#\d+/, '').toLowerCase()).trim(); return `🏭 *${nmF}* não tem venda nem meta em ${fil.length === 1 ? fil[0] : 'este escopo'} neste mês.${onde.length ? ` Vende em: *${onde.join(', ')}*. Pergunte, por exemplo, "como estamos de ${nmF.split(' ')[0]} em ${onde[0]}".` : ''}`; }
  if (!R.length) return null;
  const tot = R.reduce((a, x) => ({ m: a.m + (Number(x.m) || 0), fa: a.fa + (Number(x.fa) || 0), ca: a.ca + (Number(x.ca) || 0), p: a.p + (Number(x.p) || 0) }), { m: 0, fa: 0, ca: 0, p: 0 });
  const nome = titulo(String(achou[0]).replace(/^[A-Z]\s*-\s*/, '').replace(/\s*#\d+.*$/, '').toLowerCase());
  const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—');
  const out = [`🏭 *${nome} — ${filCit || (esc && esc.nome) || 'Brasil'}* · ${mes.slice(5)}/${mes.slice(0, 4)}`,
    tot.m ? `💰 Faturado *${R$(tot.fa)}* + a faturar ${R$(tot.ca)} = *${R$(tot.fa + tot.ca)}* de ${R$(tot.m)} (*${pct(tot.fa + tot.ca, tot.m)}*)` : `💰 Faturado *${R$(tot.fa)}* + a faturar ${R$(tot.ca)} · _sem meta no GEROT_`,
    `👥 Clientes que compraram: *${N(tot.p)}*`];
  if (!filCit && !(esc && (esc.supervisor || esc.rca)) && fil.length > 1) { const pf = new Map(); for (const x of R) { const y = pf.get(x.filial) || { m: 0, v: 0 }; y.m += Number(x.m) || 0; y.v += (Number(x.fa) || 0) + (Number(x.ca) || 0); pf.set(x.filial, y); } out.push('', '*Por filial:*', ...[...pf.entries()].sort((a, b) => (a[1].v / (a[1].m || 1)) - (b[1].v / (b[1].m || 1))).map(([f, y]) => `• *${f}*: ${R$(y.v)}${y.m ? ` de ${R$(y.m)} (${pct(y.v, y.m)})` : ''}`)); }
  else { const ps = new Map(); for (const x of R) { const k = titulo(nome2(x.supervisor || 'sem supervisor')); const y = ps.get(k) || { m: 0, v: 0 }; y.m += Number(x.m) || 0; y.v += (Number(x.fa) || 0) + (Number(x.ca) || 0); ps.set(k, y); } if (ps.size > 1) out.push('', '*Por supervisor:*', ...[...ps.entries()].sort((a, b) => (a[1].v / (a[1].m || 1)) - (b[1].v / (b[1].m || 1))).map(([k, y]) => `• *${k}*: ${R$(y.v)}${y.m ? ` de ${R$(y.m)} (${pct(y.v, y.m)})` : ''}`)); }
  out.push('_GEROT_');
  return out.join('\n');
}
