# =========================================================================
# FICHA DO ARQUIVO: scripts/carregar_ficha_d1.py
# O QUE E: leva do banco do Data Lake (pedidos_historico_ceven.db, no Drive) para o D1 a ficha de cada cliente e os prospects (Vitorio, 31/10/2026).
#   Roda no GitHub depois do Data Lake (.github/workflows/ficha-clientes-d1.yml). So envia cliente cuja ficha mudou. Nao chama o CEVEN.
# REGRAS: pedido com data futura fica fora (o banco tem datas ate 18/12/2026). "Parou" = comprou antes e nao comprou nos ultimos 60 dias (regra de recompra do +MIX). Nada estimado.
# USO: EVO_KEY=... python scripts/carregar_ficha_d1.py analises/pedidos_historico_ceven.db [--ensaio]
# =========================================================================
import sqlite3, json, hashlib, os, sys, time, datetime, urllib.request
BASE = 'https://ceven-cftv-matrix.pages.dev/api/ficha-carga'
KEY = os.environ.get('EVO_KEY', '')
ENSAIO = '--ensaio' in sys.argv
PEDIDOS, ITENS, PARADOS = 6, 25, 15
hoje = (datetime.datetime.utcnow() - datetime.timedelta(hours=3)).date()
corte60 = (hoje - datetime.timedelta(days=60)).isoformat()

def chama(metodo, sufixo='', corpo=None):
    for t in range(4):
        try:
            req = urllib.request.Request(BASE + sufixo, method=metodo, data=json.dumps(corpo).encode() if corpo is not None else None,
                headers={'X-Evo-Key': KEY, 'Content-Type': 'application/json', 'User-Agent': 'ceven-ficha'})
            with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
        except Exception as e:
            if t == 3: raise
            time.sleep(5 * (t + 1))

db = sqlite3.connect('file:%s?mode=ro' % sys.argv[1], uri=True)
db.row_factory = sqlite3.Row
fichas = {}
for p in db.execute("SELECT * FROM pedidos_historico WHERE data_pedido <= ? ORDER BY data_pedido DESC", (hoje.isoformat(),)):
    k = (p['filial_sigla'], str(p['id_cliente']))
    f = fichas.setdefault(k, {'nome': p['nome_cliente'], 'cnpj': p['cnpj_cliente'], 'ped': [], 'chaves': []})
    if len(f['ped']) < PEDIDOS:
        f['ped'].append({'num': p['num_pedido'], 'data': p['data_pedido'], 'rca': str(p['rca_id']), 'rca_nome': p['rca_nome'], 'status': p['status_pedido'], 'valor': p['total_clube'], 'faturado': p['vl_faturado'], 'cortado': p['vl_cortado'], 'chave': p['chave']})
    f['chaves'].append((p['chave'], p['data_pedido'], str(p['rca_id'])))
por_ped = {}
for i in db.execute("SELECT chave_pedido c, codprod, descricao, quantidade, valor_total FROM pedidos_historico_itens WHERE tipo_registro = 'VENDA'"):
    por_ped.setdefault(i['c'], []).append(i)
for f in fichas.values():
    for p in f['ped']:
        p['itens'] = [{'cod': str(i['codprod']), 'd': i['descricao'], 'q': i['quantidade'], 'v': i['valor_total']} for i in por_ped.get(p['chave'], [])[:ITENS]]
        del p['chave']
    recente, antigos = set(), {}
    for ch, data, rca in f['chaves']:
        for i in por_ped.get(ch, []):
            c = str(i['codprod'])
            if data >= corte60: recente.add(c)
            elif c not in antigos: antigos[c] = {'cod': c, 'd': i['descricao'], 'ult': data, 'rca': rca}
    f['parou'] = [x for c, x in antigos.items() if c not in recente][:PARADOS]
    f['ult'] = f['chaves'][0][1] if f['chaves'] else None
    del f['chaves']
print('fichas montadas', len(fichas), 'tamanho medio', sum(len(json.dumps(f)) for f in fichas.values()) // max(1, len(fichas)))
por_filial = {}
for (fil, cli), f in fichas.items(): por_filial.setdefault(fil, {})[cli] = f
total = 0
for fil, cs in sorted(por_filial.items()):
    ant = {} if ENSAIO else chama('GET', '?filial=' + fil)['hashes']
    lote, mudou = [], 0
    for cli, f in cs.items():
        j = json.dumps(f, ensure_ascii=False, separators=(',', ':')); h = hashlib.md5(j.encode()).hexdigest()[:16]
        if ant.get(cli) == h: continue
        mudou += 1
        lote.append({'filial': fil, 'id_cliente': cli, 'hash': h, 'json': j})
        if len(lote) == 200:
            if not ENSAIO: chama('POST', '', {'fichas': lote})
            lote = []
    if lote and not ENSAIO: chama('POST', '', {'fichas': lote})
    total += mudou
    print(fil, 'clientes', len(cs), 'mudaram', mudou, flush=True)
print('total enviado', total)
inicio = datetime.datetime.utcnow().isoformat() + 'Z'
try:
    P = [{'filial': r['filial'], 'rca': str(r['rca_codigo']), 'cnpj': str(r['cnpj']), 'dados': {'razao': r['razao_social'], 'fantasia': r['nome_fantasia'], 'cnae': r['cnae_desc'], 'end': r['endereco'], 'bairro': r['bairro'], 'mun': r['municipio'], 'tel': r['telefone'], 'km': r['distancia_km'], 'motivo': r['motivo'], 'lat': r['latitude'], 'lon': r['longitude']}} for r in db.execute('SELECT * FROM prospects_mapa_radar')]
    print('prospects', len(P))
    if P and not ENSAIO:
        for i in range(0, len(P), 200): chama('POST', '', {'prospects': P[i:i + 200]})
        chama('POST', '', {'limpar_prospects_antes': inicio})   # so depois de gravar: quem saiu da lista sai da tabela
except sqlite3.OperationalError as e:
    print('sem prospects:', e)
