/**
 * FICHA DO ARQUIVO
 * O QUE É: gatilho externo e confiável pros workflows do GitHub Actions. O
 *          agendador nativo do GitHub (`schedule` no .yml) está falhando
 *          repetidamente em disparar na hora certa (achado em 23/09/2026,
 *          documentado como limitação conhecida da plataforma). Cloudflare
 *          Cron Triggers são muito mais confiáveis; este worker só faz uma
 *          chamada POST pra API do GitHub (`workflow_dispatch`, que é
 *          entregue na hora, ao contrário do `schedule`) em cada horário
 *          oficial.
 * RODA: pelos Cron Triggers configurados em wrangler.toml (UTC = BRT + 3).
 * LÊ: nada além do relógio do Cloudflare.
 * ESCREVE: dispara (via API do GitHub) os workflows ceven-cron-whatsapp.yml,
 *          ceven-cron-marca-propria.yml e ceven-cron-datalake.yml no
 *          repositório vitoriobergamobrazil/cevenonline.
 * DEPENDE DE: secret GITHUB_TOKEN (PAT com escopo "workflow"), configurado via
 *          `wrangler secret put GITHUB_TOKEN` dentro de worker-cron/.
 * ATENÇÃO: este worker ANTES continha um sistema completo e paralelo de envio
 *          de WhatsApp (v3.0), que ficou rodando sozinho por semanas sem
 *          ninguém saber, mandando pra número errado. Foi desativado e
 *          totalmente substituído por este gatilho simples em 23/09/2026.
 *          NÃO reintroduzir lógica de envio de mensagem aqui — o envio real
 *          mora só em pipeline/ceven_unified_engine.js, chamado pelo
 *          workflow do GitHub.
 */

import { vigiarDisparos } from './vigia.js';
const REPO = 'vitoriotriunfante/cevenonline';
const REF = 'main';

const FERIADOS_NACIONAIS = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01',
  '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21', '2027-05-01',
  '2027-05-27', '2027-09-07', '2027-10-12', '2027-11-02', '2027-11-15', '2027-11-20', '2027-12-25'
]);
const dataHojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// Mapa oficial de gatilhos cron (UTC) -> { workflow, inputs }
// Executado com precisão no Cloudflare Pago (Maestro Único)
const GATILHOS = {
  '0 6 * * *':     { workflow: 'ceven-cron-datalake.yml',      inputs: {} },                                   // 03:00 BRT — Atualiza TUDO no Drive (zero msg, todo dia)
  '0 7 * * *':     { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '04:00', destino: 'dry_run' } },// 04:00 BRT — Aquecimento matinal (zero msg, todo dia — pode haver faturamento em fim de semana, objetivo é aquecer dado, não disparar)
  '45 10 * * 2-6': { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '07:45', destino: 'vitorio' } }, // 07:45 BRT — Abertura oficial (WhatsApp)
  '0 13 * * 2-6':  { workflow: 'ceven-cron-marca-propria.yml', inputs: { destino: 'vitorio' } },                                   // 10:00 BRT — Marcas próprias (WhatsApp)
  '30 14 * * 2-6': { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '11:30', destino: 'vitorio' } }, // 11:30 BRT — Gestão de campo (WhatsApp)
  '30 17 * * 2-6': { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '14:30', destino: 'vitorio' } }, // 14:30 BRT — Parcial da tarde (WhatsApp)
  '0 20 * * 2-6':  { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '17:00', destino: 'vitorio' } }, // 17:00 BRT — Reta final (WhatsApp)
  '30 21 * * 2-6': { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '18:30', destino: 'vitorio' } }  // 18:30 BRT — Fechamento oficial (WhatsApp)
};

// RELOGIOS DA TV (03/10/2026): antes, o agendador do GitHub chamava estas funcoes e perdia cerca de 2/3 das
// chamadas (95 de 288 por dia). Agora o Cloudflare chama direto, na hora certa. Cada item e uma chamada
// HTTP as funcoes do site; os passos de um mesmo gatilho rodam em sequencia.
// CEVEN DESLIGADO em 16/11/2026 por ordem do Vitorio ("pare imediatamente de buscar toda e qualquer informação no CEVEN... deixe apenas populando GEROT e Clube da Venda").
const CEVEN_DESLIGADO = true;

const BASE_TV = 'https://ceven-cftv-matrix.pages.dev';
const TAREFAS_TV = CEVEN_DESLIGADO ? {} : {
  '*/2 * * * *':     { passos: [{ rota: '/api/cron-varredura-central', ms: 170000 }, { rota: '/api/cron-piloto-pedidos', ms: 60000 }] },
  '4-59/5 * * * *':  { passos: [{ rota: '/api/cron-lances', ms: 280000 }] },
  '2-59/5 * * * *':  { passos: [{ rota: '/api/cron-mapa-executivo', ms: 60000 }] },
  '2-59/15 * * * *': { passos: [{ rota: '/api/cron-faturado-mes', ms: 60000 }] }
};

async function rodarTarefaTv(cron, tarefa, env) {
  for (const passo of tarefa.passos) {
    const inicio = Date.now();
    try {
      const headers = { 'User-Agent': 'ceven-cron-trigger' };
      if (passo.chaveEnv && env && env[passo.chaveEnv]) headers['x-chave'] = env[passo.chaveEnv];
      const r = await fetch(BASE_TV + passo.rota, { headers, signal: AbortSignal.timeout(passo.ms) });
      console.log(`[TV] cron "${cron}" ${passo.rota} status=${r.status} em ${Date.now() - inicio} ms`);
    } catch (e) {
      console.log(`[TV][ERRO] cron "${cron}" ${passo.rota}: ${e && e.message ? e.message : e}`);
    }
  }
}

async function dispararWorkflow(env, workflow, inputs) {
  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ceven-cron-trigger',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ref: REF, inputs })
  });
  return { status: res.status, ok: res.ok, body: res.status !== 204 ? await res.text() : '' };
}

export default {
  async scheduled(event, env, ctx) {
    if (event.cron === '2-59/15 * * * *') {
      const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const dia = agora.getDay(), h = agora.getHours(), mi = agora.getMinutes();
      // GEROT (21/11/2026, Vitorio: 'le ele de 20 em 20 minutos'): SONDA de 15 em 15 min, seg-sab 06h-21h45 BRT (gerot-horario.yml, ~1 min, so le
      // 'Ultima atualizacao'). Mudou desde a ultima coleta -> a propria sonda dispara gerot-coleta.yml. Medido 17-21/11: o GEROT atualiza nas horas PARES (~hh:33).
      if (dia >= 1 && dia <= 6 && h >= 6 && h <= 21) {
        try { const r = await dispararWorkflow(env, 'gerot-horario.yml', {}); console.log(`[GEROT] sonda status=${r.status} ${r.body}`); } catch (e) { console.log('[GEROT][ERRO] ' + (e && e.message ? e.message : e)); }
      }
      // reserva: coleta fixa 07h17 e 21h17 mesmo se a sonda falhar (comeco do dia e ultima carga para a madrugada)
      if (dia >= 1 && dia <= 6 && [7, 21].includes(h) && mi >= 15 && mi < 30) {
        try { const r = await dispararWorkflow(env, 'gerot-coleta.yml', {}); console.log(`[GEROT] gerot-coleta.yml status=${r.status} ${r.body}`); } catch (e) { console.log('[GEROT][ERRO] ' + (e && e.message ? e.message : e)); }
      }
      // AUDITORIA DO JOTA (21/11/2026, plano bloco B): o schedule do GitHub atrasava 7 h (06h30 rodava 13h54). 06h32 e 13h02 BRT, seg-sab.
      if (dia >= 1 && dia <= 6 && ((h === 6 && mi >= 30 && mi < 45) || (h === 13 && mi < 15))) {
        try { const r = await dispararWorkflow(env, 'jota-auditoria.yml', {}); console.log(`[AUDITORIA] jota-auditoria.yml status=${r.status} ${r.body}`); } catch (e) { console.log('[AUDITORIA][ERRO] ' + (e && e.message ? e.message : e)); }
      }
      // CLUBE DA VENDA (16/11/2026): disparado pelo worker-cron a cada 30 min (:02 e :32, seg-sab 07h-20h45 BRT) para nao depender do schedule do GitHub.
      if (dia >= 1 && dia <= 6 && h >= 7 && h <= 20 && (mi < 15 || (mi >= 30 && mi < 45))) {
        try { const r = await dispararWorkflow(env, 'clube-coletor.yml', {}); console.log(`[CLUBE] clube-coletor.yml status=${r.status} ${r.body}`); } catch (e) { console.log('[CLUBE][ERRO] ' + (e && e.message ? e.message : e)); }
      }
      const dataSp = dataHojeSP();
      // LIGA (21/11/2026): a classificacao parou em 16/11 (o disparo estava no ramo do CEVEN desligado). Recalculada de 30 em 30 min, seg-sab 07h-20h45 BRT,
      // a partir dos lances do Clube + GEROT (brasileirao-dataset.yml le /api/brasileirao-lances; nao precisa do CEVEN)
      if (dia >= 1 && dia <= 6 && h >= 7 && h <= 20 && ((mi >= 15 && mi < 30) || mi >= 45)) {
        try { const r = await dispararWorkflow(env, 'brasileirao-dataset.yml', {}); console.log(`[LIGA] brasileirao-dataset.yml status=${r.status} ${r.body}`); } catch (e) { console.log('[LIGA][ERRO] ' + (e && e.message ? e.message : e)); }
      }
      // FECHAMENTO DA LIGA (22/11/2026, auditoria: 17, 18 e 19/11 nunca fecharam — o fechamento era chamado pelo cron-lances, desligado em 16/11).
      //   22h17 BRT seg-sex, depois da coleta das 21h17 (que grava os lances do dia). Idempotente; fecha tambem dia util anterior ainda aberto.
      if (dia >= 1 && dia <= 5 && h === 22 && mi >= 15 && mi < 30) {
        // semana invicta (tambem era chamada pelo cron-lances desligado): idempotente; so grava quando o ultimo dia util da semana ja passou das 19h
        await rodarTarefaTv(event.cron, { passos: [{ rota: '/api/cron-fechamento-dia', ms: 280000 }, { rota: '/api/cron-semana-invicta', ms: 280000 }] }, env);
      }
      // CEVEN DO ADMIN (22/11/2026, Vitorio: 'RETs, compromissos e tags... tem que vir do admin'): compromisso/RET a cada 15 min e TAGs 2x/dia (a funcao decide). Seg-sab 06h-20h.
      if (dia >= 1 && dia <= 6 && h >= 6 && h <= 20 && env.MONITORIA_CRON_KEY) {
        await rodarTarefaTv(event.cron, { passos: [{ rota: '/api/cron-ceven-admin', ms: 280000, chaveEnv: 'MONITORIA_CRON_KEY' }] }, env);
      }
      // MONITOR.IA PILOTO (21/11/2026): seg-sex 09h-20h BRT, UMA filial por chamada (65 supervisores numa chamada estourava a CPU, erro 1102).
      // O site decide a janela pela hora local da filial e se ENVIA (liberacao propria monitoria_liberada_ate) ou so GRAVA (sombra).
      if (dia >= 1 && dia <= 5 && !FERIADOS_NACIONAIS.has(dataSp) && h >= 9 && h <= 20 && env.MONITORIA_CRON_KEY) {
        for (const f of ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ']) {
          await rodarTarefaTv(event.cron, { passos: [{ rota: '/api/monitoria-piloto?filial=' + f, ms: 60000, chaveEnv: 'MONITORIA_CRON_KEY' }] }, env);
        }
      }
      if (dia >= 1 && dia <= 5 && !FERIADOS_NACIONAIS.has(dataSp) && h === 19 && mi >= 15 && mi < 30 && env.MONITORIA_CRON_KEY) {
        await rodarTarefaTv(event.cron, { passos: [{ rota: '/api/cron-aprendizado', ms: 120000, chaveEnv: 'MONITORIA_CRON_KEY' }] }, env);
      }
      return;
    }
    if (CEVEN_DESLIGADO) {
      console.log(`[CEVEN_DESLIGADO] Cron "${event.cron}" ignorado.`);
      return;
    }
    const tarefaTv = TAREFAS_TV[event.cron];
    if (tarefaTv) {
      // VIGIA dos disparos de WhatsApp (05/10/2026): a cada 2 min confere se o disparo oficial do horario comecou; se nao, refaz 1 vez (ver vigia.js)
      if (event.cron === '*/2 * * * *') {
        try { for (const l of await vigiarDisparos(env)) console.log('[VIGIA] ' + l); } catch (e) { console.log('[VIGIA][ERRO] ' + (e && e.message ? e.message : e)); }
      }
      // LIGA AO VIVO (13/10/2026): o gatilho proprio "8-59/15 10-23 * * 2-6" foi publicado mas o Cloudflare nunca o disparou (15:33 a 19:05 sem nenhuma rodada).
      // Agora vai pendurado no relogio de 15 em 15 min que ja funciona: segunda a sexta, 07h a 20h45 BRT -> brasileirao-dataset.yml (nao manda mensagem).
      if (event.cron === '2-59/15 * * * *') {
        const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const dia = agora.getDay(), h = agora.getHours();
        if (dia >= 1 && dia <= 5 && h >= 7 && h <= 20) {
          try { const r = await dispararWorkflow(env, 'brasileirao-dataset.yml', {}); console.log(`[LIGA] brasileirao-dataset.yml status=${r.status} ${r.body}`); } catch (e) { console.log('[LIGA][ERRO] ' + (e && e.message ? e.message : e)); }
        }
        // GEROT e PROSPECTS (09/11/2026): o `schedule` do GitHub nao disparou nenhuma vez; vao no mesmo relogio de 15 min (:02 :17 :32 :47).
        // GEROT depois de cada janela: 09h17 11h17 13h17 15h17 17h17 19h17, segunda a sabado. Prospects: 09h32 12h32 15h32, todo dia. Nenhum manda mensagem.
        const mi = agora.getMinutes();
        if (dia >= 1 && dia <= 6 && [7, 9, 11, 13, 15, 17, 19, 21].includes(h) && mi >= 15 && mi < 30) {   // 12/11/2026 (Vitorio: 'GEROT tem que popular de 2 em 2 horas'): +07h17 (o schedule do GitHub nunca disparou a das 07h15) e +21h17 (ultima carga do dia para o batimento da madrugada)
          try { const r = await dispararWorkflow(env, 'gerot-coleta.yml', {}); console.log(`[GEROT] gerot-coleta.yml status=${r.status} ${r.body}`); } catch (e) { console.log('[GEROT][ERRO] ' + (e && e.message ? e.message : e)); }
        }
        if ([9, 12, 15].includes(h) && mi >= 30 && mi < 45) {
          try { const r = await dispararWorkflow(env, 'prospects-coleta.yml', {}); console.log(`[PROSPECTS] prospects-coleta.yml status=${r.status} ${r.body}`); } catch (e) { console.log('[PROSPECTS][ERRO] ' + (e && e.message ? e.message : e)); }
        }
        // MONITOR.IA (Analista Comercial): varredura continua a cada 15 min, SEGUNDA A SEXTA 07:30-18:30 BRT, excluindo feriados nacionais.
        // Respeita regra.modo no D1 e regras anti-spam (R.enviarTexto + max 4/dia + sem repetir assinatura).
        const dataSp = dataHojeSP();
        const emExpediente = dia >= 1 && dia <= 5 && !FERIADOS_NACIONAIS.has(dataSp) && ((h === 7 && mi >= 30) || (h >= 8 && h <= 17) || (h === 18 && mi <= 30));
        if (emExpediente && env.MONITORIA_CRON_KEY) {
          await rodarTarefaTv(event.cron, { passos: [{ rota: '/api/cron-monitoria?regra=ANALISTA', ms: 120000, chaveEnv: 'MONITORIA_CRON_KEY' }] }, env);
        }
        // CURADOR JOTA (Aprendizado Contínuo): roda 19h15 BRT (seg-sex, sem feriados), analisa interações/sugestões/👎 e envia resumo ao Vitório.
        if (dia >= 1 && dia <= 5 && !FERIADOS_NACIONAIS.has(dataSp) && h === 19 && mi >= 15 && mi < 30 && env.MONITORIA_CRON_KEY) {
          await rodarTarefaTv(event.cron, { passos: [{ rota: '/api/cron-aprendizado', ms: 120000, chaveEnv: 'MONITORIA_CRON_KEY' }] }, env);
        }
      }
      await rodarTarefaTv(event.cron, tarefaTv, env);
      return;
    }
    const gatilho = GATILHOS[event.cron];
    if (!gatilho) {
      console.log(`[IGNORADO] Cron "${event.cron}" não está no mapa de gatilhos.`);
      return;
    }

    // TRAVA DE SEGURANÇA: NUNCA disparar mensagens aos sábados, domingos ou feriados
    const dtBrt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const diaSemana = dtBrt.getDay(); // 0 = Domingo, 6 = Sábado
    const dataIso = dtBrt.toISOString().split('T')[0];
    const feriados = [
      '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21',
      '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02',
      '2026-11-15', '2026-11-20', '2026-12-25'
    ];
    // dry_run nunca manda mensagem real — não conta como "comercial" pra trava de calendário
    // (permite o aquecimento de 04:00 rodar todo dia, inclusive fim de semana/feriado).
    const isDryRun = gatilho.inputs && gatilho.inputs.destino === 'dry_run';
    const isMensagemComercial = !isDryRun && (gatilho.workflow.includes('whatsapp') || gatilho.workflow.includes('marca-propria'));

    if (isMensagemComercial) {
      if (diaSemana === 0 || diaSemana === 6) {
        console.log(`[BLOQUEADO FIM DE SEMANA] Hoje é ${diaSemana === 0 ? 'DOMINGO' : 'SÁBADO'} (${dataIso}) em Brasília. Disparo abortado.`);
        return;
      }
      if (feriados.includes(dataIso)) {
        console.log(`[BLOQUEADO FERIADO] Hoje é FERIADO NACIONAL (${dataIso}) em Brasília. Disparo abortado.`);
        return;
      }
    }

    console.log(`[DISPARANDO] ${gatilho.workflow} (cron "${event.cron}", inputs=${JSON.stringify(gatilho.inputs)})`);
    const r = await dispararWorkflow(env, gatilho.workflow, gatilho.inputs);
    console.log(`[RESULTADO] status=${r.status} ok=${r.ok} ${r.body}`);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const workflow = url.searchParams.get('workflow');
    if (workflow && GATILHOS[Object.keys(GATILHOS).find(c => GATILHOS[c].workflow === workflow)]) {
      // permite teste manual: /?workflow=ceven-cron-whatsapp.yml&ciclo=11:30
      const ciclo = url.searchParams.get('ciclo');
      const inputs = ciclo ? { ciclo } : {};
      const r = await dispararWorkflow(env, workflow, inputs);
      return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      status: 'CEVEN Cron Trigger (gatilho externo pro GitHub Actions) — Ativo',
      gatilhos: GATILHOS,
      relogios_tv: TAREFAS_TV
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }
};
