# Estudo profundo do +MIX (Vitorio, 20/10/2026: "preciso fazer todas as correlacoes possiveis e se preciso ajustar a ferramenta").
# So leitura: banco de pedidos do Drive (analises/pedidos_historico_ceven.db) + historico das recomendacoes (analises/mix_gap_hist.db, gravado por gerar_dados_mix.js).
# Uso: python scripts/estudo_mix_profundo.py [AAAA-MM]   (roda no GitHub pelo workflow analise-sob-demanda)
import sqlite3, json, sys, datetime, statistics as st, urllib.request, collections, math

MES = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().strftime('%Y-%m')
hoje = datetime.date.today()
ATE = min(hoje - datetime.timedelta(days=1), datetime.date(int(MES[:4]), int(MES[5:]), 28) + datetime.timedelta(days=4)).isoformat()
INI = MES + '-01'
d0 = datetime.date.fromisoformat(INI)
ANTES = (d0 - datetime.timedelta(days=90)).isoformat()
MES_ANT = (d0 - datetime.timedelta(days=1)).strftime('%Y-%m')
VAREJO = {'VJ', 'FARMA', 'PET VJ', 'ESP'}

eq = json.load(urllib.request.urlopen(urllib.request.Request('https://ceven-cftv-matrix.pages.dev/api/tv-mostra', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60))
vjs = {(k.split('_')[0].upper(), str(v['rca'])) for k, l in eq['filiais'].items() for v in l if str(v.get('canal') or '').upper() in VAREJO}

db = sqlite3.connect('analises/pedidos_historico_ceven.db')
rows = db.execute("""SELECT ph.filial_sigla, ph.id_cliente, CAST(ph.rca_id AS TEXT), replace(replace(replace(ph.cnpj_cliente,'.',''),'/',''),'-',''), substr(ph.data_pedido,1,10), ph.num_pedido, i.codprod, i.valor_total
  FROM pedidos_historico ph JOIN pedidos_historico_itens i ON i.chave_pedido = ph.chave
  WHERE i.tipo_registro='VENDA' AND i.codprod NOT IN ('','12229') AND substr(ph.data_pedido,1,10) BETWEEN ? AND ?""", (ANTES, ATE)).fetchall()
C = {}
for f, c, r, cnpj, d, p, cod, v in rows:
    o = C.setdefault((f, str(c)), {'rca': None, 'cnpj': cnpj, 'mes': set(), 'antes': set(), 'q1': set(), 'q2': set(), 'peds': set(), 'valor': 0.0, 'valor_ant': 0.0})
    cod = str(cod)
    if d >= INI:
        o['rca'] = r; o['mes'].add(cod); o['peds'].add(p); o['valor'] += v or 0
        (o['q1'] if int(d[8:10]) <= 15 else o['q2']).add(p)
    else:
        o['antes'].add(cod)
        if d[:7] == MES_ANT: o['valor_ant'] += v or 0

h = sqlite3.connect('analises/mix_gap_hist.db')
rec = {}
for f, cnpj, resp in h.execute('SELECT filial, cnpj, resposta_json FROM mix_gap WHERE dia = (SELECT MAX(dia) FROM mix_gap)'):
    g = json.loads(resp); m = {}
    for ind in g.get('industrias_gap') or []:
        for p in ind.get('produtos') or []:
            m[str(p['codprod'])] = {'ind': ind.get('industria'), 'pen': p.get('penetracao') or 0, 'n': p.get('n_clientes') or 0}
    rec[(f, cnpj)] = {'m': m, 'uni': g.get('total_universo') or 0, 'dados': g.get('total_com_dados') or 0}

alvo = [(k, o) for k, o in C.items() if o['rca'] and (k[0], o['rca']) in vjs and (k[0], o['cnpj']) in rec]
print(f'mes {MES} ate {ATE} | clientes varejo positivados com +MIX: {len(alvo)}')

def med(a): return round(st.mean(a), 2) if a else None
def mediana(a): return round(st.median(a), 2) if a else None

# A) grupos de cliente
G = collections.defaultdict(list)
conv_pen = collections.defaultdict(lambda: [0, 0]); conv_ind = collections.defaultdict(lambda: [0, 0]); conv_uni = collections.defaultdict(lambda: [0, 0])
tot_rec = tot_hit = tot_novos = 0
for k, o in alvo:
    r = rec[(k[0], o['cnpj'])]
    novos = o['mes'] - o['antes']
    R = {c for c in r['m'] if c not in o['antes']}   # recomendacao que ainda era novidade para o cliente
    hit = novos & R
    tot_rec += len(R); tot_hit += len(hit); tot_novos += len(novos)
    grupo = 'A_comprou_novo_do_MIX' if hit else ('B_comprou_novo_fora_do_MIX' if novos else 'C_nao_comprou_novo')
    G[grupo].append({'valor': o['valor'], 'valor_ant': o['valor_ant'], 'mix': len(o['mes']), 'novos': len(novos), 'peds': len(o['peds']), 'dob': 1 if o['q1'] and o['q2'] else 0, 'tinha_ant': 1 if o['valor_ant'] > 0 else 0})
    for c in R:
        info = r['m'][c]; acertou = 1 if c in hit else 0
        b = '0-20%' if info['pen'] < 20 else '20-40%' if info['pen'] < 40 else '40-60%' if info['pen'] < 60 else '60%+'
        conv_pen[b][0] += acertou; conv_pen[b][1] += 1
        conv_ind[info['ind']][0] += acertou; conv_ind[info['ind']][1] += 1
    ub = '<10 vizinhos' if r['uni'] < 10 else '10-29' if r['uni'] < 30 else '30-59' if r['uni'] < 60 else '60+'
    conv_uni[ub][0] += len(hit); conv_uni[ub][1] += len(R)

print('\n=== A) GRUPOS DE CLIENTES (mes inteiro) ===')
print('grupo | clientes | R$ no mes (media/mediana) | R$ mes anterior | crescimento medio R$ | mix | produtos novos | pedidos | dobradinha% | ja compravam no mes anterior%')
for g in sorted(G):
    L = G[g]; cres = [x['valor'] - x['valor_ant'] for x in L if x['tinha_ant']]
    print(g, '|', len(L), '|', med([x['valor'] for x in L]), '/', mediana([x['valor'] for x in L]), '|', med([x['valor_ant'] for x in L]), '|', med(cres), '|', med([x['mix'] for x in L]), '|', med([x['novos'] for x in L]), '|', med([x['peds'] for x in L]), '|', round(100 * st.mean([x['dob'] for x in L]), 1), '|', round(100 * st.mean([x['tinha_ant'] for x in L]), 1))

print('\n=== B) PONTARIA DO +MIX ===')
print(f'recomendacoes ainda novas para o cliente: {tot_rec} | compradas: {tot_hit} | conversao: {round(100 * tot_hit / tot_rec, 2) if tot_rec else None}%')
print(f'produtos novos comprados: {tot_novos} | dos quais estavam no +MIX: {round(100 * tot_hit / tot_novos, 1) if tot_novos else None}%')

print('\n=== C) CONVERSAO POR PENETRACAO DO PRODUTO NA VIZINHANCA ===')
for b in ['0-20%', '20-40%', '40-60%', '60%+']:
    a, n = conv_pen[b]; print(b, '| recomendacoes', n, '| compradas', a, '| conversao', round(100 * a / n, 2) if n else None, '%')

print('\n=== D) CONVERSAO POR TAMANHO DO UNIVERSO (vizinhos) ===')
for b in ['<10 vizinhos', '10-29', '30-59', '60+']:
    a, n = conv_uni[b]; print(b, '| recomendacoes', n, '| compradas', a, '| conversao', round(100 * a / n, 2) if n else None, '%')

print('\n=== E) CONVERSAO POR INDUSTRIA (min. 200 recomendacoes) ===')
for ind, (a, n) in sorted(conv_ind.items(), key=lambda kv: -(kv[1][0] / kv[1][1] if kv[1][1] else 0)):
    if n >= 200: print(ind, '| recomendacoes', n, '| compradas', a, '| conversao', round(100 * a / n, 2), '%')
