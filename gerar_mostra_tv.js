/**
 * FICHA DO ARQUIVO
 * O QUE É: gera public/mostra_vendedores.json a partir da planilha "VENDEDORES AUDITADOS.xlsx"
 *          (aba MOSTRA_DISPAROS, a MESMA fonte de verdade dos disparos de WhatsApp).
 * PROJETO: CFTV/TV. A TV só mostra vendedor com "MOSTRA NOS DISPAROS" = SIM.
 * RODA: automaticamente dentro do publicar_tv.js. Manual: node gerar_mostra_tv.js [caminho.xlsx]
 * ATENÇÃO: lê a cópia LOCAL da planilha. A original está no Drive: mantenha a cópia local
 *          atualizada antes de publicar (o script mostra a data do arquivo).
 * ESCREVE: public/mostra_vendedores.json (nomes de vendedor/supervisor/RCA/canal — sem dados de venda).
 */
const X = require('xlsx');
const fs = require('fs');
const path = require('path');

const origem = process.argv[2] || path.join(__dirname, 'VENDEDORES AUDITADOS.xlsx');
if (!fs.existsSync(origem)) { console.error('Planilha nao encontrada:', origem); process.exit(1); }
const wb = X.readFile(origem);
const ws = wb.Sheets['MOSTRA_DISPAROS'];
if (!ws) { console.error('Aba MOSTRA_DISPAROS nao encontrada'); process.exit(1); }

const clean = s => String(s == null ? '' : s).replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();
const filiais = {};
let sim = 0, nao = 0;
for (const r of X.utils.sheet_to_json(ws, { defval: '' })) {
  const f = String(r['Filial'] || '').toUpperCase().trim();
  const rca = String(r['Cód. Vendedor (RCA)'] || '').trim();
  if (!f || !rca) continue;
  const mostra = String(r['MOSTRA NOS DISPAROS']).toUpperCase().trim() === 'SIM';
  mostra ? sim++ : nao++;
  (filiais[f] = filiais[f] || []).push({
    rca, nome: clean(r['Nome do Vendedor']), supervisor: clean(r['Nome Supervisor']), gerente: String(r['Gerente Geral'] || '').trim(),
    canal: String(r['Canal Oficial'] || '').trim(), mostra, motivo: mostra ? '' : String(r['MOTIVO (se NÃO)'] || '')
  });
}
const mtime = fs.statSync(origem).mtime;
const out = { gerado_em: new Date().toISOString(), planilha_em: mtime.toISOString(), total_sim: sim, total_nao: nao, filiais };
fs.writeFileSync(path.join(__dirname, 'public', 'mostra_vendedores.json'), JSON.stringify(out));
console.log(`mostra_vendedores.json: ${sim} SIM / ${nao} NAO em ${Object.keys(filiais).length} filiais (planilha de ${mtime.toLocaleString('pt-BR')})`);
