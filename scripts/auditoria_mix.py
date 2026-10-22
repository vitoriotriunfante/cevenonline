# AUDITORIA DO +MIX CONTRA O PLANO (Vitorio, 22/10/2026: "diagnostico do +MIX, se esta ajustando de acordo com o plano, auditoria 10000%")
# O plano: (1) gravar TODO DIA a recomendacao do +MIX de cada cliente ANTES da visita (desde 20/10);
#          (2) o +MIX nao pode recomendar produto que o cliente comprou ha 7 a 60 dias (regra da recompra);
#          (3) medir o USO REAL: o cliente comprou, no dia/dias seguintes a gravacao, um produto novo que estava na lista gravada?
# So leitura. Uso: python3 scripts/auditoria_mix.py
import sqlite3, json, collections, datetime as dt, statistics as st

db = sqlite3.connect('analises/pedidos_historico_ceven.db')
h = sqlite3.connect('analises/mix_gap_hist.db')
so = lambda x: ''.join(c for c in str(x or '') if c.isdigit())
ONTEM = (dt.date.today() - dt.timedelta(days=1)).isoformat()
print('=' * 100)
print('AUDITORIA DO +MIX —', dt.date.today().isoformat())
print('=' * 100)

# ---------- 1. CAPTURA DIARIA ----------
print('\n1) CAPTURA DIARIA (o que esta gravado em mix_gap_hist.db)')
dias = [r for r in h.execute("SELECT dia, COUNT(*), COUNT(DISTINCT filial), COUNT(DISTINCT rca), SUM(CASE WHEN resposta_json LIKE '%\"disponivel\": true%' OR resposta_json LIKE '%\"disponivel\":true%' THEN 1 ELSE 0 END) FROM mix_gap GROUP BY dia ORDER BY dia")]
for d, n, nf, nr, disp in dias:
    print(f'   {d}: {n} clientes gravados | {nf} filiais | {nr} vendedores | resposta disponivel: {disp}')
cols = [c[1] for c in h.execute('PRAGMA table_info(mix_gap)')]
print('   colunas gravadas:', cols, '| hora da captura gravada?', 'SIM' if any('hora' in c or 'quando' in c for c in cols) else 'NAO (so o dia)')

# pedidos: por cliente, data e produtos (para os itens 2 e 3)
compras = collections.defaultdict(list)   # (filial, cnpj) -> [(data, num, set(cod))]
tmp = collections.defaultdict(lambda: {'d': '', 'p': set()})
for f, cnpj, d, num, cod in db.execute("""SELECT ph.filial_sigla, ph.cnpj_cliente, substr(ph.data_pedido,1,10), ph.num_pedido, i.codprod
    FROM pedidos_historico ph JOIN pedidos_historico_itens i ON i.chave_pedido = ph.chave
    WHERE i.tipo_registro = 'VENDA' AND i.codprod <> '12229' AND substr(ph.data_pedido,1,10) BETWEEN '2026-07-01' AND ?""", (ONTEM,)):
    k = (f, so(cnpj), num); tmp[k]['d'] = d; tmp[k]['p'].add(str(cod))
for (f, c, num), o in tmp.items():
    compras[(f, c)].append((o['d'], num, o['p']))
for k in compras:
    compras[k].sort()
print(f'   pedidos lidos ate {ONTEM}: {len(tmp)}')

def lista(resp):
    try:
        g = json.loads(resp)
    except Exception:
        return None, set(), set()
    ind = {str(p['codprod']) for i in g.get('industrias_gap') or [] for p in i.get('produtos') or []}
    top = {str(p['codprod']) for p in g.get('produtos_top') or []}
    return g, ind, top

# ---------- 2. REGRA DA RECOMPRA ----------
print('\n2) REGRA DA RECOMPRA: produtos que o +MIX recomendou e o cliente JA COMPRAVA (dias desde a ultima compra, contados do dia da gravacao)')
print('   regra: ate 6 dias = aceitavel (atraso do CEVEN) | 7 a 60 dias = ERRO (nao podia aparecer) | mais de 60 dias = correto recomendar')
erros_ex = []
for d, *_ in dias:
    faixa = collections.Counter(); tot = 0; cli_err = 0; cli = 0
    for f, cnpj, resp in h.execute('SELECT filial, cnpj, resposta_json FROM mix_gap WHERE dia = ?', (d,)):
        g, ind, top = lista(resp)
        if g is None or not g.get('disponivel'):
            continue
        cli += 1
        ult = {}
        for (dd, num, P) in compras.get((f, cnpj), []):
            if dd > d:
                break
            for c in P:
                ult[c] = dd
        teve = False
        for origem, S in (('industria', ind), ('regional', top)):
            for c in S:
                tot += 1
                if c not in ult:
                    faixa[origem + ' nunca/+60d ou nunca'] += 0
                    continue
                dias_ = (dt.date.fromisoformat(d) - dt.date.fromisoformat(ult[c])).days
                fx = 'ate 6' if dias_ <= 6 else '7 a 60' if dias_ <= 60 else '+60'
                faixa[(origem, fx)] += 1
                if fx == '7 a 60':
                    teve = True
                    if len(erros_ex) < 12:
                        erros_ex.append((d, f, cnpj, c, ult[c], dias_, origem))
        cli_err += teve
    def fx(o, x):
        return faixa[(o, x)]
    print(f'   {d}: {cli} clientes, {tot} recomendacoes | INDUSTRIA: ate6 {fx("industria","ate 6")} · 7-60 {fx("industria","7 a 60")} · +60 {fx("industria","+60")}'
          f' | REGIONAL: ate6 {fx("regional","ate 6")} · 7-60 {fx("regional","7 a 60")} · +60 {fx("regional","+60")} | clientes com algum erro 7-60: {cli_err} ({100*cli_err/max(cli,1):.1f}%)')
if erros_ex:
    print('   exemplos de ERRO (dia gravado, filial, cnpj, produto, ultima compra, dias, lista):')
    for e in erros_ex:
        print('     ', e)

# ---------- 3. USO REAL ----------
print('\n3) USO REAL: dos clientes gravados no dia D, quantos fizeram pedido em D ou D+1 e quantos levaram produto NOVO (60 dias) da lista gravada')
for d, *_ in dias:
    d1 = (dt.date.fromisoformat(d) + dt.timedelta(days=1)).isoformat()
    if d > ONTEM:
        print(f'   {d}: dia ainda sem pedidos fechados no banco'); continue
    gr = comprou = usou = itens = 0
    for f, cnpj, resp in h.execute('SELECT filial, cnpj, resposta_json FROM mix_gap WHERE dia = ?', (d,)):
        g, ind, top = lista(resp)
        if g is None or not g.get('disponivel'):
            continue
        gr += 1
        P = compras.get((f, cnpj), [])
        dep = [x for x in P if d <= x[0] <= min(d1, ONTEM)]
        if not dep:
            continue
        comprou += 1
        lim = (dt.date.fromisoformat(d) - dt.timedelta(days=60)).isoformat()
        antes = set().union(*[x[2] for x in P if lim <= x[0] < d]) if any(lim <= x[0] < d for x in P) else set()
        novos = (set().union(*[x[2] for x in dep]) - antes) & (ind | top)
        if novos:
            usou += 1; itens += len(novos)
    print(f'   {d}: {gr} gravados | {comprou} compraram em {d}..{min(d1, ONTEM)} | {usou} levaram produto novo da lista ({100*usou/max(comprou,1):.1f}% de quem comprou) | {itens} produtos novos')

# ---------- 4. QUALIDADE DA LISTA ----------
print('\n4) QUALIDADE DA RESPOSTA (ultimo dia gravado)')
ult_dia = dias[-1][0] if dias else None
tam = []; univ = []; vazias = 0
for resp, uj in h.execute('SELECT resposta_json, universo_json FROM mix_gap WHERE dia = ?', (ult_dia,)):
    g, ind, top = lista(resp)
    if g is None:
        continue
    tam.append(len(ind | top)); vazias += not (ind | top)
    try:
        univ.append(len(json.loads(uj)))
    except Exception:
        pass
if tam:
    print(f'   {ult_dia}: produtos recomendados por cliente: mediana {st.median(tam)} | min {min(tam)} | max {max(tam)} | listas vazias {vazias}')
if univ:
    print(f'   vizinhos usados (universo, so da carteira do proprio vendedor): mediana {st.median(univ)} | min {min(univ)} | max {max(univ)}')
print('\nFIM')
