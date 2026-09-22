/**
 * Amostra o endpoint real /api/ceven/prospeccao-roteiro em todos os vendedores de Varejo
 * válidos das 11 filiais e agrega o perfil_cnae (carteira real) pra descobrir quais CNAEs
 * mais aparecem entre nossos clientes atuais, nacionalmente e por filial.
 *
 * Estratégia (o endpoint dispara um job assíncrono no CEVEN na primeira batida, que leva
 * um tempo pra popular o mapa antes de responder "pronto"):
 *   1. Dispara TODAS as chamadas em massa (fire-and-forget, sem esperar resposta pronta)
 *   2. Espera 2 minutos pro CEVEN processar tudo em paralelo do lado dele
 *   3. Coleta os resultados em lotes, com poucas tentativas por item (já deve estar pronto)
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const engine = require('../pipeline/ceven_unified_engine');

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';

async function dispararTrigger(codRca) {
  try {
    await axios.get(`${CEVEN_BASE}/api/ceven/prospeccao-roteiro`, {
      params: { cod_rca: codRca, hoje: 1, max: 120 },
      timeout: 8000
    });
  } catch (e) {}
}

async function coletarResultado(codRca, maxTentativas = 5) {
  for (let i = 0; i < maxTentativas; i++) {
    try {
      const res = await axios.get(`${CEVEN_BASE}/api/ceven/prospeccao-roteiro`, {
        params: { cod_rca: codRca, hoje: 1, max: 120 },
        timeout: 10000
      });
      if (res.data?.status === 'pronto') return res.data;
      if (res.data?.status === 'processando') {
        await new Promise(r => setTimeout(r, 4000));
        continue;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const reps = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/reps_data.json'), 'utf8'));

  console.log('Carregando hierarquia e canal real...');
  const repsMap = engine.carregarValidacaoVendedores();
  await engine.enriquecerCanalReal(repsMap);

  const vjsValidos = reps.filter(r => {
    const fSigla = (r.filial || '').toUpperCase();
    const val = repsMap[fSigla + '_' + r.codigo];
    return val && engine.isCanalVarejo(val.canal) && val.metaFat > 0 && val.metaPos > 0;
  });

  console.log(`${vjsValidos.length} vendedores válidos. Disparando gatilho em massa (fire-and-forget)...`);

  // Fase 1: dispara todos em massa, concorrência alta, sem esperar resposta pronta
  const DISPARO_BATCH = 40;
  for (let i = 0; i < vjsValidos.length; i += DISPARO_BATCH) {
    const lote = vjsValidos.slice(i, i + DISPARO_BATCH);
    await Promise.all(lote.map(r => dispararTrigger(r.codigo)));
    console.log(`  Disparados ${Math.min(i + DISPARO_BATCH, vjsValidos.length)}/${vjsValidos.length}...`);
  }

  console.log('Todos disparados. Aguardando 2 minutos o CEVEN processar o mapa...');
  await sleep(120000);

  console.log('Coletando resultados...');
  const agregadoNacional = {};
  const agregadoPorFilial = {};
  const outPath = path.join(__dirname, '..', 'auditoria_mensagens', new Date().toISOString().split('T')[0], 'RANKING_CNAE_NACIONAL.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  function salvar(processados, total, comSucesso, completo) {
    const rankingNacional = Object.entries(agregadoNacional)
      .map(([familia, v]) => ({ familia, clientes: v.clientes, exemplo: v.exemplo }))
      .sort((a, b) => b.clientes - a.clientes);
    fs.writeFileSync(outPath, JSON.stringify({
      geradoEm: new Date().toISOString(),
      progresso: `${processados}/${total} (${comSucesso} com dado real)`,
      completo,
      rankingNacional,
      porFilial: agregadoPorFilial
    }, null, 2), 'utf8');
  }

  const COLETA_BATCH = 20;
  let processados = 0;
  let comSucesso = 0;
  for (let i = 0; i < vjsValidos.length; i += COLETA_BATCH) {
    const lote = vjsValidos.slice(i, i + COLETA_BATCH);
    await Promise.all(lote.map(async rca => {
      const data = await coletarResultado(rca.codigo);
      processados++;
      if (data && data.perfil_cnae) {
        comSucesso++;
        const fSigla = (rca.filial || '').toUpperCase();
        if (!agregadoPorFilial[fSigla]) agregadoPorFilial[fSigla] = {};
        data.perfil_cnae.forEach(p => {
          const fam = p.familia;
          const qtd = p.clientes_no_roteiro || 0;
          if (!agregadoNacional[fam]) agregadoNacional[fam] = { clientes: 0, exemplo: p.exemplo };
          agregadoNacional[fam].clientes += qtd;
          agregadoPorFilial[fSigla][fam] = (agregadoPorFilial[fSigla][fam] || 0) + qtd;
        });
      }
    }));
    console.log(`  Coletados ${processados}/${vjsValidos.length} (${comSucesso} com dado real)...`);
    salvar(processados, vjsValidos.length, comSucesso, processados === vjsValidos.length);
  }

  const rankingFinal = Object.entries(agregadoNacional)
    .map(([familia, v]) => ({ familia, clientes: v.clientes, exemplo: v.exemplo }))
    .sort((a, b) => b.clientes - a.clientes);

  console.log('\n=== RANKING NACIONAL DE CNAEs (completo) ===');
  rankingFinal.forEach((r, i) => console.log(`${i + 1}. CNAE ${r.familia} — ${r.clientes} clientes — ${r.exemplo}`));
  console.log(`\nSalvo em: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
