import os
from PIL import Image, ImageDraw, ImageFont

orig_dir = r"c:\Users\vitorio.neto\Documents\Projetos IA\CEVEN várias telas\MAIS_MIX\JOTA\imagens\novas_figurinhas"
out_path = r"c:\Users\vitorio.neto\Documents\Projetos IA\CEVEN várias telas\MAIS_MIX\JOTA\prancha_novas_figurinhas.png"

items = [
    ("21_acelera_triunfante.jpg", "1. #ACELERATRIUNFANTE (Foguete)"),
    ("22_cartao_vermelho.jpg", "2. Cartão Vermelho (Zerado Não)"),
    ("23_cartao_amarelo.jpg", "3. Cartão Amarelo (Atenção ao Ritmo)"),
    ("24_chutando_pro_gol.jpg", "4. Chutando pro Gol (Fechou Negócio)"),
    ("25_bora_pra_cima.jpg", "5. Bora pra Cima (Motivação)"),
    ("26_bora_vender.jpg", "6. Bora Vender (Foco em Vendas)"),
]

# Canvas de 3 colunas x 2 linhas
cell_w, cell_h = 600, 650
pad_x, pad_y = 40, 40
title_h = 100

total_w = pad_x * 4 + cell_w * 3
total_h = title_h + pad_y * 3 + cell_h * 2

prancha = Image.new("RGB", (total_w, total_h), (245, 247, 250))
draw = ImageDraw.Draw(prancha)

# Título
try:
    font_title = ImageFont.truetype("arialbd.ttf", 42)
    font_desc = ImageFont.truetype("arialbd.ttf", 22)
except:
    font_title = ImageFont.load_default()
    font_desc = ImageFont.load_default()

draw.text((pad_x, 35), "NOVO LOTE DE FIGURINHAS DO JOTA — SUGESTÕES DA DIRETORIA", fill=(15, 30, 60), font=font_title)

for idx, (fname, label) in enumerate(items):
    col = idx % 3
    row = idx // 3
    
    x = pad_x + col * (cell_w + pad_x)
    y = title_h + pad_y + row * (cell_h + pad_y)
    
    # Card fundo branco com sombra sutil
    draw.rounded_rectangle([x, y, x + cell_w, y + cell_h], radius=16, fill=(255, 255, 255), outline=(220, 225, 235), width=2)
    
    img_path = os.path.join(orig_dir, fname)
    if os.path.exists(img_path):
        im = Image.open(img_path).convert("RGB")
        im.thumbnail((cell_w - 40, cell_h - 90), Image.Resampling.LANCZOS)
        
        im_x = x + (cell_w - im.width) // 2
        im_y = y + 20
        prancha.paste(im, (im_x, im_y))
    
    # Label
    bbox = draw.textbbox((0, 0), label, font=font_desc)
    tw = bbox[2] - bbox[0]
    draw.text((x + (cell_w - tw) // 2, y + cell_h - 50), label, fill=(30, 40, 60), font=font_desc)

prancha.save(out_path, "PNG")

# Copiar também para artifacts para visualização direta
artifact_prancha = r"C:\Users\vitorio.neto\.gemini\antigravity-ide\brain\7f085700-ae4b-43d2-9a24-bd8f736172fa\prancha_novas_figurinhas.png"
prancha.save(artifact_prancha, "PNG")
print("Prancha gerada com sucesso:", out_path)
