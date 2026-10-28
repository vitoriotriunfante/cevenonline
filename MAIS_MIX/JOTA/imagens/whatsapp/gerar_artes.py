import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D = sys.argv[1]; OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
NAVY = (18, 32, 64); AZUL = (38, 84, 150); AZUL2 = (63, 119, 190); VERM = (200, 16, 46); OURO = (201, 162, 74); BRANCO = (255, 255, 255); CINZA = (220, 228, 240)
F = 'C:/Windows/Fonts/'
def fonte(nome, t):
    for n in nome:
        try: return ImageFont.truetype(F + n, t)
        except Exception: pass
    return ImageFont.load_default()
BLACK = ['ariblk.ttf', 'seguibl.ttf', 'arialbd.ttf']; BOLD = ['segoeuib.ttf', 'arialbd.ttf']; REG = ['segoeui.ttf', 'arial.ttf']; ITAL = ['segoeuiz.ttf', 'segoeuii.ttf', 'ariali.ttf']
def gradiente(w, h, c1, c2, diagonal=True):
    g = Image.new('RGB', (w, h)); px = g.load()
    for y in range(h):
        for x in range(0, w, 1):
            t = ((x / w) * 0.5 + (y / h) * 0.5) if diagonal else y / h
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return g
def sombra(img, raio=18, alpha=110, off=(10, 14)):
    a = img.getchannel('A'); s = Image.new('RGBA', img.size, (0, 0, 0, 0)); s.putalpha(a.point(lambda v: v * alpha // 255))
    s = s.filter(ImageFilter.GaussianBlur(raio)); base = Image.new('RGBA', (img.width + abs(off[0]) + raio * 2, img.height + abs(off[1]) + raio * 2), (0, 0, 0, 0))
    base.alpha_composite(s, (raio + off[0], raio + off[1])); base.alpha_composite(img, (raio, raio)); return base
def corta(img):
    return img.crop(img.getchannel('A').getbbox())
def detalhes(dr, w, h, escala=1.0):
    # motivo da marca Mais Mix: seta subindo + barras + estrela (discreto, no fundo)
    for i, (x, hh) in enumerate([(0.78, 0.18), (0.83, 0.26), (0.88, 0.34)]):
        dr.rounded_rectangle([w * x, h * (0.9 - hh), w * x + 26 * escala, h * 0.9], 6, fill=(255, 255, 255, 22))

# ---------------- FOTO DO PERFIL 640x640 (o WhatsApp corta em circulo) ----------------
S = 640
bg = gradiente(S, S, AZUL2, NAVY).convert('RGBA')
cam = Image.new('RGBA', (S, S), (0, 0, 0, 0)); dc = ImageDraw.Draw(cam)
for r, a in [(270, 34), (205, 30)]: dc.ellipse([S / 2 - r, S / 2 - r - 40, S / 2 + r, S / 2 + r - 40], fill=(255, 255, 255, a))
bg.alpha_composite(cam)
jota = corta(Image.open(os.path.join(D, 'bracos_cruzados.png')).convert('RGBA'))
alt = int(S * 0.98); jota = jota.resize((int(jota.width * alt / jota.height), alt), Image.LANCZOS)
js = sombra(jota, 14, 120, (6, 10))
bg.alpha_composite(js, ((S - js.width) // 2, int(S * 0.13)))
# faixa vermelha com o nome, dentro da area segura do circulo
fx0, fy0, fx1, fy1 = 150, 470, 490, 548
dr = ImageDraw.Draw(bg, 'RGBA')
dr.rounded_rectangle([fx0 + 4, fy0 + 6, fx1 + 4, fy1 + 6], 22, fill=(0, 0, 0, 90))
dr.rounded_rectangle([fx0, fy0, fx1, fy1], 22, fill=VERM, outline=BRANCO, width=4)
f1 = fonte(BLACK, 52); t = 'JOTA'; tw = dr.textlength(t, font=f1); dr.text(((S - tw) / 2, fy0 + 6), t, font=f1, fill=BRANCO)
f2 = fonte(BOLD, 21); t2 = 'MAIS MIX TRIUNFANTE'; tw2 = dr.textlength(t2, font=f2)
dr.rounded_rectangle([(S - tw2) / 2 - 14, fy1 + 10, (S + tw2) / 2 + 14, fy1 + 44], 14, fill=NAVY)
dr.text(((S - tw2) / 2, fy1 + 13), t2, font=f2, fill=OURO)
# anel do circulo (vermelho Triunfante)
anel = Image.new('RGBA', (S, S), (0, 0, 0, 0)); da = ImageDraw.Draw(anel)
da.ellipse([6, 6, S - 6, S - 6], outline=VERM, width=12); da.ellipse([20, 20, S - 20, S - 20], outline=(255, 255, 255, 120), width=3)
bg.alpha_composite(anel)
bg.convert('RGB').save(os.path.join(OUT, 'jota_perfil_whatsapp_640.png'), quality=95)
# previa redonda (como aparece no WhatsApp)
m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).ellipse([0, 0, S, S], fill=255)
pv = Image.new('RGBA', (S, S), (240, 242, 245, 255)); pv.paste(bg, (0, 0), m); pv.convert('RGB').save(os.path.join(OUT, '_previa_perfil_redondo.png'))

# ---------------- CAPA 1920x1080 (o WhatsApp Business mostra uma faixa central: o conteudo fica no meio) ----------------
W, H = 1920, 1080
cap = gradiente(W, H, NAVY, AZUL).convert('RGBA'); camada = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(camada)
# seta da marca subindo, ao fundo
pts = [(80, 1000), (560, 760), (760, 860), (1780, 120)]
dr.line(pts, fill=(255, 255, 255, 20), width=40, joint='curve')
dr.polygon([(1800, 70), (1860, 190), (1730, 175)], fill=(255, 255, 255, 20))
for i, x in enumerate([1660, 1730, 1800]): dr.rounded_rectangle([x, 1030 - 80 * (i + 1), x + 44, 1030], 10, fill=(255, 255, 255, 16))
# estrela dourada
import math
def estrela(cx, cy, r, cor):
    p = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5; rr = r if k % 2 == 0 else r * 0.45
        p.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    dr.polygon(p, fill=cor)
estrela(1830, 70, 30, OURO + (230,))
cap.alpha_composite(camada); dr = ImageDraw.Draw(cap)
# JOTA na lateral esquerda
jp = corta(Image.open(os.path.join(D, 'apoio_apontar.png')).convert('RGBA'))
alt = 930; jp = jp.resize((int(jp.width * alt / jp.height), alt), Image.LANCZOS)
sj = sombra(jp, 20, 120, (10, 14)); cap.alpha_composite(sj, (40, H - sj.height + 30))
# ESCRITAS NA LATERAL DIREITA (x0 = 1220, liberando o centro para a foto de perfil redonda do WhatsApp)
x0 = 1220
f_i = fonte(BOLD, 33); f_r = fonte(REG, 26); f_b = fonte(ITAL, 32)
dr = ImageDraw.Draw(cap, 'RGBA')
dr.text((x0, 210), 'Eu sou o', font=fonte(BOLD, 42), fill=CINZA)
dr.text((x0, 250), 'JOTA', font=fonte(BLACK, 96), fill=BRANCO)
wj = dr.textlength('JOTA', font=fonte(BLACK, 96))
dr.rounded_rectangle([x0 + wj + 24, 282, x0 + wj + 24 + 430, 338], 16, fill=VERM)
dr.text((x0 + wj + 40, 290), 'assistente do Comercial', font=fonte(BOLD, 30), fill=BRANCO)
itens = [
    ('Meta e positivação', 'do grupo ao vendedor, na hora'),
    ('Rota, visitas e zerados', 'cliente por cliente'),
    ('+MIX e produtos', 'quem comprou, quem parou, o que levar'),
    ('Liga Champions', 'lances, pontos e ranking')
]
y = 380
for i, (a, b) in enumerate(itens):
    dr.ellipse([x0, y + 4, x0 + 38, y + 42], fill=OURO); n = str(i + 1); dr.text((x0 + 19 - dr.textlength(n, font=fonte(BLACK, 24)) / 2, y + 7), n, font=fonte(BLACK, 24), fill=NAVY)
    dr.text((x0 + 52, y), a, font=f_i, fill=BRANCO); dr.text((x0 + 52, y + 40), b, font=f_r, fill=CINZA); y += 92
dr.text((x0, y + 16), 'É só perguntar do seu jeito aqui no WhatsApp.', font=fonte(REG, 28), fill=CINZA)
dr.rounded_rectangle([x0, y + 64, x0 + 440, y + 116], 24, outline=OURO, width=2)
dr.text((x0 + 20, y + 72), 'Meu DNA é Triunfante!', font=f_b, fill=OURO)
cap.convert('RGB').save(os.path.join(OUT, 'jota_capa_whatsapp_1920x1080.png'), quality=95)
print('ok')

# ---------------- CAPA FAIXA 1920x690 (proporcao que o WhatsApp Business mostra: ~2,8:1) ----------------
W, H = 1920, 690
cap = gradiente(W, H, NAVY, AZUL).convert('RGBA'); camada = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dc = ImageDraw.Draw(camada)
dc.line([(0, 640), (430, 470), (600, 560), (1840, 70)], fill=(255, 255, 255, 18), width=34, joint='curve')
for i, x in enumerate([1720, 1785, 1850]): dc.rounded_rectangle([x, 660 - 70 * (i + 1), x + 40, 660], 9, fill=(255, 255, 255, 14))
cap.alpha_composite(camada); dr = ImageDraw.Draw(cap)
estrela(1865, 60, 26, OURO)
jp = corta(Image.open(os.path.join(D, 'apoio_apontar.png')).convert('RGBA'))
alt = 980; jp = jp.resize((int(jp.width * alt / jp.height), alt), Image.LANCZOS)
sj = sombra(jp, 16, 110, (8, 10)); cap.alpha_composite(sj, (30, 40))   # JOTA na lateral esquerda
# ESCRITAS NA LATERAL DIREITA (x0 = 1220)
x0 = 1220
dr.text((x0, 45), 'Eu sou o', font=fonte(BOLD, 34), fill=CINZA)
dr.text((x0, 80), 'JOTA', font=fonte(BLACK, 84), fill=BRANCO)
wj = dr.textlength('JOTA', font=fonte(BLACK, 84))
dr.rounded_rectangle([x0 + wj + 20, 106, x0 + wj + 20 + 380, 156], 14, fill=VERM)
dr.text((x0 + wj + 32, 114), 'assistente do Comercial', font=fonte(BOLD, 26), fill=BRANCO)
itens = [
    ('Meta e positivação', 'do grupo ao vendedor, na hora'),
    ('Rota, visitas e zerados', 'cliente por cliente'),
    ('+MIX e produtos', 'quem comprou, quem parou'),
    ('Liga Champions', 'lances, pontos e ranking')
]
y = 182
for i, (a, b) in enumerate(itens):
    dr.ellipse([x0, y + 2, x0 + 34, y + 36], fill=OURO); n = str(i + 1); fn = fonte(BLACK, 22); dr.text((x0 + 17 - dr.textlength(n, font=fn) / 2, y + 5), n, font=fn, fill=NAVY)
    dr.text((x0 + 46, y - 2), a, font=fonte(BOLD, 28), fill=BRANCO); dr.text((x0 + 46, y + 34), b, font=fonte(REG, 22), fill=CINZA)
    y += 76
dr.text((x0, y + 10), 'É só perguntar do seu jeito, aqui no WhatsApp.', font=fonte(REG, 24), fill=CINZA)
dr.rounded_rectangle([x0, y + 46, x0 + 380, y + 92], 22, outline=OURO, width=2)
dr.text((x0 + 18, y + 52), 'Meu DNA é Triunfante!', font=fonte(ITAL, 27), fill=OURO)
cap.convert('RGB').save(os.path.join(OUT, 'jota_capa_whatsapp_faixa_1920x690.png'), quality=95)
print('faixa ok')

# ---------------- CAPA 16:9 (o WhatsApp corta a capa em 16:9 e mostra no perfil so a faixa do meio) ----------------
W, H = 1920, 1080
OY = 195
cap = gradiente(W, H, NAVY, AZUL).convert('RGBA'); camada = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dc = ImageDraw.Draw(camada)
dc.line([(0, 640 + OY + 120), (430, 470 + OY), (600, 560 + OY), (1840, 70 + OY - 120)], fill=(255, 255, 255, 18), width=34, joint='curve')
for i, x in enumerate([1720, 1785, 1850]): dc.rounded_rectangle([x, 660 + OY - 70 * (i + 1), x + 40, 660 + OY], 9, fill=(255, 255, 255, 14))
cap.alpha_composite(camada); dr = ImageDraw.Draw(cap)
estrela(1865, 60 + OY, 26, OURO)
jp = corta(Image.open(os.path.join(D, 'apoio_apontar.png')).convert('RGBA'))
alt = 1100; jp = jp.resize((int(jp.width * alt / jp.height), alt), Image.LANCZOS)
sj = sombra(jp, 16, 110, (8, 10)); cap.alpha_composite(sj, (30, 40 + OY - 20))   # JOTA na lateral esquerda
# ESCRITAS NA LATERAL DIREITA
x0 = 1220
dr.text((x0, 45 + OY), 'Eu sou o', font=fonte(BOLD, 34), fill=CINZA)
dr.text((x0, 80 + OY), 'JOTA', font=fonte(BLACK, 84), fill=BRANCO)
wj = dr.textlength('JOTA', font=fonte(BLACK, 84))
dr.rounded_rectangle([x0 + wj + 20, 106 + OY, x0 + wj + 20 + 380, 156 + OY], 14, fill=VERM)
dr.text((x0 + wj + 32, 114 + OY), 'assistente do Comercial', font=fonte(BOLD, 26), fill=BRANCO)
itens = [
    ('Meta e positivação', 'do grupo ao vendedor, na hora'),
    ('Rota, visitas e zerados', 'cliente por cliente'),
    ('+MIX e produtos', 'quem comprou, quem parou'),
    ('Liga Champions', 'lances, pontos e ranking')
]
y = 182 + OY
for i, (a, b) in enumerate(itens):
    dr.ellipse([x0, y + 2, x0 + 34, y + 36], fill=OURO); n = str(i + 1); fn = fonte(BLACK, 22); dr.text((x0 + 17 - dr.textlength(n, font=fn) / 2, y + 5), n, font=fn, fill=NAVY)
    dr.text((x0 + 46, y - 2), a, font=fonte(BOLD, 28), fill=BRANCO); dr.text((x0 + 46, y + 34), b, font=fonte(REG, 22), fill=CINZA)
    y += 76
dr.text((x0, y + 10), 'É só perguntar do seu jeito, aqui no WhatsApp.', font=fonte(REG, 24), fill=CINZA)
dr.rounded_rectangle([x0, y + 46, x0 + 380, y + 92], 22, outline=OURO, width=2)
dr.text((x0 + 18, y + 52), 'Meu DNA é Triunfante!', font=fonte(ITAL, 27), fill=OURO)
cap.convert('RGB').save(os.path.join(OUT, 'jota_capa_whatsapp_16x9_1920x1080.png'), quality=95)
print('16x9 ok')

# ---------------- SIMULAÇÃO DA TELA DO WHATSAPP (com o círculo do perfil no centro) ----------------
prev_capa = cap.copy()
# Avatar circular redimensionado para simular a tela do WhatsApp (~440px de diâmetro)
D_AV = 440
av_img = Image.open(os.path.join(OUT, '_previa_perfil_redondo.png')).convert('RGBA').resize((D_AV, D_AV), Image.LANCZOS)
# No WhatsApp mobile, o avatar fica centralizado na horizontal: (1920 - D_AV) // 2
x_av = (1920 - D_AV) // 2
y_av = 1080 // 2 - 80 + OY // 2   # Sobrepõe exatamente a zona central inferior da capa
prev_capa.alpha_composite(av_img, (x_av, y_av))
prev_capa.convert('RGB').save(os.path.join(OUT, '_previa_whatsapp_tela_com_perfil.png'), quality=95)
print('previa whatsapp tela ok')
