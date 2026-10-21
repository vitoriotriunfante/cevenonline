# ANTES E DEPOIS DO MESMO CLIENTE (Vitorio, 21/10/2026: "o que mais podemos ver para embasar ou refutar a tese?")
# Pergunta: o cliente que comprou um produto NOVO que estava no +MIX passou a comprar mais nos pedidos SEGUINTES?
# Tratado  = cliente que, em outubro, comprou um produto da recomendacao do +MIX que ele nao comprava nos 60 dias anteriores (data do evento = esse pedido).
# Controle = cliente do MESMO vendedor e do MESMO tipo, que tinha recomendacao do +MIX e nao comprou nada dela em outubro;
#            recebe como "data do evento" a data mediana dos eventos do vendedor dele (para comparar o mesmo periodo).
# Medida   = media por pedido (R$ e produtos) e pedidos por 30 dias, nos 60 dias ANTES do evento x DEPOIS do evento (sem o pedido do evento).
#            Ganho real do +MIX = (depois - antes dos tratados) - (depois - antes dos controles), comparando sempre dentro do mesmo vendedor e tipo.
# Ressalva: a recomendacao gravada e a de 20/10 em diante (o CEVEN nao guarda a de antes); o produto comprado pode ter saido da lista depois da compra.
# So leitura. Uso: python3 scripts/estudo_mix_antes_depois.py [AAAA-MM]
import sqlite3, json, collections, datetime as dt, statistics as st, sys, os

MES = sys.argv[1] if len(sys.argv) > 1 else dt.date.today().strftime('%Y-%m')
INI = MES + '-01'
# pedidos com data no futuro existem no banco (ex.: 18/12): so vale ate ontem
ONTEM = (dt.date.today() - dt.timedelta(days=1)).isoformat()
ANTES_DE = (dt.date.fromisoformat(INI) - dt.timedelta(days=90)).isoformat()
db = sqlite3.connect('analises/pedidos_historico_ceven.db')
h = sqlite3.connect('analises/mix_gap_hist.db')
so = lambda x: ''.join(ch for ch in str(x or '') if ch.isdigit())
try:
    TIPO = json.load(open('analises/atividade_por_cnpj.json', encoding='utf-8'))['cnpj']
except Exception:
    TIPO = {}

# recomendacao do +MIX por cliente: uniao de todos os dias gravados
rec = collections.defaultdict(set)
for f, cnpj, resp in h.execute('SELECT filial, cnpj, resposta_json FROM mix_gap'):
    try:
        g = json.loads(resp)
    except Exception:
        continue
    for i in g.get('industrias_gap') or []:
        for p in i.get('produtos') or []:
            rec[(f, cnpj)].add(str(p['codprod']))
    for p in g.get('produtos_top') or []:
        rec[(f, cnpj)].add(str(p['codprod']))
print(f'MES {MES} | clientes com recomendacao do +MIX gravada: {len(rec)}')

# pedidos de cada cliente: data, valor, produtos
ped = collections.defaultdict(lambda: collections.defaultdict(lambda: {'d': '', 'v': 0.0, 'p': set(), 'rca': ''}))
for f, rca, cnpj, d, num, cod, v in db.execute("""SELECT ph.filial_sigla, CAST(ph.rca_id AS TEXT), ph.cnpj_cliente, substr(ph.data_pedido,1,10), ph.num_pedido, i.codprod, i.valor_total
    FROM pedidos_historico ph JOIN pedidos_historico_itens i ON i.chave_pedido = ph.chave
    WHERE i.tipo_registro = 'VENDA' AND i.codprod <> '12229' AND substr(ph.data_pedido,1,10) >= ? AND substr(ph.data_pedido,1,10) <= ?""", (ANTES_DE, ONTEM)):
    k = (f, so(cnpj)); o = ped[k][num]; o['d'] = d; o['v'] += float(v or 0); o['p'].add(str(cod))
    if d >= INI: o['rca'] = rca
hoje = max(o['d'] for c in ped.values() for o in c.values())
print('pedidos ate', hoje)

def metr(L, dias):
    if not L:
        return None
    return {'rs': sum(o['v'] for o in L) / len(L), 'it': sum(len(o['p']) for o in L) / len(L), 'freq': len(L) / max(dias, 1) * 30}

cli = []   # {k, rca, tipo, evento, pedidos}
for k, P in ped.items():
    if k not in rec:
        continue
    L = sorted(P.values(), key=lambda o: o['d'])
    rcas = [o['rca'] for o in L if o['rca']]
    if not rcas:
        continue
    ev = None
    for o in L:
        if o['d'] < INI:
            continue
        lim = (dt.date.fromisoformat(o['d']) - dt.timedelta(days=60)).isoformat()
        antes = set().union(*[x['p'] for x in L if lim <= x['d'] < o['d']]) if any(lim <= x['d'] < o['d'] for x in L) else set()
        novos = (o['p'] - antes) & rec[k]
        if novos:
            ev = o; break
    cli.append({'k': k, 'rca': collections.Counter(rcas).most_common(1)[0][0], 'tipo': TIPO.get(k[1], 'sem cadastro'), 'ev': ev, 'L': L})

# data do evento do controle: mediana dos eventos do mesmo vendedor
evV = collections.defaultdict(list)
for c in cli:
    if c['ev']:
        evV[(c['k'][0], c['rca'])].append(c['ev']['d'])
linhas = []
for c in cli:
    if c['ev']:
        d = c['ev']['d']; trat = 1
    else:
        ds = sorted(evV.get((c['k'][0], c['rca']), []))
        if not ds:
            continue
        d = ds[len(ds) // 2]; trat = 0
    ini = (dt.date.fromisoformat(d) - dt.timedelta(days=60)).isoformat()
    A = [o for o in c['L'] if ini <= o['d'] < d]
    B = [o for o in c['L'] if o['d'] > d]
    dA = 60; dB = (dt.date.fromisoformat(hoje) - dt.date.fromisoformat(d)).days
    if not A or dB < 3:
        continue
    a = metr(A, dA); b = metr(B, dB) or {'rs': None, 'it': None, 'freq': 0.0}
    linhas.append({'trat': trat, 'g': (c['k'][0], c['rca'], c['tipo']), 'tipo': c['tipo'], 'a': a, 'b': b, 'voltou': 1 if B else 0})

def resumo(L, nome):
    T = [x for x in L if x['trat']]; C = [x for x in L if not x['trat']]
    if len(T) < 5 or len(C) < 5:
        return
    def m(X, per, k):
        v = [x[per][k] for x in X if x[per][k] is not None]
        return st.mean(v) if v else None
    vT = [x for x in T if x['voltou']]; vC = [x for x in C if x['voltou']]
    print(f'\n== {nome} ==  tratados {len(T)} | controles {len(C)}')
    print(f'  voltou a comprar depois do evento: tratados {100*len(vT)/len(T):.1f}% | controles {100*len(vC)/len(C):.1f}%')
    print(f'  pedidos por 30 dias: tratados {m(T,"a","freq"):.2f} -> {m(T,"b","freq"):.2f} | controles {m(C,"a","freq"):.2f} -> {m(C,"b","freq"):.2f}')
    for k, rot in (('rs', 'R$ por pedido'), ('it', 'produtos por pedido')):
        ta, tb, ca, cb = m(vT, 'a', k), m(vT, 'b', k), m(vC, 'a', k), m(vC, 'b', k)
        if None in (ta, tb, ca, cb):
            continue
        print(f'  {rot} (so quem voltou): tratados {ta:.1f} -> {tb:.1f} ({100*(tb-ta)/ta:+.1f}%) | controles {ca:.1f} -> {cb:.1f} ({100*(cb-ca)/ca:+.1f}%) | ganho do +MIX {100*((tb-ta)/ta-(cb-ca)/ca):+.1f} p.p.')

resumo(linhas, 'TODOS')
# comparacao justa: so grupos (vendedor + tipo) que tem tratado E controle
gs = collections.defaultdict(lambda: [0, 0])
for x in linhas:
    gs[x['g']][x['trat']] += 1
ok = {g for g, (c, t) in gs.items() if c and t}
resumo([x for x in linhas if x['g'] in ok], 'MESMO VENDEDOR E MESMO TIPO DE CLIENTE')
for t in sorted({x['tipo'] for x in linhas}):
    resumo([x for x in linhas if x['g'] in ok and x['tipo'] == t], 'tipo: ' + t)

# O PRODUTO DO +MIX FICOU? tratados que voltaram: recompraram o produto novo depois?
fic = tot = 0
for c in cli:
    if not c['ev']:
        continue
    d = c['ev']['d']; lim = (dt.date.fromisoformat(d) - dt.timedelta(days=60)).isoformat()
    antes = set().union(*[x['p'] for x in c['L'] if lim <= x['d'] < d]) if any(lim <= x['d'] < d for x in c['L']) else set()
    novos = (c['ev']['p'] - antes) & rec[c['k']]
    dep = [o for o in c['L'] if o['d'] > d]
    if not dep:
        continue
    tot += 1
    if novos & set().union(*[o['p'] for o in dep]):
        fic += 1
if tot:
    print(f'\nO PRODUTO DO +MIX FICOU? dos {tot} clientes que compraram de novo depois, {fic} ({100*fic/tot:.1f}%) levaram de novo o produto novo do +MIX')
