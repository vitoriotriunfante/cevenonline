# Lista para o TIME DE DADOS do CEVEN (Vitorio, 20/10/2026): cada produto que o +MIX RECOMENDA para um cliente que JA COMPROU esse produto.
# Prova dois defeitos: (1) o historico do +MIX atrasa ~1 semana (compra recente continua recomendada); (2) a lista "produtos com maior aderencia
# na regiao" (produtos_top) nao e filtrada pelo cliente. Saida: saida/mix_falhas.csv (separador ;, UTF-8 com BOM, abre direto no Excel).
import sqlite3, json, csv, os, datetime, urllib.request
db = sqlite3.connect('analises/pedidos_historico_ceven.db'); h = sqlite3.connect('analises/mix_gap_hist.db')
dia = h.execute('SELECT MAX(dia) FROM mix_gap').fetchone()[0]
eq = json.load(urllib.request.urlopen(urllib.request.Request('https://ceven-cftv-matrix.pages.dev/api/tv-mostra', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60))
equipe = {(k.split('_')[0].upper(), str(v['rca'])): v for k, l in eq['filiais'].items() for v in l}
ult = {}   # (filial, cnpj, cod) -> dados da ULTIMA compra
for f, cnpj, idc, nomec, rca, rnome, sup, d, num, cod, desc, qt, val in db.execute("""SELECT ph.filial_sigla, replace(replace(replace(ph.cnpj_cliente,'.',''),'/',''),'-',''), ph.id_cliente, ph.nome_cliente,
    CAST(ph.rca_id AS TEXT), ph.rca_nome, ph.supervisor_nome, substr(ph.data_pedido,1,10), ph.num_pedido, i.codprod, i.descricao, i.quantidade, i.valor_total
    FROM pedidos_historico ph JOIN pedidos_historico_itens i ON i.chave_pedido = ph.chave
    WHERE i.tipo_registro='VENDA' AND substr(ph.data_pedido,1,10) BETWEEN '2026-07-01' AND ?""", (dia,)):
    k = (f, cnpj, str(cod))
    if k not in ult or d > ult[k]['d']: ult[k] = {'d': d, 'num': num, 'desc': desc, 'qt': qt, 'val': val, 'idc': idc, 'nomec': nomec, 'rca': rca, 'rnome': rnome, 'sup': sup}
os.makedirs('saida', exist_ok=True)
n = 0
with open('saida/mix_falhas.csv', 'w', newline='', encoding='utf-8-sig') as fo:
    w = csv.writer(fo, delimiter=';')
    w.writerow(['data_da_recomendacao', 'lista_do_mix', 'filial', 'cod_rca_da_recomendacao', 'vendedor', 'supervisor', 'cod_cliente', 'cnpj_cliente', 'nome_cliente',
                'cod_produto', 'nome_produto', 'industria', 'penetracao_vizinhos_pct', 'vizinhos_que_compram', 'universo_vizinhos',
                'data_ultima_compra', 'dias_entre_compra_e_recomendacao', 'num_pedido_da_compra', 'qtd_comprada', 'valor_comprado', 'rca_que_vendeu', 'nome_rca_que_vendeu'])
    for f, rca, cnpj, idc, resp in h.execute('SELECT filial, rca, cnpj, id_cliente, resposta_json FROM mix_gap WHERE dia = ?', (dia,)):
        g = json.loads(resp)
        itens = [('INDUSTRIA (industrias_gap)', i.get('industria'), p) for i in g.get('industrias_gap') or [] for p in i.get('produtos') or []] + \
                [('REGIONAL (produtos_top)', p.get('industria'), p) for p in g.get('produtos_top') or []]
        vend = equipe.get((f, str(rca)), {})
        for lista, ind, p in itens:
            u = ult.get((f, cnpj, str(p.get('codprod'))))
            if not u: continue
            dias = (datetime.date.fromisoformat(dia) - datetime.date.fromisoformat(u['d'])).days
            w.writerow([dia, lista, f, rca, vend.get('nome') or '', vend.get('supervisor') or u['sup'] or '', u['idc'] or idc, cnpj, u['nomec'] or '',
                        p.get('codprod'), p.get('produto') or u['desc'] or '', ind or '', str(p.get('penetracao') or '').replace('.', ','), p.get('n_clientes') or '', g.get('total_universo') or '',
                        u['d'], dias, u['num'], str(u['qt'] or '').replace('.', ','), str(round(u['val'] or 0, 2)).replace('.', ','), u['rca'], u['rnome'] or ''])
            n += 1
print('linhas:', n, '| recomendacao de', dia)
