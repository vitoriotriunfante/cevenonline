const fs = require('fs');
const rel = 'scratch/build_brasileirao_dataset.py';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); s = s.replace(de, () => para); };

// 1) canal de cada vendedor (VAREJO ou AS), vindo da Gestao de Equipe
tr("                'nome': item['nome'], 'filial': fil_canonica, 'sup': item.get('supervisor', ''),\n                'gerente': item.get('gerente', '')\n            }",
   "                'nome': item['nome'], 'filial': fil_canonica, 'sup': item.get('supervisor', ''),\n                'gerente': item.get('gerente', ''),\n                # CANAL DA LIGA (Vitorio, 07/10/2026): AS (Autosservico) joga por SEMANA e tem tabelas proprias; todo o resto e VAREJO\n                'canal': 'AS' if str(item.get('canal', '')).upper() == 'AS' else 'VAREJO'\n            }", 'canal');
tr("        'rca': rca, 'nome': meta['nome'], 'filial': fil, 'supervisor': meta['sup'], 'gerente': meta['gerente'],\n", "        'rca': rca, 'nome': meta['nome'], 'filial': fil, 'supervisor': meta['sup'], 'gerente': meta['gerente'], 'canal': meta['canal'],\n", 'reg');

// 2) posicoes dentro de cada canal
tr("for idx, v in enumerate(vendedores_lista):\n    v['pos_brasil'] = idx + 1\nfor fil in FILIAIS_VALIDAS:\n    fil_vends = [v for v in vendedores_lista if v['filial'] == fil]\n    fil_vends.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg'], x['gp']), reverse=True)\n    for idx, v in enumerate(fil_vends):\n        v['pos_filial'] = idx + 1\n",
"# Posicao DENTRO do canal (Varejo e AS tem tabelas separadas). A tabela do AS e a semanal (bloco 'as' abaixo); aqui AS guarda so a posicao diaria de referencia.\nfor _canal in ('VAREJO', 'AS'):\n    _lista = [v for v in vendedores_lista if v['canal'] == _canal]\n    for idx, v in enumerate(_lista):\n        v['pos_brasil'] = idx + 1\n    for fil in FILIAIS_VALIDAS:\n        fil_vends = [v for v in _lista if v['filial'] == fil]\n        fil_vends.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg'], x['gp']), reverse=True)\n        for idx, v in enumerate(fil_vends):\n            v['pos_filial'] = idx + 1\n", 'pos');

// 3) supervisores por canal
tr("sups_set = set((v['filial'], v['supervisor']) for v in vendedores_lista if v['supervisor'] and eh_supervisor_de_verdade(v['supervisor']))\nfor fil, s in sups_set:\n    vends = [v for v in vendedores_lista if v['filial'] == fil and v['supervisor'] == s]\n",
    "sups_set = set((v['filial'], v['supervisor'], v['canal']) for v in vendedores_lista if v['supervisor'] and eh_supervisor_de_verdade(v['supervisor']))\nfor fil, s, canal_s in sorted(sups_set):\n    vends = [v for v in vendedores_lista if v['filial'] == fil and v['supervisor'] == s and v['canal'] == canal_s]\n", 'supset');
tr("        'supervisor': s, 'filial': fil, 'gerente': vends[0]['gerente'], 'total_vendedores': len(vends),\n", "        'supervisor': s, 'filial': fil, 'canal': canal_s, 'gerente': vends[0]['gerente'], 'total_vendedores': len(vends),\n", 'supreg');
tr("for idx, s in enumerate(sups_tabela):\n    s['pos'] = idx + 1\n", "_pos_canal = {}\nfor s in sups_tabela:\n    _pos_canal[s['canal']] = _pos_canal.get(s['canal'], 0) + 1\n    s['pos'] = _pos_canal[s['canal']]  # posicao dentro do canal\n", 'suppos');

// 4) bloco AS (semanal): lances por semana + faseamento (vem do /api/liga-as)
tr("# Exportar JSON Final\n", `# =====================================================================================================================
# LIGA AS (Autosservico) — SEMANAL (Vitorio e o Diretor, 07/10/2026). Semanas do mes: 1 (dias 1-7), 2 (8-14), 3 (15-20), 4 (21-fim).
# Pontos do vendedor AS = lances da semana + faseamento (20/40/60/110% = 10/20/30/40) + bonus (100% ate dia 15 = +50; ate dia 25 = +25).
# Supervisor AS = faseamento/bonus da EQUIPE somada (lances da equipe aparecem so como informacao). O faseamento vem de /api/liga-as (mesma regra, functions/_lib/liga_as.js).
# Lances de rotina DIARIA (amarelo das 10h, vermelho de abandono das 10h/11h) NAO valem no AS ate a regra propria do AS ser definida (AS visita um dia e vende em outro).
# =====================================================================================================================
AS_SEMANAS_FIM = [(1, 7), (2, 14), (3, 20), (4, 31)]
AS_LANCES_FORA = ('ven10', 'vis10', 'vis11')
def semana_as(dia_iso):
    d = int(dia_iso[8:10])
    for n, fim in AS_SEMANAS_FIM:
        if d <= fim:
            return n
    return 4
MES_AS = (datetime.now(timezone.utc) - timedelta(hours=3)).strftime('%Y-%m')
bloco_as = {'mes': MES_AS, 'vale_desde': INICIO_OFICIAL, 'semanas': [
    {'n': 1, 'de': 1, 'ate': 7}, {'n': 2, 'de': 8, 'ate': 14}, {'n': 3, 'de': 15, 'ate': 20}, {'n': 4, 'de': 21, 'ate': 31}]}
try:
    req = urllib.request.Request(f'https://ceven-cftv-matrix.pages.dev/api/liga-as?mes={MES_AS}', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        _api_as = json.loads(resp.read().decode('utf-8'))
    if 'vendedores' not in _api_as:
        raise RuntimeError(str(_api_as)[:160])
    bloco_as['regras'] = _api_as.get('regras')
    # pontos de lances por RCA e semana (so dias de rodada do mes de referencia)
    _lan_sem = {}
    for _rca, _dias in rca_dia_lances.items():
        for _d, _ls in _dias.items():
            if _d not in DIAS_RODADA or not _d.startswith(MES_AS):
                continue
            _n = semana_as(_d)
            for _l in _ls:
                _ch = str(_l.get('chave') or '')
                if any(('|' + t + '|') in ('|' + re.sub(r'^[A-Z]{3}\\|', '', _ch) + '|') for t in AS_LANCES_FORA):
                    continue
                _p = _l.get('pontos')
                if isinstance(_p, (int, float)):
                    _lan_sem.setdefault(_rca, {})[_n] = _lan_sem.setdefault(_rca, {}).get(_n, 0) + _p
    _vend_as = []
    for v in _api_as['vendedores']:
        _m = rca_map.get(str(v['rca']))
        if not _m or _m['canal'] != 'AS' or v['filial'] not in FILIAIS_VALIDAS:
            continue
        _sem = [{'n': n, 'pts_lances': _lan_sem.get(str(v['rca']), {}).get(n, 0)} for n in (1, 2, 3, 4)]
        _pl = sum(x['pts_lances'] for x in _sem)
        _vend_as.append({
            'rca': str(v['rca']), 'nome': v['nome'], 'filial': v['filial'], 'supervisor': _m['sup'], 'gerente': _m['gerente'],
            'meta_mes': v.get('meta_mes'), 'pct_hoje': v.get('pct_hoje'), 'fases': v.get('fases'), 'bonus': v.get('bonus'),
            'pts_faseamento': sum(f['ganhou'] for f in v.get('fases', [])), 'pts_bonus': sum(b['ganhou'] for b in v.get('bonus', [])),
            'semanas': _sem, 'pts_lances': _pl, 'pontos': _pl + v.get('pontos', 0)
        })
    _vend_as.sort(key=lambda x: (x['pontos'], x['pct_hoje'] if x['pct_hoje'] is not None else -999), reverse=True)
    for idx, v in enumerate(_vend_as):
        v['pos_brasil'] = idx + 1
    for fil in FILIAIS_VALIDAS:
        for idx, v in enumerate([x for x in _vend_as if x['filial'] == fil]):
            v['pos_filial'] = idx + 1
    _sup_as = []
    for sp in _api_as.get('supervisores', []):
        _eq = [v for v in _vend_as if v['filial'] == sp['filial'] and v['supervisor'] == sp['supervisor']]
        _sup_as.append({
            'supervisor': sp['supervisor'], 'filial': sp['filial'], 'gerente': (_eq[0]['gerente'] if _eq else ''), 'total_vendedores': sp['vendedores'], 'com_meta': sp['com_meta'],
            'meta_mes': sp.get('meta_mes'), 'pct_hoje': sp.get('pct_hoje'), 'fases': sp.get('fases'), 'bonus': sp.get('bonus'), 'pontos': sp.get('pontos', 0),
            'pts_lances_equipe': sum(v['pts_lances'] for v in _eq)
        })
    _sup_as.sort(key=lambda x: (x['pontos'], x['pct_hoje'] if x['pct_hoje'] is not None else -999), reverse=True)
    for idx, x in enumerate(_sup_as):
        x['pos'] = idx + 1
    bloco_as['vendedores'] = _vend_as
    bloco_as['supervisores'] = _sup_as
    print(f"Liga AS: {len(_vend_as)} vendedores e {len(_sup_as)} supervisores (mes {MES_AS})")
except Exception as _e:
    bloco_as['erro'] = str(_e)[:200]
    print('Aviso: nao consegui montar o bloco da Liga AS (as tabelas do AS ficam vazias):', _e)

# Exportar JSON Final
`, 'bloco');
tr("    'supervisores': sups_tabela,\n    'vendedores': vendedores_lista\n}", "    'supervisores': sups_tabela,\n    'vendedores': vendedores_lista,\n    'as': bloco_as\n}", 'saida');
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
