const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
// GRUPOS DE NEGOCIO (Vitório, 22/09/2026, ver pipeline/ceven_unified_engine.js): Varejo = VJ + FARMA + PET VJ + ESP · AS = AS + PET AS · fora de ambos: SUP, GER, NULO

ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "const minSuper = v.canal === 'AS' ? 75000 : 15000;", "const minSuper = ['AS', 'PET AS'].includes(v.canal) ? 75000 : 15000;", 'a');
  s = tr(s, "(canalMapa.get(String(codigo)) || {}).canal === 'AS' ? '&canal=AS' : ''", "['AS', 'PET AS'].includes((canalMapa.get(String(codigo)) || {}).canal) ? '&canal=AS' : ''", 'b');
  return s;
});
ed('functions/api/liga-as.js', (s) => tr(s, "String(v.canal || '').toUpperCase() === 'AS' && v.mostra !== false", "['AS', 'PET AS'].includes(String(v.canal || '').toUpperCase()) && v.mostra !== false", 'las'));
ed('public/tvapp.html', (s) => {
  s = tr(s, "(r.canal || '').toUpperCase() === 'AS' ? '&canal=AS' : ''", "['AS', 'PET AS'].includes((r.canal || '').toUpperCase()) ? '&canal=AS' : ''", 'a');
  s = tr(s, "(v.canal === 'AS' ? 75000 : 15000)", "(['AS', 'PET AS'].includes(v.canal) ? 75000 : 15000)", 'b');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, "(r.canal || '').toUpperCase() === 'AS' ? '&canal=AS' : ''", "['AS', 'PET AS'].includes((r.canal || '').toUpperCase()) ? '&canal=AS' : ''", 'a');
  s = tr(s, "(v.canal === 'AS' ? 75000 : 15000)", "(['AS', 'PET AS'].includes(v.canal) ? 75000 : 15000)", 'b');
  return s;
});
// gerador: AS = AS + PET AS; SUP e GER (contas de supervisor/gerente) ficam fora da liga
ed('scratch/build_brasileirao_dataset.py', (s) => {
  s = tr(s, "            if item.get('mostra') is False:\n                ocultos_fora += 1\n                continue\n", "            if item.get('mostra') is False:\n                ocultos_fora += 1\n                continue\n            # contas de SUPERVISOR e de GERENTE (canal real do CEVEN = SUP/GER) nao sao vendedores: ficam fora da liga (grupos de negocio de 22/09/2026)\n            if str(item.get('canal', '')).upper() in ('SUP', 'GER'):\n                ocultos_fora += 1\n                continue\n", 'sup');
  s = tr(s, "'canal': 'AS' if str(item.get('canal', '')).upper() == 'AS' else 'VAREJO'", "'canal': 'AS' if str(item.get('canal', '')).upper() in ('AS', 'PET AS') else 'VAREJO'", 'can');
  return s;
});
ed('testes/t_canal.mjs', (s) => tr(s, "g.includes(\"'canal': 'AS' if str(item.get('canal', '')).upper() == 'AS' else 'VAREJO'\")", "g.includes(\"'canal': 'AS' if str(item.get('canal', '')).upper() in ('AS', 'PET AS') else 'VAREJO'\")", 'tt'));
ed('testes/t_canal_ceven.mjs', (s) => s.split("v.canal === 'AS' ? 75000 : 15000").join("['AS', 'PET AS'].includes(v.canal) ? 75000 : 15000"));
console.log('tudo ok');
