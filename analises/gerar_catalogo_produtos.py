# Gera o catalogo de produtos do CEVEN a partir da planilha "Relacao de itens por filial".
# REGRAS (decisao do Vitorio, 03/10/2026):
#   - UMA LINHA POR PRODUTO EM CADA FILIAL, exatamente como a planilha (a partir da linha 7). NAO agrupa filiais.
#   - ESTOQUE E IGNORADO: as colunas DISPONIVEL (UN) e TOTAL (UN) nao entram.
#   - A linha de TOTAL do rodape nao e produto e e descartada.
#   - SKU 12229 e sempre ignorado nas contas (fica marcado na coluna "ignorar").
# Uso: python analises/gerar_catalogo_produtos.py "<caminho da planilha .xlsx>"
# Saidas: config/catalogo_produtos_por_filial.csv e config/catalogo_produtos_por_filial.json
import sys, json, csv, datetime, os
import openpyxl

SKU_IGNORADO = 12229
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
origem = sys.argv[1]
wb = openpyxl.load_workbook(origem, read_only=True, data_only=True)
data_planilha = None
linhas = []
for i, r in enumerate(wb['TODAS'].iter_rows(values_only=True)):
    if r[0] == 'DATA:' and isinstance(r[1], datetime.datetime):
        data_planilha = r[1].date().isoformat()
    if i < 6 or not isinstance(r[2], int) or r[0] == 'TOTAL' or not r[1]:
        continue  # pula cabecalho e a linha de TOTAL do rodape
    linhas.append({
        'filial_cod': r[0], 'sigla': r[1], 'codprod': r[2],
        'descricao': (r[3] or '').strip(), 'embalagem': (r[4] or '').strip(),
        'ean': str(r[5]).strip() if r[5] else '',
        'cod_fornecedor': r[6], 'fornecedor': (r[7] or '').strip(),
        'ignorar': 'SIM' if r[2] == SKU_IGNORADO else '',
    })

campos = ['filial_cod', 'sigla', 'codprod', 'descricao', 'embalagem', 'ean', 'cod_fornecedor', 'fornecedor', 'ignorar']
with open(os.path.join(raiz, 'config', 'catalogo_produtos_por_filial.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=campos, delimiter=';')
    w.writeheader()
    w.writerows(linhas)
saida = {
    'fonte': os.path.basename(origem), 'data_planilha': data_planilha,
    'gerado_em': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
    'observacao': 'Uma linha por produto em cada filial. Estoque ignorado de proposito. Nao agrupar filiais.',
    'total_linhas': len(linhas), 'campos': campos,
    'linhas': [[l[c] for c in campos] for l in linhas],
}
with open(os.path.join(raiz, 'config', 'catalogo_produtos_por_filial.json'), 'w', encoding='utf-8') as f:
    json.dump(saida, f, ensure_ascii=False, separators=(',', ':'))
print('linhas (produto x filial):', len(linhas), '| data da planilha:', data_planilha)
print('produtos distintos:', len(set(l['codprod'] for l in linhas)), '| filiais:', len(set(l['sigla'] for l in linhas)), '| sem EAN:', sum(1 for l in linhas if not l['ean']))
