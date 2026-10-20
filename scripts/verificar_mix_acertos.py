# De onde vem o "acerto" do +MIX medido com a recomendacao buscada DEPOIS da compra? (Vitorio, 20/10/2026: "o +MIX nao deveria constar os produtos que o
# cliente ja compra"). Para cada produto novo comprado em outubro que aparece na recomendacao de hoje: veio da lista da INDUSTRIA (filtrada pelo cliente)
# ou da lista REGIONAL (produtos_top)? E ha quantos dias foi comprado? Se aparece produto comprado ha muitos dias, o historico do +MIX tem atraso.
import sqlite3, json, collections, datetime, statistics as st
db = sqlite3.connect('analises/pedidos_historico_ceven.db'); h = sqlite3.connect('analises/mix_gap_hist.db')
dia = h.execute('SELECT MAX(dia) FROM mix_gap').fetchone()[0]
compras = collections.defaultdict(dict)   # (filial, cnpj) -> cod -> ultima data
for f, cnpj, d, cod in db.execute("""SELECT ph.filial_sigla, replace(replace(replace(ph.cnpj_cliente,'.',''),'/',''),'-',''), substr(ph.data_pedido,1,10), i.codprod
    FROM pedidos_historico ph JOIN pedidos_historico_itens i ON i.chave_pedido=ph.chave WHERE i.tipo_registro='VENDA' AND substr(ph.data_pedido,1,10) BETWEEN '2026-07-01' AND ?""", (dia,)):
    m = compras[(f, cnpj)]; c = str(cod)
    if d > m.get(c, ''): m[c] = d
fonte = collections.Counter(); idade_ind = []; idade_top = []; ex = []
top_tem_comprado = 0; top_total = 0; ind_total = 0; ind_tem_comprado = 0
for f, cnpj, resp in h.execute('SELECT filial, cnpj, resposta_json FROM mix_gap WHERE dia=?', (dia,)):
    g = json.loads(resp); m = compras.get((f, cnpj), {})
    ind = {str(p['codprod']) for i in g.get('industrias_gap') or [] for p in i.get('produtos') or []}
    top = {str(p['codprod']) for p in g.get('produtos_top') or []}
    ind_total += len(ind); top_total += len(top)
    for c in ind:
        if c in m: ind_tem_comprado += 1; idade_ind.append((datetime.date.fromisoformat(dia) - datetime.date.fromisoformat(m[c])).days)
    for c in top:
        if c in m: top_tem_comprado += 1; idade_top.append((datetime.date.fromisoformat(dia) - datetime.date.fromisoformat(m[c])).days)
        if c in m and len(ex) < 8: ex.append((f, cnpj, c, m[c]))
print('recomendacao de', dia)
print(f'LISTA DA INDUSTRIA: {ind_total} produtos recomendados; {ind_tem_comprado} ({round(100*ind_tem_comprado/max(ind_total,1),2)}%) o cliente JA COMPROU desde julho')
if idade_ind: print('   ha quantos dias foi a ultima compra desses: mediana', st.median(idade_ind), '| ate 7 dias', sum(1 for x in idade_ind if x <= 7), '| 8-30', sum(1 for x in idade_ind if 8 <= x <= 30), '| 31-90', sum(1 for x in idade_ind if 31 <= x <= 90), '| +90', sum(1 for x in idade_ind if x > 90))
print(f'LISTA REGIONAL (produtos_top): {top_total} produtos; {top_tem_comprado} ({round(100*top_tem_comprado/max(top_total,1),2)}%) o cliente JA COMPROU desde julho')
if idade_top: print('   ha quantos dias: mediana', st.median(idade_top), '| ate 7 dias', sum(1 for x in idade_top if x <= 7), '| 8-30', sum(1 for x in idade_top if 8 <= x <= 30), '| 31-90', sum(1 for x in idade_top if 31 <= x <= 90))
print('exemplos (filial, cnpj, produto, ultima compra):', ex)
