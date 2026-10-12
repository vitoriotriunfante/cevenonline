// =========================================================================
// FICHA DO ARQUIVO: scripts/aplicar_vinculo_representantes.js
// O QUE É: aplica `vinculo: 'REPRESENTANTE'` na Gestão de Equipe (D1 config_equipe_soberana) para todo RCA que a planilha DEPARA marca com "R"
//          na coluna P ("Tipo vendedor"). Decisão do Vitório (12/10/2026): representante aparece nos painéis (meta, vendas) mas NÃO é cobrado
//          (sem lance, cartão, pênalti, Liga, incentivo, zerados nem cobrança no WhatsApp).
// COMO RODAR (uma vez; é idempotente):  node scripts/aplicar_vinculo_representantes.js "<caminho do DEPARA .xlsx>" [--dry]
//          --dry = só mostra o que mudaria, não grava.
// SEGURANÇA: lê o JSON atual da Gestão e MESCLA (não substitui a lista); guarda cópia de segurança em scratch/backup_equipe_AAAA-MM-DDTHH-MM.json
//          antes de gravar; RCA "R" que não está na Gestão entra como OCULTO (mostra=false) + REPRESENTANTE (continua somando nos totais).
// DEPENDE: wrangler logado na conta do Pages/D1 (ver memória: reference_cloudflare_contas_wrangler) e `npm i` (exceljs ou xlsx já no projeto).
// =========================================================================
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const arquivo = process.argv[2];
const dry = process.argv.includes('--dry');
if (!arquivo || !fs.existsSync(arquivo)) { console.error('Informe o caminho do DEPARA .xlsx'); process.exit(1); }

let XLSX;
try { XLSX = require('xlsx'); } catch { console.error('Falta o pacote "xlsx": rode  npm i xlsx'); process.exit(1); }

const aspas = (a) => (process.platform === 'win32' && /[\s'"*]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a);   // no Windows o shell separa por espaco: protege o SQL e os caminhos
const wrangler = (args) => execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'ceven_noc_d1', '--remote', ...args].map(aspas), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' });

// 1) quem é R no DEPARA (coluna P = "Tipo vendedor"; cód. = "Cód novo (WinThor)")
const wb = XLSX.readFile(arquivo);
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
const cab = linhas[0].map((x) => String(x || '').trim());
const iFil = cab.indexOf('Filial'), iNome = cab.indexOf('Vendedor'), iCod = cab.findIndex((x) => /^C[óo]d novo/i.test(x)), iTipo = cab.indexOf('Tipo vendedor');
if ([iFil, iCod, iTipo].some((i) => i < 0)) { console.error('Colunas não encontradas no DEPARA:', cab.join(' | ')); process.exit(1); }
const R = new Map();
for (const l of linhas.slice(1)) if (l && l[iFil] && String(l[iTipo] || '').trim().toUpperCase() === 'R') R.set(String(l[iCod]).trim(), { filial: String(l[iFil]).trim().toUpperCase(), nome: String(l[iNome] || '').trim() });
console.log(`DEPARA: ${R.size} representantes (tipo R).`);

// 2) Gestão atual
const bruto = wrangler(['--json', '--command', 'SELECT conteudo_json FROM config_equipe_soberana WHERE id = 1']);
const ini = bruto.indexOf('[');
const dados = JSON.parse(JSON.parse(bruto.slice(ini))[0].results[0].conteudo_json);

fs.mkdirSync(path.join(__dirname, '..', 'scratch'), { recursive: true });
const bkp = path.join(__dirname, '..', 'scratch', `backup_equipe_${new Date().toISOString().slice(0, 16).replace(':', '-')}.json`);
fs.writeFileSync(bkp, JSON.stringify(dados));
console.log('Cópia de segurança:', bkp);

// 3) mescla
let marcados = 0, ja = 0; const achou = new Set();
for (const lista of Object.values(dados.filiais)) for (const v of lista) {
  const c = String(v.rca);
  if (!R.has(c)) continue;
  achou.add(c);
  if (v.vinculo === 'REPRESENTANTE') { ja++; continue; }
  v.vinculo = 'REPRESENTANTE'; v.vinculo_fonte = 'DEPARA vendedores 2026-10-08 (coluna P = R)'; marcados++;
}
const novos = [];
for (const [c, info] of R) {
  if (achou.has(c)) continue;
  const chave = Object.keys(dados.filiais).find((k) => k === info.filial) || Object.keys(dados.filiais).find((k) => k.split('_')[0] === info.filial);
  if (!chave) { console.warn('Filial desconhecida, ignorado:', c, info.filial); continue; }
  dados.filiais[chave].push({ rca: /^\d+$/.test(c) ? Number(c) : c, grupo: '', nome: info.nome || ('RCA ' + c), supervisor: '', gerente: '', canal: '', mostra: false,
    motivo: 'Representante (DEPARA 08/10, tipo R): acompanhado, não cobrado', vinculo: 'REPRESENTANTE', vinculo_fonte: 'DEPARA vendedores 2026-10-08 (coluna P = R)' });
  novos.push(c);
}
let sim = 0, nao = 0;
for (const lista of Object.values(dados.filiais)) for (const v of lista) { if (v.mostra === false) nao++; else sim++; }
dados.total_sim = sim; dados.total_nao = nao;
console.log(`Marcados agora: ${marcados} | já eram: ${ja} | entram como ocultos (não estavam na Gestão): ${novos.length} [${novos.join(', ')}] | SIM ${sim} / NÃO ${nao}`);
if (dry) { console.log('--dry: nada gravado.'); process.exit(0); }

// 4) grava (+ trilha de auditoria)
const sqlArq = path.join(__dirname, '..', 'scratch', 'seed_vinculo.sql');
const esc = (s) => s.replace(/'/g, "''");
fs.writeFileSync(sqlArq,
  `UPDATE config_equipe_soberana SET conteudo_json='${esc(JSON.stringify(dados))}', atualizado_por='Vinculo REPRESENTANTE (DEPARA 08/10)', atualizado_em=datetime('now') WHERE id=1;\n` +
  `INSERT INTO audit_alteracoes_equipe (alterado_em, usuario, total_rcas, resumo) VALUES (datetime('now'),'Vinculo REPRESENTANTE',${sim + nao},'REPRESENTANTE em ${marcados + ja + novos.length} RCAs (DEPARA, coluna P=R); SIM ${sim} NAO ${nao}');\n`);
console.log(wrangler(['--file', sqlArq]).split('\n').slice(-6).join('\n'));
fs.unlinkSync(sqlArq);
console.log('OK: Gestão atualizada. As telas pegam em até 1 min.');
