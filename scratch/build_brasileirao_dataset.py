import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import json
import subprocess
import urllib.request
from datetime import datetime, timezone, date, timedelta

# Feriados nacionais 2026 — mesma lista oficial usada em .github/workflows/ceven-cron-whatsapp.yml
# (trava de disparo de WhatsApp), pra manter os dois projetos consistentes sobre "dia útil".
FERIADOS_2026 = {
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01',
    '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25'
}

print("--- RECONSTRUINDO DATASET DO BRASILEIRÃO: CADA DIA É UM JOGO (v2 — pontuação real) ---")

# 0. Carregar régua de pontos (config/pontuacao_brasileirao.json) — nunca hardcoded aqui, pra
# ficar fácil de ajustar sem mexer em código (decisão do Vitório, 28/09/2026).
with open('config/pontuacao_brasileirao.json', 'r', encoding='utf-8') as f:
    CONFIG_PONTOS = json.load(f)
PONTOS_POR_LANCE = CONFIG_PONTOS['pontos_por_lance']
FAIXAS = CONFIG_PONTOS['faixas_pontos_liga']


def valor_lance(chave, nivel):
    """Acha o valor em pontos de um lance pela CHAVE (mais específico) ou pelo NÍVEL (fallback).
    Chave real salva em tv_lances é tipo '{sig}|gol_super|{rca}' ou 'gol_super|{rca}' (matriz vs
    TV de filial usam formatos levemente diferentes) — procuramos por SUBSTRING de cada código
    conhecido dentro da chave, nunca inventamos pontuação pra um lance não mapeado (fica 0)."""
    partes = str(chave or '').split('|')
    for p in partes:
        if p in PONTOS_POR_LANCE:
            return PONTOS_POR_LANCE[p]['pontos']
    # fallback: nível cru do lance
    if nivel in PONTOS_POR_LANCE:
        return PONTOS_POR_LANCE[nivel]['pontos']
    return 0


def julgar_pelo_score(score):
    """Vitória/Empate/Derrota a partir da soma de pontos do dia (regra do Vitório, 28/09/2026):
    > 10 pontos = Vitória (3 pts liga); 1 a 10 = Empate (1 pt liga); <= 0 = Derrota (0 pts liga)."""
    if score >= FAIXAS['vitoria']['min_pontos']:
        return 'V', FAIXAS['vitoria']['pontos_tabela']
    if score >= FAIXAS['empate']['min_pontos']:
        return 'E', FAIXAS['empate']['pontos_tabela']
    return 'D', FAIXAS['derrota']['pontos_tabela']


# Temporada oficial do Brasileirão Triunfante começa em 28/09/2026 (data de início fixa,
# confirmada pelo Vitório) — lances antes disso não contam pra liga.
INICIO_TEMPORADA = '2026-09-28'
# FONTE DOS LANCES (decisao 04/10/2026 — rodar online, sem credencial): a API publica /api/brasileirao-lances
# (um dia por vez, ja sem duplicados). Antes dependia do `wrangler` com login do Cloudflare no PC.
# BRASILEIRAO_FONTE=wrangler volta ao jeito antigo (so para comparar).
import os
def _dias_desde(inicio):
    d = date.fromisoformat(inicio); hoje = (datetime.now(timezone.utc) - timedelta(hours=3)).date(); out = []
    while d <= hoje:
        out.append(d.isoformat()); d += timedelta(days=1)
    return out
def carregar_lances_api():
    lances = []
    for dia in _dias_desde(INICIO_TEMPORADA):
        if date.fromisoformat(dia).weekday() >= 5 or dia in FERIADOS_2026:
            continue  # so dia util conta como jogo
        req = urllib.request.Request(f'https://ceven-cftv-matrix.pages.dev/api/brasileirao-lances?dia={dia}', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            j = json.loads(resp.read().decode('utf-8'))
        if 'lances' not in j:
            raise RuntimeError(f'resposta sem lances para {dia}: {str(j)[:120]}')
        for l in j['lances']:
            l['dia'] = dia
            lances.append(l)
        print(f"  {dia}: {len(j['lances'])} lances (duplicados ja removidos pela API: {j.get('duplicados_removidos', 0)})")
    return lances
try:
    if os.environ.get('BRASILEIRAO_FONTE') == 'wrangler':
        cmd = f'npx wrangler d1 execute ceven_noc_d1 --remote --json --command "SELECT dia, filial, chave, nivel, rca, vendedor, supervisor, cliente, motivo, dias_sem_compra FROM tv_lances WHERE dia >= \'{INICIO_TEMPORADA}\' AND nivel != \'marker\'"'
        res = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT)
        d1_data = json.loads(res)[0]['results']
    else:
        d1_data = carregar_lances_api()
    print(f"Total lances no D1: {len(d1_data)}")
    # Um mesmo lance pode estar gravado duas vezes: pela TV da matriz (filial MTZ, chave com prefixo
    # "SIG|") e pela TV de filial/cron (filial real, chave sem prefixo). Conta cada lance UMA vez.
    # Identidade = dia + filial real + chave sem prefixo (a filial entra para nao juntar lances de
    # supervisor de filiais diferentes). Mesma regra de functions/api/brasileirao-lances.js.
    import re
    _vistos = {}
    for _l in d1_data:
        _ch = str(_l.get('chave') or '')
        _m = re.match(r'^([A-Z]{3})\|', _ch)
        _pre = _m.group(1) if _m else None
        _fil = _l.get('filial') or ''
        _fil_real = _pre if (_fil == 'MTZ' and _pre) else (_fil or _pre or '')
        _canon = re.sub(r'^[A-Z]{3}\|', '', _ch)
        _id = (_l.get('dia'), _fil_real, _canon)
        if _id not in _vistos or (_fil != 'MTZ' and _vistos[_id].get('filial') == 'MTZ'):
            _vistos[_id] = _l
    duplicados_removidos = len(d1_data) - len(_vistos)
    d1_data = list(_vistos.values())
    # SIMULACAO (nao e o padrao): BRASILEIRAO_SEM_IMP_GPS=1 tira os impedimentos de GPS da liga, so para comparar o efeito.
    # Motivo (auditoria 05/10/2026): o check-out do palm vem com ponto-padrao/GPS parado em ~metade das visitas.
    # PADRAO (decisao do Vitorio, 05/10/2026): impedimento de GPS anterior a 06/10 nao conta na liga (sem comprovacao).
    # BRASILEIRAO_COM_IMP_GPS_ANTIGO=1 traz de volta, so para comparar.
    if os.environ.get('BRASILEIRAO_COM_IMP_GPS_ANTIGO') != '1':
        _antes = len(d1_data)
        d1_data = [l for l in d1_data if not (str(l.get('dia') or '') < '2026-10-06' and re.search(r'(^|\|)(imp\|gps|ver_dev|golcontra_dev)\|', str(l.get('chave') or '')))]
        print(f'Impedimentos de GPS antigos (sem comprovacao) fora da liga: {_antes - len(d1_data)} de {_antes}')
    print(f"Duplicados removidos: {duplicados_removidos} | lances únicos: {len(d1_data)}")
except Exception as e:
    # NUNCA sobrescrever o dataset publicado com dado vazio/zerado por falha de consulta
    # (ex.: secret do Cloudflare ausente, D1 fora do ar) — regra "nunca inventar dado"
    # também vale para "nunca apagar dado real por engano". Aborta sem tocar no JSON.
    print(f"❌ Erro ao buscar os lances: {e}")
    print("Abortando SEM gravar public/dados_brasileirao.json — mantendo o dataset publicado anterior.")
    sys.exit(1)

FILIAIS_VALIDAS = ['TBL', 'TPH', 'TCV', 'ABC', 'API', 'TSJ', 'TBE', 'TPA', 'MCD', 'TCA', 'TCG']

# 1. Carregar mapa de vendedores/supervisores/gerentes — 100% online, via /api/tv-mostra (mesma
# fonte que a TV/CFTV usa). NUNCA mais dependente de analises/pedidos_historico_ceven.db (SQLite
# local) — violava a premissa online (ver PREMISSA_ONLINE.md), achado em 28/09/2026.
rca_map = {}
ocultos_fora = 0
try:
    req = urllib.request.Request('https://ceven-cftv-matrix.pages.dev/api/tv-mostra', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as resp:
        mostra_json = json.loads(resp.read().decode('utf-8'))
    for fil, itens in mostra_json.get('filiais', {}).items():
        fil_canonica = fil.split('_')[0]  # SIGLA_GRUPO -> SIGLA (ver functions/_lib/xlsx_mostra.js)
        for item in itens:
            rca_id = str(item['rca'])
            # Quem a equipe OCULTA (mostra: false — cadastro de teste, inativo, "GERENTE X"...) NAO disputa o Brasileirao:
            # mesma regra das TVs e do WhatsApp ("quem aparece = equipe"). Decisao do Vitorio, 04/10/2026.
            if item.get('mostra') is False:
                ocultos_fora += 1
                continue
            rca_map[rca_id] = {
                'nome': item['nome'], 'filial': fil_canonica, 'sup': item.get('supervisor', ''),
                'gerente': item.get('gerente', '')
            }
except Exception as e:
    print(f"❌ Erro ao carregar /api/tv-mostra: {e}")
    print("Abortando SEM gravar public/dados_brasileirao.json — sem a lista de vendedores não dá pra montar o dataset.")
    sys.exit(1)
print(f"Vendedores carregados de /api/tv-mostra: {len(rca_map)} (ocultos pela equipe, fora da liga: {ocultos_fora})")

# Dias de rodada: so DIAS UTEIS (segunda a sexta) e SEM feriados nacionais — cada dia util e um jogo
# (decisao do Vitorio, 03/10/2026: sabado, domingo e feriado nao contam como jogo, mesmo que haja lance no D1).
DIAS_COM_LANCE = set(l['dia'] for l in d1_data if l.get('dia'))
DIAS_RODADA = sorted(d for d in DIAS_COM_LANCE if date.fromisoformat(d).weekday() < 5 and d not in FERIADOS_2026)
print("Dias de rodada:", DIAS_RODADA, "| ignorados (fim de semana/feriado):", sorted(DIAS_COM_LANCE - set(DIAS_RODADA)))

# Agrupar lances por RCA e por Dia
rca_dia_lances = {}
for l in d1_data:
    rca = str(l.get('rca') or '')
    dia = l.get('dia')
    if not rca or not dia or rca == 'None':
        continue
    rca_dia_lances.setdefault(rca, {}).setdefault(dia, []).append(l)

# Dias ÚTEIS ESPERADOS de cada semana civil (seg-sex, excluindo feriados nacionais) que tocam o
# período da temporada — usado pra Semana Invicta EXIGIR a semana completa, não só os dias que já
# tiveram rodada (decisão do Vitório, 28/09/2026: "siga a logica do 5 dias uteis lembrando que
# temos feriados"). Sem isso, a 1ª segunda-feira da temporada já dava o bônus de +3 prematuramente.
def dias_uteis_esperados_da_semana(qualquer_dia_da_semana):
    dt = date.fromisoformat(qualquer_dia_da_semana)
    segunda = dt - timedelta(days=dt.weekday())  # weekday(): segunda=0
    dias = []
    for i in range(5):  # segunda a sexta
        d = segunda + timedelta(days=i)
        iso = d.isoformat()
        if iso not in FERIADOS_2026:
            dias.append(iso)
    return dias

SEMANAS_DA_TEMPORADA = sorted(set(f"{date.fromisoformat(d).isocalendar()[0]}-W{date.fromisoformat(d).isocalendar()[1]:02d}" for d in DIAS_RODADA))
DIAS_UTEIS_ESPERADOS_POR_SEMANA = {}
for d in DIAS_RODADA:
    dt = date.fromisoformat(d)
    semana_key = f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"
    if semana_key not in DIAS_UTEIS_ESPERADOS_POR_SEMANA:
        DIAS_UTEIS_ESPERADOS_POR_SEMANA[semana_key] = dias_uteis_esperados_da_semana(d)

# 2. Julgar cada RODADA (dia) de cada VENDEDOR pela soma real de pontos dos lances do dia.
vendedores_lista = []
resultado_dia_vendedor = {}  # (rca, dia) -> 'V'/'E'/'D' — usado pra agregar supervisor/filial/gerente
for rca, meta in rca_map.items():
    fil = meta['filial']
    if fil not in FILIAIS_VALIDAS:
        continue

    dias_map = rca_dia_lances.get(rca, {})
    vitorias = empates = derrotas = 0
    pts_tabela = 0
    gp_total = gc_total = 0  # "Gols Pró" = soma de pontos positivos; "Gols Contra" = soma de pontos negativos (em módulo)
    forma = []
    super_pedidos = inativos_resgatados = 0
    streak_atual = max_streak = 0

    for d in DIAS_RODADA:
        lances = dias_map.get(d, [])
        score_dia = 0
        for l in lances:
            ch = l.get('chave', '')
            if 'gol_super' in ch:
                super_pedidos += 1
            if 'gol_inativo' in ch:
                inativos_resgatados += 1
            v = valor_lance(ch, l.get('nivel'))
            score_dia += v
            if v > 0:
                gp_total += v
            elif v < 0:
                gc_total += -v

        resultado, pts = julgar_pelo_score(score_dia)
        resultado_dia_vendedor[(rca, d)] = resultado
        pts_tabela += pts
        forma.append(resultado)

        if resultado == 'V':
            vitorias += 1
            streak_atual += 1
            max_streak = max(max_streak, streak_atual)
        else:
            streak_atual = 0
            if resultado == 'E':
                empates += 1
            else:
                derrotas += 1

    # Bônus de constância (regulamento): Trinca de Ouro (3 vitórias seguidas) = +3.
    bonus_constancia = 3 if max_streak >= 3 else (1 if max_streak >= 2 else 0)
    pts_tabela += bonus_constancia

    # Semana Invicta (regulamento, decisão do Vitório 28/09/2026): +3 pontos extras POR SEMANA em
    # que o vendedor bateu Vitória em TODOS os dias ÚTEIS ESPERADOS da semana (seg-sex, excluindo
    # feriados nacionais) — a semana precisa estar COMPLETA em DIAS_RODADA, não só os dias que já
    # tiveram rodada até agora (sem isso, a 1ª segunda da temporada já dava o bônus prematuramente).
    semanas_invictas = 0
    for semana_key, dias_uteis in DIAS_UTEIS_ESPERADOS_POR_SEMANA.items():
        semana_completa = all(d in DIAS_RODADA for d in dias_uteis)
        if not semana_completa:
            continue  # semana ainda não terminou (ou faltam dias) — não julga ainda
        resultados_semana = [resultado_dia_vendedor.get((rca, d)) for d in dias_uteis]
        if resultados_semana and all(r == 'V' for r in resultados_semana):
            semanas_invictas += 1
    bonus_semana_invicta = semanas_invictas * 3
    pts_tabela += bonus_semana_invicta

    jogos = len(DIAS_RODADA)
    pts_possiveis = jogos * 3
    aprov = round((pts_tabela / pts_possiveis) * 100, 1) if pts_possiveis > 0 else 0

    vendedores_lista.append({
        'rca': rca, 'nome': meta['nome'], 'filial': fil, 'supervisor': meta['sup'], 'gerente': meta['gerente'],
        'jogos': jogos, 'vitorias': vitorias, 'empates': empates, 'derrotas': derrotas,
        'pts_tabela': pts_tabela, 'aprov': aprov, 'gp': gp_total, 'gc': gc_total, 'sg': gp_total - gc_total,
        'super_pedidos': super_pedidos, 'inativos_resgatados': inativos_resgatados,
        'forma': forma, 'streak': max_streak, 'bonus_constancia': bonus_constancia,
        'semanas_invictas': semanas_invictas, 'bonus_semana_invicta': bonus_semana_invicta
    })

vendedores_lista.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg'], x['gp'], x['inativos_resgatados']), reverse=True)
for idx, v in enumerate(vendedores_lista):
    v['pos_brasil'] = idx + 1
for fil in FILIAIS_VALIDAS:
    fil_vends = [v for v in vendedores_lista if v['filial'] == fil]
    fil_vends.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg'], x['gp']), reverse=True)
    for idx, v in enumerate(fil_vends):
        v['pos_filial'] = idx + 1


def agrega_por_maioria(grupo_rcas, nome_chave):
    """Supervisor/Filial/Gerente jogam pela MAIORIA (>50%) da equipe em Vitória no dia — decisão
    do Vitório, 28/09/2026. Cada nível 'joga contra ele mesmo', dia a dia, igual o vendedor."""
    vitorias = empates = derrotas = 0
    pts_tabela = 0
    forma = []
    for d in DIAS_RODADA:
        resultados_dia = [resultado_dia_vendedor.get((rca, d)) for rca in grupo_rcas]
        resultados_dia = [r for r in resultados_dia if r is not None]
        if not resultados_dia:
            forma.append('D')
            derrotas += 1
            continue
        n_vitorias = sum(1 for r in resultados_dia if r == 'V')
        if n_vitorias == 0:
            resultado, pts = 'D', FAIXAS['derrota']['pontos_tabela']
        elif n_vitorias > len(resultados_dia) / 2:
            resultado, pts = 'V', FAIXAS['vitoria']['pontos_tabela']
        else:
            resultado, pts = 'E', FAIXAS['empate']['pontos_tabela']
        forma.append(resultado)
        pts_tabela += pts
        if resultado == 'V':
            vitorias += 1
        elif resultado == 'E':
            empates += 1
        else:
            derrotas += 1
    return vitorias, empates, derrotas, pts_tabela, forma


# 3. Tabela Série A (Filiais) — pela MAIORIA dos vendedores da filial em Vitória no dia.
filiais_tabela = []
for fil in FILIAIS_VALIDAS:
    vends = [v for v in vendedores_lista if v['filial'] == fil]
    rcas_fil = [v['rca'] for v in vends]
    vitorias, empates, derrotas, pts_tabela, forma = agrega_por_maioria(rcas_fil, fil)
    tot_gp = sum(v['gp'] for v in vends)
    tot_gc = sum(v['gc'] for v in vends)
    filiais_tabela.append({
        'sigla': fil, 'total_vendedores': len(vends), 'jogos': len(DIAS_RODADA), 'pts_tabela': pts_tabela,
        'vitorias': vitorias, 'empates': empates, 'derrotas': derrotas,
        'gp': tot_gp, 'gc': tot_gc, 'sg': tot_gp - tot_gc,
        'aprov': round((pts_tabela / (len(DIAS_RODADA) * 3)) * 100, 1) if DIAS_RODADA else 0,
        'super_pedidos': sum(v['super_pedidos'] for v in vends),
        'inativos_resgatados': sum(v['inativos_resgatados'] for v in vends), 'forma': forma
    })
filiais_tabela.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg'], x['gp']), reverse=True)
for idx, f in enumerate(filiais_tabela):
    f['pos'] = idx + 1

# 4. Tabela Gerentes — mesma lógica de maioria, agregada pelas equipes do gerente.
gerentes_tabela = []
# Gerente = FILIAL + nome (decisao do Vitorio, 03/10/2026): o mesmo primeiro nome existe em filiais diferentes
# (Fabio Machado em TBL e Fabio Colares em TPH) e NAO podem virar um gerente so.
NOME_COMPLETO_GERENTE = {('TBL', 'Fábio'): 'Fábio Machado', ('TPH', 'Fábio'): 'Fábio Colares'}
gerentes_set = sorted(set((v['filial'], v['gerente']) for v in vendedores_lista if v['gerente']))
for fil_g, g in gerentes_set:
    vends = [v for v in vendedores_lista if v['gerente'] == g and v['filial'] == fil_g]
    rcas_ger = [v['rca'] for v in vends]
    vitorias, empates, derrotas, pts_tabela, forma = agrega_por_maioria(rcas_ger, g)
    tot_gp = sum(v['gp'] for v in vends)
    tot_gc = sum(v['gc'] for v in vends)
    gerentes_tabela.append({
        'nome': NOME_COMPLETO_GERENTE.get((fil_g, g), g), 'filiais': sorted(set(v['filial'] for v in vends)), 'total_vendedores': len(vends),
        'jogos': len(DIAS_RODADA), 'pts_tabela': pts_tabela, 'vitorias': vitorias, 'empates': empates,
        'derrotas': derrotas, 'gp': tot_gp, 'gc': tot_gc, 'sg': tot_gp - tot_gc,
        'aprov': round((pts_tabela / (len(DIAS_RODADA) * 3)) * 100, 1) if DIAS_RODADA else 0, 'forma': forma
    })
gerentes_tabela.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg']), reverse=True)
for idx, g in enumerate(gerentes_tabela):
    g['pos'] = idx + 1

# 5. Tabela Supervisores — mesma lógica de maioria, agregada pela equipe dele.
# ---------------------------------------------------------------------------
# PLUS DE LIDERANCA do supervisor (regras do Vitorio, 03-04/10/2026, em config/pontuacao_brasileirao.json):
#   Compromisso Matinal ate 10:00 (o CEVEN trava as 10:00: "feito" = feito ate as 10:00) .... +15
#   Inicio e execucao do RET de campo (RECOMENDADO, nao obrigatorio) ...................... +25
#   Zero devolucoes na equipe no dia (Fair Play) ........................................... +30
#   So BONUS: nao atingiu = 0, sem punicao. So dias de rodada (segunda a sexta, sem feriado).
# Entradas vem de scripts/coletar_plus_lideranca.js (scratch/plus_inputs.json). Sem o arquivo, ou supervisor que o
# CEVEN nao devolveu => plus_lideranca = None (a tela mostra "—"). NUNCA inventa: Fair Play so conta se o banco de
# devolucoes cobre o dia; senao fica pendente (None) e o total marca plus_pendente.
# ---------------------------------------------------------------------------
import re as _re, unicodedata as _ud
def _norm_nome(n):
    n = _re.sub(r'^CLT\s*-\s*', '', str(n or ''), flags=_re.I)
    n = _re.sub(r'^CLT\s+', '', n, flags=_re.I)
    n = _ud.normalize('NFD', n)
    n = ''.join(c for c in n if _ud.category(c) != 'Mn').upper()
    return _re.sub(r'\s+', ' ', _re.sub(r'[^A-Z ]', '', n)).strip()

PLUS_PONTOS = {'compromisso': 15, 'ret': 25, 'fair_play': 30}
try:
    _cfg_plus = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config', 'pontuacao_brasileirao.json'), encoding='utf-8'))['plus_lideranca_supervisor']
    PLUS_PONTOS = {'compromisso': _cfg_plus['compromisso_matinal_ate_10h00']['pontos'], 'ret': _cfg_plus['ret_inicio_e_execucao']['pontos'], 'fair_play': _cfg_plus['zero_devolucoes_equipe_no_dia']['pontos']}
except Exception as _e:
    print('Aviso: pontos do Plus lidos do padrao (config ausente):', _e)

PLUS_INPUTS = None
_plus_path = os.environ.get('BRASILEIRAO_PLUS_INPUTS') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'plus_inputs.json')
if os.path.exists(_plus_path):
    try:
        PLUS_INPUTS = json.load(open(_plus_path, encoding='utf-8'))
        print('Plus: entradas carregadas de', _plus_path, '|', len(PLUS_INPUTS.get('supervisores', {})), 'supervisores')
    except Exception as _e:
        print('Aviso: plus_inputs.json ilegivel, Plus fica "—":', _e)
else:
    print('Plus: sem plus_inputs.json — coluna Plus fica "—" (rode scripts/coletar_plus_lideranca.js)')

def calcula_plus(fil, nome):
    """Devolve (total, detalhe, pendente) ou (None, None, None) se nao houver dado real."""
    if not PLUS_INPUTS:
        return None, None, None
    info = PLUS_INPUTS.get('supervisores', {}).get(f"{fil}|{_norm_nome(nome)}")
    if not info:
        return None, None, None
    dev = PLUS_INPUTS.get('devolucoes') or {}
    dev_ate = dev.get('ate') if dev.get('disponivel') else None
    total, pendente, detalhe = 0, False, {}
    for d in DIAS_RODADA:
        comp = PLUS_PONTOS['compromisso'] if info.get('compromisso', {}).get(d) else 0
        ret = PLUS_PONTOS['ret'] if info.get('ret', {}).get(d) else 0
        if dev_ate and dev_ate >= d:
            fair = 0 if dev.get('porSupDia', {}).get(f"{fil}|{_norm_nome(nome)}|{d}") else PLUS_PONTOS['fair_play']
        else:
            fair = None  # banco de devolucoes ainda nao cobre o dia: nao da nem tira
            pendente = True
        detalhe[d] = {'compromisso': comp, 'ret': ret, 'fair_play': fair}
        total += comp + ret + (fair or 0)
    return total, detalhe, pendente


sups_tabela = []
# "GERENTE MCD" / "GERENTE TPH" etc. NAO sao supervisores: sao vendedores ligados direto ao gerente (sem supervisor).
# Decisao do Vitorio, 03/10/2026: ficam FORA da Liga dos Supervisores; os vendedores continuam no ranking de vendedores
# e contam na equipe do gerente.
def eh_supervisor_de_verdade(nome):
    n = str(nome).strip().upper()
    # "GERENTE <FILIAL>", "RCAS INATIVOS" e "VENDA EMPRESA (INTERNO)" nao sao pessoas/supervisores (decisao do Vitorio, 04/10/2026)
    return not (n.startswith('GERENTE ') or n.startswith('RCAS INATIVOS') or n.startswith('VENDA EMPRESA'))
sups_set = set((v['filial'], v['supervisor']) for v in vendedores_lista if v['supervisor'] and eh_supervisor_de_verdade(v['supervisor']))
for fil, s in sups_set:
    vends = [v for v in vendedores_lista if v['filial'] == fil and v['supervisor'] == s]
    if not vends:
        continue
    rcas_sup = [v['rca'] for v in vends]
    vitorias, empates, derrotas, pts_tabela, forma = agrega_por_maioria(rcas_sup, s)
    tot_gp = sum(v['gp'] for v in vends)
    plus_total, plus_detalhe, plus_pendente = calcula_plus(fil, s)
    tot_gc = sum(v['gc'] for v in vends)
    sups_tabela.append({
        'supervisor': s, 'filial': fil, 'gerente': vends[0]['gerente'], 'total_vendedores': len(vends),
        'jogos': len(DIAS_RODADA), 'pts_tabela': pts_tabela, 'vitorias': vitorias, 'empates': empates,
        'derrotas': derrotas, 'gp': tot_gp, 'gc': tot_gc, 'sg': tot_gp - tot_gc,
        'aprov': round((pts_tabela / (len(DIAS_RODADA) * 3)) * 100, 1) if DIAS_RODADA else 0, 'forma': forma,
        'plus_lideranca': plus_total, 'plus_detalhe': plus_detalhe, 'plus_pendente': plus_pendente
    })
# O PLUS NAO SOMA PONTOS: e criterio de DESEMPATE (decisao do Vitorio, 04/10/2026). Ordem: pontos do time (V/E/D),
# depois Plus de Lideranca acumulado, depois vitorias, depois saldo de gols. Supervisor sem Plus (sem dado) conta 0.
sups_tabela.sort(key=lambda x: (x['pts_tabela'], x['plus_lideranca'] or 0, x['vitorias'], x['sg']), reverse=True)
for idx, s in enumerate(sups_tabela):
    s['pos'] = idx + 1

# Exportar JSON Final
resultado_final = {
    'gerado_em': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    'conceito': 'Cada Dia é um Jogo — pontuação real por tipo de lance (config/pontuacao_brasileirao.json)',
    'config_pontuacao_versao': CONFIG_PONTOS.get('atualizado_em'),
    'dias_rodada': DIAS_RODADA,
    'total_lances_auditados': len(d1_data),
    'filiais': filiais_tabela,
    'gerentes': gerentes_tabela,
    'supervisores': sups_tabela,
    'vendedores': vendedores_lista
}

with open(os.environ.get('BRASILEIRAO_SAIDA') or 'public/dados_brasileirao.json', 'w', encoding='utf-8') as f:  # BRASILEIRAO_SAIDA so para teste
    json.dump(resultado_final, f, ensure_ascii=False, indent=2)

print("✅ Novo dataset do Brasileirão gerado com sucesso (100% online, pontuação real)!")
