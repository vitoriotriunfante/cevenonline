import requests
import urllib3
import json
import sqlite3
import os
import openpyxl

urllib3.disable_warnings()

headers = {'User-Agent': 'Mozilla/5.0'}
BASE_RV = 'https://mapa.drivetriunfante-lastmile.com.br/rv/api'
MES = '2026-09'

db_path = os.path.join(os.path.dirname(__file__), 'pedidos_historico_ceven.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("================================================================================")
print(" EXTRAÇÃO E INTEGRAÇÃO: PREMIAÇÃO (RV), METAS E RET (NOVO HAR 14/09)")
print("================================================================================")

# 1. Extrair Metas Oficiais de Premiação / RV (Setembro/2026)
print("\n1. Baixando Metas de Premiação/RV (/rv/api/metas)...")
try:
    r_metas = requests.get(f"{BASE_RV}/metas?mes={MES}", headers=headers, verify=False, timeout=30)
    if r_metas.status_code == 200:
        data_metas = r_metas.json()
        rows_metas = data_metas.get('rows', [])
        print(f"   -> {len(rows_metas)} metas encontradas!")
        
        # Salvar em JSON de backup
        with open(os.path.join(os.path.dirname(__file__), 'METAS_PREMIACAO_RV_SETEMBRO.json'), 'w', encoding='utf-8') as f:
            json.dump(rows_metas, f, ensure_ascii=False, indent=2)
            
        # Salvar em SQLite
        cursor.execute("DROP TABLE IF EXISTS metas_premiacao_rv_setembro")
        cursor.execute("""
            CREATE TABLE metas_premiacao_rv_setembro (
                cod_vendedor INTEGER,
                cnpj_fornecedor TEXT,
                fornecedor TEXT,
                tipo_meta INTEGER,
                meta REAL,
                peso REAL,
                pct_minimo REAL,
                pct_acima REAL,
                recorrente INTEGER
            )
        """)
        for m in rows_metas:
            cursor.execute("""
                INSERT INTO metas_premiacao_rv_setembro VALUES (?,?,?,?,?,?,?,?,?)
            """, (
                m.get('cod_vendedor'), str(m.get('cnpj_fornecedor')), m.get('fornecedor'),
                m.get('tipo_meta'), m.get('meta'), m.get('peso'), m.get('pct_minimo'),
                m.get('pct_acima'), m.get('recorrente')
            ))
        conn.commit()
        print("   -> Tabela SQLite 'metas_premiacao_rv_setembro' populada com sucesso!")
except Exception as e:
    print(f"   Erro ao baixar metas: {e}")

# 2. Extrair Apuração Agregada de Premiação / RV (Setembro/2026)
print("\n2. Baixando Apuração Agregada Realizada (/rv/api/apuracao-agregada)...")
try:
    r_apur = requests.get(f"{BASE_RV}/apuracao-agregada?mes={MES}", headers=headers, verify=False, timeout=35)
    if r_apur.status_code == 200:
        data_apur = r_apur.json()
        fornecedores_apur = data_apur.get('fornecedores', [])
        print(f"   -> {len(fornecedores_apur)} registros de apuração de RV encontrados!")
        
        with open(os.path.join(os.path.dirname(__file__), 'APURACAO_PREMIACAO_RV_SETEMBRO.json'), 'w', encoding='utf-8') as f:
            json.dump(fornecedores_apur, f, ensure_ascii=False, indent=2)
            
        cursor.execute("DROP TABLE IF EXISTS apuracao_premiacao_rv_setembro")
        cursor.execute("""
            CREATE TABLE apuracao_premiacao_rv_setembro (
                codusur INTEGER,
                cnpj_fornecedor TEXT,
                fat_faturado REAL,
                fat_vendas REAL,
                mix_faturado INTEGER,
                mix_vendas INTEGER,
                fase_faturado REAL,
                fase_vendas REAL,
                pos_faturado INTEGER,
                pos_vendas INTEGER
            )
        """)
        for a in fornecedores_apur:
            cursor.execute("""
                INSERT INTO apuracao_premiacao_rv_setembro VALUES (?,?,?,?,?,?,?,?,?,?)
            """, (
                a.get('CODUSUR'), str(a.get('cnpj_fornecedor')),
                a.get('fat_f'), a.get('fat_v'),
                a.get('mix_f'), a.get('mix_v'),
                a.get('fase_f'), a.get('fase_v'),
                a.get('pos_f'), a.get('pos_v')
            ))
        conn.commit()
        print("   -> Tabela SQLite 'apuracao_premiacao_rv_setembro' populada com sucesso!")
except Exception as e:
    print(f"   Erro ao baixar apuração agregada: {e}")

# 3. Extrair Metas de Ticket Médio e Mix (/rv/api/metas-tmmix)
print("\n3. Baixando Metas de Ticket Médio & Mix (/rv/api/metas-tmmix)...")
try:
    r_tmmix = requests.get(f"{BASE_RV}/metas-tmmix?mes={MES}", headers=headers, verify=False, timeout=60)
    if r_tmmix.status_code == 200:
        data_tmmix = r_tmmix.json()
        rows_tmmix = data_tmmix.get('rows', [])
        print(f"   -> {len(rows_tmmix)} metas de TM e Mix encontradas!")
        
        with open(os.path.join(os.path.dirname(__file__), 'METAS_TM_MIX_SETEMBRO.json'), 'w', encoding='utf-8') as f:
            json.dump(rows_tmmix, f, ensure_ascii=False, indent=2)
            
        cursor.execute("DROP TABLE IF EXISTS metas_ticket_medio_mix")
        cursor.execute("""
            CREATE TABLE metas_ticket_medio_mix (
                codusur INTEGER,
                cnpj_fornecedor TEXT,
                meta_tm REAL,
                meta_mix REAL,
                meses INTEGER,
                fallback INTEGER
            )
        """)
        for tm in rows_tmmix:
            cursor.execute("""
                INSERT INTO metas_ticket_medio_mix VALUES (?,?,?,?,?,?)
            """, (
                tm.get('CODUSUR'), str(tm.get('cnpj_fornecedor')),
                tm.get('meta_tm'), tm.get('meta_mix'),
                tm.get('meses'), tm.get('fallback')
            ))
        conn.commit()
        print("   -> Tabela SQLite 'metas_ticket_medio_mix' populada com sucesso!")
except Exception as e:
    print(f"   Erro ao baixar metas TM/Mix: {e}")

# 4. Extrair Tabela de Usuários WinThor (/rv/api/pcusuari)
print("\n4. Baixando Cadastro de Usuários WinThor (/rv/api/pcusuari)...")
try:
    r_usr = requests.get(f"{BASE_RV}/pcusuari", headers=headers, verify=False, timeout=20)
    if r_usr.status_code == 200:
        data_usr = r_usr.json()
        rows_usr = data_usr.get('rows', [])
        print(f"   -> {len(rows_usr)} usuários WinThor encontrados!")
        
        cursor.execute("DROP TABLE IF EXISTS winthor_usuarios_vendas")
        cursor.execute("""
            CREATE TABLE winthor_usuarios_vendas (
                codusur INTEGER,
                nome TEXT,
                tipovend TEXT,
                cpf TEXT,
                codsupervisor INTEGER,
                nome_supervisor TEXT,
                filial INTEGER
            )
        """)
        for u in rows_usr:
            cursor.execute("""
                INSERT INTO winthor_usuarios_vendas VALUES (?,?,?,?,?,?,?)
            """, (
                u.get('CODUSUR'), u.get('NOME'), u.get('TIPOVEND'),
                u.get('CPF'), u.get('CODSUPERVISOR'), u.get('nome_supervisor'),
                u.get('filial')
            ))
        conn.commit()
        print("   -> Tabela SQLite 'winthor_usuarios_vendas' populada com sucesso!")
except Exception as e:
    print(f"   Erro ao baixar usuários WinThor: {e}")

# 5. Criar Planilha Excel de Auditoria e Apuração de Premiações
excel_out = os.path.join(os.path.dirname(__file__), 'APURACAO_PREMIACOES_E_METAS_SETEMBRO.xlsx')
print(f"\n5. Gerando Planilha Excel Completa ({excel_out})...")

wb = openpyxl.Workbook()
# Remover sheet default
wb.remove(wb.active)

# Aba 1: Metas de Premiação
cursor.execute("""
    SELECT 
        w.filial,
        w.nome_supervisor,
        m.cod_vendedor,
        w.nome as vendedor,
        m.fornecedor,
        m.tipo_meta,
        m.meta,
        m.peso,
        m.pct_minimo,
        m.pct_acima,
        m.recorrente
    FROM metas_premiacao_rv_setembro m
    LEFT JOIN winthor_usuarios_vendas w ON m.cod_vendedor = w.codusur
    ORDER BY w.filial, w.nome_supervisor, m.cod_vendedor, m.fornecedor
""")
res_metas = cursor.fetchall()
if res_metas:
    ws1 = wb.create_sheet('Metas_Premiacao_Vendedores')
    ws1.append(['Filial WinThor', 'Supervisor', 'Cód. RCA', 'Vendedor', 'Fornecedor/Indústria', 'Tipo Meta', 'Meta (R$ ou Un)', 'Peso', '% Mínimo', '% Acima', 'Recorrente'])
    for row in res_metas:
        ws1.append(list(row))
    print(f"   -> Aba 'Metas_Premiacao_Vendedores' criada com {len(res_metas)} linhas!")

# Aba 2: Apuração Realizada vs Meta (Conciliação RV)
cursor.execute("""
    SELECT 
        w.filial,
        w.nome_supervisor,
        a.codusur,
        w.nome as vendedor,
        m.fornecedor,
        COALESCE(m.meta, 0) as meta,
        a.fat_faturado,
        a.fat_vendas,
        ROUND(CASE WHEN m.meta > 0 THEN (a.fat_vendas / m.meta) * 100 ELSE 0 END, 1) as pct_atingimento,
        a.pos_faturado,
        a.pos_vendas,
        a.mix_faturado,
        a.mix_vendas
    FROM apuracao_premiacao_rv_setembro a
    LEFT JOIN winthor_usuarios_vendas w ON a.codusur = w.codusur
    LEFT JOIN metas_premiacao_rv_setembro m ON a.codusur = m.cod_vendedor AND a.cnpj_fornecedor = m.cnpj_fornecedor
    WHERE a.fat_vendas > 0 OR a.pos_vendas > 0
    ORDER BY w.filial, w.nome_supervisor, a.codusur
""")
res_apur = cursor.fetchall()
if res_apur:
    ws2 = wb.create_sheet('Apuracao_Realizado_vs_Meta')
    ws2.append(['Filial WinThor', 'Supervisor', 'Cód. RCA', 'Vendedor', 'Fornecedor', 'Meta (R$)', 'Faturado (R$)', 'Venda Total (R$)', '% Atingimento', 'Positivação Faturada', 'Positivação Total', 'Mix Faturado', 'Mix Total'])
    for row in res_apur:
        ws2.append(list(row))
    print(f"   -> Aba 'Apuracao_Realizado_vs_Meta' criada com {len(res_apur)} linhas!")

# Aba 3: Metas Ticket Médio e Mix
cursor.execute("""
    SELECT 
        w.filial,
        w.nome_supervisor,
        t.codusur,
        w.nome as vendedor,
        t.meta_tm,
        t.meta_mix,
        t.meses,
        t.fallback
    FROM metas_ticket_medio_mix t
    LEFT JOIN winthor_usuarios_vendas w ON t.codusur = w.codusur
    ORDER BY w.filial, w.nome_supervisor, t.codusur
""")
res_tmmix = cursor.fetchall()
if res_tmmix:
    ws3 = wb.create_sheet('Metas_Ticket_Medio_e_Mix')
    ws3.append(['Filial WinThor', 'Supervisor', 'Cód. RCA', 'Vendedor', 'Meta Ticket Médio (R$)', 'Meta Mix (SKUs)', 'Meses Histórico', 'Fallback'])
    for row in res_tmmix:
        ws3.append(list(row))
    print(f"   -> Aba 'Metas_Ticket_Medio_e_Mix' criada com {len(res_tmmix)} linhas!")

wb.save(excel_out)
print(f"   -> Planilha salva com sucesso: {excel_out}")
print("================================================================================")
print(" EXTRAÇÃO E INTEGRAÇÃO CONCLUÍDAS COM SUCESSO!")
print("================================================================================")
