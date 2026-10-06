# Popup "Decisão do VAR" — crítica e redesenho (06/10/2026)

## Crítica do popup atual (prints 89/90)
- Hierarquia plana: título 42px, selo com os PONTOS em 14px (a informação mais importante é a menor coisa da tela) e todos os campos com o mesmo peso.
- Selo ilegível a distância (14px) e sem relação com o resto; o nome do lance aparece 3 vezes (título, selo, campo LANCE).
- Cor sempre vermelha (borda), mesmo em gol/goleada: o borda vermelha contradiz "+7 PONTOS" verde.
- Espaço mal usado: colunas vazias à direita, linhas separadas só por filete; rótulos e valores sem contraste de função.
- Campos de rotina (FILIAL, CHECK-IN...) com o mesmo tamanho que o vendedor.
- Inconsistência: lista (amarelos) e lances únicos não parecem da mesma família.

## Decisões
1. Faixa superior + borda + brilho na cor do lance (verde ganho, amarelo cartão amarelo/semana invicta, laranja impedimento, vermelho pênalti/vermelho/gol contra, azul neutro).
2. HERÓI = pontos ("+9", "-5") em 9,5vw (~180px em Full HD) + nome do lance em ~75px; "PONTOS NA LIGA" na cor do lance.
3. Título antigo vira etiqueta pequena em caixa-alta ("GOL DE PLACA · DECISÃO DO VAR") quando existe selo; sem selo (listas) continua grande.
4. Vendedor em segundo nível (~58px, faixa lateral colorida); rótulo + RCA em tamanho menor.
5. Evidências viram cartões em grade de 3 colunas (valor ≥ 37px em Full HD, ≥ 25px em 1280x720); rótulo 20px. `.w` ocupa meia grade (2 por linha).
6. Selo de nível da qualificação (pílula bronze/prata/ouro/diamante/platina) ao lado do nome do lance.
7. Veredito em faixa no rodapé, 48px, tom do lance.
8. Listas (amarelos, venda10, visita10): itens `hot` consecutivos ocupam linha inteira, um por linha.
9. Tudo com clamp()/vw; `max-height:94vh`; validado em 1920x1080 e 1280x720 (nada corta, sobra margem).
10. Sem dependência externa. `:has()` (Chrome 105+) só para a cor; sem ele cai no vermelho padrão.

## Como aplicar
1. Em `public/tvapp.html` e `public/matrizapp.html`: apagar as regras `#ov .dec ...` (tvapp linhas 118-132, inclusive o bloco "POPUP COMPACTO") e colar o conteúdo de `scratch/ux_popup.css`.
2. Funciona SEM mudar HTML (o selo antigo, de estilo inline, vira etiqueta maior e a cor fica vermelha). Para o resultado completo, trocar o selo (passo 3).
3. Selo novo em `telaVAR` (tvapp.html ~linha 902; mesmo em matrizapp):

ANTES:
```js
const seloLiga = infoLiga.pts ? `<div style="background:rgba(15,23,42,.9);border:1px solid ${infoLiga.cor};color:${infoLiga.cor};font-weight:900;padding:6px 12px;border-radius:8px;font-size:14px;margin-bottom:8px;display:inline-flex;align-items:center;gap:6px">🏆 ${infoLiga.nome} · <b>${infoLiga.pts}</b></div>` : '';
```
DEPOIS:
```js
const TOM = {'#22c55e':'g','#eab308':'y','#facc15':'y','#f97316':'o','#ef4444':'r','#38bdf8':'b'};
const ptsNum = String(infoLiga.pts).split(' ')[0];                 // "+7"
const nomeSelo = qGol ? infoLiga0.nome : infoLiga.nome;            // nível vira pílula
const seloLiga = infoLiga.pts ? `<div class="selo" data-tom="${TOM[infoLiga.cor] || 'b'}"><b class="sp">${ptsNum}</b><span class="sn">${esc(nomeSelo)}${qGol ? `<em class="nv nv-${esc(String(qGol.nivel).toLowerCase())}">${esc(qGol.nivel)}</em>` : ''}</span><i class="sl">PONTOS NA LIGA</i></div>` : '';
```
Observação: para "-3 PONTOS NA LIGA CADA" (amarelos) o `.sl` pode ser `infoLiga.pts.replace(/^\S+\s/, '')` em vez do texto fixo. Se `qGol.nivel` vier com acento/maiúscula (ex.: "Diamante"), o toLowerCase já resolve; sem classe correspondente a pílula fica cinza.
4. `compactaDecHtml` (tv-animacoes.js): nenhuma mudança obrigatória. Opcional: incluir `CHECK|TEMPO` fora da regex de "larga" (já está fora), manter como está.
5. Opcional: o campo LANCE repete o nome do selo em gols simples; pode ser omitido quando `item.sub` igual ao nome (decisão de conteúdo, não mexi).
6. Publicar com `node publicar_tv.js "popup VAR novo"` somente quando o Vitório mandar.

## Validação
Teste em `.../scratchpad/ux/teste.html` (hash #gol, #imp, #am, #pen, #gole), prints `*_1920.png` e `*_1280.png` na mesma pasta.
