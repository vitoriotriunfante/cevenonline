const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

ed('scratch/build_brasileirao_dataset.py', (s) => {
  s = tr(s, "DIAS_RODADA = sorted(d for d in DIAS_COM_LANCE if date.fromisoformat(d).weekday() < 5 and d not in FERIADOS_2026)\n",
"DIAS_RODADA = sorted(d for d in DIAS_COM_LANCE if date.fromisoformat(d).weekday() < 5 and d not in FERIADOS_2026)\n" +
"# LIGA OFICIAL (decisao do Vitorio, 06/10/2026): a liga que vale (remuneracao) comeca em 'vigente_desde' do regulamento (07/10/2026), ja com regras congeladas e dias fechados.\n" +
"# O que veio antes e PRE-TEMPORADA: aparece no ranking, mas marcado como 'nao vale remuneracao'. Assim que existir o primeiro dia oficial com lance, a tabela passa a contar so os dias oficiais.\n" +
"INICIO_OFICIAL = str(CONFIG_PONTOS.get('vigente_desde') or '2026-10-07')\n" +
"_oficiais = [d for d in DIAS_RODADA if d >= INICIO_OFICIAL]\n" +
"PRE_TEMPORADA = not _oficiais\n" +
"if _oficiais:\n" +
"    DIAS_RODADA = _oficiais\n" +
"print('Liga oficial desde', INICIO_OFICIAL, '| pre-temporada:', PRE_TEMPORADA)\n", 'dias');
  s = tr(s, "    'dias_rodada': DIAS_RODADA,\n", "    'dias_rodada': DIAS_RODADA,\n    'inicio_oficial': INICIO_OFICIAL,\n    'pre_temporada': PRE_TEMPORADA,\n", 'saida');
  return s;
});

ed('public/brasileirao.html', (s) => {
  s = tr(s, "<span class=\"live-pill\"><span class=\"dot\"></span> CADA DIA É UM JOGO</span>", "<span class=\"live-pill\"><span class=\"dot\"></span> CADA DIA É UM JOGO</span><span id=\"pillPre\" style=\"display:none;margin-left:8px;padding:3px 10px;border-radius:999px;background:#7c2d12;color:#fed7aa;font-weight:800;font-size:12px\" title=\"A liga oficial, com regras congeladas e dias fechados, começa em 07/10/2026. Até lá este ranking é só acompanhamento.\">PRÉ-TEMPORADA · não vale remuneração · liga oficial começa em 07/10/2026</span>", 'pill');
  return s;
});
console.log('tudo ok');
