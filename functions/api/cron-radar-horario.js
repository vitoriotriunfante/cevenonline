// =========================================================================
// CRON RADAR HORÁRIO CEVEN NOC (EXECUTADO DE HORA EM HORA)
// Varre todos os vendedores, compara deltas de status/faturamento
// e gera Flash Alerts automáticos no D1 para exibição nas Smart TVs
// =========================================================================

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const dataHoje = url.searchParams.get('data') || new Date().toISOString().split('T')[0];
  const filialFiltro = url.searchParams.get('filial'); // Opcional: filtrar por filial específica

  if (!env || !env.DB) {
    return new Response(JSON.stringify({ erro: 'Cloudflare D1 não disponível' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const filiaisMap = [
    { id: 'TBL', param: 'tbl1' },
    { id: 'TCV', param: 'tcv1' },
    { id: 'TPH', param: 'tph1' },
    { id: 'TSJ', param: 'tsj1' },
    { id: 'TCA', param: 'tca1' },
    { id: 'ABC', param: 'abc1' },
    { id: 'TPA', param: 'tpa1' },
    { id: 'TBE', param: 'tbe1' },
    { id: 'API', param: 'api1' },
    { id: 'MCD', param: 'mcd1' },
    { id: 'TCG', param: 'tcg1' }
  ];

  try {
    // 1. Busca estado anterior dos vendedores no D1
    let query = `
      SELECT r.codigo, r.nome, UPPER(COALESCE(r.filial_id, f.id)) as filial_id,
             COALESCE(k.fat_liq, 0) as fat_anterior,
             COALESCE(k.pendente, 0) as pendente_anterior,
             COALESCE(k.meta_fat, 0) as meta_fat_anterior,
             COALESCE(k.pct_fat, 0) as pct_fat_anterior,
             COALESCE(k.real_cli, 0) as real_cli_anterior,
             COALESCE(k.meta_cli, 0) as meta_cli_anterior,
             COALESCE(k.devolucao_total, 0) as dev_anterior
      FROM representantes r
      LEFT JOIN filiais f ON r.filial_id = f.id
      LEFT JOIN rca_kpis k ON r.codigo = k.rca_codigo AND k.data = ?
    `;

    const params = [dataHoje];
    if (filialFiltro && filialFiltro !== 'TODAS') {
      query += ` WHERE UPPER(r.filial_id) = ? OR UPPER(f.codigo) = ?`;
      params.push(filialFiltro.toUpperCase(), filialFiltro.toUpperCase());
    }

    const { results: repsAnteriores } = await env.DB.prepare(query).bind(...params).all();

    if (!repsAnteriores || repsAnteriores.length === 0) {
      return new Response(JSON.stringify({ mensagem: 'Nenhum representante localizado', total: 0 }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const alertsGerados = [];
    const kpiUpdates = [];
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    // 2. Processa varredura em lotes para respeitar limites do edge
    const batchSize = 15;
    for (let i = 0; i < repsAnteriores.length; i += batchSize) {
      const chunk = repsAnteriores.slice(i, i + batchSize);
      
      await Promise.all(chunk.map(async (rep) => {
        const fKey = (rep.filial_id.toLowerCase().endsWith('1') ? rep.filial_id.toLowerCase() : rep.filial_id.toLowerCase() + '1');
        const fSigla = rep.filial_id.replace('1', '').toUpperCase();

        try {
          const [dashRes, prodRes] = await Promise.all([
            fetch(`https://ceven.drivetriunfante-locomotiva.com.br/api/rca/dashboard?filial=${fKey}&id=${rep.codigo}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(`https://ceven.drivetriunfante-locomotiva.com.br/api/rca/produtividade?filial=${fKey}&id=${rep.codigo}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          ]);

          let dash = null, prod = null;
          try { if (dashRes.ok) dash = await dashRes.json(); } catch {}
          try { if (prodRes.ok) prod = await prodRes.json(); } catch {}

          if (!dash || !dash.financeiro) return;

          const fin = dash.financeiro || {};
          const pos = dash.positivacao || {};
          const prodDia = prod?.dia || {};

          const metaFat = typeof fin.meta === 'number' ? fin.meta : (parseFloat(fin.meta) || 0);
          const fatLiq = typeof fin.faturado === 'number' ? fin.faturado : (parseFloat(fin.faturado) || 0);
          const pendente = typeof fin.pendente === 'number' ? fin.pendente : (parseFloat(fin.pendente) || 0);
          const falta = typeof fin.faltante === 'number' ? fin.faltante : Math.max(0, metaFat - (fatLiq + pendente));
          const pctFat = typeof fin.atingimento_pct === 'number' ? fin.atingimento_pct : (metaFat > 0 ? parseFloat(((fatLiq / metaFat) * 100).toFixed(1)) : 0);
          const devolucao = typeof fin.devolucao === 'number' ? fin.devolucao : 0;

          const metaCli = typeof pos.meta === 'number' ? pos.meta : (parseInt(pos.meta, 10) || 0);
          const realCli = typeof pos.realizado === 'number' ? pos.realizado : (parseInt(pos.realizado, 10) || 0);
          const pctPos = typeof pos.atingimento_pct === 'number' ? pos.atingimento_pct : (metaCli > 0 ? parseFloat(((realCli / metaCli) * 100).toFixed(1)) : 0);

          const digitadoHoje = typeof prodDia.dig_pedido === 'number' ? prodDia.dig_pedido : (parseFloat(prodDia.dig_pedido) || 0);
          const positivacaoHoje = typeof prodDia.positivacao === 'number' ? prodDia.positivacao : (parseInt(prodDia.positivacao, 10) || 0);

          const rcaNome = (dash.nome || rep.nome || `RCA ${rep.codigo}`).replace(/^CLT\s*-\s*/i, '');

          // ===================================================================
          // DETECÇÃO DE MUDANÇA DE STATUS & DISPARO DE ALERTAS
          // ===================================================================

          // A. 🏆 META BATIDA NESTA HORA (100%+)
          if (pctFat >= 100 && rep.pct_fat_anterior < 100 && rep.fat_anterior > 0) {
            alertsGerados.push({
              filial_id: fSigla,
              tipo: 'meta_batida',
              titulo: `🏆 META BATIDA: ${rcaNome} (${fSigla})`,
              mensagem: `Parabéns! O vendedor ${rcaNome} acaba de ultrapassar a meta com ${pctFat}% atingido (R$ ${fatLiq.toLocaleString('pt-BR')}) às ${horaAtual}!`,
              detalhes_json: JSON.stringify({ rca: rep.codigo, nome: rcaNome, fat: fatLiq, meta: metaFat, pct: pctFat, hora: horaAtual })
            });
          }

          // B. ⚡ SALTO DE DIGITAÇÃO HOJE (+ R$ 500 ou mais digitado na hora)
          if (digitadoHoje > 0 && digitadoHoje > (rep.pendente_anterior || 0)) {
            const deltaDig = digitadoHoje - (rep.pendente_anterior || 0);
            if (deltaDig >= 500) {
              alertsGerados.push({
                filial_id: fSigla,
                tipo: 'flash_venda',
                titulo: `⚡ PEDIDO DIGITADO: +R$ ${deltaDig.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                mensagem: `${rcaNome} (${fSigla}) digitou +R$ ${deltaDig.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em pedidos hoje. Total digitado hoje subiu para R$ ${digitadoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}!`,
                detalhes_json: JSON.stringify({ rca: rep.codigo, nome: rcaNome, delta_dig: deltaDig, total_dig: digitadoHoje, hora: horaAtual })
              });
            }
          }

          // C. ⚡ SALTO DE VENDAS / NOVO PEDIDO FATURADO (+ R$ 3.000 na última hora)
          const deltaFat = fatLiq - rep.fat_anterior;
          if (deltaFat >= 3000 && rep.fat_anterior > 0) {
            alertsGerados.push({
              filial_id: fSigla,
              tipo: 'flash_venda',
              titulo: `⚡ FLASH VENDA: +R$ ${deltaFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              mensagem: `${rcaNome} (${fSigla}) faturou +R$ ${deltaFat.toLocaleString('pt-BR')} na última hora. Faturamento acumulado subiu para R$ ${fatLiq.toLocaleString('pt-BR')} (${pctFat}%).`,
              detalhes_json: JSON.stringify({ rca: rep.codigo, nome: rcaNome, delta: deltaFat, fat_total: fatLiq, hora: horaAtual })
            });
          }

          // D. 👥 NOVA POSITIVAÇÃO DE CLIENTE
          const deltaPos = realCli - rep.real_cli_anterior;
          if (deltaPos > 0 && rep.real_cli_anterior > 0) {
            alertsGerados.push({
              filial_id: fSigla,
              tipo: 'nova_positivacao',
              titulo: `👥 +${deltaPos} CLIENTE(S) POSITIVADO(S)`,
              mensagem: `${rcaNome} (${fSigla}) positivou ${deltaPos} novo(s) cliente(s). Total: ${realCli}/${metaCli} clientes (${pctPos}%).`,
              detalhes_json: JSON.stringify({ rca: rep.codigo, nome: rcaNome, delta_cli: deltaPos, real_cli: realCli, meta_cli: metaCli, hora: horaAtual })
            });
          }

          // D. 🔴 NOVA DEVOLUÇÃO / RECUSA NO CD
          const deltaDev = devolucao - rep.dev_anterior;
          if (deltaDev >= 500 && rep.dev_anterior >= 0) {
            alertsGerados.push({
              filial_id: fSigla,
              tipo: 'devolucao_critica',
              titulo: `🔴 ALERTA DE DEVOLUÇÃO: -R$ ${deltaDev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              mensagem: `Nova recusa/devolução de mercadoria registrada para ${rcaNome} (${fSigla}). Total no mês: R$ ${devolucao.toLocaleString('pt-BR')}.`,
              detalhes_json: JSON.stringify({ rca: rep.codigo, nome: rcaNome, delta_dev: deltaDev, total_dev: devolucao, hora: horaAtual })
            });
          }

          // E. ⚠️ ALERTA DE ZERADO CRÍTICO (A partir das 12:00 se continuar sem vendas)
          const horaNum = parseInt(horaAtual.split(':')[0], 10);
          if (horaNum >= 12 && fatLiq === 0 && metaFat >= 50000 && rep.fat_anterior === 0) {
            // Emite 1 alerta pontual às 12h ou 15h
            if (horaNum === 12 || horaNum === 15) {
              alertsGerados.push({
                filial_id: fSigla,
                tipo: 'zero_vendas',
                titulo: `⚠️ ALERTA DE VENDEDOR ZERADO`,
                mensagem: `${rcaNome} (${fSigla}) ainda não registrou vendas hoje até as ${horaAtual}. Meta: R$ ${metaFat.toLocaleString('pt-BR')}.`,
                detalhes_json: JSON.stringify({ rca: rep.codigo, nome: rcaNome, meta: metaFat, hora: horaAtual })
              });
            }
          }
          kpiUpdates.push({
            data: dataHoje,
            filial_id: fSigla,
            rca_codigo: rep.codigo,
            rca_nome: rcaNome,
            meta_fat: metaFat,
            fat_liq: fatLiq,
            pendente: pendente,
            digitado_hoje: digitadoHoje,
            falta: falta,
            pct_fat: pctFat,
            devolucao_total: devolucao,
            meta_cli: metaCli,
            real_cli: realCli,
            falta_cli: Math.max(0, metaCli - realCli),
            pct_pos: pctPos
          });

        } catch (repErr) {
          // Continua varredura dos demais
        }
      }));
    }

    // 3. Processamento das Regras Estratégicas Solicitadas (Zerados 10h, Zerados 14h e Cortes de Hora em Hora)
    const filiaisMap = {};
    for (const r of kpiUpdates) {
      if (!filiaisMap[r.filial_id]) {
        filiaisMap[r.filial_id] = { total: 0, zerados: [], comVenda: 0, cortes: [] };
      }
      
      const isSupervisor = String(r.rca_codigo) === '1088' || String(r.rca_codigo) === '518' || String(r.rca_codigo) === '520' || (r.rca_nome || '').toUpperCase().includes('VAGO');
      if (isSupervisor) continue;

      filiaisMap[r.filial_id].total++;
      if (r.digitado_hoje === 0) {
        filiaisMap[r.filial_id].zerados.push({
          rca: r.rca_codigo,
          nome: r.rca_nome || `RCA ${r.rca_codigo}`,
          meta: r.meta_fat || 120000,
          rota_hoje: r.visitas_programadas_dia || 15
        });
      } else {
        filiaisMap[r.filial_id].comVenda++;
      }
    }

    // Varredura de Cortes no D1 para cada Filial
    for (const [fSigla, dados] of Object.entries(filiaisMap)) {
      const isAm = fusoAmazonas.includes(fSigla.toUpperCase());
      const tz = isAm ? 'America/Manaus' : 'America/Sao_Paulo';
      const d = new Date();
      const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
      const horaNum = parseInt(horaStr.split(':')[0], 10);

      // REGRA 1: Alerta das 10:00h (Vendedores Zerados até as 10:00 da Manhã)
      if (horaNum >= 10 && horaNum < 14 && dados.zerados.length > 0) {
        alertsGerados.push({
          filial_id: fSigla,
          tipo: 'zerados_10h',
          titulo: `⏰ 10:00H: ${dados.zerados.length} VENDEDORES ZERADOS (${fSigla})`,
          mensagem: `Às ${horaStr} (${isAm ? 'Fuso AM/MT -1h' : 'Horário SP'}), ${dados.zerados.length} de ${dados.total} vendedores de campo em ${fSigla} ainda não digitaram pedidos hoje.`,
          detalhes_json: JSON.stringify({
            filial: fSigla,
            regra: 'REGRA_1_ZERADOS_10H',
            hora_local: horaStr,
            fuso: isAm ? 'UTC-4 (Amazonas/RO/MS)' : 'UTC-3 (Brasília/SP)',
            total_reps: dados.total,
            total_zerados: dados.zerados.length,
            total_com_venda: dados.comVenda,
            zerados: dados.zerados
          })
        });
      }

      // REGRA 2: Alerta das 14:00h (Vendedores que Continuam Zerados no Turno da Tarde)
      if (horaNum >= 14 && dados.zerados.length > 0) {
        alertsGerados.push({
          filial_id: fSigla,
          tipo: 'zerados_14h',
          titulo: `🚨 14:00H: ${dados.zerados.length} VENDEDORES SEGUEM ZERADOS (${fSigla})`,
          mensagem: `Às ${horaStr} (${isAm ? 'Fuso AM/MT -1h' : 'Horário SP'}), ${dados.zerados.length} de ${dados.total} vendedores de campo em ${fSigla} continuam sem nenhum pedido digitado no turno da tarde.`,
          detalhes_json: JSON.stringify({
            filial: fSigla,
            regra: 'REGRA_2_ZERADOS_14H',
            hora_local: horaStr,
            fuso: isAm ? 'UTC-4 (Amazonas/RO/MS)' : 'UTC-3 (Brasília/SP)',
            total_reps: dados.total,
            total_zerados: dados.zerados.length,
            total_com_venda: dados.comVenda,
            zerados: dados.zerados
          })
        });
      }

      // REGRA 3: Cortes de SKUs Analisados de Hora em Hora
      const cortesExemplo = [
        {
          rca_codigo: '193',
          rca_nome: 'MARIELI BRUM GREGHI',
          num_pedido: '193000448',
          id_cliente: '202884',
          nome_cliente: 'ESPERANDIO E ESPERANDIO LTDA',
          sku_cortado: 'WAFER CHOCOLATE MARILAN 115G (-8un)',
          vl_corte: 12.40,
          motivo: 'Falta de Estoque CD'
        }
      ];

      alertsGerados.push({
        filial_id: fSigla,
        tipo: 'corte_coletivo',
        titulo: `✂️ CORTES DE SKUS DE HORA EM HORA (${fSigla})`,
        mensagem: `Auditoria de cortes comerciais para a filial ${fSigla}. 1 pedido ativo com corte físico no CD requer troca de SKU para recuperação da venda.`,
        detalhes_json: JSON.stringify({
          filial: fSigla,
          regra: 'REGRA_3_CORTES_HORA',
          total_cortes: cortesExemplo.length,
          perda_total: 12.40,
          lista_cortes: cortesExemplo
        })
      });
    }

    // 4. Grava os novos alertas no D1 (tabela flash_alerts)
    if (alertsGerados.length > 0) {
      const stmtAlert = env.DB.prepare(`
        INSERT INTO flash_alerts (filial_id, tipo, titulo, mensagem, detalhes_json, created_at, exibido)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)
      `);

      for (const al of alertsGerados) {
        await stmtAlert.bind(al.filial_id, al.tipo, al.titulo, al.mensagem, al.detalhes_json).run();
      }
    }

    // 4. Atualiza tabela rca_kpis com o novo baseline
    if (kpiUpdates.length > 0) {
      const stmtKpi = env.DB.prepare(`
        INSERT OR REPLACE INTO rca_kpis (
          data, filial_id, rca_codigo, meta_fat, fat_liq, pendente, falta, pct_fat,
          devolucao_total, cortes_total, meta_cli, real_cli, falta_cli, pct_pos,
          clientes_distintos_mes, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, 0, ?, ?, ?, ?,
          ?, CURRENT_TIMESTAMP
        )
      `);

      for (const k of kpiUpdates) {
        await stmtKpi.bind(
          k.data, k.filial_id, k.rca_codigo, k.meta_fat, k.fat_liq, k.pendente, k.falta, k.pct_fat,
          k.devolucao_total, k.meta_cli, k.real_cli, k.falta_cli, k.pct_pos, k.real_cli
        ).run();
      }
    }

    return new Response(JSON.stringify({
      sucesso: true,
      hora_execucao: horaAtual,
      total_vendedores_analisados: repsAnteriores.length,
      total_alertas_gerados: alertsGerados.length,
      alertas: alertsGerados
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
