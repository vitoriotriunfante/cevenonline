# Teste da busca de prospects com espera (extrator do Data Lake). Roda com:  python testes/t_prospects.py
# Simula o CEVEN: a 1a chamada so ACIONA o calculo; o resultado 'pronto' vem depois.
import os, sys, time, types
from concurrent.futures import ThreadPoolExecutor, as_completed

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
fonte = open(os.path.join(RAIZ, 'analises', 'coletar_todos_os_pdvs_e_prospects_100pct.py'), encoding='utf-8').read()
ini = fonte.index('PROSPECTS_SEM_RETORNO = []') if 'PROSPECTS_SEM_RETORNO = []' in fonte else -1
if ini < 0:
    print('FALHOU - extrator nao tem a busca com espera'); sys.exit(1)
ini_fetch = fonte.index('def fetch_prospects(v):')
fim = fonte.index('t1 = time.time()', ini)
trecho = fonte[ini_fetch:fim]

chamadas = {}
class Resp:
    def __init__(self, corpo): self.status_code = 200; self._c = corpo
    def json(self): return self._c

def requests_get(url, headers=None, verify=None, timeout=None):
    rca = url.split('cod_rca=')[1].split('&')[0]
    chamadas[rca] = chamadas.get(rca, 0) + 1
    n = chamadas[rca]
    if rca == 'A':   # pronto na 1a chamada
        return Resp({'status': 'pronto', 'prospects': [{'cnpj': '1'}]})
    if rca == 'B':   # so fica pronto na 2a chamada (depois de acionado)
        return Resp({'status': 'processando'}) if n == 1 else Resp({'status': 'pronto', 'prospects': [{'cnpj': '2'}, {'cnpj': '3'}]})
    if rca.startswith('Q'):   # fila do CEVEN: so fica pronto a partir da 2a chamada
        return Resp({'status': 'processando'}) if n == 1 else Resp({'status': 'pronto', 'prospects': [{'cnpj': rca}]})
    return Resp({'status': 'processando'})   # C: nunca fica pronto

esperas = []
ns = {
    'requests': types.SimpleNamespace(get=requests_get),
    'time': types.SimpleNamespace(sleep=lambda s: esperas.append(s), time=time.time),
    'ThreadPoolExecutor': ThreadPoolExecutor, 'as_completed': as_completed,
    'BASE_URL': 'http://teste', 'TOKEN': 'x', 'HEADERS': {}, 'os': os,
}
# a lista PROSPECTS_SEM_RETORNO e definida no trecho anterior ao fetch no arquivo real
ns['PROSPECTS_SEM_RETORNO'] = []
exec(trecho.replace('PROSPECTS_SEM_RETORNO = []', 'pass'), ns)

vendedores = [('ABC', rca, 'Nome ' + rca, 'Sup', 'Ger', 'VJ') for rca in ('A', 'B', 'C')]
resultado = {v[1]: pl for v, pl in ns['buscar_prospects_com_espera'](vendedores, rodadas=3)}

falhou = 0
def ok(c, m):
    global falhou
    print(('  ok     - ' if c else '  FALHOU - ') + m)
    if not c: falhou += 1

ok(set(resultado) == {'A', 'B'}, 'entram so os vendedores que ficaram prontos (A na 1a rodada, B na 2a)')
ok(len(resultado.get('B', [])) == 2, 'o resultado do B vem da 2a rodada (2 prospects)')
ok(ns['PROSPECTS_SEM_RETORNO'] and [v[1] for v in ns['PROSPECTS_SEM_RETORNO']] == ['C'], 'quem nunca ficou pronto (C) vai para "sem retorno", nao vira zero')
ok(chamadas.get('A') == 1, 'quem ja estava pronto nao e consultado de novo')
ok(chamadas.get('C') == 4, 'o pendente e consultado nas 3 rodadas e mais uma passada final')
ok(esperas == [60, 60], f'espera de 60 s antes da 2a e da 3a rodada (esperas: {esperas})')
# --- fila grande: depois de acionar todos, so os PRIMEIROS da fila sao consultados a cada rodada (poucas chamadas) ---
chamadas.clear(); esperas.clear(); ns['PROSPECTS_SEM_RETORNO'].clear()
fila = [('ABC', 'Q%d' % i, 'Nome', 'Sup', 'Ger', 'VJ') for i in range(10)]
res2 = {v[1]: pl for v, pl in ns['buscar_prospects_com_espera'](fila, rodadas=2, lote_sonda=3)}
ok(all(chamadas['Q%d' % i] == 2 for i in range(3)) and set(['Q0', 'Q1', 'Q2']) <= set(res2), 'fila grande: a 2a rodada consulta so os 3 primeiros da fila (ficam prontos)')
ok(chamadas['Q9'] == 2 and 'Q9' in res2, 'quem estava no fim da fila so e consultado de novo na passada final (e entra se ficou pronto)')
ok(len(res2) == 10 and not ns['PROSPECTS_SEM_RETORNO'], 'na fila grande todos acabam entrando e ninguem vira zero')
sys.exit(1 if falhou else 0)
