# ESTUDO COMPLETO: o que faz o vendedor de VAREJO vender melhor, e onde entra o +MIX (Vitorio, 20/10/2026: "refaca o estudo cruzando todas essas
# relacoes... veja se o mix tem correlacao direta com faturamento, positivacao, visitas, remuneracao... vendedor, regiao... para estimular o pessoal a
# usar mais a ferramenta"). So leitura. Roda no GitHub (analise-sob-demanda) com o banco de pedidos e o historico do +MIX do Drive.
# Uso: python scripts/estudo_mix_completo.py [AAAA-MM]
import sqlite3, json, sys, os, datetime, statistics as st, urllib.request, collections, time, math

MES = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().strftime('%Y-%m')
hoje = datetime.date.today()
ATE = (hoje - datetime.timedelta(days=1)).isoformat()
INI = MES + '-01'
ANTES = (datetime.date.fromisoformat(INI) - datetime.timedelta(days=90)).isoformat()
MES_ANT = (datetime.date.fromisoformat(INI) - datetime.timedelta(days=1)).strftime('%Y-%m')
VAREJO = {'VJ', 'FARMA', 'PET VJ', 'ESP'}
SITE, CEVEN = 'https://ceven-cftv-matrix.pages.dev', 'https://ceven.drivetriunfante-locomotiva.com.br'
SEC = os.environ.get('CEVEN_APP_SECRET', '')


def get(url, ceven=False, tent=4):
    h = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'}
    if ceven: h['X-App-Secret'] = SEC
    for t in range(tent):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(25); continue
            return None
        except Exception: time.sleep(3 * (t + 1))
    return None


def med(a): a = [x for x in a if x is not None]; return round(st.mean(a), 2) if a else None
def pear(a, b):
    p = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
    if len(p) < 8: return None
    xs, ys = zip(*p); mx, my = st.mean(xs), st.mean(ys)
    n = sum((x - mx) * (y - my) for x, y in p); d = math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    return round(n / d, 2) if d else None
def rank(v):
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0] * len(v)
    for k, i in enumerate(o): r[i] = k
    return r
def spear(a, b):
    p = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
    if len(p) < 8: return None
    xs, ys = zip(*p); return pear(rank(list(xs)), rank(list(ys)))
def ols(Y, X):   # minimos quadrados com variaveis padronizadas: devolve o peso (beta) de cada fator
    n = len(Y); k = len(X[0])
    z = lambda col: (lambda m, s: [(c - m) / s if s else 0 for c in col])(st.mean(col), st.pstdev(col))
    Xs = list(zip(*[z([r[j] for r in X]) for j in range(k)])); Ys = z(Y)
    A = [[sum(Xs[i][a] * Xs[i][b] for i in range(n)) for b in range(k)] + [sum(Xs[i][a] * Ys[i] for i in range(n))] for a in range(k)]
    for c in range(k):
        p = max(range(c, k), key=lambda r: abs(A[r][c])); A[c], A[p] = A[p], A[c]
        for r in range(k):
            if r != c and A[c][c]:
                f = A[r][c] / A[c][c]; A[r] = [x - f * y for x, y in zip(A[r], A[c])]
    beta = [round(A[i][k] / A[i][i], 2) if A[i][i] else None for i in range(k)]
    pred = [sum(beta[j] * Xs[i][j] for j in range(k)) for i in range(n)]
    r2 = 1 - sum((Ys[i] - pred[i]) ** 2 for i in range(n)) / sum(y * y for y in Ys)
    return beta, round(r2, 2)

# ---------- equipe, metas, incentivo, liga ----------
eq = get(SITE + '/api/tv-mostra')
V = {}
for k, l in eq['filiais'].items():
    for v in l:
        if str(v.get('canal') or '').upper() in VAREJO: V[(k.split('_')[0].upper(), str(v['rca']))] = {'filial': k.split('_')[0].upper(), 'rca': str(v['rca']), 'nome': v['nome'], 'sup': v.get('supervisor') or '', 'canal': str(v.get('canal')).upper()}
for f in sorted({k[0] for k in V}):
    sn = get(f'{SITE}/api/central-snapshot?filial={f}') or {}
    for r, x in (sn.get('rcas') or {}).items():
        d = (x or {}).get('dashboard') or {}; fin = d.get('financeiro') or {}; pos = d.get('positivacao') or {}
        if (f, r) in V and fin:
            V[(f, r)].update(meta=fin.get('meta') or 0, fatpend=(fin.get('faturado') or 0) + (fin.get('pendente') or 0), pmeta=pos.get('meta') or 0, preal=pos.get('realizado') or 0)
inc = get(SITE + '/api/incentivo-outubro') or {}
for x in inc.get('vendedores') or []:
    k = (str(x.get('filial')).upper(), str(x.get('rca')))
    if k in V: V[k].update(premio=2 if x.get('g2') else 1 if x.get('g1') else 0)
liga = get('https://raw.githubusercontent.com/vitoriotriunfante/cevenonline/main/public/dados_brasileirao.json') or {}
for x in liga.get('vendedores') or []:
    k = (str(x.get('filial')).upper(), str(x.get('rca')))
    if k in V: V[k].update(liga_pts=x.get('pts_tabela'), liga_aprov=x.get('aprov'))

# ---------- pedidos ----------
db = sqlite3.connect('analises/pedidos_historico_ceven.db')
cli = {}
for f, c, r, cnpj, d, p, cod, val in db.execute("""SELECT ph.filial_sigla, ph.id_cliente, CAST(ph.rca_id AS TEXT), replace(replace(replace(ph.cnpj_cliente,'.',''),'/',''),'-',''),
    substr(ph.data_pedido,1,10), ph.num_pedido, i.codprod, i.valor_total FROM pedidos_historico ph JOIN pedidos_historico_itens i ON i.chave_pedido = ph.chave
    WHERE i.tipo_registro='VENDA' AND i.codprod NOT IN ('','12229') AND substr(ph.data_pedido,1,10) BETWEEN ? AND ?""", (ANTES, ATE)):
    o = cli.setdefault((f, str(c)), {'rca': None, 'cnpj': cnpj, 'mes': set(), 'antes': set(), 'q1': set(), 'q2': set(), 'peds': {}, 'valor': 0.0, 'ant': False})
    cod = str(cod)
    if d >= INI:
        o['rca'] = r; o['mes'].add(cod); o['peds'][p] = o['peds'].get(p, 0) + (val or 0); o['valor'] += val or 0
        (o['q1'] if int(d[8:10]) <= 15 else o['q2']).add(p)
    else:
        o['antes'].add(cod)
        if d[:7] == MES_ANT: o['ant'] = True

# ---------- +MIX (mesma regra da tela: produtos das industrias com oportunidade + produtos de maior aderencia) ----------
rec = {}
h = sqlite3.connect('analises/mix_gap_hist.db')
for f, cnpj, resp in h.execute('SELECT filial, cnpj, resposta_json FROM mix_gap WHERE dia = (SELECT MAX(dia) FROM mix_gap)'):
    g = json.loads(resp); s = set()
    for ind in g.get('industrias_gap') or []:
        for p in ind.get('produtos') or []: s.add(str(p['codprod']))
    for p in g.get('produtos_top') or []: s.add(str(p['codprod']))
    rec[(f, cnpj)] = s

# ---------- visitas do mes (roteiro do mes, CEVEN) ----------
alvos = sorted(V)
t0 = time.time()
for i, k in enumerate(alvos):
    alvo = t0 + i * 0.8
    if time.time() < alvo: time.sleep(alvo - time.time())
    rm = get(f'{CEVEN}/api/rca/roteiro-mes?filial={k[0].lower()}1&id={k[1]}', ceven=True)
    if not isinstance(rm, list): continue
    L = [x for x in rm if str(x.get('data_visita') or '') <= ATE and str(x.get('data_visita') or '') >= INI]
    V[k].update(carteira=len({x.get('cnpj') for x in rm if x.get('cnpj')}), programadas=len(L),
                visitas=sum(1 for x in L if x.get('checkin_horario')), visitas_venda=sum(1 for x in L if x.get('status') in ('POSITIVADO', 'EFETIVADO')))

# ---------- metricas por vendedor ----------
porv = collections.defaultdict(list)
for (f, c), o in cli.items():
    if o['rca'] and (f, o['rca']) in V: porv[(f, o['rca'])].append(o)
linhas = []
for k, L in porv.items():
    v = V[k]
    if len(L) < 5: continue
    peds = [x for o in L for x in o['peds'].values()]
    usou = [o for o in L if (k[0], o['cnpj']) in rec and ((o['mes'] - o['antes']) & rec[(k[0], o['cnpj'])])]
    comrec = [o for o in L if (k[0], o['cnpj']) in rec]
    fat = sum(o['valor'] for o in L)
    linhas.append({**{x: v.get(x) for x in ('filial', 'rca', 'nome', 'sup', 'canal')},
        'clientes': len(L), 'carteira': v.get('carteira'), 'cobertura_pct': round(100 * len(L) / v['carteira'], 1) if v.get('carteira') else None,
        'visitas': v.get('visitas'), 'visitas_venda': v.get('visitas_venda'), 'conversao_visita_pct': round(100 * v['visitas_venda'] / v['visitas'], 1) if v.get('visitas') else None,
        'pedidos': len(peds), 'mix_cliente': med([len(o['mes']) for o in L]), 'skus_pedido': None, 'novos_cliente': med([len(o['mes'] - o['antes']) for o in L]),
        'faturado': round(fat), 'rs_cliente': round(fat / len(L)), 'ticket': round(st.mean(peds)) if peds else None, 'rs_visita': round(fat / v['visitas']) if v.get('visitas') else None,
        'dobradinha_pct': round(100 * sum(1 for o in L if o['q1'] and o['q2']) / len(L), 1), 'fidelizacao_pct': round(100 * sum(1 for o in L if o['ant']) / len(L), 1),
        'uso_mix_pct': round(100 * len(usou) / len(comrec), 1) if comrec else None,
        'pct_meta_fat': round(100 * v['fatpend'] / v['meta'], 1) if v.get('meta') else None, 'pct_meta_pos': round(100 * v['preal'] / v['pmeta'], 1) if v.get('pmeta') else None,
        'premio': v.get('premio'), 'liga_pts': v.get('liga_pts')})
print(f'MES {MES} ate {ATE} | vendedores de varejo analisados: {len(linhas)} | com visitas lidas: {sum(1 for x in linhas if x["visitas"])}')

VARS = ['clientes', 'cobertura_pct', 'visitas', 'conversao_visita_pct', 'pedidos', 'mix_cliente', 'novos_cliente', 'faturado', 'rs_cliente', 'ticket', 'rs_visita',
        'dobradinha_pct', 'fidelizacao_pct', 'uso_mix_pct', 'pct_meta_fat', 'pct_meta_pos', 'premio', 'liga_pts']
col = lambda n: [x.get(n) for x in linhas]
print('\n=== 1) CORRELACAO (Spearman, -1 a 1; |r|>=0.3 forte) DE CADA FATOR COM OS RESULTADOS ===')
RES = ['faturado', 'pct_meta_fat', 'pct_meta_pos', 'premio', 'liga_pts', 'rs_cliente']
print('fator'.ljust(22), ' '.join(r[:12].rjust(12) for r in RES))
for a in VARS:
    if a in RES: continue
    print(a.ljust(22), ' '.join(str(spear(col(a), col(r))).rjust(12) for r in RES))
print('\nresultados entre si:')
for i, a in enumerate(RES):
    for b in RES[i + 1:]: print(f'  {a} x {b}: {spear(col(a), col(b))}')

print('\n=== 2) O MIX: correlacao do mix por cliente com tudo ===')
for b in VARS:
    if b != 'mix_cliente': print(f'  mix_cliente x {b}: pearson {pear(col("mix_cliente"), col(b))} | spearman {spear(col("mix_cliente"), col(b))}')

print('\n=== 3) PESO DE CADA FATOR NO FATURADO DO VENDEDOR (regressao padronizada) ===')
ok = [x for x in linhas if all(x.get(n) is not None for n in ('clientes', 'mix_cliente', 'ticket', 'visitas', 'conversao_visita_pct'))]
for fat_k, fatores in [('faturado', ['clientes', 'mix_cliente']), ('faturado', ['clientes', 'mix_cliente', 'visitas', 'conversao_visita_pct']), ('rs_cliente', ['mix_cliente', 'dobradinha_pct', 'novos_cliente'])]:
    b, r2 = ols([x[fat_k] for x in ok], [[x[n] for n in fatores] for x in ok])
    print(f'  {fat_k} ~ {", ".join(f"{n} {w}" for n, w in zip(fatores, b))} | explica {round(r2 * 100)}% da variacao (n={len(ok)})')

print('\n=== 4) QUADRANTES: COBERTURA (clientes positivados) x MIX POR CLIENTE (corte = mediana) ===')
mc, mm = st.median(col('clientes')), st.median(col('mix_cliente'))
Q = collections.defaultdict(list)
for x in linhas: Q[('MUITOS clientes' if x['clientes'] >= mc else 'POUCOS clientes') + ' + ' + ('MUITO mix' if x['mix_cliente'] >= mm else 'POUCO mix')].append(x)
print(f'(corte: {mc} clientes, {mm} produtos por cliente)')
print('quadrante | vendedores | ' + ' | '.join(['clientes', 'mix_cliente', 'faturado', 'rs_cliente', 'pct_meta_fat', 'pct_meta_pos', 'premio>0 %', 'liga_pts', 'uso_mix_pct', 'dobradinha_pct', 'conversao_visita_pct']))
for q in sorted(Q):
    L = Q[q]
    print(q, '|', len(L), '|', med([x['clientes'] for x in L]), '|', med([x['mix_cliente'] for x in L]), '|', med([x['faturado'] for x in L]), '|', med([x['rs_cliente'] for x in L]), '|',
          med([x['pct_meta_fat'] for x in L]), '|', med([x['pct_meta_pos'] for x in L]), '|', round(100 * sum(1 for x in L if (x['premio'] or 0) > 0) / len(L)), '|', med([x['liga_pts'] for x in L]), '|',
          med([x['uso_mix_pct'] for x in L]), '|', med([x['dobradinha_pct'] for x in L]), '|', med([x['conversao_visita_pct'] for x in L]))
print('\n  dentro de cada quadrante: quem usa MAIS o +MIX (acima da mediana do quadrante) x quem usa MENOS')
for q in sorted(Q):
    L = [x for x in Q[q] if x['uso_mix_pct'] is not None]
    if len(L) < 8: continue
    mu = st.median([x['uso_mix_pct'] for x in L]); A = [x for x in L if x['uso_mix_pct'] > mu]; B = [x for x in L if x['uso_mix_pct'] <= mu]
    print(f'  {q}: usa mais ({len(A)}) x usa menos ({len(B)}) | mix {med([x["mix_cliente"] for x in A])} x {med([x["mix_cliente"] for x in B])} | R$/cliente {med([x["rs_cliente"] for x in A])} x {med([x["rs_cliente"] for x in B])} | clientes {med([x["clientes"] for x in A])} x {med([x["clientes"] for x in B])} | %meta fat {med([x["pct_meta_fat"] for x in A])} x {med([x["pct_meta_fat"] for x in B])} | %meta pos {med([x["pct_meta_pos"] for x in A])} x {med([x["pct_meta_pos"] for x in B])}')

print('\n=== 5) POR FILIAL (regiao) ===')
print('filial | vend | clientes | mix | R$/cliente | uso +MIX | %meta fat | %meta pos | corr uso x mix (dentro da filial)')
for f in sorted({x['filial'] for x in linhas}):
    L = [x for x in linhas if x['filial'] == f]
    print(f, '|', len(L), '|', med([x['clientes'] for x in L]), '|', med([x['mix_cliente'] for x in L]), '|', med([x['rs_cliente'] for x in L]), '|', med([x['uso_mix_pct'] for x in L]), '|',
          med([x['pct_meta_fat'] for x in L]), '|', med([x['pct_meta_pos'] for x in L]), '|', spear([x['uso_mix_pct'] for x in L], [x['mix_cliente'] for x in L]))

print('\n=== 6) POR SUPERVISOR (min. 4 vendedores) ===')
S = collections.defaultdict(list)
for x in linhas: S[(x['filial'], x['sup'])].append(x)
ss = sorted([(k, L) for k, L in S.items() if len(L) >= 4], key=lambda kv: -(med([x['uso_mix_pct'] for x in kv[1]]) or 0))
for (f, s), L in ss:
    print(f'{f} | {s} | vend {len(L)} | uso +MIX {med([x["uso_mix_pct"] for x in L])} | mix {med([x["mix_cliente"] for x in L])} | clientes {med([x["clientes"] for x in L])} | R$/cliente {med([x["rs_cliente"] for x in L])} | %meta fat {med([x["pct_meta_fat"] for x in L])} | %meta pos {med([x["pct_meta_pos"] for x in L])}')

print('\n=== 7) VENDEDORES-EXEMPLO: muitos clientes + muito mix + uso alto do +MIX (top 15 por faturado) ===')
for x in sorted([x for x in linhas if x['clientes'] >= mc and x['mix_cliente'] >= mm and (x['uso_mix_pct'] or 0) >= 15], key=lambda x: -x['faturado'])[:15]:
    print(f"{x['filial']} {x['rca']} {x['nome']} | clientes {x['clientes']} | mix {x['mix_cliente']} | uso +MIX {x['uso_mix_pct']}% | R$ {x['faturado']} | %meta fat {x['pct_meta_fat']} | %meta pos {x['pct_meta_pos']} | premio {x['premio']}")
