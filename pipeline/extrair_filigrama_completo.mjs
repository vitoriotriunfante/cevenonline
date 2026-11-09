import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const userDataDir = path.resolve('scratch/perfil_gerot');

// Meses consolidados fechados (não mudam mais) + Novembro (dinâmico)
const meses = [
  { cod: '2026-08', nome: 'Agosto 2026', fechado: true },
  { cod: '2026-09', nome: 'Setembro 2026', fechado: true },
  { cod: '2026-10', nome: 'Outubro 2026', fechado: true },
  { cod: '2026-11', nome: 'Novembro 2026', fechado: false }
];

// Dimensões completas da tabela
const dimensoes = ['Filial', 'Supervisor', 'Vendedor', 'Fornecedor', 'Cliente', 'Produto'];

async function extrairTabelaDimensao(page, dimensaoNome) {
  // Clicar na aba da dimensão
  const clicou = await page.evaluate((nome) => {
    const btns = Array.from(document.querySelectorAll('button, a, [role="tab"], th, div'))
      .filter(el => el.innerText && el.innerText.trim() === nome && el.offsetHeight > 0);
    if (btns.length > 0) {
      btns[0].click();
      return true;
    }
    return false;
  }, dimensaoNome);

  if (!clicou) {
    console.log(`⚠️ Aba ${dimensaoNome} não encontrada pelo clique.`);
    return [];
  }

  await page.waitForTimeout(3000);

  // Extrair todas as linhas da tabela
  const linhas = await page.evaluate(() => {
    const dados = [];
    document.querySelectorAll('table tbody tr').forEach(tr => {
      const cols = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()).filter(Boolean);
      if (cols.length >= 3) {
        dados.push(cols);
      }
    });
    return dados;
  });

  return linhas;
}

async function coletarFiligramaCompleto() {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await context.newPage();
  console.log('🌐 Conectando ao GEROT para extração estruturada no filigrama...');
  await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/painel', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const pastaDestino = path.resolve('pipeline/gerot_consolidado');
  fs.mkdirSync(pastaDestino, { recursive: true });

  for (const mesInfo of meses) {
    console.log(`\n========================================`);
    console.log(`📅 Processando ${mesInfo.nome} (${mesInfo.cod}) [Fechado: ${mesInfo.fechado}]`);
    console.log(`========================================`);

    // 1. Abrir seletor de período
    await page.click('#btnPeriodo');
    await page.waitForTimeout(500);

    // Expandir 2026 se necessário
    await page.evaluate(() => {
      const btn2026 = document.querySelector('button[data-ano="2026"]');
      if (btn2026 && btn2026.classList.contains('fech')) btn2026.click();
    });
    await page.waitForTimeout(500);

    // Clicar no mês
    const clicou = await page.evaluate((cod) => {
      const btn = document.querySelector(`button[data-mes="${cod}"]`);
      if (btn) { btn.click(); return true; }
      return false;
    }, mesInfo.cod);

    if (!clicou) {
      console.log(`❌ Falha ao selecionar mês ${mesInfo.cod}`);
      continue;
    }
    await page.waitForTimeout(4000);

    // 2. Coletar KPIs gerais do mês
    const kpisGerais = await page.evaluate(() => {
      const cards = [];
      document.querySelectorAll('.kpi, .card, .cx-kpi, .topo-card').forEach(c => {
        const t = c.innerText.trim();
        if (t) cards.push(t.replace(/\n/g, ' | '));
      });
      return cards;
    });

    const snapshotMes = {
      mes: mesInfo.nome,
      codigo: mesInfo.cod,
      fechado: mesInfo.fechado,
      extraidoEm: new Date().toISOString(),
      kpisGerais,
      dimensoes: {}
    };

    // 3. Coletar cada dimensão (Filial, Supervisor, Vendedor, Fornecedor, Cliente, Produto)
    for (const dim of dimensoes) {
      process.stdout.write(`   ⏳ Extraindo ${dim}... `);
      const linhas = await extrairTabelaDimensao(page, dim);
      snapshotMes.dimensoes[dim] = linhas;
      console.log(`${linhas.length} registros extraídos.`);
    }

    // Salvar arquivo individual do mês para não sobrecarregar memória
    const arquivoMes = path.join(pastaDestino, `gerot_${mesInfo.cod}.json`);
    fs.writeFileSync(arquivoMes, JSON.stringify(snapshotMes, null, 2), 'utf-8');
    console.log(`💾 Snapshot salvo em: ${arquivoMes}`);
  }

  console.log('\n🎉 Todos os meses (Ago, Set, Out e Nov) extraídos com sucesso no filigrama!');
  await context.close();
}

coletarFiligramaCompleto().catch(console.error);

