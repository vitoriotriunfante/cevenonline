/**
 * FICHA DO ARQUIVO
 * O QUE É: tira a cópia de RESERVA da equipe (public/mostra_vendedores.json) a partir da GESTÃO DE EQUIPE ao vivo (/api/tv-mostra, D1).
 *          A fonte da equipe é a tela Gestão de Equipe (/gestao-equipe). A planilha do Drive NÃO é mais lida (decisão do Vitório, 05/10/2026).
 * PROJETO: CFTV/TV. A TV só mostra vendedor com mostra = SIM.
 * RODA: automaticamente dentro do publicar_tv.js. Manual: node gerar_mostra_tv.js
 * ESCREVE: public/mostra_vendedores.json (nomes de vendedor/supervisor/RCA/canal — sem dados de venda). Só serve se o D1 ficar indisponível.
 * REGRA: se a resposta ao vivo não vier do D1 (origem != 'd1') ou vier vazia, NÃO sobrescreve a cópia anterior.
 */
const fs = require('fs');
const path = require('path');

(async () => {
  const r = await fetch('https://ceven-cftv-matrix.pages.dev/api/tv-mostra?nocache=1&t=' + Date.now(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const d = await r.json();
  if (!d || d.origem !== 'd1' || !d.filiais || !Object.keys(d.filiais).length) {
    console.error('Gestao de Equipe (D1) nao respondeu como esperado (origem=' + (d && d.origem) + '): mantendo a copia anterior.');
    process.exit(1);
  }
  let sim = 0, nao = 0;
  for (const lista of Object.values(d.filiais)) for (const v of lista) (v.mostra ? sim++ : nao++);
  const out = { gerado_em: new Date().toISOString(), copia_de: 'gestao-de-equipe (D1)', atualizado_em: d.atualizado_em || null, atualizado_por: d.atualizado_por || null, total_sim: sim, total_nao: nao, grupos: d.grupos || {}, filiais: d.filiais };
  fs.writeFileSync(path.join(__dirname, 'public', 'mostra_vendedores.json'), JSON.stringify(out));
  console.log(`mostra_vendedores.json (copia da Gestao de Equipe): ${sim} SIM / ${nao} NAO em ${Object.keys(d.filiais).length} filiais (salva por ${d.atualizado_por || '?'} em ${d.atualizado_em || '?'})`);
})().catch((e) => { console.error('Nao consegui ler a Gestao de Equipe:', e.message); process.exit(1); });
