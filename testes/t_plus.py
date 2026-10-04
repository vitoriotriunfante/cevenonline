# Teste da conta do Plus de Lideranca (scratch/build_brasileirao_dataset.py), sem rede.
# Extrai do gerador o bloco "PLUS DE LIDERANCA" e o executa com entradas FABRICADAS (so para validar a conta).
import io, json, os, re, sys, tempfile
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(RAIZ, 'scratch', 'build_brasileirao_dataset.py'), encoding='utf-8').read().replace('\r\n', '\n')
i = src.index('# PLUS DE LIDERANCA do supervisor')
i = src.rfind('# -----', 0, i)
j = src.index('sups_tabela = []')
bloco = src[i:j]

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ok     - ' if cond else '  FALHOU - ') + msg)
    if not cond:
        falhas += 1

def roda(inputs, dias):
    f = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8')
    json.dump(inputs, f); f.close()
    os.environ['BRASILEIRAO_PLUS_INPUTS'] = f.name
    ns = {'json': json, 'os': os, '__file__': os.path.join(RAIZ, 'scratch', 'build_brasileirao_dataset.py'), 'DIAS_RODADA': dias}
    exec(bloco, ns)
    os.unlink(f.name)
    return ns

DIAS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']
ENTRADA = {
    'supervisores': {
        'TBL|CIRLENE DE FATIMA GOMES VITORINO': {
            'compromisso': {'2026-09-28': True, '2026-09-29': True, '2026-09-30': False, '2026-10-01': True, '2026-10-02': True},
            'ret': {'2026-09-28': True, '2026-09-29': False, '2026-09-30': False, '2026-10-01': True, '2026-10-02': False},
        }
    },
    'devolucoes': {'disponivel': True, 'ate': '2026-10-01', 'porSupDia': {'TBL|CIRLENE DE FATIMA GOMES VITORINO|2026-09-29': {'notas': 1}}},
}

ns = roda(ENTRADA, DIAS)
ok(ns['PLUS_PONTOS'] == {'compromisso': 15, 'ret': 25, 'fair_play': 30}, 'pontos do Plus vem da config: +15 compromisso, +25 RET, +30 Fair Play')
total, det, pend = ns['calcula_plus']('TBL', 'CLT - Cirlene de Fátima Gomes Vitorino')
ok(total == 200, f'soma do Plus em 5 dias = 200 (70+15+30+70+15), achou {total}')
ok(det['2026-09-29'] == {'compromisso': 15, 'ret': 0, 'fair_play': 0}, 'dia com devolucao: Fair Play = 0 (sem punicao)')
ok(det['2026-09-30']['compromisso'] == 0 and det['2026-09-30']['ret'] == 0, 'compromisso nao feito e RET nao feito = 0, sem punicao')
ok(det['2026-10-02']['fair_play'] is None and pend is True, 'dia que o banco de devolucoes ainda nao cobre fica PENDENTE (nao da nem tira)')
ok(all(v >= 0 for d in det.values() for v in d.values() if v is not None), 'nunca ha ponto negativo no Plus')
ok(ns['calcula_plus']('TBL', 'SUPERVISOR QUE O CEVEN NAO DEVOLVEU') == (None, None, None), 'supervisor sem dado do CEVEN fica sem Plus (nao inventa)')
ok(ns['_norm_nome']('CLT - José  Ávila') == 'JOSE AVILA', 'nomes sao normalizados (CLT, acento, espaco)')

sem = roda({'supervisores': {}, 'devolucoes': {'disponivel': False}}, DIAS)
ok(sem['calcula_plus']('TBL', 'QUALQUER') == (None, None, None), 'sem dados o Plus fica "—" (None)')

sys.exit(1 if falhas else 0)
