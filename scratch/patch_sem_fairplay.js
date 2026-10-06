const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

ed('scratch/build_brasileirao_dataset.py', (s) => {
  s = tr(s, "#   Zero devolucoes na equipe no dia (Fair Play) ........................................... +5\n", '', 'c1');
  s = tr(s, "PLUS_PONTOS = {'compromisso': 5, 'ret': 5, 'fair_play': 5}", "PLUS_PONTOS = {'compromisso': 5, 'ret': 5}", 'p1');
  s = tr(s, ", 'fair_play': _cfg_plus['zero_devolucoes_equipe_no_dia']['pontos']}", "}", 'p2');
  s = tr(s, "    dev = PLUS_INPUTS.get('devolucoes') or {}\n    dev_ate = dev.get('ate') if dev.get('disponivel') else None\n", '', 'dev');
  s = tr(s, "        if dev_ate and dev_ate >= d:\n            fair = 0 if dev.get('porSupDia', {}).get(f\"{fil}|{_norm_nome(nome)}|{d}\") else PLUS_PONTOS['fair_play']\n        else:\n            fair = None  # banco de devolucoes ainda nao cobre o dia: nao da nem tira\n            pendente = True\n        detalhe[d] = {'compromisso': comp, 'ret': ret, 'fair_play': fair}\n        total += comp + ret + (fair or 0)\n",
    "        detalhe[d] = {'compromisso': comp, 'ret': ret}\n        total += comp + ret\n", 'loop');
  return s;
});
ed('public/brasileirao.html', (s) => tr(s, 'Compromisso até 10h +5, RET +5, Fair Play +5 (zero devoluções da equipe no dia))', 'Compromisso até 10h +5, RET +5)', 'sub'));
ed('public/apresentacao-diretoria.html', (s) => { s = tr(s, '<br>\n          🛡️ <strong>Zero Devoluções na Equipe no Dia:</strong> +5 pts bônus Fair Play\n', '\n', 'ap'); return s; });
ed('testes/rodar_testes.mjs', (s) => {
  s = tr(s, " && c.zero_devolucoes_equipe_no_dia.pontos === 5", " && !c.zero_devolucoes_equipe_no_dia", 't1');
  s = tr(s, "+5 RET (recomendado), +5 zero devolucoes, sem destravamento", "+5 RET (recomendado), sem Fair Play, sem destravamento", 't2');
  s = tr(s, "+15 compromisso (ate 10:00), +25 RET, +30 Fair Play, sem punicao", "+5 compromisso (ate 10:00), +5 RET, sem punicao", 't3');
  return s;
});
ed('testes/t_plus.py', (s) => {
  s = tr(s, "== {'compromisso': 5, 'ret': 5, 'fair_play': 5}, 'pontos do Plus vem da config: +5 compromisso, +5 RET, +5 Fair Play'", "== {'compromisso': 5, 'ret': 5}, 'pontos do Plus vem da config: +5 compromisso, +5 RET (sem Fair Play)'", 'a');
  s = tr(s, "ok(total == 45, f'soma do Plus em 5 dias = 45 (15+5+5+15+5), achou {total}')", "ok(total == 30, f'soma do Plus em 5 dias = 30 (10+5+0+10+5), achou {total}')", 'b');
  s = tr(s, "ok(det['2026-09-29'] == {'compromisso': 5, 'ret': 0, 'fair_play': 0}, 'dia com devolucao: Fair Play = 0 (sem punicao)')", "ok(det['2026-09-29'] == {'compromisso': 5, 'ret': 0}, 'devolucao nao interfere no Plus (Fair Play retirado)')", 'c');
  s = tr(s, "ok(det['2026-10-02']['fair_play'] is None and pend is True, 'dia que o banco de devolucoes ainda nao cobre fica PENDENTE (nao da nem tira)')", "ok(pend is False, 'sem Fair Play nao ha mais dia pendente')", 'd');
  s = tr(s, "for v in d.values() if v is not None)", "for v in d.values() if v is not None)", 'e');
  return s;
});
console.log('tudo ok');
