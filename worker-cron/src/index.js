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

const REPO = 'vitoriotriunfante/cevenonline';
const REF = 'main';

// Mapa oficial de gatilhos cron (UTC) -> { workflow, inputs }
// Executado com precisão no Cloudflare Pago (Maestro Único)
const GATILHOS = {
  '0 6 * * *':     { workflow: 'ceven-cron-datalake.yml',      inputs: {} },                                   // 03:00 BRT — Atualiza TUDO no Drive (zero msg, todo dia)
  '0 7 * * *':     { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '04:00', destino: 'dry_run' } },// 04:00 BRT — Aquecimento matinal (zero msg, todo dia — pode haver faturamento em fim de semana, objetivo é aquecer dado, não disparar)
  '45 10 * * 2-6': { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '07:45', destino: 'todos' } }, // 07:45 BRT — Abertura oficial (WhatsApp)
  '0 13 * * 2-6':  { workflow: 'ceven-cron-marca-propria.yml', inputs: {} },                                   // 10:00 BRT — Marcas próprias (WhatsApp)
  '30 14 * * 2-6': { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '11:30', destino: 'todos' } }, // 11:30 BRT — Gestão de campo (WhatsApp)
  '30 17 * * 2-6': { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '14:30', destino: 'todos' } }, // 14:30 BRT — Parcial da tarde (WhatsApp)
  '0 20 * * 2-6':  { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '17:00', destino: 'todos' } }, // 17:00 BRT — Reta final (WhatsApp)
  '30 21 * * 2-6': { workflow: 'ceven-cron-whatsapp.yml',      inputs: { ciclo: '18:30', destino: 'todos' } }  // 18:30 BRT — Fechamento oficial (WhatsApp)
};

// RELOGIOS DA TV (03/10/2026): antes, o agendador do GitHub chamava estas funcoes e perdia cerca de 2/3 das
// chamadas (95 de 288 por dia). Agora o Cloudflare chama direto, na hora certa. Cada item e uma chamada
// HTTP as funcoes do site; os passos de um mesmo gatilho rodam em sequencia.
const BASE_TV = 'https://ceven-cftv-matrix.pages.dev';
const TAREFAS_TV = {
  '*/2 * * * *':     { passos: [{ rota: '/api/cron-varredura-central', ms: 170000 }, { rota: '/api/cron-piloto-pedidos', ms: 60000 }] },
  '4-59/5 * * * *':  { passos: [{ rota: '/api/cron-lances', ms: 280000 }] },
  '2-59/5 * * * *':  { passos: [{ rota: '/api/cron-mapa-executivo', ms: 60000 }] },
  '2-59/15 * * * *': { passos: [{ rota: '/api/cron-faturado-mes', ms: 60000 }] }
};

async function rodarTarefaTv(cron, tarefa) {
  for (const passo of tarefa.passos) {
    const inicio = Date.now();
    try {
      const r = await fetch(BASE_TV + passo.rota, { headers: { 'User-Agent': 'ceven-cron-trigger' }, signal: AbortSignal.timeout(passo.ms) });
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
    const tarefaTv = TAREFAS_TV[event.cron];
    if (tarefaTv) {
      await rodarTarefaTv(event.cron, tarefaTv);
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
