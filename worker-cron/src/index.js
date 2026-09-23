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

const REPO = 'vitoriobergamobrazil/cevenonline';
const REF = 'clean-v3';

// mapa cron (UTC) -> { workflow, inputs }
const GATILHOS = {
  '0 6 * * 1-5':   { workflow: 'ceven-cron-datalake.yml', inputs: {} },          // 03:00 BRT
  '0 7 * * 1-5':   { workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '04:00' } }, // 04:00 BRT
  '45 10 * * 1-5': { workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '07:45' } }, // 07:45 BRT
  '0 13 * * 1-5':  { workflow: 'ceven-cron-marca-propria.yml', inputs: {} },     // 10:00 BRT
  '30 14 * * 1-5': { workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '11:30' } }, // 11:30 BRT
  '30 17 * * 1-5': { workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '14:30' } }, // 14:30 BRT
  '0 20 * * 1-5':  { workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '17:00' } }, // 17:00 BRT
  '30 21 * * 1-5': { workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '18:30' } }  // 18:30 BRT
};

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
    const gatilho = GATILHOS[event.cron];
    if (!gatilho) {
      console.log(`[IGNORADO] Cron "${event.cron}" não está no mapa de gatilhos.`);
      return;
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
      gatilhos: GATILHOS
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }
};
