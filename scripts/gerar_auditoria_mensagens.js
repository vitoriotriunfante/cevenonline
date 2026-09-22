/**
 * Gera, para um ou mais ciclos do dia, TODAS as mensagens (consolidado da
 * Diretoria + uma por gerente) em arquivos .txt individuais, SEM enviar nada
 * ao WhatsApp. Usa dados reais do CEVEN (mesmas funções do motor oficial).
 *
 * Uso:
 *   node scripts/gerar_auditoria_mensagens.js --hora=11:00
 *   node scripts/gerar_auditoria_mensagens.js --todos
 *
 * Saída: auditoria_mensagens/<data>/<hora>__<destinatario>.txt
 */
const fs = require('fs');
const path = require('path');
const engine = require('../pipeline/ceven_unified_engine');

const CICLOS = {
  '07:45': 'abertura',
  '11:30': 'gestao_campo',
  '11:00': 'vendas_zerados',
  '14:30': 'vendas_zerados',
  '17:00': 'vendas_zerados',
  '18:30': 'vendas_zerados'
};

function parseArgs() {
  const args = {};
  process.argv.forEach((val) => {
    if (val.startsWith('--')) {
      const [k, v] = val.slice(2).split('=');
      args[k] = v === undefined ? true : v;
    }
  });
  return args;
}

function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
}

async function gerarCiclo(hora, dataHoje, outDir, repsMap) {
  const acao = CICLOS[hora];
  console.log(`\n=== Gerando ciclo ${hora} (${acao}) ===`);

  const diretrizes = engine.carregarDiretrizesOperacionais({});

  if (acao === 'abertura') {
    const abertura = await engine.coletarAberturaVarejo(repsMap, diretrizes);
    fs.writeFileSync(path.join(outDir, `${slug(hora)}__CONSOLIDADO_ABERTURA.txt`), abertura.textoAbertura, 'utf8');
    console.log(`  -> 1 arquivo (mensagem única, sem quebra por gerente)`);
    return;
  }

  if (acao === 'gestao_campo') {
    const token = await engine.getAdminToken();
    const auditoria = await engine.coletarAuditoriaCampo(token, dataHoje);
    let n = 0;
    for (const [sigla, rel] of Object.entries(auditoria)) {
      fs.writeFileSync(path.join(outDir, `${slug(hora)}__${sigla}.txt`), rel.texto, 'utf8');
      n++;
    }
    console.log(`  -> ${n} arquivos (um por filial)`);
    return;
  }

  if (acao === 'vendas_zerados') {
    const filialVendas = await engine.coletarVendasEZerados(repsMap, dataHoje);
    const rel = engine.formatarRelatoriosVendas(filialVendas, hora);
    fs.writeFileSync(path.join(outDir, `${slug(hora)}__CONSOLIDADO_DIRETORIA.txt`), rel.msgConsolidado, 'utf8');
    let n = 1;
    for (const [sigla, texto] of Object.entries(rel.mensagensGerentes)) {
      fs.writeFileSync(path.join(outDir, `${slug(hora)}__${sigla}.txt`), texto, 'utf8');
      n++;
    }
    console.log(`  -> ${n} arquivos (1 consolidado + ${n - 1} por filial/gerente)`);
    return;
  }
}

async function main() {
  const args = parseArgs();
  const dataHoje = args.data || new Date().toISOString().split('T')[0];
  const horas = args.todos ? Object.keys(CICLOS) : [args.hora || '11:30'];

  const outDir = path.join(__dirname, '..', 'auditoria_mensagens', dataHoje);
  fs.mkdirSync(outDir, { recursive: true });

  const repsMap = engine.carregarValidacaoVendedores();
  console.log(`Enriquecendo canal real (area_atuacao) de ${Object.keys(repsMap).length} contas...`);
  await engine.enriquecerCanalReal(repsMap);

  for (const hora of horas) {
    if (!CICLOS[hora]) {
      console.error(`Ciclo desconhecido: ${hora}. Válidos: ${Object.keys(CICLOS).join(', ')}`);
      continue;
    }
    try {
      await gerarCiclo(hora, dataHoje, outDir, repsMap);
    } catch (e) {
      console.error(`  ERRO no ciclo ${hora}:`, e.message);
    }
  }

  console.log(`\nTodos os arquivos salvos em: ${outDir}`);
}

main();
