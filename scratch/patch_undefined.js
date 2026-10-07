const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// "undefined/undefined visitas · 0 pedidos": o aviso de amarelo vindo do SERVIDOR nao traz visitas nem rota; o texto de apoio imprimia o que nao existia (e o "0 pedidos" nem era dado).
// Agora: usa a prova gravada no lance; se nao houver, diz que o detalhe nao foi gravado. So mostra "visitas / pedidos" quando o numero e real.
const LINHA = "a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : (a.v && a.v.feitas != null && a.v.rota != null ? a.v.feitas + '/' + a.v.rota + ' visitas · ' + (a.v.pos || 0) + ' pedidos' : 'detalhe do lance não gravado'))";
ed('public/tvapp.html', (s) => {
  s = tr(s, "a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : a.v.feitas + '/' + a.v.rota + ' visitas · 0 pedidos')", LINHA, 'a');
  s = tr(s, "<span>${a.v.feitas}/${a.v.rota} visitas · digitado ${brl(a.v.dig)}</span>", "<span>${a.v && a.v.feitas != null && a.v.rota != null ? a.v.feitas + '/' + a.v.rota + ' visitas · digitado ' + brl(a.v.dig) : (a.txt ? esc(a.txt) : 'detalhe do lance não gravado')}</span>", 'b');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, "a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : (a.v ? a.v.feitas : 0) + '/' + (a.v ? a.v.rota : 0) + ' visitas · 0 pedidos')", LINHA, 'a');
  s = tr(s, "<span>${a.txt ? esc(a.txt) : (a.v ? a.v.feitas : 0) + '/' + (a.v ? a.v.rota : 0) + ' visitas · digitado ' + brl(a.v ? a.v.dig : 0)}</span>", "<span>${a.txt ? esc(a.txt) : (a.v && a.v.feitas != null && a.v.rota != null ? a.v.feitas + '/' + a.v.rota + ' visitas · digitado ' + brl(a.v.dig) : 'detalhe do lance não gravado')}</span>", 'b');
  return s;
});
// o aviso do servidor nao usa como "detalhe" a sigla da filial que o navegador gravou no lugar da prova (3 letras)
ed('public/animacoes/tv-animacoes.js', (s) => tr(s, "txt: r.obs || '', subtipo:", "txt: (r.obs && String(r.obs).length > 3) ? r.obs : '', subtipo:", 'tv'));
console.log('tudo ok');
