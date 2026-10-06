const fs = require('fs');
const p = 'testes/t_notif_supervisores.mjs';
let s = fs.readFileSync(p, 'utf8');
const a = s.indexOf("  ok(k.texto.startsWith('KLEBERSON BATISTA LIDUARIO");
const b = s.indexOf("  // ja avisado nao repete");
if (a < 0 || b < 0) throw new Error('ancora');
const novo = [
  "  ok(k.texto.startsWith('📊 Kleberson Batista Liduario · sua equipe (09:05–10:05)\\nSaldo: +3 pts') && k.texto.includes('⚽ 1 gol (+5)') && k.texto.includes('🚨 1 pênalti (−4)') && k.texto.includes('📝 2 pedidos na rota (+2)'), 'cabecalho com o NOME do supervisor, saldo e o resumo por tipo com emoji (5 - 4 + 1 + 1 = +3)');",
  "  ok(k.texto.includes('✅ O QUE DEU CERTO\\n• Fulano Silva — Super Pedido (+5)') && k.texto.includes('⚠️ ATENÇÃO\\n• Fulano Silva — pênalti (−4)') && !k.texto.includes('Pedido Feito na Rota'), 'blocos \"o que deu certo\" e \"atencao\", um vendedor por linha com nome em formato de leitura; pedido na rota so na contagem');",
  "  const rep = lib.montaMensagens([...Array(6)].map((_, i) => L({ chave: 'imp|gps|7|' + i, nivel: 'impedimento', pontos: -5, vendedor: 'BRUNO GUSTAVO NATAL', pontos_nome: 'Impedimento' })), new Set(), {})[0];",
  "  ok(rep.texto.includes('• Bruno Natal — 6 impedimentos (−30)') && rep.texto.includes('🚩 6 impedimentos (−30)'), 'o mesmo lance repetido vira \"6 impedimentos (−30)\" numa linha so');",
  "  const niv = lib.montaMensagens([L({ chave: 'gol_mix|1|1', pontos: 8, pontos_nome: 'Dobrou o Mix PLATINA' })], new Set(), {})[0];",
  "  ok(niv.texto.includes('Dobrou o Mix Platina (+8)'), 'nivel do gol aparece em formato de leitura (Platina)');",
  ""
].join('\n');
s = s.slice(0, a) + novo + s.slice(b);
s = s.replace("/\\(\\+\\d+ lances: veja na Liga\\)/", "/\\(\\+\\d+ vendedor\\(es\\): veja na Liga\\)/");
fs.writeFileSync(p, s); console.log('ok');
