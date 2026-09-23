/**
 * Amostra o endpoint /api/ceven/prospeccao-roteiro em lotes de 10 vendedores:
 * 1. Dispara os 10 (fire-and-forget, ativa o processamento no CEVEN)
 * 2. Espera 3 minutos fixos (tempo de "cruzar com a base da Receita")
 * 3. Busca o resultado dos 10 (já deve estar pronto)
 * 4. Próximo lote de 10
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const engine = require('../pipeline/ceven_unified_engine');

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
const TAMANHO_LOTE = 10;
const ESPERA_MS = 3 * 60 * 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function disparar(codRca) {
  try {
    await axios.get(`${CEVEN_BASE}/api/ceven/prospeccao-roteiro`, {
      params: { cod_rca: codRca, hoje: 1, max: 120 },
      timeout: 10000
    });
  } catch (e) {}
}

async function buscar(codRca, tentativas = 5) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await axios.get(`${CEVEN_BASE}/api/ceven/prospeccao-roteiro`, {
        params: { cod_rca: codRca, hoje: 1, max: 120 },
        timeout: 15000
      });
      if (res.data?.status === 'pronto') return res.data;
      if (res.data?.status === 'processando') { await sleep(15000); continue; }
      return null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

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

  console.log(`${vjsValidos.length} vendedores válidos. Processando em lotes de ${TAMANHO_LOTE} (dispara -> espera 3min -> busca)...`);

  const agregadoNacional = {};
  const agregadoPorFilial = {};
  const outPath = path.join(__dirname, '..', 'auditoria_mensagens', new Date().toISOString().split('T')[0], 'RANKING_CNAE_NACIONAL.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  function salvar(processados, total, comSucesso) {
    const rankingNacional = Object.entries(agregadoNacional)
      .map(([familia, v]) => ({ familia, clientes: v.clientes, exemplo: v.exemplo }))
      .sort((a, b) => b.clientes - a.clientes);
    fs.writeFileSync(outPath, JSON.stringify({
      geradoEm: new Date().toISOString(),
      progresso: `${processados}/${total} (${comSucesso} com dado real)`,
      completo: processados === total,
      rankingNacional,
      porFilial: agregadoPorFilial
    }, null, 2), 'utf8');
  }

  let processados = 0;
  let comSucesso = 0;
  const inicio = Date.now();

  for (let i = 0; i < vjsValidos.length; i += TAMANHO_LOTE) {
    const lote = vjsValidos.slice(i, i + TAMANHO_LOTE);
    const numLote = Math.floor(i / TAMANHO_LOTE) + 1;
    const totalLotes = Math.ceil(vjsValidos.length / TAMANHO_LOTE);

    console.log(`\n[Lote ${numLote}/${totalLotes}] Disparando ${lote.length} vendedores...`);
    await Promise.all(lote.map(r => disparar(r.codigo)));

    console.log(`[Lote ${numLote}/${totalLotes}] Aguardando 3 minutos...`);
    await sleep(ESPERA_MS);

    console.log(`[Lote ${numLote}/${totalLotes}] Buscando resultados...`);
    await Promise.all(lote.map(async rca => {
      const data = await buscar(rca.codigo);
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

    const decorridoMin = ((Date.now() - inicio) / 60000).toFixed(1);
    console.log(`[Lote ${numLote}/${totalLotes}] OK. Total: ${processados}/${vjsValidos.length} (${comSucesso} com dado real) | ${decorridoMin}min decorridos`);
    salvar(processados, vjsValidos.length, comSucesso);
  }

  console.log('\n=== RANKING NACIONAL DE CNAEs (completo) ===');
  Object.entries(agregadoNacional).sort((a, b) => b[1].clientes - a[1].clientes)
    .forEach(([fam, v], i) => console.log(`${i + 1}. CNAE ${fam} — ${v.clientes} clientes — ${v.exemplo}`));
  console.log(`\nSalvo em: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
