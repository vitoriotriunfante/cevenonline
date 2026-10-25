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
pts = [(120, 900), (620, 560), (860, 700), (1500, 230)]
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
# JOTA apontando para o texto
jp = corta(Image.open(os.path.join(D, 'apoio_apontar.png')).convert('RGBA'))
alt = 930; jp = jp.resize((int(jp.width * alt / jp.height), alt), Image.LANCZOS)
sj = sombra(jp, 20, 120, (10, 14)); cap.alpha_composite(sj, (250, H - sj.height + 30))
x0 = 860
f_t = fonte(BLACK, 92); f_s = fonte(BOLD, 40); f_i = fonte(BOLD, 40); f_r = fonte(REG, 32); f_b = fonte(ITAL, 38)
dr = ImageDraw.Draw(cap, 'RGBA')
dr.text((x0, 230), 'Eu sou o', font=fonte(BOLD, 46), fill=CINZA)
dr.text((x0, 278), 'JOTA', font=fonte(BLACK, 120), fill=BRANCO)
dr.rounded_rectangle([x0 + 340, 318, x0 + 1010, 388], 18, fill=VERM)
dr.text((x0 + 362, 326), 'assistente do Comercial', font=fonte(BOLD, 42), fill=BRANCO)
itens = [('Faturado, meta e positivação', 'na hora, do grupo ao vendedor'), ('Rota, visitas e zerados', 'cliente por cliente'), ('+MIX e produtos', 'quem comprou, quem parou, o que oferecer'), ('Liga Champions', 'lances, pontos e ranking')]
y = 450
for i, (a, b) in enumerate(itens):
    dr.ellipse([x0, y + 6, x0 + 44, y + 50], fill=OURO); n = str(i + 1); dr.text((x0 + 22 - dr.textlength(n, font=fonte(BLACK, 28)) / 2, y + 9), n, font=fonte(BLACK, 28), fill=NAVY)
    dr.text((x0 + 66, y), a, font=f_i, fill=BRANCO); dr.text((x0 + 66, y + 50), b, font=f_r, fill=CINZA); y += 112
dr.text((x0, y + 18), 'É só perguntar do seu jeito aqui no WhatsApp.', font=fonte(REG, 34), fill=CINZA)
dr.rounded_rectangle([x0, y + 80, x0 + 560, y + 140], 30, outline=OURO, width=3)
dr.text((x0 + 26, y + 88), 'Meu DNA é Triunfante!', font=f_b, fill=OURO)
cap.convert('RGB').save(os.path.join(OUT, 'jota_capa_whatsapp_1920x1080.png'), quality=95)
print('ok')

# ---------------- CAPA FAIXA 1920x690 (proporcao que o WhatsApp Business mostra: ~2,8:1) ----------------
W, H = 1920, 690
cap = gradiente(W, H, NAVY, AZUL).convert('RGBA'); camada = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dc = ImageDraw.Draw(camada)
dc.line([(0, 640), (430, 470), (600, 560), (1840, 70)], fill=(255, 255, 255, 18), width=34, joint='curve')
for i, x in enumerate([1720, 1785, 1850]): dc.rounded_rectangle([x, 660 - 70 * (i + 1), x + 40, 660], 9, fill=(255, 255, 255, 14))
cap.alpha_composite(camada); dr = ImageDraw.Draw(cap)
def estrela2(cx, cy, r, cor):
    p = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5; rr = r if k % 2 == 0 else r * 0.45
        p.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    dr.polygon(p, fill=cor)
estrela2(1865, 60, 26, OURO)
jp = corta(Image.open(os.path.join(D, 'apoio_apontar.png')).convert('RGBA'))
alt = 1000; jp = jp.resize((int(jp.width * alt / jp.height), alt), Image.LANCZOS)
sj = sombra(jp, 16, 110, (8, 10)); cap.alpha_composite(sj, (150, 40))   # JOTA ate a cintura (o resto sai da faixa)
x0 = 960
dr.text((x0, 70), 'Eu sou o', font=fonte(BOLD, 40), fill=CINZA)
dr.text((x0, 108), 'JOTA', font=fonte(BLACK, 108), fill=BRANCO)
wj = dr.textlength('JOTA', font=fonte(BLACK, 108))
dr.rounded_rectangle([x0 + wj + 30, 150, x0 + wj + 30 + 540, 214], 18, fill=VERM)
dr.text((x0 + wj + 52, 156), 'assistente do Comercial', font=fonte(BOLD, 40), fill=BRANCO)
itens = [('Meta e positivação', 'do grupo ao vendedor, na hora'), ('Rota, visitas e zerados', 'cliente por cliente'), ('+MIX e produtos', 'quem comprou, quem parou'), ('Liga Champions', 'lances, pontos e ranking')]
for i, (a, b) in enumerate(itens):
    cx = x0 + (i % 2) * 480; cy = 268 + (i // 2) * 118
    dr.ellipse([cx, cy + 4, cx + 40, cy + 44], fill=OURO); n = str(i + 1); fn = fonte(BLACK, 25); dr.text((cx + 20 - dr.textlength(n, font=fn) / 2, cy + 7), n, font=fn, fill=NAVY)
    dr.text((cx + 56, cy - 2), a, font=fonte(BOLD, 33), fill=BRANCO); dr.text((cx + 56, cy + 42), b, font=fonte(REG, 27), fill=CINZA)
dr.text((x0, 518), 'É só perguntar do seu jeito, aqui no WhatsApp.', font=fonte(REG, 31), fill=CINZA)
dr.rounded_rectangle([x0, 572, x0 + 500, 628], 28, outline=OURO, width=3)
dr.text((x0 + 24, 578), 'Meu DNA é Triunfante!', font=fonte(ITAL, 35), fill=OURO)
cap.convert('RGB').save(os.path.join(OUT, 'jota_capa_whatsapp_faixa_1920x690.png'), quality=95)
print('faixa ok')
