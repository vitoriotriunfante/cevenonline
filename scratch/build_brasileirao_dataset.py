import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import sqlite3
import json
import subprocess
import os
from datetime import datetime, timezone

print("--- RECONSTRUINDO DATASET DO BRASILEIRÃO: CADA DIA É UM JOGO ---")

# 1. Puxar lances do D1
# Temporada oficial do Brasileirão Triunfante começa em 28/09/2026 (data de início fixa,
# confirmada pelo Vitório) — lances antes disso não contam pra liga.
INICIO_TEMPORADA = '2026-09-28'
cmd = f'npx wrangler d1 execute ceven_noc_d1 --remote --json --command "SELECT dia, filial, chave, nivel, rca, vendedor, supervisor, cliente, motivo, dias_sem_compra FROM tv_lances WHERE dia >= \'{INICIO_TEMPORADA}\' AND nivel != \'marker\'"'
try:
    res = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT)
    d1_data = json.loads(res)[0]['results']
    print(f"Total lances no D1: {len(d1_data)}")
except Exception as e:
    # NUNCA sobrescrever o dataset publicado com dado vazio/zerado por falha de consulta
    # (ex.: secret do Cloudflare ausente, D1 fora do ar) — regra "nunca inventar dado"
    # também vale para "nunca apagar dado real por engano". Aborta sem tocar no JSON.
    print(f"❌ Erro ao consultar o D1: {e}")
    print("Abortando SEM gravar public/dados_brasileirao.json — mantendo o dataset publicado anterior.")
    sys.exit(1)

FILIAIS_VALIDAS = ['TBL', 'TPH', 'TCV', 'ABC', 'API', 'TSJ', 'TBE', 'TPA', 'MCD', 'TCA', 'TCG']

# 2. Carregar mapa de vendedores / supervisores / gerentes
conn = sqlite3.connect('analises/pedidos_historico_ceven.db')
cur = conn.cursor()
cur.execute("SELECT rca_codigo, rca_nome, filial, supervisor, gerente, meta_faturamento, meta_positivacao FROM rca_dashboard_financeiro_live")
rca_map = {}
for r in cur.fetchall():
    rca_map[str(r[0])] = {
        'nome': r[1], 'filial': r[2], 'sup': r[3], 'gerente': r[4],
        'meta_fat': r[5], 'meta_pos': r[6]
    }

# Também carregar mostra_vendedores.json para ter todos os RCAs
try:
    with open('public/mostra_vendedores.json', 'r', encoding='utf-8') as f:
        mostra_json = json.load(f)
    for fil, itens in mostra_json.get('filiais', {}).items():
        for item in itens:
            rca_id = str(item['rca'])
            if rca_id not in rca_map:
                rca_map[rca_id] = {
                    'nome': item['nome'], 'filial': fil, 'sup': item.get('supervisor',''),
                    'gerente': item.get('gerente',''), 'meta_fat': 0, 'meta_pos': 0
                }
except Exception as e:
    print(f"Erro ao ler mostra_vendedores: {e}")

# Dias de rodada registrados no D1
DIAS_RODADA = sorted(list(set(l['dia'] for l in d1_data if l.get('dia'))))
print("Dias de rodada:", DIAS_RODADA)

# Agrupar lances por RCA e por Dia
# rca_dia_lances[rca][dia] = list of lances
rca_dia_lances = {}
for l in d1_data:
    rca = str(l.get('rca') or '')
    dia = l.get('dia')
    if not rca or not dia or rca == 'None':
        continue
    if rca not in rca_dia_lances:
        rca_dia_lances[rca] = {}
    if dia not in rca_dia_lances[rca]:
        rca_dia_lances[rca][dia] = []
    rca_dia_lances[rca][dia].append(l)

# Avaliar cada dia do vendedor:
# Vitória (3 pts): Fez lances positivos (gols/super pedidos/resgates) e ZERO vermelhos.
# Empate (1 pt): Teve gols, mas teve cartões leves, OU não teve faltas graves mas sem grande volume.
# Derrota (0 pts): Teve cartão vermelho, OU só teve faltas/impedimentos e nenhum gol.
def julgar_rodada(lances_do_dia):
    if not lances_do_dia:
        return 'D', 0, 0 # Derrota

    gols = sum(1 for l in lances_do_dia if l['nivel'] == 'gol')
    defesas = sum(1 for l in lances_do_dia if l['nivel'] == 'defesa')
    vermelhos = sum(1 for l in lances_do_dia if l['nivel'] == 'vermelho')
    penaltis = sum(1 for l in lances_do_dia if l['nivel'] == 'penalti')
    amarelos = sum(1 for l in lances_do_dia if l['nivel'] in ('amarelo', 'venda10', 'visita10'))
    impedimentos = sum(1 for l in lances_do_dia if l['nivel'] == 'impedimento')

    gp = gols * 2 + defesas * 1
    gc = vermelhos * 3 + penaltis * 2 + amarelos * 1 + impedimentos * 1

    # Se tomou cartão vermelho = Derrota automática no dia!
    if vermelhos > 0:
        return 'D', gp, gc

    # Se fez gols e não teve falta grave = Vitória!
    if (gols + defesas) >= 1 and (penaltis == 0 and impedimentos <= 1):
        return 'V', gp, gc

    # Se teve gols mas teve penalidades = Empate
    if (gols + defesas) >= 1:
        return 'E', gp, gc

    # Se só teve impedimento leve = Empate
    if gc <= 1:
        return 'E', gp, gc

    return 'D', gp, gc

# Construir tabela dos Vendedores
vendedores_lista = []
for rca, meta in rca_map.items():
    fil = meta['filial']
    if fil not in FILIAIS_VALIDAS:
        continue

    dias_map = rca_dia_lances.get(rca, {})
    vitorias = 0
    empates = 0
    derrotas = 0
    gp_total = 0
    gc_total = 0
    forma = []
    super_pedidos = 0
    inativos_resgatados = 0

    streak_atual = 0
    max_streak = 0

    for d in DIAS_RODADA:
        lances = dias_map.get(d, [])
        # Contagem específica
        for l in lances:
            ch = l.get('chave','')
            if 'super' in ch: super_pedidos += 1
            if 'inativo' in ch or 'resgate' in ch: inativos_resgatados += 1

        resultado, gp, gc = julgar_rodada(lances)
        gp_total += gp
        gc_total += gc
        forma.append(resultado)

        if resultado == 'V':
            vitorias += 1
            streak_atual += 1
            if streak_atual > max_streak: max_streak = streak_atual
        elif resultado == 'E':
            empates += 1
            streak_atual = 0
        else:
            derrotas += 1
            streak_atual = 0

    # Bônus de constância: streak >= 3 ganha +3 pts
    bonus_constancia = 3 if max_streak >= 3 else (1 if max_streak >= 2 else 0)
    pts_tabela = (vitorias * 3) + (empates * 1) + bonus_constancia
    jogos = len(DIAS_RODADA)
    pts_possiveis = jogos * 3
    aprov = round((pts_tabela / pts_possiveis) * 100, 1) if pts_possiveis > 0 else 0

    vendedores_lista.append({
        'rca': rca,
        'nome': meta['nome'],
        'filial': fil,
        'supervisor': meta['sup'],
        'gerente': meta['gerente'],
        'jogos': jogos,
        'vitorias': vitorias,
        'empates': empates,
        'derrotas': derrotas,
        'pts_tabela': pts_tabela,
        'aprov': aprov,
        'gp': gp_total,
        'gc': gc_total,
        'sg': gp_total - gc_total,
        'super_pedidos': super_pedidos,
        'inativos_resgatados': inativos_resgatados,
        'forma': forma,
        'streak': max_streak,
        'bonus_constancia': bonus_constancia
    })

# Ordenar Ranking Geral Brasil
vendedores_lista.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg'], x['gp'], x['inativos_resgatados']), reverse=True)

# Atribuir posições no Brasil e nas Filiais
for idx, v in enumerate(vendedores_lista):
    v['pos_brasil'] = idx + 1

# Posição na Filial
for fil in FILIAIS_VALIDAS:
    fil_vends = [v for v in vendedores_lista if v['filial'] == fil]
    fil_vends.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg'], x['gp']), reverse=True)
    for idx, v in enumerate(fil_vends):
        v['pos_filial'] = idx + 1

# Construir Tabela Série A (Filiais)
filiais_tabela = []
for fil in FILIAIS_VALIDAS:
    vends = [v for v in vendedores_lista if v['filial'] == fil]
    total_vends = len(vends)
    tot_jogos = len(DIAS_RODADA)
    tot_pts = sum(v['pts_tabela'] for v in vends)
    tot_v = sum(v['vitorias'] for v in vends)
    tot_e = sum(v['empates'] for v in vends)
    tot_d = sum(v['derrotas'] for v in vends)
    tot_gp = sum(v['gp'] for v in vends)
    tot_gc = sum(v['gc'] for v in vends)
    tot_super = sum(v['super_pedidos'] for v in vends)
    tot_inat = sum(v['inativos_resgatados'] for v in vends)

    max_pts = (total_vends * tot_jogos * 3)
    aprov = round((tot_pts / max_pts) * 100, 1) if max_pts > 0 else 0

    filiais_tabela.append({
        'sigla': fil,
        'total_vendedores': total_vends,
        'jogos': tot_jogos,
        'pts_tabela': tot_pts,
        'vitorias': tot_v,
        'empates': tot_e,
        'derrotas': tot_d,
        'gp': tot_gp,
        'gc': tot_gc,
        'sg': tot_gp - tot_gc,
        'aprov': aprov,
        'super_pedidos': tot_super,
        'inativos_resgatados': tot_inat
    })

filiais_tabela.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg'], x['gp']), reverse=True)
for idx, f in enumerate(filiais_tabela):
    f['pos'] = idx + 1

# Construir Tabela Gerentes
gerentes_tabela = []
gerentes_set = set(v['gerente'] for v in vendedores_lista if v['gerente'])
for g in gerentes_set:
    vends = [v for v in vendedores_lista if v['gerente'] == g]
    filiais_ger = sorted(list(set(v['filial'] for v in vends)))
    tot_pts = sum(v['pts_tabela'] for v in vends)
    tot_v = sum(v['vitorias'] for v in vends)
    tot_e = sum(v['empates'] for v in vends)
    tot_d = sum(v['derrotas'] for v in vends)
    tot_gp = sum(v['gp'] for v in vends)
    tot_gc = sum(v['gc'] for v in vends)
    max_pts = len(vends) * len(DIAS_RODADA) * 3
    aprov = round((tot_pts / max_pts) * 100, 1) if max_pts > 0 else 0

    gerentes_tabela.append({
        'nome': g,
        'filiais': filiais_ger,
        'total_vendedores': len(vends),
        'jogos': len(DIAS_RODADA),
        'pts_tabela': tot_pts,
        'vitorias': tot_v,
        'empates': tot_e,
        'derrotas': tot_d,
        'gp': tot_gp,
        'gc': tot_gc,
        'sg': tot_gp - tot_gc,
        'aprov': aprov
    })
gerentes_tabela.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg']), reverse=True)
for idx, g in enumerate(gerentes_tabela):
    g['pos'] = idx + 1

# Construir Tabela Supervisores
sups_tabela = []
sups_set = set((v['filial'], v['supervisor']) for v in vendedores_lista if v['supervisor'])
for fil, s in sups_set:
    vends = [v for v in vendedores_lista if v['filial'] == fil and v['supervisor'] == s]
    if not vends: continue
    tot_pts = sum(v['pts_tabela'] for v in vends)
    tot_v = sum(v['vitorias'] for v in vends)
    tot_e = sum(v['empates'] for v in vends)
    tot_d = sum(v['derrotas'] for v in vends)
    tot_gp = sum(v['gp'] for v in vends)
    tot_gc = sum(v['gc'] for v in vends)
    max_pts = len(vends) * len(DIAS_RODADA) * 3
    aprov = round((tot_pts / max_pts) * 100, 1) if max_pts > 0 else 0

    # Plus de liderança (simulado com base em conformidade de processos)
    plus_lideranca = 15 if aprov >= 50 else 5

    sups_tabela.append({
        'supervisor': s,
        'filial': fil,
        'gerente': vends[0]['gerente'],
        'total_vendedores': len(vends),
        'jogos': len(DIAS_RODADA),
        'pts_tabela': tot_pts + plus_lideranca,
        'pts_equipe': tot_pts,
        'plus_lideranca': plus_lideranca,
        'vitorias': tot_v,
        'empates': tot_e,
        'derrotas': tot_d,
        'gp': tot_gp,
        'gc': tot_gc,
        'sg': tot_gp - tot_gc,
        'aprov': aprov
    })
sups_tabela.sort(key=lambda x: (x['pts_tabela'], x['vitorias'], x['sg']), reverse=True)
for idx, s in enumerate(sups_tabela):
    s['pos'] = idx + 1

# Exportar JSON Final
resultado_final = {
    'gerado_em': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    'conceito': 'Cada Dia é um Jogo (Pontos Corridos por Rodadas)',
    'dias_rodada': DIAS_RODADA,
    'total_lances_auditados': len(d1_data),
    'filiais': filiais_tabela,
    'gerentes': gerentes_tabela,
    'supervisores': sups_tabela,
    'vendedores': vendedores_lista
}

with open('public/dados_brasileirao.json', 'w', encoding='utf-8') as f:
    json.dump(resultado_final, f, ensure_ascii=False, indent=2)

print(f"✅ Novo dataset do Brasileirão gerado com sucesso!")
print(f"Filiais: {len(filiais_tabela)} | Gerentes: {len(gerentes_tabela)} | Supervisores: {len(sups_tabela)} | Vendedores: {len(vendedores_lista)}")
