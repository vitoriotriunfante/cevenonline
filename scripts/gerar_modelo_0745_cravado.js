/**
 * Gera o MODELO EXATO do que sera enviado no ciclo 07:45 (consolidado + 1 por
 * gerente), usando as MESMAS funcoes do motor real (nenhuma logica duplicada),
 * e salva em OPERACAO_WHATSAPP/relatorios_por_horario/07_45/ como referencia
 * cravada -- pedido do Vitorio em 23/09/2026 pra ter prova do que vai sair
 * amanha, sem depender de esperar o disparo ao vivo.
 *
 * NAO envia nada pro WhatsApp. So gera e salva arquivo.
 */
const fs = require('fs');
const path = require('path');
const engine = require('../pipeline/ceven_unified_engine');

async function main() {
  const dataHoje = new Date().toISOString().split('T')[0];
  const repsMap = engine.carregarValidacaoVendedores();
  await engine.enriquecerCanalReal(repsMap);
  engine.aplicarMostraDisparos(repsMap);

  const diretrizes = engine.carregarDiretrizesOperacionais({});
  const abertura = await engine.coletarAberturaVarejo(repsMap, diretrizes);

  const outDir = path.join(__dirname, '..', 'OPERACAO_WHATSAPP', 'relatorios_por_horario', '07_45');
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, '07_45__VITORIO.md'), abertura.textoAbertura, 'utf8');
  console.log('Consolidado (Vitório) salvo.');

  let n = 0;
  for (const g of engine.GERENTES_MAP) {
    const chaves = Object.keys(abertura.dadosAbertura || {});
    let chave = chaves.find(k => {
      const [sigla, gerenteNome] = k.split('::');
      return sigla === g.filial && gerenteNome.toUpperCase() === g.gerente.toUpperCase();
    });
    if (!chave) chave = chaves.find(k => k.split('::')[0] === g.filial);
    const f = chave ? abertura.dadosAbertura[chave] : null;
    if (!f) { console.log(`  sem dados pra ${g.filial} - ${g.gerente}`); continue; }

    const pInat = f.visitas > 0 ? ((f.inativos / f.visitas) * 100).toFixed(1).replace('.', ',') : '0,0';
    const pRec = f.visitas > 0 ? ((f.rec / f.visitas) * 100).toFixed(1).replace('.', ',') : '0,0';
    const mediaVend = f.vjs > 0 ? (f.visitas / f.vjs).toFixed(1).replace('.', ',') : '0,0';
    let msg = `🌅 *ABERTURA MATINAL — ${g.filial} (07:45)*\n`;
    msg += `📅 ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `👥 Vendedores: ${f.vjs} • Visitas: ${f.visitas} (média ${mediaVend}/vendedor)\n`;
    msg += `Sem compra +30d: ${f.inativos} (${pInat}%) • Recorrência: ${f.rec} (${pRec}%)\n`;
    if (f.sigla === 'TPH') msg += `🔥 Volta Comigo: ${f.volta} PDVs\n`;
    msg += `Oportunidades CNAE ${abertura.cnaeFoco?.codigo || ''}: +${f.prospects.toLocaleString('pt-BR')} PDVs\n`;

    const fname = `07_45__GERENTE_${g.filial}_${g.gerente.replace(/[^a-zA-Z0-9]+/g, '_')}.md`;
    fs.writeFileSync(path.join(outDir, fname), msg, 'utf8');
    n++;
  }
  console.log(`${n} arquivos de gerente salvos em ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
