import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const userDataDir = path.resolve('scratch/perfil_gerot');
const mesesParaExtrair = [
  { cod: '2026-08', nome: 'Agosto 2026' },
  { cod: '2026-09', nome: 'Setembro 2026' },
  { cod: '2026-10', nome: 'Outubro 2026' },
  { cod: '2026-11', nome: 'Novembro 2026' }
];

async function extrairDadosMes(page, mesInfo) {
  console.log(`\n⏳ Sincronizando ${mesInfo.nome} (${mesInfo.cod})...`);

  // 1. Abrir seletor de período
  await page.click('#btnPeriodo');
  await page.waitForTimeout(500);

  // Garantir que 2026 está aberto
  const anoAberto = await page.evaluate(() => {
    const btn2026 = document.querySelector('button[data-ano="2026"]');
    if (btn2026 && btn2026.classList.contains('fech')) {
      btn2026.click();
      return true;
    }
    return false;
  });
  if (anoAberto) await page.waitForTimeout(500);

  // 2. Clicar no mês alvo
  const clicouMes = await page.evaluate((cod) => {
    const btn = document.querySelector(`button[data-mes="${cod}"]`);
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, mesInfo.cod);

  if (!clicouMes) {
    console.error(`❌ Não foi possível clicar no botão de ${mesInfo.cod}`);
    return null;
  }

  await page.waitForTimeout(4000);

  // 3. Coletar KPIs da Visão Geral
  const dadosGerais = await page.evaluate(() => {
    const periodo = document.querySelector('#txtPeriodo')?.innerText?.trim();
    const cards = [];
    document.querySelectorAll('.kpi, .card, .cx-kpi, .topo-card').forEach(c => {
      const texto = c.innerText.trim();
      if (texto) cards.push(texto.replace(/\n/g, ' | '));
    });
    return { periodo, cards };
  });

  // 4. Coletar Tabela de Filiais
  const filiais = await page.evaluate(() => {
    const linhas = [];
    document.querySelectorAll('table tbody tr').forEach(tr => {
      const colunas = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()).filter(Boolean);
      if (colunas.length >= 5) {
        linhas.push({
          filial: colunas[0],
          mediaPonderada: colunas[1],
          faturado: colunas[2],
          faturadoCarteira: colunas[3],
          captacao: colunas[4],
          positivacao: colunas[5],
          mix: colunas[6],
          fatCliente: colunas[7],
          fatPedido: colunas[8],
          cortes: colunas[9],
          devolucao: colunas[10],
          tmf: colunas[11]
        });
      }
    });
    return linhas;
  });

  // 5. Clicar na aba "Fornecedor" para coletar indústrias
  const clicouFornecedor = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a, [role="tab"], th, div'))
      .filter(el => el.innerText && el.innerText.trim() === 'Fornecedor' && el.offsetHeight > 0);
    if (btns.length > 0) {
      btns[0].click();
      return true;
    }
    return false;
  });

  let fornecedores = [];
  if (clicouFornecedor) {
    await page.waitForTimeout(3000);
    fornecedores = await page.evaluate(() => {
      const linhas = [];
      document.querySelectorAll('table tbody tr').forEach(tr => {
        const colunas = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()).filter(Boolean);
        if (colunas.length >= 5) {
          linhas.push({
            fornecedor: colunas[0],
            mediaPonderada: colunas[1],
            faturado: colunas[2],
            faturadoCarteira: colunas[3],
            captacao: colunas[4],
            positivacao: colunas[5],
            mix: colunas[6],
            fatCliente: colunas[7],
            fatPedido: colunas[8],
            cortes: colunas[9],
            devolucao: colunas[10],
            tmf: colunas[11]
          });
        }
      });
      return linhas;
    });
  }

  // 6. Clicar na aba "Supervisor" para coletar supervisores
  const clicouSupervisor = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a, [role="tab"], th, div'))
      .filter(el => el.innerText && el.innerText.trim() === 'Supervisor' && el.offsetHeight > 0);
    if (btns.length > 0) {
      btns[0].click();
      return true;
    }
    return false;
  });

  let supervisores = [];
  if (clicouSupervisor) {
    await page.waitForTimeout(3000);
    supervisores = await page.evaluate(() => {
      const linhas = [];
      document.querySelectorAll('table tbody tr').forEach(tr => {
        const colunas = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()).filter(Boolean);
        if (colunas.length >= 5) {
          linhas.push({
            supervisor: colunas[0],
            mediaPonderada: colunas[1],
            faturado: colunas[2],
            faturadoCarteira: colunas[3],
            captacao: colunas[4],
            positivacao: colunas[5],
            mix: colunas[6],
            cortes: colunas[9],
            devolucao: colunas[10]
          });
        }
      });
      return linhas;
    });
  }

  // Voltar para a aba "Filial"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a, [role="tab"], th, div'))
      .filter(el => el.innerText && el.innerText.trim() === 'Filial' && el.offsetHeight > 0);
    if (btns.length > 0) btns[0].click();
  });
  await page.waitForTimeout(1000);

  console.log(`✅ ${mesInfo.nome}: ${filiais.length} filiais, ${fornecedores.length} indústrias, ${supervisores.length} supervisores coletados.`);

  return {
    mes: mesInfo.nome,
    codigo: mesInfo.cod,
    geral: dadosGerais,
    filiais,
    fornecedores,
    supervisores
  };
}

async function coletarHistoricoCompleto() {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await context.newPage();
  console.log('🌐 Conectando ao GEROT...');
  await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/painel', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const baseHistorica = {
    atualizadoEm: new Date().toISOString(),
    meses: {}
  };

  for (const m of mesesParaExtrair) {
    try {
      const res = await extrairDadosMes(page, m);
      if (res) {
        baseHistorica.meses[m.cod] = res;
      }
    } catch (err) {
      console.error(`Erro ao coletar ${m.nome}:`, err.message);
    }
  }

  const outputPath = path.resolve('pipeline/base_historica_gerot.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(baseHistorica, null, 2), 'utf-8');
  console.log(`\n🎉 Base histórica salva com sucesso em: ${outputPath}`);

  await context.close();
}

coletarHistoricoCompleto().catch(console.error);

