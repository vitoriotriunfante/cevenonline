# LISTA DOS CLIENTES COM +MIX VAZIO (Vitorio, 22/10/2026: "me uma lista com quais e de quais vendedores, com codigo")
# Le a ultima captura gravada (mix_gap_hist.db) e lista os clientes para quem o CEVEN devolveu lista vazia. So leitura.
import sqlite3, json, csv, os
h = sqlite3.connect('analises/mix_gap_hist.db')
dia = h.execute('SELECT MAX(dia) FROM mix_gap').fetchone()[0]
os.makedirs('saida', exist_ok=True)
n = 0
with open('saida/mix_listas_vazias.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';')
    w.writerow(['dia', 'filial', 'cod_rca', 'cod_cliente', 'cnpj', 'vizinhos_usados', 'total_universo_ceven', 'disponivel'])
    for f, rca, cnpj, idc, uj, resp in h.execute('SELECT filial, rca, cnpj, id_cliente, universo_json, resposta_json FROM mix_gap WHERE dia = ? ORDER BY filial, rca', (dia,)):
        g = json.loads(resp)
        cods = {p['codprod'] for i in g.get('industrias_gap') or [] for p in i.get('produtos') or []} | {p['codprod'] for p in g.get('produtos_top') or []}
        if cods:
            continue
        n += 1
        w.writerow([dia, f, rca, idc, cnpj, len(json.loads(uj or '[]')), g.get('total_universo'), g.get('disponivel')])
print(dia, 'listas vazias:', n)
