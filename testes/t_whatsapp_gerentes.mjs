// Teste do WhatsApp: TPH e MCD (filiais com 2 gerentes) saem DIVIDIDOS em todos os ciclos (11:30, 14:30, 17:00, 18:30), cada gerente so com a hierarquia dele.
// Regra do Vitorio (05/10/2026): "precisa respeitar as hierarquias em todos". Usa o motor de verdade com um CEVEN falso (axios.get trocado); nada vai ao WhatsApp.
import { createRequire } from 'node:module';
import { join } from 'node:path';
const require = createRequire(import.meta.url);

export default async function (ok, RAIZ) {
  const axios = require('axios');
  const engine = require(join(RAIZ, 'pipeline', 'ceven_unified_engine.js'));

  // ---- CEVEN falso ----
  const PROD = {
    '1001': { prog: 20, vis: 10, dig: 1000, ped: 3 },   // TPH, Vagner
    '1002': { prog: 30, vis: 12, dig: 2500, ped: 5 },   // TPH, Fabio
    '2001': { prog: 25, vis: 9, dig: 700, ped: 2 },     // MCD, Cleverson
    '2002': { prog: 15, vis: 6, dig: 0, ped: 0 },       // MCD, Adriano (zerado)
    '3001': { prog: 18, vis: 8, dig: 400, ped: 1 },     // TCA
    '2003': { prog: 10, vis: 4, dig: 0, ped: 0 },       // MCD, ligado direto ao gerente (zerado)
    '1003': { prog: 10, vis: 5, dig: 500, ped: 2 },     // TPH, Vagner, OCULTO na planilha (so entra no total)
    '3002': { prog: 0, vis: 0, dig: 300, ped: 1 }       // TCA, so na planilha (so entra no total)
  };
  const original = axios.get;
  axios.get = async (url) => {
    const u = new URL(url);
    const id = u.searchParams.get('id');
    const caminho = u.pathname;
    if (caminho.endsWith('/api/rca/produtividade')) { const p = PROD[id]; return { data: { dia: { total_programado: p.prog, visitas_na_rota: p.vis, visitas_com_venda: p.ped, positivacao: p.ped, dig_pedido: p.dig } } }; }
    if (caminho.endsWith('/api/rca/dashboard')) return { data: { financeiro: { meta: 1000 }, positivacao: { meta: 10 } } };
    if (caminho.endsWith('/api/rca/devolucoes') || caminho.endsWith('/api/rca/roteiro-hoje')) return { data: [] };
    if (caminho.includes('/api/admin/supervisores/matriz-compromissos')) {
      return { data: { supervisores: [
        { filial: 'tph1', id: 1, nome: 'LUCAS RAMOS MONTAGNHANI', porDia: [true] },
        { filial: 'tph1', id: 2, nome: 'AILTON LUIZ ARENDT JUNIOR', porDia: [false] },
        { filial: 'mcd1', id: 3, nome: 'THIAGO TESTE', porDia: [true] },
        { filial: 'mcd1', id: 4, nome: 'CLEOMAR DINIZ BARBOSA', porDia: [true] },
        { filial: 'tca1', id: 5, nome: 'SUPERVISOR TCA', porDia: [true] },
        { filial: 'mcd1', id: 6, nome: 'GERENTE MCD', porDia: [false] }
      ] } };
    }
    if (caminho.includes('/api/admin/supervisores/matriz-ret')) return { data: { supervisores: [{ id: 1, porDia: [true] }, { id: 3, porDia: [true] }] } };
    if (caminho.includes('/api/admin/ret/periodo')) return { data: { dias: [] } };
    return { data: null };
  };

  try {
    const mk = (filial, rca, gerente, supNome) => ({ filial, rca, nome: 'VEND ' + rca, canal: 'VJ', gerente, supNome, metaFat: 0, metaPos: 0 });
    const repsMap = {
      TPH_1001: mk('TPH', '1001', 'Vagner', 'LUCAS RAMOS MONTAGNHANI'),
      TPH_1002: mk('TPH', '1002', 'Fábio', 'AILTON LUIZ ARENDT JUNIOR'),
      MCD_2001: mk('MCD', '2001', 'Cleverson', 'THIAGO TESTE'),
      MCD_2002: mk('MCD', '2002', 'Adriano', 'CLEOMAR DINIZ BARBOSA'),
      TCA_3001: mk('TCA', '3001', 'Becher', 'SUPERVISOR TCA'),
      MCD_2003: mk('MCD', '2003', 'Cleverson', 'GERENTE MCD')
    };
    // ocultos e so-da-planilha: somam nos TOTAIS (macro soma tudo), nunca nas listas de varejo
    Object.defineProperty(repsMap, '__extrasMacro', { value: [
      { filial: 'TPH', rca: '1003', nome: 'OCULTO TPH', gerente: 'Vagner' },
      { filial: 'TCA', rca: '3002', nome: 'SO PLANILHA', gerente: '' }
    ], enumerable: false });

    // ---- 1) quais filiais sao divididas ----
    const div = engine.gerentesPorFilialDividida(repsMap);
    ok(div.has('TPH') && div.has('MCD') && !div.has('TCA'), 'TPH e MCD sao filiais divididas; TCA (um gerente so) nao');

    // ---- 2) ciclos 14:30 / 17:00 / 18:30 (vendas e zerados) ----
    const fv = await engine.coletarVendasEZerados(repsMap, '2026-10-05');
    const chaves = Object.keys(fv).sort();
    ok(chaves.includes('TPH::VAGNER') && chaves.includes('TPH::FÁBIO') && chaves.includes('MCD::CLEVERSON') && chaves.includes('MCD::ADRIANO'), 'coleta de vendas: um resultado por gerente em TPH e MCD (' + chaves.filter(c => c.includes('::')).join(', ') + ')');
    ok(!chaves.includes('TPH') && !chaves.includes('MCD') && chaves.includes('TCA'), 'coleta de vendas: sem linha da filial inteira onde ha divisao; TCA continua inteira');
    ok(fv['TPH::VAGNER'].fatTotalDigitado === 1500 && fv['TPH::FÁBIO'].fatTotalDigitado === 2500, 'cada gerente soma os vendedores dele (Vagner 1000 + oculto 500 = 1500; Fabio 2500)');
    ok(fv['TPH::VAGNER'].vjTotal === 1 && fv['TPH::VAGNER'].pedidosTotal === 5, 'o OCULTO soma nos totais (pedidos 5) mas NAO entra na lista/contagem de varejo (1 vendedor)');
    ok(fv['TCA'].fatTotalDigitado === 700 && fv['TCA'].vjTotal === 1, 'vendedor so da planilha soma no total da filial (400 + 300) sem virar vendedor de varejo');
    ok(fv['MCD::ADRIANO'].vjSem === 1 && fv['MCD::CLEVERSON'].vjSem === 1, 'zerado aparece so no gerente dono do vendedor (Adriano 1; Cleverson 1 = o ligado direto ao gerente)');
    ok(engine.rotuloSupervisaoFalsa('GERENTE MCD') === 'Vendedores ligados direto ao gerente' && engine.rotuloSupervisaoFalsa('VENDA EMPRESA (INTERNO)') === 'Venda empresa (interno)' && engine.rotuloSupervisaoFalsa('LUCAS RAMOS') === null, 'rotulos de supervisao falsa (GERENTE X, VENDA EMPRESA) e supervisor de verdade');

    for (const hora of ['14:30', '17:00', '18:30']) {
      const rel = engine.formatarRelatoriosVendas(JSON.parse(JSON.stringify(fv)), hora);
      const m = rel.mensagensGerentes;
      ok(m['TPH::VAGNER'] && m['TPH::FÁBIO'] && m['MCD::CLEVERSON'] && m['MCD::ADRIANO'] && m['TCA'], `${hora}: um relatorio por gerente (TPH, MCD) e um por filial (demais)`);
      ok(/FILIAL TPH — VAGNER/.test(m['TPH::VAGNER']) && /FILIAL TPH — FÁBIO/.test(m['TPH::FÁBIO']), `${hora}: cada relatorio de TPH leva o nome do SEU gerente`);
      ok(/R\$ 1\.500,00/.test(m['TPH::VAGNER']) && !/R\$ 2\.500,00/.test(m['TPH::VAGNER']), `${hora}: relatorio do Vagner nao mistura o digitado do Fabio`);
      ok(rel.msgConsolidado.includes('5.400'), `${hora}: consolidado da diretoria soma tudo, ocultos incluidos (R$ 5.400)`);
      ok(!/Supervisor: GERENTE/.test(m['MCD::CLEVERSON']) && (hora === '18:30' || /Vendedores ligados direto ao gerente/.test(m['MCD::CLEVERSON'])), `${hora}: nao aparece "Supervisor: GERENTE MCD"; aparece "Vendedores ligados direto ao gerente"`);
    }
    const rel1430 = engine.formatarRelatoriosVendas(JSON.parse(JSON.stringify(fv)), '14:30');
    ok(/ADRIANO/.test(rel1430.mensagensGerentes['MCD::ADRIANO']) && /VEND 2002/.test(rel1430.mensagensGerentes['MCD::ADRIANO']) && !/VEND 2002/.test(rel1430.mensagensGerentes['MCD::CLEVERSON']), '14:30: o zerado do Adriano nao aparece na mensagem do Cleverson');

    // ---- 3) ciclo 11:30 (gestao de campo) ----
    const aud = await engine.coletarAuditoriaCampo('token-falso', '2026-10-05', repsMap);
    const pg = aud.__porGerente || {};
    ok(pg['TPH::VAGNER'] && pg['TPH::FÁBIO'] && pg['MCD::CLEVERSON'] && pg['MCD::ADRIANO'], '11:30: gestao de campo tambem sai por gerente em TPH e MCD');
    ok(/LUCAS RAMOS/.test(pg['TPH::VAGNER'].texto) && !/AILTON/.test(pg['TPH::VAGNER'].texto), '11:30: o Vagner ve so os supervisores dele (Lucas), sem o do Fabio (Ailton)');
    ok(/AILTON/.test(pg['TPH::FÁBIO'].texto) && !/LUCAS/.test(pg['TPH::FÁBIO'].texto), '11:30: o Fabio ve so o supervisor dele (Ailton)');
    ok(!/GERENTE MCD/.test(pg['MCD::CLEVERSON'].texto) && !/GERENTE MCD/.test(aud.MCD.texto) && aud.MCD.totalSups === 2, '11:30: "GERENTE MCD" nao conta nem aparece como supervisor (so os 2 supervisores de verdade)');
    ok(aud.TPH && /LUCAS/.test(aud.TPH.texto) && /AILTON/.test(aud.TPH.texto), '11:30: a visao da filial inteira (diretoria) continua com todos os supervisores');
    ok(!Object.keys(aud).includes('__porGerente') && Object.values(aud).length === 11, '11:30: consolidado continua com as 11 filiais (a divisao nao duplica a soma)');

    // ---- 4) o envio usa a chave do gerente (e a filial inteira so quando nao ha divisao) ----
    const fonte = (await import('node:fs')).readFileSync(join(RAIZ, 'pipeline', 'ceven_unified_engine.js'), 'utf8');
    ok(fonte.includes("relatorios.mensagensGerentes[g.filial + '::' + String(g.gerente).toUpperCase()] || relatorios.mensagensGerentes[g.filial]"), 'envio 14:30/17:00/18:30: cada gerente recebe a mensagem da chave SIGLA::GERENTE');
    ok(fonte.includes("(auditoria.__porGerente || {})[g.filial + '::' + String(g.gerente).toUpperCase()] || auditoria[g.filial]"), 'envio 11:30: cada gerente recebe a gestao de campo da chave SIGLA::GERENTE');
  } finally {
    axios.get = original;
  }
}
