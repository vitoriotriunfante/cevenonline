# Analise sob demanda (Vitorio, 19/10/2026): mix de produtos x Dobradinha das Quinzenas (cliente que comprou na 1a e na 2a quinzena do mes).
# Uso: python scripts/analise_mix_quinzenas.py AAAA-MM [AAAA-MM-DD ate]. So leitura do banco de pedidos (pedidos_historico_ceven.db do Drive).
import sqlite3, statistics as st, math, collections, sys, datetime
MES = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().strftime('%Y-%m')
ATE = sys.argv[2] if len(sys.argv) > 2 else datetime.date.today().isoformat()
c = sqlite3.connect('analises/pedidos_historico_ceven.db')
# SO CLIENTES DE VENDEDORES DE VAREJO (Vitorio, 19/10/2026): canal da Gestao de Equipe (/api/tv-mostra): VJ, FARMA, PET VJ, ESP.
import json, urllib.request
_eq = json.load(urllib.request.urlopen(urllib.request.Request('https://ceven-cftv-matrix.pages.dev/api/tv-mostra', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60))
VAREJO = {(k.split('_')[0].upper(), str(v['rca'])) for k, lst in _eq['filiais'].items() for v in lst if str(v.get('canal') or '').upper() in ('VJ', 'FARMA', 'PET VJ', 'ESP')}
print('vendedores de varejo na Gestao de Equipe:', len(VAREJO))
rows = c.execute("""
SELECT ph.filial_sigla, ph.id_cliente, ph.rca_id, substr(ph.data_pedido,1,7) mes, CAST(substr(ph.data_pedido,9,2) AS INT) dia, ph.num_pedido,
       i.codprod, i.valor_total
FROM pedidos_historico ph JOIN pedidos_historico_itens i ON i.chave_pedido = ph.chave
WHERE substr(ph.data_pedido,1,7) = ? AND substr(ph.data_pedido,1,10) <= ? AND i.tipo_registro='VENDA' AND i.codprod <> 12229
""", (MES, ATE)).fetchall()
for d, n in sqlite3.connect('analises/pedidos_historico_ceven.db').execute("SELECT substr(data_pedido,1,10), COUNT(*) FROM pedidos_historico WHERE substr(data_pedido,1,7) = ? GROUP BY 1 ORDER BY 1", (MES,)).fetchall(): print('pedidos no dia', d, n)
print("mes", MES, "ate", ATE, "| linhas de item", len(rows), "| ultimo dia com pedido", max((r[3] + "-" + str(r[4]).zfill(2)) for r in rows) if rows else None)
cli = collections.defaultdict(lambda: {'q1': False, 'q2': False, 'skus': set(), 'ped': set(), 'skus_ped': collections.defaultdict(set), 'valor': 0.0})
for f, idc, rca, mes, dia, num, cod, val in rows:
    if (str(f).upper(), str(rca)) not in VAREJO: continue
    k = (f, idc, mes)
    x = cli[k]
    if dia <= 15: x['q1'] = True
    else: x['q2'] = True
    x['skus'].add(cod); x['ped'].add(num); x['skus_ped'][num].add(cod); x['valor'] += val or 0


def resumo(lst):
    mix = [len(x['skus']) for x in lst]
    ped = [len(x['ped']) for x in lst]
    mpp = [st.mean(len(s) for s in x['skus_ped'].values()) for x in lst]
    val = [x['valor'] for x in lst]
    return len(lst), st.mean(mix), st.median(mix), st.mean(ped), st.mean(mpp), st.mean(val)


print('mes | grupo | clientes | mix mes (media) | mix mes (mediana) | pedidos/mes | SKUs por pedido | R$/mes')
for mes in (MES,):
    xs = [v for k, v in cli.items() if mes == 'TODOS' or k[2] == mes]
    d = [x for x in xs if x['q1'] and x['q2']]
    o = [x for x in xs if not (x['q1'] and x['q2'])]
    for nome, g in (('DOBRADINHA', d), ('UMA QUINZENA', o)):
        n, mm, md, pm, mpp, v = resumo(g)
        print(f'{mes} | {nome} | {n} | {mm:.1f} | {md} | {pm:.2f} | {mpp:.1f} | {v:,.0f}')
# correlacao: % dobradinha por faixa de mix (mes)
xs = list(cli.values())
print('\nfaixa de mix no mes | clientes | % com dobradinha')
for a, b in ((1, 2), (3, 5), (6, 10), (11, 20), (21, 40), (41, 9999)):
    g = [x for x in xs if a <= len(x['skus']) <= b]
    if g: print(f'{a}-{b if b < 9999 else "+"} | {len(g)} | {100 * sum(1 for x in g if x["q1"] and x["q2"]) / len(g):.1f}%')
print('\nfaixa de SKUs POR PEDIDO | clientes | % com dobradinha')
for a, b in ((1, 2), (3, 4), (5, 7), (8, 12), (13, 9999)):
    g = [x for x in xs if a <= st.mean(len(s) for s in x['skus_ped'].values()) < b + 1]
    if g: print(f'{a}-{b if b < 9999 else "+"} | {len(g)} | {100 * sum(1 for x in g if x["q1"] and x["q2"]) / len(g):.1f}%')


def corr(a, b):
    ma, mb = st.mean(a), st.mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    return num / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))


dob = [1 if x['q1'] and x['q2'] else 0 for x in xs]
print('\ncorrelacao dobradinha x mix do mes:', round(corr(dob, [len(x['skus']) for x in xs]), 3))
print('correlacao dobradinha x SKUs por pedido:', round(corr(dob, [st.mean(len(s) for s in x['skus_ped'].values()) for x in xs]), 3))
print('correlacao dobradinha x numero de pedidos:', round(corr(dob, [len(x['ped']) for x in xs]), 3))
# mesmo numero de pedidos (2 pedidos no mes): dobradinha vs 2 pedidos na mesma quinzena
g2 = [x for x in xs if len(x['ped']) == 2]
d2 = [x for x in g2 if x['q1'] and x['q2']]; o2 = [x for x in g2 if not (x['q1'] and x['q2'])]
print('\nSO quem fez 2 pedidos no mes: dobradinha', len(d2), 'clientes, mix', round(st.mean(len(x['skus']) for x in d2), 1), 'R$', round(st.mean(x['valor'] for x in d2)),
      '| mesma quinzena', len(o2), 'clientes, mix', round(st.mean(len(x['skus']) for x in o2), 1), 'R$', round(st.mean(x['valor'] for x in o2)))
