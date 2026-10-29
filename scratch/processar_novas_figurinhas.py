import os
import shutil
from PIL import Image

artifact_dir = r"C:\Users\vitorio.neto\.gemini\antigravity-ide\brain\7f085700-ae4b-43d2-9a24-bd8f736172fa"
orig_dir = r"c:\Users\vitorio.neto\Documents\Projetos IA\CEVEN várias telas\MAIS_MIX\JOTA\imagens\novas_figurinhas"
dest_dir = r"c:\Users\vitorio.neto\Documents\Projetos IA\CEVEN várias telas\public\jota\figurinhas"

os.makedirs(orig_dir, exist_ok=True)
os.makedirs(dest_dir, exist_ok=True)

figurinhas = [
    ("jota_acelera_triunfante_1793217872020.jpg", "21_acelera_triunfante", "Acelera Triunfante (#ACELERATRIUNFANTE)"),
    ("jota_cartao_vermelho_1793217899672.jpg", "22_cartao_vermelho", "Cartão Vermelho (Zerado Aqui Não)"),
    ("jota_cartao_amarelo_1793217951393.jpg", "23_cartao_amarelo", "Cartão Amarelo (Atenção ao Ritmo)"),
    ("jota_chutando_gol_1793217984466.jpg", "24_chutando_pro_gol", "Chutando pro Gol (Fechou Negócio)"),
    ("jota_bora_pra_cima_1793218021897.jpg", "25_bora_pra_cima", "Bora pra Cima (Motivação / Energia)"),
    ("jota_bora_vender_1793218068509.jpg", "26_bora_vender", "Bora Vender (Vendedor de Sucesso)"),
]

for src_name, dst_base, desc in figurinhas:
    src_path = os.path.join(artifact_dir, src_name)
    if not os.path.exists(src_path):
        print(f"Arquivo não encontrado: {src_path}")
        continue
    
    # 1. Copiar imagem original em alta para a pasta do Jota
    orig_save = os.path.join(orig_dir, f"{dst_base}.jpg")
    shutil.copy2(src_path, orig_save)
    
    # 2. Processar para figurinha do WhatsApp (512x512 webp)
    im = Image.open(src_path).convert("RGBA")
    
    # Tornar os pixels brancos externos do canto transparentes
    # Flood fill a partir dos cantos (0,0), (width-1, 0), (0, height-1), (width-1, height-1)
    # se o pixel for muito claro (> 245)
    w, h = im.size
    data = im.load()
    
    from collections import deque
    queue = deque([(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)])
    visited = set(queue)
    
    while queue:
        x, y = queue.popleft()
        r, g, b, a = data[x, y]
        if r > 240 and g > 240 and b > 240:
            data[x, y] = (r, g, b, 0)
            for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                    visited.add((nx, ny))
                    nr, ng, nb, na = data[nx, ny]
                    if nr > 240 and ng > 240 and nb > 240:
                        queue.append((nx, ny))
    
    # Redimensionar para 512x512 proporcional
    im.thumbnail((512, 512), Image.Resampling.LANCZOS)
    
    # Criar canvas quadrado 512x512 transparente
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    offset = ((512 - im.width) // 2, (512 - im.height) // 2)
    canvas.paste(im, offset, im)
    
    webp_path = os.path.join(dest_dir, f"{dst_base}.webp")
    canvas.save(webp_path, "WEBP", quality=90)
    print(f"Salva com sucesso: {webp_path}")

print("Concluído!")
