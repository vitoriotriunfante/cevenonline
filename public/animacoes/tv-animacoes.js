(function(window) {
// =========================================================================
// MOTOR CENTRAL DE ANIMAÇÕES BROADCAST TV (CFTV CEVEN)
// GOL DE PLACA, DEFESA MILAGROSA, IMPEDIMENTO VAR, CARTÕES & PÊNALTI
// =========================================================================

// ============================== ANIMAÇÃO DO PÊNALTI (mini jogo em canvas) ==============================
// Cena de ~7 s: o CLIENTE (camisa azul, com o nome dele) dribla com a bola, o VENDEDOR (camisa vermelha) dá o carrinho,
// o cliente cai, o juiz apita e aponta a marca do pênalti. Depois entra o "VAR revisando".
const TORCIDA = (() => { const a = []; let x = 12345; const r = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 900; i++) a.push({x: r(), y: 250 + r() * 260, c: ['#38bdf8', '#f59e0b', '#ef4444', '#e8eefc', '#22c55e', '#a78bfa'][Math.floor(r() * 6)], ph: r() * 6.28}); return a; })();
const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };

// =========================================================================
// SPRITES GERADOS POR IA (opcional): se as imagens existirem em /animacoes/sprites/,
// os personagens são desenhados com elas em vez do boneco vetorial (fallback automático
// e silencioso — nenhum lance quebra se faltar uma imagem). Ver
// REGRAS_CFTV/PROMPTS_IMAGENS_ANIMACOES_TV.md para os prompts e o mapa de poses.
// =========================================================================
// Caminhos ABSOLUTOS (começam com /animacoes/): o script é carregado por páginas em URLs
// diferentes (/tvapp, /tv?filial=..., matriz), e caminho relativo resolveria contra a URL da
// página, não contra a pasta do script — por isso não pode ser 'sprites/...' nem 'videos/...'.
const SPRITE_ARQUIVOS = {
  gol: '/animacoes/sprites/gol.png',
  vermelho: '/animacoes/sprites/cartao_vermelho.png',
  amarelo: '/animacoes/sprites/cartao_amarelo.png',
  impedimento: '/animacoes/sprites/impedimento.png',
  penalti: '/animacoes/sprites/penalti.png',
  defesa: '/animacoes/sprites/defesa.png',
  fundo: '/animacoes/sprites/fundo_estadio.png'
};
const SPRITES = {};
function carregaSprites() {
  Object.entries(SPRITE_ARQUIVOS).forEach(([nome, arquivo]) => {
    if (SPRITES[nome]) return; // já carregada (ou já tentou)
    const img = new Image();
    img.onload = () => { SPRITES[nome] = img; };
    img.onerror = () => { SPRITES[nome] = null; }; // arquivo ainda não existe: fica no vetorial
    img.src = arquivo;
    SPRITES[nome] = undefined; // "carregando"
  });
}
carregaSprites();
const spritePronta = (nome) => SPRITES[nome] instanceof HTMLImageElement;

// Desenha um personagem usando o sprite (se pronto) ou cai no boneco vetorial `pessoa()`.
// x,y = pé do personagem (mesma referência de pessoa()); k = escala; espelha = true vira a imagem no eixo X.
function personagem(c, spriteNome, x, y, k, opcoesVetorial, espelha) {
  if (spritePronta(spriteNome)) {
    const img = SPRITES[spriteNome];
    const alturaAlvo = 340 * k, largura = alturaAlvo * (img.width / img.height);
    c.save();
    c.translate(x, y);
    if (espelha) c.scale(-1, 1);
    c.drawImage(img, -largura / 2, -alturaAlvo, largura, alturaAlvo);
    c.restore();
    return true;
  }
  pessoa(c, { ...opcoesVetorial, x, y, k });
  return false;
}
// Preenche o fundo do campo com o sprite de estádio (se pronto) ou o gradiente/textura vetorial de sempre.
function fundoDeCampo(c, LX, LW, W1080, desenhaVetorial) {
  if (spritePronta('fundo')) {
    const img = SPRITES.fundo;
    c.drawImage(img, LX, 0, LW, W1080);
  } else if (desenhaVetorial) {
    desenhaVetorial();
  }
}

// =========================================================================
// VÍDEOS GERADOS POR IA (opcional, prioridade sobre sprite e vetorial): se o arquivo existir em
// /animacoes/videos/, o lance toca esse vídeo real 1x (a "ação") e, ao terminar (evento `ended`,
// nunca um tempo fixo — cada vídeo pode ter duração diferente), passa para a tela de decisão em
// texto. Ver REGRAS_CFTV/PROMPTS_VIDEOS_ANIMACOES_TV.md para os prompts.
// =========================================================================
// Cada lance tem VÁRIOS vídeos (banco de variações), para não repetir sempre a mesma cena.
// "gol" tem 4 arquivos: quando o lance tem um subtipo específico com vídeo próprio (ver
// GOL_POR_SUBTIPO), usa esse; senão sorteia entre os 4. Os demais lances ainda não têm vídeo
// gerado (listas vazias = cai no vetorial) — gerar seguindo
// REGRAS_CFTV/PROMPTS_VIDEOS_ANIMACOES_TV.md e preencher aqui quando prontos.
const VIDEO_ARQUIVOS = {
  gol: ['/animacoes/videos/gol1_mp.mp4', '/animacoes/videos/gol2_mp.mp4', '/animacoes/videos/gol_1.mp4', '/animacoes/videos/gol_2.mp4', '/animacoes/videos/gol_3.mp4', '/animacoes/videos/gol_4.mp4', '/animacoes/videos/gol_5.mp4', '/animacoes/videos/gol_6.mp4', '/animacoes/videos/gol_7.mp4', '/animacoes/videos/gol_8.mp4', '/animacoes/videos/gol_9.mp4', '/animacoes/videos/gol_10.mp4', '/animacoes/videos/gol_11.mp4', '/animacoes/videos/gol_12.mp4', '/animacoes/videos/gol_13.mp4', '/animacoes/videos/gol_14.mp4', '/animacoes/videos/gol_15.mp4', '/animacoes/videos/gol_16.mp4', '/animacoes/videos/gol_17.mp4', '/animacoes/videos/gol_18.mp4', '/animacoes/videos/gol_19.mp4', '/animacoes/videos/gol_20.mp4'],
  // vermelho_2.mp4 e identico ao vermelho_1.mp4 (verificado por conteudo em 05/10/2026): fora da lista. vermelho_4 e o novo (05/10/2026).
  vermelho: ['/animacoes/videos/vermelho_1.mp4', '/animacoes/videos/vermelho_3.mp4', '/animacoes/videos/vermelho_4.mp4'],
  // Gol Contra (devolucao comercial): 3 videos proprios (antes tocava pênalti na TV da filial e amarelo na Matriz).
  golcontra: ['/animacoes/videos/golcontra_1.mp4', '/animacoes/videos/golcontra_2.mp4', '/animacoes/videos/golcontra_3.mp4'],
  amarelo: ['/animacoes/videos/amarelo_1.mp4', '/animacoes/videos/amarelo_2.mp4', '/animacoes/videos/amarelo_3.mp4'],
  impedimento: ['/animacoes/videos/impedimento_1.mp4', '/animacoes/videos/impedimento_2.mp4', '/animacoes/videos/impedimento_3.mp4'],
  penalti: ['/animacoes/videos/penalti_1.mp4', '/animacoes/videos/penalti_2.mp4', '/animacoes/videos/penalti_3.mp4'],
  defesa: ['/animacoes/videos/defesa_1.mp4', '/animacoes/videos/defesa_2.mp4', '/animacoes/videos/defesa_3.mp4', '/animacoes/videos/defesa_4.mp4', '/animacoes/videos/defesa_5.mp4', '/animacoes/videos/defesa_6.mp4'], // defesa_1 a defesa_6: gerar com os prompts de defesa (ate existirem, a TV usa a animacao desenhada)
  // Hat-Trick e Semana Invicta: vídeo de FUNDO genérico (sem valores/números — esses continuam
  // aparecendo só na tela de decisão, como hoje). 1 arquivo cada, sem variações.
  hattrick: ['/animacoes/videos/hattrick_1.mp4', '/animacoes/videos/hattrick_2.mp4'],
  semanainvicta: ['/animacoes/videos/semanainvicta_1.mp4', '/animacoes/videos/semanainvicta_2.mp4'],
  // Bola Cheia (18h): video gerado pelo Gemini (ver docs/PROMPT_VIDEO_BOLA_CHEIA.md). Sem o arquivo, a tela usa a animacao em CSS.
  bolacheia: ['/animacoes/videos/bolacheia_1.mp4', '/animacoes/videos/bolacheia_2.mp4']
};
// Gol com subtipo conhecido usa um vídeo dedicado (ex.: super pedido é mais "explosivo", cliente
// recuperado é mais "resgate emocionado"). Sem entrada aqui = sorteia entre todos os de VIDEO_ARQUIVOS.gol.
const GOL_POR_SUBTIPO = {
  super_pedido: '/animacoes/videos/gol_1.mp4',
  inativo_recuperado: '/animacoes/videos/gol_2.mp4',
  marca_propria: '/animacoes/videos/gol1_mp.mp4', // video proprio do Gol de Marca Propria (07/10/2026)
  mp_tripla: '/animacoes/videos/gol2_mp.mp4' // video proprio da Tripla de Marca Propria
};
const VIDEO_OK = {}; // arquivo -> true (existe e já testado) | false (não existe)
function testaVideo(arquivo) {
  if (VIDEO_OK[arquivo] !== undefined) return;
  VIDEO_OK[arquivo] = undefined;
  // Elemento <video> fora do DOM não carrega metadados de forma confiável em vários navegadores
  // (fica preso em "waiting" para sempre) — por isso anexa escondido, remove ao terminar o teste.
  const v = document.createElement('video');
  v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
  v.preload = 'metadata';
  v.muted = true;
  const limpa = () => { try { v.remove(); } catch {} };
  v.onloadedmetadata = () => { VIDEO_OK[arquivo] = true; limpa(); };
  v.onerror = () => { VIDEO_OK[arquivo] = false; limpa(); };
  v.src = arquivo;
  (document.body || document.documentElement).appendChild(v);
}
Object.values(VIDEO_ARQUIVOS).flat().forEach(testaVideo);
// Promise que resolve quando todos os testes de vídeo já responderam (true/false), com um teto de
// segurança de 4s — evita que um clique rápido logo após carregar a página caia no vetorial só
// porque o teste do <video> (assíncrono) ainda não terminou.
const videosProntosPromise = new Promise((resolve) => {
  const arquivos = Object.values(VIDEO_ARQUIVOS).flat();
  const checa = () => arquivos.every((a) => VIDEO_OK[a] !== undefined);
  if (checa()) return resolve();
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (checa() || Date.now() - t0 > 4000) { clearInterval(iv); resolve(); }
  }, 100);
});
function videosProntos() { return videosProntosPromise; }

// Escolhe qual arquivo tocar para um lance: usa o dedicado ao subtipo (se existir e estiver
// pronto), senão sorteia entre os disponíveis do nível. Devolve null se nenhum estiver pronto.
// BARALHO (05/10/2026, pedido do Vitorio: "garantir que variamos os gols e lances"): em vez de sortear com Math.random()
// (que repete o mesmo video seguido e deixa uns aparecerem mais que outros), cada tipo de lance tem um baralho embaralhado:
// toca todos os videos prontos, um por vez, SEM repetir, e so reembaralha quando acaba; o primeiro do novo baralho nunca e o
// ultimo que tocou. O baralho fica guardado no navegador (localStorage), entao sobrevive a recarga automatica da TV.
const BARALHOS = {};
function lerBaralho(nivel) { try { const j = JSON.parse(localStorage.getItem('ceven_tv_baralho_' + nivel) || 'null'); if (j && Array.isArray(j.fila)) return j; } catch (e) {} return { fila: [], ultimo: null }; }
function salvaBaralho(nivel, b) { try { localStorage.setItem('ceven_tv_baralho_' + nivel, JSON.stringify(b)); } catch (e) {} }
function embaralha(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function proximoDoBaralho(nivel, pool) {
  const b = BARALHOS[nivel] || (BARALHOS[nivel] = lerBaralho(nivel));
  b.fila = b.fila.filter((a) => pool.includes(a)); // tira o que nao esta mais pronto
  if (!b.fila.length) {
    b.fila = embaralha(pool.slice());
    if (pool.length > 1 && b.fila[0] === b.ultimo) b.fila.push(b.fila.shift()); // nunca repete o ultimo que tocou
  }
  const a = b.fila.shift();
  b.ultimo = a;
  salvaBaralho(nivel, b);
  return a;
}
function escolheVideo(nivel, subtipo) {
  if (nivel === 'gol' && subtipo && GOL_POR_SUBTIPO[subtipo] && VIDEO_OK[GOL_POR_SUBTIPO[subtipo]] === true) {
    return GOL_POR_SUBTIPO[subtipo];
  }
  let prontos = (VIDEO_ARQUIVOS[nivel] || []).filter((a) => VIDEO_OK[a] === true);
  if (nivel === 'gol') { // gol_1 e gol_2 sao reservados aos gols especiais (Super Pedido, Resgate); gol comum usa os demais
    const reservados = Object.values(GOL_POR_SUBTIPO);
    const comuns = prontos.filter((a) => !reservados.includes(a));
    if (comuns.length) prontos = comuns;
  }
  if (!prontos.length) return null;
  return proximoDoBaralho(nivel, prontos);
}

// Toca o vídeo do lance por cima do canvas (que fica como fundo/decisão). Chama aoTerminar()
// quando o vídeo real acabar (não um tempo fixo). Devolve uma função de parar/limpar, com a
// MESMA assinatura de retorno das iniciaAnim* em canvas (para não mudar quem chama).
// Se nenhum vídeo do lance existir, devolve null (quem chamar cai no comportamento vetorial de sempre).
//
// O vídeo toca dentro de um <iframe> isolado (public/animacoes/player_video.html), não direto na
// página da TV. Um iframe roda num contexto de execução/memória SEPARADO do documento principal —
// isso é mais parecido com "abrir outra aba" do que injetar <video> na mesma página, e é a
// abordagem mais robusta quando o navegador embarcado da Smart TV tem dificuldade em reaproveitar
// decodificador de vídeo dentro da mesma página ao longo de várias trocas. A comunicação entre a
// página da TV e o player é por postMessage (pedir "tocar" um arquivo); texto/nome do lance
// continua sendo desenhado pela própria TV, por cima do iframe (a "máscara").
let IFRAME_PLAYER = null, IFRAME_PLAYER_PRONTO = false;
function pegaIframePlayer() {
  if (IFRAME_PLAYER && IFRAME_PLAYER.isConnected) return IFRAME_PLAYER;
  const container = document.getElementById('video-lance-fixo');
  if (!container) return null; // página sem o container fixo (ex.: página de teste antiga) — sem vídeo
  IFRAME_PLAYER_PRONTO = false;
  IFRAME_PLAYER = document.createElement('iframe');
  IFRAME_PLAYER.src = '/animacoes/player_video.html';
  IFRAME_PLAYER.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
  IFRAME_PLAYER.setAttribute('allow', 'autoplay');
  container.appendChild(IFRAME_PLAYER);
  window.addEventListener('message', (ev) => {
    if (ev.source === IFRAME_PLAYER.contentWindow && ev.data && ev.data.tipo === 'player-pronto') IFRAME_PLAYER_PRONTO = true;
  });
  return IFRAME_PLAYER;
}
// duracaoMaxMs: TETO de segurança — se o player nunca avisar a duração real do arquivo (mensagem
// 'duracao'), a decisão aparece nesse tempo de qualquer forma, para a TV nunca ficar presa
// esperando. Quando o player avisa a duração real, o cronômetro é reajustado para ela (cada
// vídeo toca o tempo que realmente dura, sem cortar nem esticar).
// arquivoFixo: quando informado, toca esse arquivo específico em vez de sortear um novo — usado
// pelo REPLAY, para repetir exatamente o mesmo vídeo do LANCE (nunca sortear outro no meio do lance).
function tocaVideoLance(cv, nivel, subtipo, duracaoMaxMs, aoTerminar, arquivoFixo) {
  const arquivo = arquivoFixo || escolheVideo(nivel, subtipo);
  if (!arquivo) return null;
  const frame = pegaIframePlayer();
  if (!frame) return null;
  const container = document.getElementById('video-lance-fixo');
  const mudo = window.somOn === false;
  // cv pode não existir no momento da chamada (ex.: durante a tela "VAR REVISANDO", sem canvas
  // no DOM) — tolera null/undefined em vez de travar a sequência inteira.
  const escondeVideo = () => { if (container) container.style.display = 'none'; if (cv) cv.style.display = ''; };
  const mostraVideo = () => { if (container) container.style.display = ''; if (cv) cv.style.display = 'none'; };

  let parou = false, t = null;
  const finaliza = () => {
    if (parou) return;
    parou = true;
    clearTimeout(t);
    escondeVideo();
    aoTerminar();
  };
  const rearmaCronometro = (ms) => { clearTimeout(t); t = setTimeout(finaliza, ms); };

  const onDuracaoReal = (ev) => {
    if (parou || ev.source !== frame.contentWindow || !ev.data || ev.data.tipo !== 'duracao') return;
    const restanteMs = ev.data.segundos * 1000;
    if (restanteMs > 0 && restanteMs < duracaoMaxMs) rearmaCronometro(restanteMs); // vídeo mais curto que o teto: usa a duração real
  };
  window.addEventListener('message', onDuracaoReal);

  const pedeParaTocar = () => {
    if (frame.contentWindow) frame.contentWindow.postMessage({ tipo: 'tocar', arquivo, mudo }, '*');
    mostraVideo();
  };
  if (IFRAME_PLAYER_PRONTO) pedeParaTocar();
  else frame.onload = pedeParaTocar; // primeira vez: espera o player carregar antes de mandar tocar

  rearmaCronometro(duracaoMaxMs); // teto de segurança, reajustado se a duração real chegar antes

  const stop = () => {
    window.removeEventListener('message', onDuracaoReal);
    if (parou) return;
    parou = true;
    clearTimeout(t);
    if (frame.contentWindow) frame.contentWindow.postMessage({ tipo: 'parar' }, '*');
    escondeVideo();
  };
  stop.arquivo = arquivo; // exposto para o REPLAY reaproveitar exatamente o mesmo vídeo do LANCE
  return stop;
}
function membro(c, x, y, ang, len, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len; c.lineTo(ex, ey); c.stroke(); return [ex, ey]; }
function pessoa(c, o) {
  c.save(); c.translate(o.x, o.y); if (o.rot) c.rotate(o.rot); c.scale(o.k, o.k);
  const sw = Math.sin(o.fase || 0), pele = o.pele || '#f1c9a5'; let aL1 = .1, aL2 = -.1, aA1 = .2, aA2 = -.2;
  if (o.pose === 'run') { aL1 = sw * .9; aL2 = -sw * .9; aA1 = -sw * .9; aA2 = sw * .9; }
  else if (o.pose === 'slide') { aL1 = 1.35; aL2 = 1.1; aA1 = -1.3; aA2 = -.9; }
  else if (o.pose === 'fall') { aL1 = .35; aL2 = -.3; aA1 = 2.5; aA2 = -2.4; }
  else if (o.pose === 'protesto') { aL1 = .1; aL2 = -.1; aA1 = 2.7; aA2 = -2.7; }
  else if (o.pose === 'aponta') { aA1 = o.alvo != null ? o.alvo : 1.35; }
  const quadril = [0, -75], ombro = [0, -140];
  const perna = (a, cor) => { const [ex, ey] = membro(c, quadril[0], quadril[1], a, 76, 17, cor); c.fillStyle = '#111'; c.beginPath(); c.ellipse(ex + 8, ey, 15, 8, 0, 0, 7); c.fill(); };
  perna(aL2, pele); membro(c, ombro[0], ombro[1], aA2, 58, 13, pele);
  c.fillStyle = o.camisa; rr(c, -26, -152, 52, 82, 10); c.fill();
  if (o.num) { c.fillStyle = '#fff'; c.font = '900 34px Segoe UI'; c.textAlign = 'center'; c.fillText(o.num, 0, -100); }
  c.fillStyle = o.calcao; c.fillRect(-26, -78, 52, 30);
  perna(aL1, pele);
  c.fillStyle = pele; c.beginPath(); c.arc(0, -176, 25, 0, 7); c.fill();
  c.fillStyle = o.cabelo || '#2b1b10'; c.beginPath(); c.arc(0, -180, 25, Math.PI, 0); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(9, -174, 3, 0, 7); c.fill();
  if (o.grito) { c.fillStyle = '#7a1f1f'; c.beginPath(); c.ellipse(12, -162, 6, 9, 0, 0, 7); c.fill(); }
  if (o.pose === 'apito') { // mão na boca com o apito
    c.strokeStyle = pele; c.lineWidth = 13; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -140); c.lineTo(24, -122); c.lineTo(20, -164); c.stroke();
    c.fillStyle = '#e5e7eb'; c.beginPath(); c.arc(28, -164, 9, 0, 7); c.fill();
  } else membro(c, ombro[0], ombro[1], aA1, o.pose === 'aponta' ? 74 : 58, 13, pele);
  c.restore();
}
function bola(c, x, y, r, rot) { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#111';
  for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(Math.cos(i * 1.2566) * r * .55, Math.sin(i * 1.2566) * r * .55, r * .2, 0, 7); c.fill(); } c.restore(); }
function etiqueta(c, txt, x, y, cor) { c.font = '800 26px Segoe UI'; c.textAlign = 'center'; const w = c.measureText(txt).width + 26; c.fillStyle = 'rgba(0,0,0,.65)'; rr(c, x - w / 2, y - 26, w, 38, 12); c.fill(); c.strokeStyle = cor; c.lineWidth = 3; c.stroke(); c.fillStyle = '#fff'; c.fillText(txt, x, y + 2); }
function desenhaCena(c, W, H, t, P) {
  const S = H / 1080, ox = (W / S - 1920) / 2, LX = -ox, LW = 1920 + 2 * ox, CH = 940, K = 1.5;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.save(); c.scale(S, S); c.translate(ox, 0);

  // Ordem autêntica da transmissão de futebol (Total: 14.000 ms):
  // 1) 0 -> 3500 ms: Lance normal ao vivo (cliente conduz, vendedor rasga no carrinho, cliente cai)
  // 2) 3500 -> 4800 ms: Juiz corre apitando a falta (PIIIIII!)
  // 3) 4800 -> 6800 ms: VINHETA DA TV: "VAR EM AÇÃO - REVISANDO POSSÍVEL PÊNALTI"
  // 4) 6800 -> 10800 ms: CÂMERA LENTA (SLOW-MO 0.25x) com ZOOM NO CONTATO das pernas (vendedor derrubando o cliente em detalhes)
  // 5) 10800 -> 14000 ms: ÁRBITRO CONFIRMA O PÊNALTI (sinal de TV com as mãos e aponta a marca da cal)

  // TELA 3: VINHETA DO VAR EM TELA CHEIA (4800 a 6800 ms)
  if (t >= 4800 && t < 6800) {
    const q = (t - 4800) / 2000;
    c.fillStyle = '#060b18'; c.fillRect(LX, 0, LW, 1080);
    c.strokeStyle = 'rgba(56, 189, 248, 0.25)'; c.lineWidth = 2;
    for (let y = 0; y < 1080; y += 40) { c.beginPath(); c.moveTo(LX, y); c.lineTo(1920 + ox, y); c.stroke(); }
    const beamY = ((t * 0.8) % 1080);
    c.fillStyle = 'rgba(56, 189, 248, 0.15)'; c.fillRect(LX, beamY - 40, LW, 80);

    c.save(); c.translate(960, 480);
    rr(c, -360, -180, 720, 360, 28);
    c.fillStyle = '#0f172a'; c.fill();
    c.lineWidth = 6; c.strokeStyle = '#38bdf8'; c.stroke();
    
    rr(c, -160, -130, 320, 110, 16);
    c.fillStyle = '#ef4444'; c.fill();
    c.font = '900 86px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText('VAR', 0, -48);

    c.font = '900 48px Segoe UI'; c.fillStyle = '#f8fafc';
    c.fillText('REVISANDO O LANCE…', 0, 50);

    c.font = '700 28px Segoe UI'; c.fillStyle = '#94a3b8';
    c.fillText('POSSÍVEL PÊNALTI · ANÁLISE DE CONTATO', 0, 110);

    rr(c, -260, 135, 520, 14, 7); c.fillStyle = '#334155'; c.fill();
    rr(c, -260, 135, 520 * q, 14, 7); c.fillStyle = '#38bdf8'; c.fill();
    c.restore();
    c.restore();
    return;
  }

  let cenaT = t;
  let isVarSlowMo = false;
  if (t >= 6800 && t < 10800) {
    isVarSlowMo = true;
    const varProg = (t - 6800) / 4000;
    cenaT = 2200 + varProg * 1100;
  } else if (t >= 10800) {
    cenaT = 4400 + (t - 10800) * 0.4;
  }

  if (isVarSlowMo) {
    // Zoom cinematográfico no lance: enquadra perfeitamente o carrinho e o chão sem cortar as pernas
    c.translate(960, 540);
    c.scale(1.4, 1.4);
    c.translate(-980, -560);
  } else if ((t > 3600 && t < 4000) || (t > 10900 && t < 11200)) {
    c.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);
  }

  const g = c.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, '#050a1a'); g.addColorStop(1, '#16264d'); c.fillStyle = g; c.fillRect(LX, 0, LW, 540);
  for (const fx of [200, 700, 1200, 1700]) { c.fillStyle = 'rgba(255,255,220,.07)'; c.beginPath(); c.moveTo(fx - 30, 0); c.lineTo(fx + 30, 0); c.lineTo(fx + 230, 540); c.lineTo(fx - 230, 540); c.fill(); c.fillStyle = '#fffbe0'; c.fillRect(fx - 40, 18, 80, 14); }
  c.fillStyle = '#0d1530'; c.fillRect(LX, 240, LW, 300);
  for (const d of TORCIDA) { const px = LX + d.x * LW, pulo = t > 3600 ? Math.abs(Math.sin(t * .01 + d.ph)) * 9 : 0; c.globalAlpha = .4 + .35 * (.5 + .5 * Math.sin(t * .004 + d.ph)); c.fillStyle = d.c; c.fillRect(px, d.y - pulo, 9, 12);
    if (Math.sin(t * .02 + d.ph * 9) > .987) { c.globalAlpha = .9; c.fillStyle = '#fff'; c.beginPath(); c.arc(px, d.y, 13, 0, 7); c.fill(); } }
  c.globalAlpha = 1;
  c.fillStyle = '#0f5a2b'; c.fillRect(LX, 540, LW, 540);
  for (let i = -3; i < 16; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.07)'; c.fillRect(i * 160, 540, 160, 540); }
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.beginPath(); c.moveTo(LX, 575); c.lineTo(1920 + ox, 575); c.stroke();
  c.beginPath(); c.moveTo(880, 575); c.lineTo(800, 1080); c.stroke();
  c.lineWidth = 8; c.strokeRect(1560, 405, 300, 170); c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.3)';
  for (let x = 1580; x < 1860; x += 20) { c.beginPath(); c.moveTo(x, 405); c.lineTo(x, 575); c.stroke(); } for (let y = 425; y < 575; y += 20) { c.beginPath(); c.moveTo(1560, y); c.lineTo(1860, y); c.stroke(); }
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(1400, 880, 16, 6, 0, 0, 7); c.fill();
  if (t > 11000) { const q = ((t - 11000) % 900) / 900; c.strokeStyle = `rgba(250,204,21,${1 - q})`; c.lineWidth = 6; c.beginPath(); c.ellipse(1400, 880, 16 + q * 70, 6 + q * 26, 0, 0, 7); c.stroke(); }

  // Jogadores
  const ax0 = -150 + Math.min(cenaT, 2800) * .42, pf = cenaT < 2800 ? 0 : Math.min(1, (cenaT - 2800) / 600);
  const ax = ax0 + 70 * pf, ay = CH - Math.sin(pf * Math.PI) * 70;
  const dx = cenaT < 2500 ? -900 + cenaT * .712 : (cenaT < 3300 ? 880 + (cenaT - 2500) * .34 : 1152 - Math.min(1, (cenaT - 3300) / 400) * 190);
  const drot = cenaT < 2500 ? 0 : (cenaT < 3300 ? -1.3 * Math.min(1, (cenaT - 2500) / 250) : -1.3 * (1 - Math.min(1, (cenaT - 3300) / 400)));
  const dpose = cenaT < 2500 ? 'run' : (cenaT < 3300 ? 'slide' : 'protesto');
  
  let rx = 702, rpose = 'run';
  if (t < 2800) { rx = -300; }
  else if (t < 3600) { rx = -200 + (t - 2800) * .9; rpose = 'run'; }
  else if (t < 4800) { rx = 690; rpose = 'apito'; }
  else if (isVarSlowMo) { rx = -500; }
  else { rx = 720; rpose = (t > 11000 && t < 12200) ? 'apito' : 'aponta'; }

  for (const [sx, sy] of [[ax, CH], [dx, CH], [rx, CH]]) { if (sx > -200 && sx < 2200) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(sx, sy + 4, 80, 14, 0, 0, 7); c.fill(); } }
  const bx = cenaT < 2800 ? ax0 + 78 : 1101 + 430 * (1 - Math.exp(-(cenaT - 2800) / 520)), by = cenaT < 2800 ? CH - 16 - Math.abs(Math.sin(cenaT * .018)) * 14 : CH - 16 - Math.abs(Math.sin((cenaT - 2800) / 170)) * 55 * Math.exp(-(cenaT - 2800) / 500);

  if (rx > -200 && rx < 2200) pessoa(c, {x: rx, y: CH, k: K, camisa: '#facc15', calcao: '#111', cabelo: '#111', pose: rpose, fase: t * .018, alvo: 1.37});
  pessoa(c, {x: dx, y: CH, k: K, camisa: '#ef4444', calcao: '#450a0a', num: '4', pose: dpose, rot: drot, fase: cenaT * .02, grito: cenaT > 3000});
  pessoa(c, {x: ax, y: ay, k: K, camisa: '#38bdf8', calcao: '#0b3b5c', num: '10', pele: '#c98f5f', pose: cenaT < 2800 ? 'run' : 'fall', rot: 1.45 * pf, fase: cenaT * .018, grito: cenaT > 2800});
  bola(c, bx, by, 16, cenaT * .01);

  const nomeC = String(P.cliente || 'CLIENTE').slice(0, 26), nomeV = String(P.vendedor || '').split(' ')[0];
  if (!isVarSlowMo) {
    if (cenaT < 2800) etiqueta(c, nomeC, ax, CH - 335, '#38bdf8'); else etiqueta(c, nomeC, ax + 190, CH + 70, '#38bdf8');
    if (cenaT > 300) etiqueta(c, nomeV, dx - (cenaT > 2500 && cenaT < 3300 ? 60 : 0), CH - (cenaT > 2500 && cenaT < 3300 ? 250 : 335), '#ef4444');
  }

  // --- 2. APITO DO JUIZ ---
  if (t >= 3500 && t < 4800) {
    const q = (t - 3500) / 1300;
    c.save(); c.translate(rx + 60, CH - 395); c.scale(1 + .12 * Math.sin(t * .05), 1 + .12 * Math.sin(t * .05));
    c.font = 'italic 900 88px Segoe UI'; c.textAlign = 'left'; c.lineWidth = 12; c.strokeStyle = '#111'; c.strokeText('PIIIIII!', 0, 0); c.fillStyle = '#facc15'; c.fillText('PIIIIII!', 0, 0);
    c.strokeStyle = `rgba(250,204,21,${1 - q})`; c.lineWidth = 5; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(-30, 30, 30 * i + q * 60, -.9, .9); c.stroke(); } c.restore();
    c.font = '800 38px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText('FALTA MARCADA PELO ÁRBITRO!', 960, 1020);
  }

  // --- 4. REPLAY EM CÂMERA LENTA ---
  if (isVarSlowMo) {
    c.save();
    c.strokeStyle = '#ef4444';
    c.lineWidth = 5;
    c.setLineDash([10, 6]);
    c.beginPath(); c.moveTo(dx - 30, CH - 20); c.lineTo(ax + 50, ay + 10); c.stroke();
    
    c.fillStyle = 'rgba(239, 68, 68, 0.4)';
    c.beginPath(); c.arc(ax + 20, CH - 35, 32 + Math.sin(t * 0.02) * 8, 0, 7); c.fill();
    c.fillStyle = '#ef4444';
    c.beginPath(); c.arc(ax + 20, CH - 35, 12, 0, 7); c.fill();
    c.restore();

    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < 1080; y += 6) c.fillRect(LX, y, LW, 2);

    c.save();
    c.translate(960, 190);
    rr(c, -440, -52, 880, 104, 18);
    c.fillStyle = 'rgba(15, 23, 42, 0.92)'; c.fill();
    c.lineWidth = 4; c.strokeStyle = '#38bdf8'; c.stroke();
    c.fillStyle = '#ef4444'; c.beginPath(); c.arc(-380, 0, 16, 0, 7); c.fill();
    c.font = '900 38px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'left';
    c.fillText('VAR · CÂMERA LENTA (PONTO DE CONTATO)', -345, 14);
    c.font = '800 24px Segoe UI'; c.fillStyle = '#facc15'; c.textAlign = 'right';
    c.fillText('0.25x SLOW', 410, 12);
    c.restore();

    etiqueta(c, `VENDEDOR: ${nomeV}`, dx, CH - 310, '#ef4444');
    etiqueta(c, `CLIENTE: ${nomeC}`, ax + 90, CH - 20, '#38bdf8');
  }

  // --- 5. DECISÃO FINAL ---
  if (t >= 10800) {
    const p = Math.min(1, (t - 10800) / 400), e = 1 - Math.pow(1 - p, 3), sc = (.3 + .7 * e) * (1 + .03 * Math.sin(t * .02));
    c.save(); c.translate(960, 240); c.scale(sc, sc); c.shadowColor = '#ef4444'; c.shadowBlur = 60; c.textAlign = 'center';
    
    rr(c, -300, -180, 600, 60, 12); c.fillStyle = '#16a34a'; c.fill();
    c.font = '900 32px Segoe UI'; c.fillStyle = '#fff'; c.fillText('✔ VAR CONFIRMA: PÊNALTI!', 0, -138);

    c.font = '900 210px Segoe UI'; c.lineWidth = 24; c.strokeStyle = '#7f1d1d'; c.strokeText('PÊNALTI!', 0, 0); c.fillStyle = '#fff'; c.fillText('PÊNALTI!', 0, 0); c.restore();
    
    c.textAlign = 'center'; c.font = '800 44px Segoe UI'; c.fillStyle = '#fecaca'; c.globalAlpha = e;
    c.fillText('⚠ VENDEDOR: ' + (P.vendedor || 'VENDEDOR'), 960, 320);
    c.globalAlpha = 1;

    // Card em destaque: CLIENTE e MOTIVO DO PÊNALTI
    c.save();
    c.translate(960, 420);
    rr(c, -480, -45, 960, 95, 16);
    c.fillStyle = 'rgba(15, 23, 42, 0.95)'; c.fill();
    c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.stroke();
    c.font = '900 25px Segoe UI'; c.fillStyle = '#38bdf8'; c.textAlign = 'center';
    c.fillText(`CLIENTE PREJUDICADO: ${P.cliente || nomeC || 'SUPERMERCADO RAVI'}`, 0, -10);
    c.font = '800 20px Segoe UI'; c.fillStyle = '#fca5a5';
    c.fillText(`MOTIVO DO PÊNALTI: ${P.motivo || P.sub || 'Cliente parado há 45+ dias sem compra com estoque suficiente'}`, 0, 24);
    c.restore();

    c.font = '700 30px Segoe UI'; c.fillStyle = '#fff';
    c.fillText('O árbitro confirma a penalidade máxima. Abrindo o relatório…', 960, 1020);
  }

  if (t > 3500 && t < 3680) { c.fillStyle = `rgba(255,255,255,${(1 - (t - 3500) / 180) * .7})`; c.fillRect(LX, 0, LW, 1080); }
  if (t > 10800 && t < 11000) { c.fillStyle = `rgba(239,68,68,${(1 - (t - 10800) / 200) * .6})`; c.fillRect(LX, 0, LW, 1080); }

  const v = c.createRadialGradient(960, 540, 400, 960, 540, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = v; c.fillRect(LX, 0, LW, 1080);
  c.restore();
}
// ============================== ANIMAÇÃO DE GOL DE PLACA (FESTA E FOGOS) ==============================
// ============================== ANIMAÇÃO DE GOL DE PLACA (MULTIESTÁGIO CINEMATOGRÁFICO) ==============================
// Estágios autênticos da transmissão:
// 1) 0 - 3200ms: Lance ao vivo! Craque faz jogada genial, drible e chuta bomba no ângulo (goleiro voa e bola estufa a rede com rastro de fogo)
// 2) 3200 - 5200ms: Vinheta espetacular da TV em tela cheia: "GOL DE PLACA! GOLAÇO HISTÓRICO!" com lasers e faíscas
// 3) 5200 - 8500ms: Replay em Câmera Lenta (Slow-Mo 0.3x) com zoom na trajetória e na bola estufando a gaveta
// 4) 8500 - 13000ms: Comemoração apoteótica: craque deslizando de joelhos no gramado, chuva de fogos de artifício coloridos e letreiro com o valor
const FOGOS = (() => { const a = []; for (let i = 0; i < 200; i++) a.push({x: 960, y: 460, vx: (Math.random() - .5) * 28, vy: (Math.random() - .75) * 24, c: ['#facc15', '#22c55e', '#38bdf8', '#ef4444', '#a855f7', '#fb923c', '#ffffff'][Math.floor(Math.random() * 7)], s: Math.random() * 7 + 3}); return a; })();

function somTorcidaGol() {
  if (window.somOn === false) return;
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)();
    // Bumbo / explosão inicial
    const o = C.createOscillator(), g = C.createGain(), n = C.currentTime;
    o.type = 'triangle'; o.frequency.setValueAtTime(140, n); o.frequency.exponentialRampToValueAtTime(35, n + 0.8);
    g.gain.setValueAtTime(0.35, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.9);
    o.connect(g); g.connect(C.destination); o.start(n); o.stop(n + 1.0);
    // Corneta de comemoração
    [440, 554, 659, 880].forEach((freq, idx) => {
      const co = C.createOscillator(), cg = C.createGain(), ct = n + idx * 0.12;
      co.type = 'sawtooth'; co.frequency.value = freq;
      cg.gain.setValueAtTime(0.001, ct); cg.gain.exponentialRampToValueAtTime(0.18, ct + 0.05); cg.gain.exponentialRampToValueAtTime(0.001, ct + 0.6);
      co.connect(cg); cg.connect(C.destination); co.start(ct); co.stop(ct + 0.7);
    });
  } catch {}
}

function desenhaCenaGol(c, W, H, t, P) {
  const S = H / 1080, ox = (W / S - 1920) / 2, LX = -ox, LW = 1920 + 2 * ox, CH = 940;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.save(); c.scale(S, S); c.translate(ox, 0);

  // --- FASE 2: VINHETA DA TV EM TELA CHEIA (3200 a 5200 ms) ---
  if (t >= 3200 && t < 5200) {
    const q = (t - 3200) / 2000;
    c.fillStyle = '#022c22'; c.fillRect(LX, 0, LW, 1080);
    c.strokeStyle = 'rgba(34, 197, 94, 0.25)'; c.lineWidth = 2;
    for (let y = 0; y < 1080; y += 40) { c.beginPath(); c.moveTo(LX, y); c.lineTo(1920 + ox, y); c.stroke(); }
    const beamY = ((t * 0.9) % 1080);
    c.fillStyle = 'rgba(250, 204, 21, 0.2)'; c.fillRect(LX, beamY - 50, LW, 100);

    c.save(); c.translate(960, 480);
    rr(c, -420, -210, 840, 420, 32);
    c.fillStyle = '#064e3b'; c.fill();
    c.lineWidth = 8; c.strokeStyle = '#22c55e'; c.stroke();

    rr(c, -240, -150, 480, 110, 18);
    c.fillStyle = '#16a34a'; c.fill();
    c.font = '900 78px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText('⚽ GOL!', 0, -68);

    c.font = '900 54px Segoe UI'; c.fillStyle = '#facc15';
    c.fillText('GOLAÇO DE PLACA!', 0, 40);

    c.font = '800 28px Segoe UI'; c.fillStyle = '#dcfce7';
    c.fillText(P.sub || 'SUPER PEDIDO DIGITADO HOJE!', 0, 100);

    rr(c, -300, 140, 600, 16, 8); c.fillStyle = '#042f2e'; c.fill();
    rr(c, -300, 140, 600 * q, 16, 8); c.fillStyle = '#facc15'; c.fill();
    c.restore();
    c.restore();
    return;
  }

  let isSlowMo = (t >= 5200 && t < 8500);
  let cenaT = t;
  if (isSlowMo) {
    // Replay da finalização e a bola entrando em câmera lenta (0.3x)
    const p = (t - 5200) / 3300;
    cenaT = 1600 + p * 1200;
    c.translate(960, 540);
    c.scale(1.35, 1.35);
    c.translate(-1100, -520);
  } else if (t >= 8500) {
    cenaT = 3200 + (t - 8500);
  }

  // Estádio com torcida vibrando e refletores
  const g = c.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, '#022c22'); g.addColorStop(1, '#064e3b'); c.fillStyle = g; c.fillRect(LX, 0, LW, 540);
  for (const fx of [240, 720, 1200, 1680]) {
    c.fillStyle = 'rgba(255,255,220,.09)'; c.beginPath(); c.moveTo(fx - 40, 0); c.lineTo(fx + 40, 0); c.lineTo(fx + 260, 540); c.lineTo(fx - 260, 540); c.fill();
    c.fillStyle = '#fffbe0'; c.fillRect(fx - 45, 18, 90, 16);
  }
  c.fillStyle = '#033526'; c.fillRect(LX, 240, LW, 300);
  for (const d of TORCIDA) {
    const px = LX + d.x * LW, pulo = t > 2400 ? Math.abs(Math.sin(t * .015 + d.ph)) * 14 : 0;
    c.fillStyle = ['#22c55e', '#facc15', '#ffffff', '#38bdf8'][Math.floor(d.ph * 2) % 4];
    c.fillRect(px, d.y - pulo, 10, 14);
  }

  // Gramado e linhas do campo
  c.fillStyle = '#047857'; c.fillRect(LX, 540, LW, 540);
  for (let i = -3; i < 16; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; c.fillRect(i * 160, 540, 160, 540); }
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.beginPath(); c.moveTo(LX, 580); c.lineTo(1920 + ox, 580); c.stroke();

  // Gol da trave e rede (trave com profundidade 3D)
  c.lineWidth = 14; c.strokeStyle = '#f8fafc'; c.strokeRect(1380, 340, 440, 260);
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.4)';
  for (let x = 1400; x < 1820; x += 20) { c.beginPath(); c.moveTo(x, 340); c.lineTo(x, 600); c.stroke(); }
  for (let y = 360; y < 600; y += 20) { c.beginPath(); c.moveTo(1380, y); c.lineTo(1820, y); c.stroke(); }

  // Goleiro pulando desesperado no canto oposto
  const gkProg = Math.min(1, Math.max(0, (cenaT - 1600) / 1000));
  const gkx = 1440 + gkProg * 140, gky = CH - 80 - Math.sin(gkProg * Math.PI) * 110;
  pessoa(c, {x: gkx, y: gky, k: 1.4, camisa: '#0284c7', calcao: '#0369a1', num: '1', pose: 'fall', rot: 0.9 * gkProg, fase: 0, grito: true});
  etiqueta(c, 'GOLEIRO', gkx, gky - 190, '#38bdf8');

  // Trajetória do chutaço de fora da área (0 a 2600ms)
  const progBomba = Math.min(1, cenaT / 2500);
  const bx = 220 + progBomba * 1410, by = 820 - Math.sin(progBomba * Math.PI) * 490 - progBomba * 370;

  // Rastro de fogo na bola estufando a rede
  for (let i = 0; i < 14; i++) {
    const r = (14 - i) * 3, op = (14 - i) / 14;
    c.fillStyle = i % 2 ? `rgba(239, 68, 68, ${op})` : `rgba(250, 204, 21, ${op})`;
    c.beginPath(); c.arc(bx - i * 20 * progBomba, by + i * 4 * progBomba, r, 0, 7); c.fill();
  }
  bola(c, bx, by, 22, cenaT * .05);

  // Craque da camisa 10
  const nomeCraque = (P.vendedor || 'VENDEDOR').split(' ')[0];
  if (t < 3200 || isSlowMo) {
    // Fase chute
    const cx = 300 + Math.min(cenaT * 0.45, 600);
    pessoa(c, {x: cx, y: CH, k: 1.55, camisa: '#16a34a', calcao: '#14532d', num: '10', pose: 'slide', rot: -0.2, fase: cenaT * 0.02, grito: true});
    etiqueta(c, `CRAQUE: ${nomeCraque}`, cx, CH - 270, '#22c55e');
  } else {
    // Comemoração apoteótica: deslizando de joelhos com braços erguidos e chuva de fogos
    const jx = 750 + Math.min(300, (t - 8500) * 0.05);
    pessoa(c, {x: jx, y: CH, k: 1.65, camisa: '#16a34a', calcao: '#14532d', num: '10', pose: 'slide', rot: -0.35, fase: t * 0.01, grito: true});
    etiqueta(c, `⭐ CRAQUE DO DIA: ${nomeCraque} ⭐`, jx, CH - 280, '#facc15');
  }

  // Tarja de Câmera Lenta no Replay
  if (isSlowMo) {
    c.save();
    c.translate(960, 180);
    rr(c, -380, -45, 760, 90, 16); c.fillStyle = 'rgba(15, 23, 42, 0.92)'; c.fill();
    c.lineWidth = 4; c.strokeStyle = '#22c55e'; c.stroke();
    c.font = '900 36px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'left';
    c.fillText('⚽ REPLAY · BOMBA NO ÂNGULO!', -320, 12);
    c.font = '800 24px Segoe UI'; c.fillStyle = '#facc15'; c.textAlign = 'right';
    c.fillText('0.3x SLOW-MO', 340, 10);
    c.restore();
  }

  // Fogos e Letreiro Titânico
  if (t > 8500) {
    const ft = (t - 8500) * 0.001;
    FOGOS.forEach(f => {
      const px = f.x + f.vx * ft * 50, py = f.y + f.vy * ft * 50 + 0.5 * 18 * ft * ft * 22;
      c.fillStyle = f.c; c.beginPath(); c.arc(px, py, f.s, 0, 7); c.fill();
    });

    c.save();
    c.translate(960, 220);
    const sc = 1 + .06 * Math.sin(t * .01);
    c.scale(sc, sc);
    c.font = '900 135px Segoe UI'; c.textAlign = 'center';
    c.lineWidth = 20; c.strokeStyle = '#064e3b'; c.strokeText('⚽ GOLAÇO DE PLACA!', 0, 0);
    c.fillStyle = '#facc15'; c.fillText('⚽ GOLAÇO DE PLACA!', 0, 0);

    rr(c, -460, 40, 920, 84, 18); c.fillStyle = 'rgba(15, 23, 42, 0.94)'; c.fill();
    c.strokeStyle = '#22c55e'; c.lineWidth = 4; c.stroke();
    c.font = '900 32px Segoe UI'; c.fillStyle = '#fef08a';
    c.fillText(P.sub || 'SUPER PEDIDO DIGITADO HOJE!', 0, 76);
    c.font = '800 24px Segoe UI'; c.fillStyle = '#86efac';
    c.fillText(`CLIENTE: ${P.cliente || 'SUPERMERCADO ALVORADA'} · VALOR: ${P.valor || 'R$ 28.500'}`, 0, 110);
    c.restore();
  }

  c.restore();
}

function iniciaAnimGol(cv, P) {
  cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const c = cv.getContext('2d'); const t0 = performance.now(); let raf = 0, parou = false, tocou = false;
  const quadro = () => {
    if (parou) return;
    const t = performance.now() - t0;
    desenhaCenaGol(c, cv.width, cv.height, t, P);
    if (t > 2400 && !tocou) { tocou = true; somTorcidaGol(); }
    raf = requestAnimationFrame(quadro);
  };
  quadro(); return () => { parou = true; cancelAnimationFrame(raf); };
}

// ============================== ANIMAÇÃO DO HAT-TRICK (CONSTÂNCIA 3 VITÓRIAS / +15 PTS) ==============================
const BRASAS_HAT = (() => { 
  const a = []; 
  for (let i = 0; i < 280; i++) {
    a.push({
      x: 960, 
      y: 540, 
      vx: (Math.random() - .5) * 36, 
      vy: (Math.random() - .8) * 30, 
      c: ['#facc15', '#f59e0b', '#ea580c', '#f97316', '#fff', '#fbbf24', '#38bdf8'][Math.floor(Math.random() * 7)], 
      s: Math.random() * 8 + 3,
      ph: Math.random() * 6.28
    }); 
  }
  return a; 
})();

function somHatTrick(estagio) {
  if (window.somOn === false) return;
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)();
    const n = C.currentTime;
    if (estagio <= 2) {
      const o = C.createOscillator(), g = C.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(estagio === 1 ? 160 : 210, n);
      o.frequency.exponentialRampToValueAtTime(45, n + 0.5);
      g.gain.setValueAtTime(0.35, n);
      g.gain.exponentialRampToValueAtTime(0.001, n + 0.55);
      o.connect(g); g.connect(C.destination);
      o.start(n); o.stop(n + 0.6);
      
      const co = C.createOscillator(), cg = C.createGain();
      co.type = 'sawtooth'; co.frequency.setValueAtTime(estagio === 1 ? 440 : 554, n + 0.05);
      cg.gain.setValueAtTime(0.001, n + 0.05); cg.gain.exponentialRampToValueAtTime(0.2, n + 0.1); cg.gain.exponentialRampToValueAtTime(0.001, n + 0.5);
      co.connect(cg); cg.connect(C.destination); co.start(n + 0.05); co.stop(n + 0.55);
    } else {
      const b = C.createOscillator(), bg = C.createGain();
      b.type = 'sine'; b.frequency.setValueAtTime(120, n); b.frequency.exponentialRampToValueAtTime(30, n + 1.2);
      bg.gain.setValueAtTime(0.45, n); bg.gain.exponentialRampToValueAtTime(0.001, n + 1.25);
      b.connect(bg); bg.connect(C.destination); b.start(n); b.stop(n + 1.3);
      
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        const co = C.createOscillator(), cg = C.createGain(), ct = n + 0.12 * idx;
        co.type = 'sawtooth'; co.frequency.value = f;
        cg.gain.setValueAtTime(0.001, ct); cg.gain.exponentialRampToValueAtTime(0.22, ct + 0.04); cg.gain.exponentialRampToValueAtTime(0.001, ct + 0.6);
        co.connect(cg); cg.connect(C.destination); co.start(ct); co.stop(ct + 0.65);
      });
    }
  } catch {}
}

function desenhaCenaHatTrick(c, W, H, t, P) {
  const S = H / 1080, ox = (W / S - 1920) / 2, LX = -ox, LW = 1920 + 2 * ox, CH = 940;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.save(); c.scale(S, S); c.translate(ox, 0);

  // FASE 2: VINHETA DA TV BROADCAST EM TELA CHEIA (3800 a 6500 ms)
  if (t >= 3800 && t < 6500) {
    const q = (t - 3800) / 2700;
    const bgG = c.createLinearGradient(0, 0, 1920, 1080);
    bgG.addColorStop(0, '#431407'); bgG.addColorStop(0.5, '#1e1b4b'); bgG.addColorStop(1, '#0f172a');
    c.fillStyle = bgG; c.fillRect(LX, 0, LW, 1080);
    
    c.strokeStyle = 'rgba(251, 191, 36, 0.25)'; c.lineWidth = 3;
    for (let y = 0; y < 1080; y += 45) { c.beginPath(); c.moveTo(LX, y); c.lineTo(1920 + ox, y); c.stroke(); }
    const beamY = ((t * 1.2) % 1080);
    c.fillStyle = 'rgba(249, 115, 22, 0.25)'; c.fillRect(LX, beamY - 60, LW, 120);

    c.save(); c.translate(960, 480);
    rr(c, -460, -220, 920, 440, 36);
    c.fillStyle = '#0f172a'; c.fill();
    c.lineWidth = 8; c.strokeStyle = '#f59e0b'; c.stroke();

    rr(c, -340, -165, 680, 120, 20);
    const gF = c.createLinearGradient(-340, 0, 340, 0);
    gF.addColorStop(0, '#ea580c'); gF.addColorStop(1, '#f59e0b');
    c.fillStyle = gF; c.fill();
    c.font = '900 82px Segoe UI, Chakra Petch, sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText('🔥 HAT-TRICK! 🔥', 0, -80);

    c.font = '900 52px Segoe UI'; c.fillStyle = '#fef08a';
    c.fillText('3 VITÓRIAS CONSECUTIVAS!', 0, 40);

    c.font = '800 28px Segoe UI'; c.fillStyle = '#fed7aa';
    c.fillText(P.sub || 'MÁXIMA CONSTÂNCIA E EFICIÊNCIA DE CAMPO', 0, 100);

    rr(c, -320, 145, 640, 18, 9); c.fillStyle = '#431407'; c.fill();
    rr(c, -320, 145, 640 * q, 18, 9); c.fillStyle = '#facc15'; c.fill();
    c.restore();
    c.restore();
    return;
  }

  // Fundo Estádio Noturno / Eletrizante
  const gSky = c.createLinearGradient(0, 0, 0, 540);
  gSky.addColorStop(0, '#1c1917'); gSky.addColorStop(1, '#292524');
  c.fillStyle = gSky; c.fillRect(LX, 0, LW, 540);

  for (const fx of [200, 680, 1160, 1640]) {
    c.fillStyle = 'rgba(254, 240, 138, 0.12)'; c.beginPath();
    c.moveTo(fx - 40, 0); c.lineTo(fx + 40, 0); c.lineTo(fx + 240, 540); c.lineTo(fx - 240, 540); c.fill();
    c.fillStyle = '#fef08a'; c.fillRect(fx - 45, 18, 90, 16);
  }

  c.fillStyle = '#1c1917'; c.fillRect(LX, 260, LW, 280);
  for (const d of TORCIDA) {
    const px = LX + d.x * LW, pulo = t > 1000 ? Math.abs(Math.sin(t * .018 + d.ph)) * 16 : 0;
    c.fillStyle = ['#f59e0b', '#ea580c', '#ffffff', '#22c55e'][Math.floor(d.ph * 2) % 4];
    c.fillRect(px, d.y - pulo, 10, 14);
  }

  c.fillStyle = '#15803d'; c.fillRect(LX, 540, LW, 540);
  for (let i = -3; i < 16; i++) {
    c.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)';
    c.fillRect(i * 160, 540, 160, 540);
  }
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(LX, 580); c.lineTo(1920 + ox, 580); c.stroke();

  c.lineWidth = 14; c.strokeStyle = '#fff'; c.strokeRect(1380, 340, 440, 260);
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.4)';
  for (let x = 1400; x < 1820; x += 20) { c.beginPath(); c.moveTo(x, 340); c.lineTo(x, 600); c.stroke(); }
  for (let y = 360; y < 600; y += 20) { c.beginPath(); c.moveTo(1380, y); c.lineTo(1820, y); c.stroke(); }

  const nomeV = (P.vendedor || 'VENDEDOR').split(' ')[0];
  const clientesHat = (Array.isArray(P.clientes) && P.clientes.length >= 3) ? P.clientes : [
    { nome: (P.cliente1 || 'PEDIDO 1'), valor: (P.valor1 || '—') },
    { nome: (P.cliente2 || 'PEDIDO 2'), valor: (P.valor2 || '—') },
    { nome: (P.cliente3 || 'PEDIDO 3'), valor: (P.valor3 || '—') }
  ];

  // FASE 1: O TRIPLO DISPARO (0 a 3800 ms)
  if (t < 3800) {
    c.save(); c.translate(960, 140);
    rr(c, -340, -40, 680, 80, 20); c.fillStyle = 'rgba(15,23,42,0.95)'; c.fill();
    c.strokeStyle = '#f59e0b'; c.lineWidth = 4; c.stroke();
    c.font = '900 36px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText('🔥 SEQUÊNCIA DO HAT-TRICK 🔥', 0, 14);
    c.restore();

    // 1º Chute (0 -> 1200ms)
    const p1 = Math.min(1, t / 1100);
    const b1x = 180 + p1 * 1420, b1y = 780 - Math.sin(p1 * Math.PI) * 440 - p1 * 340;
    if (t < 1300) {
      for (let i = 0; i < 10; i++) {
        c.fillStyle = `rgba(250, 204, 21, ${(10 - i) / 10})`;
        c.beginPath(); c.arc(b1x - i * 18 * p1, b1y + i * 5 * p1, (10 - i) * 2.5, 0, 7); c.fill();
      }
      bola(c, b1x, b1y, 20, t * 0.04);
    }
    if (t >= 1100) {
      c.save(); c.translate(1440, 290);
      rr(c, -170, -40, 340, 80, 14); c.fillStyle = '#166534'; c.fill();
      c.strokeStyle = '#86efac'; c.lineWidth = 3; c.stroke();
      c.font = '900 24px Segoe UI'; c.fillStyle = '#fef08a'; c.textAlign = 'center';
      c.fillText(`⚽ 1º GOL · ${clientesHat[0].valor || ''}`, 0, -8);
      c.font = '800 18px Segoe UI'; c.fillStyle = '#fff';
      c.fillText(clientesHat[0].nome || 'CLIENTE 1', 0, 20);
      c.restore();
    }

    // 2º Chute (1200 -> 2400ms)
    if (t >= 1200) {
      const p2 = Math.min(1, (t - 1200) / 1100);
      const b2x = 220 + p2 * 1380, b2y = 820 - Math.sin(p2 * Math.PI) * 220 - p2 * 360;
      if (t < 2500) {
        for (let i = 0; i < 10; i++) {
          c.fillStyle = `rgba(249, 115, 22, ${(10 - i) / 10})`;
          c.beginPath(); c.arc(b2x - i * 18 * p2, b2y + i * 3 * p2, (10 - i) * 2.5, 0, 7); c.fill();
        }
        bola(c, b2x, b2y, 20, t * 0.05);
      }
    }
    if (t >= 2300) {
      c.save(); c.translate(1600, 290);
      rr(c, -170, -40, 340, 80, 14); c.fillStyle = '#ea580c'; c.fill();
      c.strokeStyle = '#fed7aa'; c.lineWidth = 3; c.stroke();
      c.font = '900 24px Segoe UI'; c.fillStyle = '#fef08a'; c.textAlign = 'center';
      c.fillText(`⚽ 2º GOL · ${clientesHat[1].valor || ''}`, 0, -8);
      c.font = '800 18px Segoe UI'; c.fillStyle = '#fff';
      c.fillText(clientesHat[1].nome || 'CLIENTE 2', 0, 20);
      c.restore();
    }

    // 3º Chute Trivela Explosiva (2400 -> 3800ms)
    if (t >= 2400) {
      const p3 = Math.min(1, (t - 2400) / 1200);
      const b3x = 180 + p3 * 1480, b3y = 740 - Math.sin(p3 * Math.PI) * 580 - p3 * 220;
      for (let i = 0; i < 14; i++) {
        c.fillStyle = i % 2 ? `rgba(239, 68, 68, ${(14 - i) / 14})` : `rgba(250, 204, 21, ${(14 - i) / 14})`;
        c.beginPath(); c.arc(b3x - i * 20 * p3, b3y + i * 4 * p3, (14 - i) * 3, 0, 7); c.fill();
      }
      bola(c, b3x, b3y, 24, t * 0.06);
    }
    if (t >= 3500) {
      c.save(); c.translate(1520, 180);
      rr(c, -190, -45, 380, 90, 16); c.fillStyle = '#b91c1c'; c.fill();
      c.strokeStyle = '#fde047'; c.lineWidth = 4; c.stroke();
      c.font = '900 26px Segoe UI'; c.fillStyle = '#fde047'; c.textAlign = 'center';
      c.fillText(`🔥 3º GOL (HAT-TRICK!) · ${clientesHat[2].valor || ''}`, 0, -10);
      c.font = '800 19px Segoe UI'; c.fillStyle = '#fff';
      c.fillText(clientesHat[2].nome || 'CLIENTE 3', 0, 22);
      c.restore();
    }

    const cx = 350 + Math.min(t * 0.35, 450);
    pessoa(c, {x: cx, y: CH, k: 1.55, camisa: '#ea580c', calcao: '#7c2d12', num: '9', pose: 'slide', rot: -0.25, fase: t * 0.02, grito: true});
    etiqueta(c, `ARTILHEIRO: ${nomeV}`, cx, CH - 270, '#f97316');

  } else {
    // FASE 3: APOTEOSE DO HAT-TRICK (6500 a 13000 ms)
    const ft = (t - 6500) * 0.001;
    BRASAS_HAT.forEach(f => {
      const px = f.x + f.vx * ft * 48, py = f.y + f.vy * ft * 48 + 0.5 * 18 * ft * ft * 22;
      c.fillStyle = f.c; c.beginPath(); c.arc(px, py, f.s, 0, 7); c.fill();
    });

    const jx = 960;
    pessoa(c, {x: jx, y: CH - 20, k: 1.6, camisa: '#ea580c', calcao: '#7c2d12', num: '9', pose: 'slide', rot: -0.2, fase: t * 0.01, grito: true});
    etiqueta(c, `⭐ CRAQUE DA CONSTÂNCIA: ${nomeV} ⭐`, jx, CH - 300, '#facc15');

    c.save();
    c.translate(960, 210);
    const pulso = 1 + 0.04 * Math.sin(t * 0.008);
    c.scale(pulso, pulso);

    c.font = '900 110px Segoe UI, Chakra Petch, sans-serif'; c.textAlign = 'center';
    c.lineWidth = 20; c.strokeStyle = '#7c2d12'; c.strokeText('🔥 HAT-TRICK DE OURO! 🔥', 0, -40);
    c.fillStyle = '#facc15'; c.fillText('🔥 HAT-TRICK DE OURO! 🔥', 0, -40);

    rr(c, -440, 25, 880, 72, 18);
    const gCard = c.createLinearGradient(-440, 0, 440, 0);
    gCard.addColorStop(0, '#ea580c'); gCard.addColorStop(0.5, '#f59e0b'); gCard.addColorStop(1, '#ea580c');
    c.fillStyle = gCard; c.fill();
    c.strokeStyle = '#fef08a'; c.lineWidth = 4; c.stroke();

    c.font = '900 40px Segoe UI'; c.fillStyle = '#ffffff';
    c.fillText('🏆 +15 PONTOS DE CONSTÂNCIA NA TABELA! 🏆', 0, 74);

    // TRINCA DE CLIENTES LADO A LADO NA DECISÃO FINAL
    c.restore();

    c.save();
    c.translate(960, 390);
    const posTrinca = [-340, 0, 340];
    const coresGols = ['#166534', '#ea580c', '#b91c1c'];
    const bordasGols = ['#86efac', '#fed7aa', '#fde047'];
    for (let i = 0; i < 3; i++) {
      const xOffset = posTrinca[i];
      c.save(); c.translate(xOffset, 0);
      rr(c, -160, -45, 320, 90, 14);
      c.fillStyle = coresGols[i]; c.fill();
      c.strokeStyle = bordasGols[i]; c.lineWidth = 3; c.stroke();
      c.font = '900 20px Segoe UI'; c.fillStyle = '#fef08a'; c.textAlign = 'center';
      c.fillText(`GOL ${i + 1} · ${clientesHat[i].valor || ''}`, 0, -12);
      c.font = '800 17px Segoe UI'; c.fillStyle = '#ffffff';
      c.fillText(clientesHat[i].nome || `CLIENTE ${i + 1}`, 0, 18);
      c.restore();
    }
    c.restore();
  }

  c.restore();
}

function iniciaAnimHatTrick(cv, P) {
  cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const c = cv.getContext('2d'); const t0 = performance.now(); let raf = 0, parou = false;
  let t1 = false, t2 = false, t3 = false;
  const quadro = () => {
    if (parou) return;
    const t = performance.now() - t0;
    desenhaCenaHatTrick(c, cv.width, cv.height, t, P);
    if (t > 1000 && !t1) { t1 = true; somHatTrick(1); }
    if (t > 2200 && !t2) { t2 = true; somHatTrick(2); }
    if (t > 3400 && !t3) { t3 = true; somHatTrick(3); }
    raf = requestAnimationFrame(quadro);
  };
  quadro(); return () => { parou = true; cancelAnimationFrame(raf); };
}

// ============================== ANIMAÇÃO DE SEMANA INVICTA (5 VITÓRIAS SEG-SEX / +30 PTS) ==============================
function somSemanaInvicta(dia) {
  if (window.somOn === false) return;
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)();
    const n = C.currentTime;
    const notas = [261.63, 293.66, 329.63, 392.00, 523.25];
    const freq = notas[dia - 1] || 523.25;
    const o = C.createOscillator(), g = C.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, n);
    g.gain.setValueAtTime(0.28, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.65);
    o.connect(g); g.connect(C.destination); o.start(n); o.stop(n + 0.7);

    if (dia === 5) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        const co = C.createOscillator(), cg = C.createGain(), ct = n + 0.2 + idx * 0.12;
        co.type = 'sawtooth'; co.frequency.value = f;
        cg.gain.setValueAtTime(0.001, ct); cg.gain.exponentialRampToValueAtTime(0.2, ct + 0.04); cg.gain.exponentialRampToValueAtTime(0.001, ct + 0.6);
        co.connect(cg); cg.connect(C.destination); co.start(ct); co.stop(ct + 0.65);
      });
    }
  } catch {}
}

function desenhaCenaSemanaInvicta(c, W, H, t, P) {
  const S = H / 1080, ox = (W / S - 1920) / 2, LX = -ox, LW = 1920 + 2 * ox, CH = 940;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.save(); c.scale(S, S); c.translate(ox, 0);

  // FASE 2: VINHETA DA TV BROADCAST EM TELA CHEIA (4000 a 7000 ms)
  if (t >= 4000 && t < 7000) {
    const q = (t - 4000) / 3000;
    const bgG = c.createLinearGradient(0, 0, 1920, 1080);
    bgG.addColorStop(0, '#064e3b'); bgG.addColorStop(0.5, '#0f172a'); bgG.addColorStop(1, '#022c22');
    c.fillStyle = bgG; c.fillRect(LX, 0, LW, 1080);

    c.strokeStyle = 'rgba(34, 197, 94, 0.25)'; c.lineWidth = 3;
    for (let y = 0; y < 1080; y += 45) { c.beginPath(); c.moveTo(LX, y); c.lineTo(1920 + ox, y); c.stroke(); }
    const beamY = ((t * 1.1) % 1080);
    c.fillStyle = 'rgba(250, 204, 21, 0.2)'; c.fillRect(LX, beamY - 60, LW, 120);

    c.save(); c.translate(960, 480);
    rr(c, -460, -220, 920, 440, 36);
    c.fillStyle = '#0f172a'; c.fill();
    c.lineWidth = 8; c.strokeStyle = '#22c55e'; c.stroke();

    rr(c, -350, -165, 700, 120, 20);
    const gF = c.createLinearGradient(-350, 0, 350, 0);
    gF.addColorStop(0, '#15803d'); gF.addColorStop(1, '#eab308');
    c.fillStyle = gF; c.fill();
    c.font = '900 78px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText('👑 SEMANA INVICTA! 👑', 0, -80);

    c.font = '900 50px Segoe UI'; c.fillStyle = '#fef08a';
    c.fillText('5 VITÓRIAS EM 5 JOGOS!', 0, 40);

    c.font = '800 28px Segoe UI'; c.fillStyle = '#dcfce7';
    c.fillText(P.sub || '100% DE APROVEITAMENTO DE SEGUNDA A SEXTA', 0, 100);

    rr(c, -320, 145, 640, 18, 9); c.fillStyle = '#064e3b'; c.fill();
    rr(c, -320, 145, 640 * q, 18, 9); c.fillStyle = '#22c55e'; c.fill();
    c.restore();
    c.restore();
    return;
  }

  // Fundo Nobre
  const gSky = c.createLinearGradient(0, 0, 0, 540);
  gSky.addColorStop(0, '#064e3b'); gSky.addColorStop(1, '#0f172a');
  c.fillStyle = gSky; c.fillRect(LX, 0, LW, 540);

  c.fillStyle = '#047857'; c.fillRect(LX, 540, LW, 540);
  for (let i = -3; i < 16; i++) {
    c.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)';
    c.fillRect(i * 160, 540, 160, 540);
  }
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(LX, 580); c.lineTo(1920 + ox, 580); c.stroke();

  const nomeV = (P.vendedor || 'EQUIPE TBL');

  // FASE 1: O TABULEIRO DOS 5 DIAS (0 a 4000 ms)
  if (t < 4000) {
    c.save(); c.translate(960, 160);
    rr(c, -360, -40, 720, 80, 20); c.fillStyle = 'rgba(15,23,42,0.94)'; c.fill();
    c.strokeStyle = '#22c55e'; c.lineWidth = 4; c.stroke();
    c.font = '900 38px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText('📅 APURAÇÃO DA SEMANA INVICTA 📅', 0, 14);
    c.restore();

    const dias = [
      { nome: 'SEG', tOn: 600, x: 400 },
      { nome: 'TER', tOn: 1300, x: 680 },
      { nome: 'QUA', tOn: 2000, x: 960 },
      { nome: 'QUI', tOn: 2700, x: 1240 },
      { nome: 'SEX', tOn: 3400, x: 1520 }
    ];

    dias.forEach(d => {
      const ativo = t >= d.tOn;
      c.save();
      c.translate(d.x, 480);
      rr(c, -110, -140, 220, 280, 22);
      c.fillStyle = ativo ? '#064e3b' : '#1e293b'; c.fill();
      c.strokeStyle = ativo ? '#22c55e' : '#475569'; c.lineWidth = ativo ? 6 : 2; c.stroke();

      c.font = '900 42px Segoe UI'; c.fillStyle = ativo ? '#fef08a' : '#94a3b8'; c.textAlign = 'center';
      c.fillText(d.nome, 0, -60);

      if (ativo) {
        c.font = '900 32px Segoe UI'; c.fillStyle = '#22c55e';
        c.fillText('🟢 VITÓRIA', 0, 15);
        c.font = '800 24px Segoe UI'; c.fillStyle = '#fff';
        c.fillText('3 PONTOS', 0, 70);
      } else {
        c.font = '700 26px Segoe UI'; c.fillStyle = '#64748b';
        c.fillText('PENDENTE', 0, 20);
      }
      c.restore();
    });

    pessoa(c, {x: 960, y: CH, k: 1.55, camisa: '#16a34a', calcao: '#14532d', num: '10', pose: 'run', fase: t * 0.02});
    etiqueta(c, `LÍDER: ${nomeV}`, 960, CH - 270, '#22c55e');

  } else {
    // FASE 3: APOTEOSE DA SEMANA INVICTA (7000 a 13000 ms)
    const ft = (t - 7000) * 0.001;
    FOGOS.forEach(f => {
      const px = f.x + f.vx * ft * 46, py = f.y + f.vy * ft * 46 + 0.5 * 18 * ft * ft * 22;
      c.fillStyle = f.c; c.beginPath(); c.arc(px, py, f.s, 0, 7); c.fill();
    });

    pessoa(c, {x: 960, y: CH - 30, k: 1.65, camisa: '#16a34a', calcao: '#14532d', num: '10', pose: 'slide', rot: -0.2, fase: t * 0.01, grito: true});
    etiqueta(c, `⭐ CAMPEÃO INVICTO: ${nomeV} ⭐`, 960, CH - 300, '#facc15');

    c.save();
    c.translate(960, 240);
    const pulso = 1 + 0.04 * Math.sin(t * 0.008);
    c.scale(pulso, pulso);

    c.font = '900 120px Segoe UI, Chakra Petch, sans-serif'; c.textAlign = 'center';
    c.lineWidth = 22; c.strokeStyle = '#064e3b'; c.strokeText('👑 SEMANA INVICTA! 👑', 0, -40);
    c.fillStyle = '#facc15'; c.fillText('👑 SEMANA INVICTA! 👑', 0, -40);

    rr(c, -440, 30, 880, 84, 22);
    const gCard = c.createLinearGradient(-440, 0, 440, 0);
    gCard.addColorStop(0, '#15803d'); gCard.addColorStop(0.5, '#eab308'); gCard.addColorStop(1, '#15803d');
    c.fillStyle = gCard; c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 5; c.stroke();

    c.font = '900 46px Segoe UI'; c.fillStyle = '#ffffff';
    c.fillText('👑 +30 PONTOS EXTRAS NA TABELA GERAL! 👑', 0, 88);

    c.font = '800 28px Segoe UI'; c.fillStyle = '#dcfce7';
    c.fillText(P.sub || '5 VITÓRIAS DE SEGUNDA A SEXTA · 100% REGULARIDADE', 0, 155);

    c.restore();
  }

  c.restore();
}

function iniciaAnimSemanaInvicta(cv, P) {
  cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const c = cv.getContext('2d'); const t0 = performance.now(); let raf = 0, parou = false;
  let d1 = false, d2 = false, d3 = false, d4 = false, d5 = false;
  const quadro = () => {
    if (parou) return;
    const t = performance.now() - t0;
    desenhaCenaSemanaInvicta(c, cv.width, cv.height, t, P);
    if (t > 600 && !d1) { d1 = true; somSemanaInvicta(1); }
    if (t > 1300 && !d2) { d2 = true; somSemanaInvicta(2); }
    if (t > 2000 && !d3) { d3 = true; somSemanaInvicta(3); }
    if (t > 2700 && !d4) { d4 = true; somSemanaInvicta(4); }
    if (t > 3400 && !d5) { d5 = true; somSemanaInvicta(5); }
    raf = requestAnimationFrame(quadro);
  };
  quadro(); return () => { parou = true; cancelAnimationFrame(raf); };
}

// ============================== ANIMAÇÃO DO CARTÃO VERMELHO / AMARELO (CINEMATOGRÁFICO) ==============================
// Estágios:
// 1) 0 - 3000ms: Lance da infração grave (falta dura / reclamação descontrolada na cara do juiz)
// 2) 3000 - 4500ms: Juiz corre furioso apitando com o braço apontado
// 3) 4500 - 7500ms: Vinheta VAR de Decisão Disciplinar: "CARTÃO VERMELHO DIRETO / EXPULSÃO"
// 4) 7500 - 12000ms: Árbitro puxa o cartão do bolso em zoom dramático na cara do vendedor, apontando o caminho do vestiário
function desenhaCenaCartao(c, W, H, t, P, isVermelho) {
  const S = H / 1080, ox = (W / S - 1920) / 2, LX = -ox, LW = 1920 + 2 * ox, CH = 940;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.save(); c.scale(S, S); c.translate(ox, 0);

  // --- FASE 3: VINHETA DA TV (4500 a 7200 ms) ---
  if (t >= 4500 && t < 7200) {
    const q = (t - 4500) / 2700;
    c.fillStyle = isVermelho ? '#450a0a' : '#422006'; c.fillRect(LX, 0, LW, 1080);
    c.strokeStyle = isVermelho ? 'rgba(239, 68, 68, 0.3)' : 'rgba(250, 204, 21, 0.3)'; c.lineWidth = 3;
    for (let y = 0; y < 1080; y += 45) { c.beginPath(); c.moveTo(LX, y); c.lineTo(1920 + ox, y); c.stroke(); }

    c.save(); c.translate(960, 480);
    rr(c, -440, -200, 880, 400, 28);
    c.fillStyle = '#0f172a'; c.fill();
    c.lineWidth = 8; c.strokeStyle = isVermelho ? '#ef4444' : '#facc15'; c.stroke();

    rr(c, -300, -145, 600, 110, 18);
    c.fillStyle = isVermelho ? '#dc2626' : '#ca8a04'; c.fill();
    c.font = '900 68px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText(isVermelho ? '🟥 CARTÃO VERMELHO' : '🟨 CARTÃO AMARELO', 0, -66);

    c.font = '900 48px Segoe UI'; c.fillStyle = isVermelho ? '#fecaca' : '#fef08a';
    c.fillText(isVermelho ? 'EXPULSÃO DE CAMPO!' : 'ADVERTÊNCIA DISCIPLINAR!', 0, 45);

    c.font = '700 28px Segoe UI'; c.fillStyle = '#cbd5e1';
    c.fillText(P.sub || 'INFRAÇÃO GRAVE DETECTADA NA ROTA', 0, 105);

    rr(c, -280, 140, 560, 14, 7); c.fillStyle = '#334155'; c.fill();
    rr(c, -280, 140, 560 * q, 14, 7); c.fillStyle = isVermelho ? '#ef4444' : '#facc15'; c.fill();
    c.restore();
    c.restore();
    return;
  }

  // Fundo do Estádio Tenso
  const bgCor = isVermelho ? '#2b0606' : '#261605';
  c.fillStyle = bgCor; c.fillRect(LX, 0, LW, 540);
  c.fillStyle = '#166534'; c.fillRect(LX, 540, LW, 540);
  for (let i = -3; i < 16; i++) { c.fillStyle = i % 2 ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.03)'; c.fillRect(i * 160, 540, 160, 540); }

  const nomeV = (P.vendedor || 'VENDEDOR').split(' ')[0];

  if (t < 4500) {
    // FASE 1: Vendedor gesticulando / caindo e árbitro correndo e apitando furioso
    const jx = 1100, rx = 500 + Math.min(1, t / 3500) * 350;
    pessoa(c, {x: jx, y: CH, k: 1.5, camisa: isVermelho ? '#ef4444' : '#eab308', calcao: '#111', num: '9', pose: 'protesto', rot: 0.1, fase: t * 0.02, grito: true});
    etiqueta(c, `INFRATOR: ${nomeV}`, jx, CH - 280, isVermelho ? '#ef4444' : '#eab308');

    pessoa(c, {x: rx, y: CH, k: 1.55, camisa: '#111', calcao: '#111', pose: t < 3000 ? 'run' : 'apito', fase: t * 0.02, alvo: 1.4});
    etiqueta(c, 'ÁRBITRO', rx, CH - 290, '#facc15');

    if (t > 3000) {
      c.save(); c.translate(rx + 60, CH - 370);
      c.font = 'italic 900 80px Segoe UI'; c.fillStyle = '#facc15'; c.lineWidth = 10; c.strokeStyle = '#111';
      c.strokeText('PIIIIIII!', 0, 0); c.fillText('PIIIIIII!', 0, 0);
      c.restore();
    }
  } else {
    // FASE 4: ÁRBITRO EM PRIMEIRO PLANO ENCARANDO A CÂMERA E ERGUENDO O CARTÃO
    const pZoom = Math.min(1, (t - 7200) / 2500);
    const scaleRef = 1.35 + pZoom * 0.8;
    pessoa(c, {x: 960, y: CH + 80, k: scaleRef, camisa: '#111', calcao: '#111', pose: 'aponta', alvo: 0.1, fase: 0});

    // Cartão erguido no alto com brilho
    const cardCor = isVermelho ? '#ef4444' : '#facc15';
    c.save();
    c.translate(960, 310 - pZoom * 90);
    c.rotate(-0.06);
    rr(c, -85, -140, 170, 280, 16);
    c.fillStyle = cardCor; c.fill();
    c.lineWidth = 8; c.strokeStyle = '#fff'; c.stroke();
    c.restore();

    // Vendedor no fundo indo pro vestiário cabisbaixo
    const vx = 300 - pZoom * 120;
    pessoa(c, {x: vx, y: CH - 40, k: 1.1, camisa: isVermelho ? '#ef4444' : '#eab308', calcao: '#111', num: '9', pose: 'run', rot: 0.25, fase: t * 0.015});
    etiqueta(c, `RUMO AO VESTIÁRIO: ${nomeV}`, vx, CH - 270, isVermelho ? '#ef4444' : '#eab308');

    // Letreiro do Cartão
    c.save();
    c.translate(960, 690);
    c.textAlign = 'center';
    c.font = '900 76px Segoe UI'; c.fillStyle = '#fff';
    c.fillText(isVermelho ? '🟥 EXPULSÃO DIRETA!' : '🟨 CARTÃO AMARELO!', 0, 0);

    c.font = '800 38px Segoe UI'; c.fillStyle = isVermelho ? '#fca5a5' : '#fef08a';
    c.fillText(`INFRATOR: ${P.vendedor || 'VENDEDOR'}`, 0, 65);

    c.font = '700 28px Segoe UI'; c.fillStyle = '#e2e8f0';
    c.fillText(P.sub || 'Infração disciplinar grave registrada na rota.', 0, 120);
    c.restore();
  }

  c.restore();
}

function iniciaAnimCartao(cv, P, isVermelho) {
  cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const c = cv.getContext('2d'); const t0 = performance.now(); let raf = 0, parou = false, apitou = false;
  const quadro = () => {
    if (parou) return;
    const t = performance.now() - t0;
    desenhaCenaCartao(c, cv.width, cv.height, t, P, isVermelho);
    if (t > 3000 && !apitou) { apitou = true; apito(); }
    raf = requestAnimationFrame(quadro);
  };
  quadro(); return () => { parou = true; cancelAnimationFrame(raf); };
}

// ============================== ANIMAÇÃO DE IMPEDIMENTO (BANDEIRINHA + LINHAS DO VAR) ==============================
// 1) 0 - 3000ms: Vendedor corre na frente da zaga e recebe passe adiantado
// 2) 3000 - 4800ms: Bandeirinha levanta a bandeira amarela/vermelha e balança no alto!
// 3) 4800 - 8500ms: VAR TRAÇA AS LINHAS TRIDIMENSIONAIS (Linha Azul do Defensor x Linha Vermelha do Atacante na frente)
// 4) 8500 - 12000ms: Decisão confirmada: "IMPEDIMENTO! LANCE ANULADO (VISITA RELÂMPAGO)"
function desenhaCenaImpedimento(c, W, H, t, P) {
  const S = H / 1080, ox = (W / S - 1920) / 2, LX = -ox, LW = 1920 + 2 * ox, CH = 940;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.save(); c.scale(S, S); c.translate(ox, 0);

  // Campo
  fundoDeCampo(c, LX, LW, 1080, () => {
    c.fillStyle = '#0f172a'; c.fillRect(LX, 0, LW, 540);
    c.fillStyle = '#047857'; c.fillRect(LX, 540, LW, 540);
    for (let i = -3; i < 16; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.08)'; c.fillRect(i * 160, 540, 160, 540); }
  });

  const nomeV = (P.vendedor || 'VENDEDOR').split(' ')[0];

  if (t < 4800) {
    // Fase 1: Bandeirinha levantando a bandeira
    const bx = 1600;
    personagem(c, 'impedimento', bx, CH - 30, 1.5, {camisa: '#facc15', calcao: '#111', pose: 'aponta', alvo: -1.4, fase: 0});
    // Bandeira xadrez erguida no alto
    c.save(); c.translate(bx - 30, CH - 270);
    c.rotate(-0.1 + Math.sin(t * 0.02) * 0.1);
    c.fillStyle = '#ef4444'; c.fillRect(0, 0, 70, 45);
    c.fillStyle = '#facc15'; c.fillRect(35, 0, 35, 22); c.fillRect(0, 22, 35, 23);
    c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(0, 0, 70, 45);
    c.restore();
    etiqueta(c, 'ASSISTENTE (BANDEIRINHA)', bx, CH - 330, '#facc15');

    // Vendedor adiantado
    const vx = 950;
    pessoa(c, {x: vx, y: CH, k: 1.55, camisa: '#ef4444', calcao: '#450a0a', num: '9', pose: 'run', fase: t * 0.02});
    etiqueta(c, `VENDEDOR: ${nomeV}`, vx, CH - 280, '#ef4444');

    // Último defensor atrás da linha
    const dx = 750;
    pessoa(c, {x: dx, y: CH, k: 1.55, camisa: '#0284c7', calcao: '#0f172a', num: '3', pose: 'aponta', alvo: 1.2, fase: 0});
    etiqueta(c, 'ÚLTIMO DEFENSOR', dx, CH - 280, '#38bdf8');

    c.save(); c.translate(960, 200);
    c.font = '900 64px Segoe UI'; c.fillStyle = '#facc15'; c.textAlign = 'center';
    c.fillText('🚩 BANDEIRA LEVANTADA: POSSÍVEL IMPEDIMENTO!', 0, 0);
    c.restore();
  } else if (t < 8500) {
    // Fase 2: VAR Traçando as Linhas de Impedimento em Câmera Lenta
    const pLinha = Math.min(1, (t - 4800) / 2500);

    // Zoom no lance
    c.translate(960, 540); c.scale(1.25, 1.25); c.translate(-960, -560);

    const dx = 750, vx = 980;
    pessoa(c, {x: dx, y: CH, k: 1.55, camisa: '#0284c7', calcao: '#0f172a', num: '3', pose: 'aponta', alvo: 1.2, fase: 0});
    pessoa(c, {x: vx, y: CH, k: 1.55, camisa: '#ef4444', calcao: '#450a0a', num: '9', pose: 'run', rot: 0.2, fase: 0});

    // Linha Azul do Defensor
    c.strokeStyle = '#38bdf8'; c.lineWidth = 6; c.setLineDash([12, 8]);
    c.beginPath(); c.moveTo(dx, 1080); c.lineTo(dx, 1080 - pLinha * 700); c.stroke();

    // Linha Vermelha do Vendedor Adiantado
    c.strokeStyle = '#ef4444'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(vx, 1080); c.lineTo(vx, 1080 - pLinha * 700); c.stroke();
    c.setLineDash([]);

    // Medição da infração
    if (pLinha > 0.6) {
      c.fillStyle = 'rgba(239, 68, 68, 0.35)';
      c.fillRect(dx, 580, vx - dx, 220);
      c.fillStyle = '#fff'; c.font = '900 32px Segoe UI'; c.textAlign = 'center';
      c.fillText('ADIANTADO: VISITA DE 00:00!', (dx + vx) / 2, 700);
    }

    c.save(); c.translate(960, 180);
    rr(c, -380, -45, 760, 90, 16); c.fillStyle = 'rgba(15, 23, 42, 0.94)'; c.fill();
    c.lineWidth = 4; c.strokeStyle = '#f59e0b'; c.stroke();
    c.font = '900 34px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'left';
    c.fillText('VAR · TRAÇANDO LINHAS VIRTUAIS', -320, 12);
    c.font = '800 24px Segoe UI'; c.fillStyle = '#facc15'; c.textAlign = 'right';
    c.fillText('CALIBRAÇÃO 3D', 340, 10);
    c.restore();
  } else {
    // Fase 3: Decisão Confirmada
    c.save(); c.translate(960, 360);
    rr(c, -450, -180, 900, 360, 24); c.fillStyle = '#0f172a'; c.fill();
    c.lineWidth = 8; c.strokeStyle = '#ef4444'; c.stroke();

    c.font = '900 86px Segoe UI'; c.fillStyle = '#ef4444'; c.textAlign = 'center';
    c.fillText('🚩 IMPEDIMENTO!', 0, -40);

    c.font = '800 42px Segoe UI'; c.fillStyle = '#fff';
    c.fillText(`LANCE ANULADO: ${nomeV}`, 0, 45);

    c.font = '700 28px Segoe UI'; c.fillStyle = '#fca5a5';
    c.fillText(P.sub || 'Visita instantânea de 00:00 não pontua no painel.', 0, 105);
    c.restore();
  }

  c.restore();
}

function iniciaAnimImpedimento(cv, P) {
  cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const c = cv.getContext('2d'); const t0 = performance.now(); let raf = 0, parou = false, apitou = false;
  const quadro = () => {
    if (parou) return;
    const t = performance.now() - t0;
    desenhaCenaImpedimento(c, cv.width, cv.height, t, P);
    if (t > 3000 && !apitou) { apitou = true; apito(); }
    raf = requestAnimationFrame(quadro);
  };
  quadro(); return () => { parou = true; cancelAnimationFrame(raf); };
}

// ============================== ANIMAÇÃO DE DEFESA MILAGROSA (SUPER SALVAMENTO) ==============================
// 1) 0 - 3000ms: Ataque adversário chuta no cantinho rasteiro
// 2) 3000 - 5500ms: Vinheta da TV: "DEFESA MILAGROSA! MILAGRE NA ÁREA!"
// 3) 5500 - 8500ms: Replay em Slow-Mo: Goleiro salta com ponta dos dedos espalmando para escanteio
// 4) 8500 - 12000ms: Goleiro bate no peito comemorando a meta e o fechamento salvo
function desenhaCenaDefesa(c, W, H, t, P) {
  const S = H / 1080, ox = (W / S - 1920) / 2, LX = -ox, LW = 1920 + 2 * ox, CH = 940;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.save(); c.scale(S, S); c.translate(ox, 0);

  // Fase Vinheta (3000 a 5500ms)
  if (t >= 3000 && t < 5500) {
    const q = (t - 3000) / 2500;
    c.fillStyle = '#0f172a'; c.fillRect(LX, 0, LW, 1080);
    c.strokeStyle = 'rgba(56, 189, 248, 0.25)'; c.lineWidth = 2;
    for (let y = 0; y < 1080; y += 40) { c.beginPath(); c.moveTo(LX, y); c.lineTo(1920 + ox, y); c.stroke(); }

    c.save(); c.translate(960, 480);
    rr(c, -420, -190, 840, 380, 28); c.fillStyle = '#0369a1'; c.fill();
    c.lineWidth = 8; c.strokeStyle = '#38bdf8'; c.stroke();

    c.font = '900 78px Segoe UI'; c.fillStyle = '#fff'; c.textAlign = 'center';
    c.fillText('🧤 DEFESA MILAGROSA!', 0, -50);

    c.font = '800 46px Segoe UI'; c.fillStyle = '#facc15';
    c.fillText('SALVOU O RESULTADO NO FINAL!', 0, 40);

    c.font = '700 28px Segoe UI'; c.fillStyle = '#e0f2fe';
    c.fillText(P.sub || 'VENDA EM CLIENTE RECORRENTE / SALVAMENTO DE META', 0, 100);

    rr(c, -280, 135, 560, 14, 7); c.fillStyle = '#082f49'; c.fill();
    rr(c, -280, 135, 560 * q, 14, 7); c.fillStyle = '#38bdf8'; c.fill();
    c.restore();
    c.restore();
    return;
  }

  // Gramado e Estádio
  c.fillStyle = '#0c192e'; c.fillRect(LX, 0, LW, 540);
  c.fillStyle = '#047857'; c.fillRect(LX, 540, LW, 540);
  for (let i = -3; i < 16; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; c.fillRect(i * 160, 540, 160, 540); }

  // Trave
  c.lineWidth = 14; c.strokeStyle = '#fff'; c.strokeRect(1380, 350, 440, 250);

  const nomeV = (P.vendedor || 'VENDEDOR').split(' ')[0];

  if (t < 3000 || (t >= 5500 && t < 8500)) {
    // Voo do goleiro espalmando no ângulo
    const isSlow = (t >= 5500);
    const pVoo = isSlow ? Math.min(1, (t - 5500) / 2800) : Math.min(1, t / 2500);
    const gkx = 1100 + pVoo * 380, gky = CH - 80 - Math.sin(pVoo * Math.PI) * 220;

    pessoa(c, {x: gkx, y: gky, k: 1.6, camisa: '#0284c7', calcao: '#0c4a6e', num: '1', pose: 'slide', rot: 1.2 * pVoo, grito: true});
    etiqueta(c, `PAREDÃO: ${nomeV}`, gkx, gky - 190, '#38bdf8');

    // Bola sendo desviada
    const bx = 400 + pVoo * 1150, by = 600 - Math.sin(pVoo * Math.PI) * 180 + (pVoo > 0.8 ? (pVoo - 0.8) * 400 : 0);
    bola(c, bx, by, 22, t * 0.04);
  } else {
    // Comemoração: Bate no peito celebrando a defesaça
    const gx = 960;
    pessoa(c, {x: gx, y: CH, k: 1.7, camisa: '#0284c7', calcao: '#0c4a6e', num: '1', pose: 'slide', rot: -0.2, grito: true});
    etiqueta(c, `⭐ PAREDÃO DA RODADA: ${nomeV} ⭐`, gx, CH - 290, '#38bdf8');

    c.save(); c.translate(960, 240);
    rr(c, -420, -100, 840, 200, 22); c.fillStyle = 'rgba(15, 23, 42, 0.92)'; c.fill();
    c.lineWidth = 6; c.strokeStyle = '#38bdf8'; c.stroke();

    c.font = '900 68px Segoe UI'; c.fillStyle = '#38bdf8'; c.textAlign = 'center';
    c.fillText('🧤 DEFESA MILAGROSA!', 0, -20);
    c.font = '800 32px Segoe UI'; c.fillStyle = '#fff';
    c.fillText(P.sub || 'SALVOU O RESULTADO NA HORA H!', 0, 45);
    c.restore();
  }

  c.restore();
}

function iniciaAnimDefesa(cv, P) {
  cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const c = cv.getContext('2d'); const t0 = performance.now(); let raf = 0, parou = false, tocou = false;
  const quadro = () => {
    if (parou) return;
    const t = performance.now() - t0;
    desenhaCenaDefesa(c, cv.width, cv.height, t, P);
    if (t > 2400 && !tocou) { tocou = true; somTorcidaGol(); }
    raf = requestAnimationFrame(quadro);
  };
  quadro(); return () => { parou = true; cancelAnimationFrame(raf); };
}

function apito() {
  if (window.somOn === false) return;
  try { const C = new (window.AudioContext || window.webkitAudioContext)(), o = C.createOscillator(), l = C.createOscillator(), g = C.createGain(), lg = C.createGain(), n = C.currentTime;
    o.type = 'sine'; o.frequency.value = 2900; l.frequency.value = 38; lg.gain.value = 180; l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(.25, n + .03); g.gain.exponentialRampToValueAtTime(.0001, n + 1.1); o.connect(g); g.connect(C.destination); o.start(); l.start(); o.stop(n + 1.2); l.stop(n + 1.2); } catch {}
}
function iniciaAnimPenalti(cv, P) {
  cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const c = cv.getContext('2d'); const t0 = performance.now(); let raf = 0, parou = false, apitou1 = false, apitou2 = false;
  const quadro = () => {
    if (parou) return;
    const t = performance.now() - t0;
    desenhaCena(c, cv.width, cv.height, t, P);
    if (t > 3500 && !apitou1) { apitou1 = true; apito(); }
    if (t > 10850 && !apitou2) { apitou2 = true; setTimeout(apito, 150); }
    raf = requestAnimationFrame(quadro);
  };
  quadro(); return () => { parou = true; cancelAnimationFrame(raf); };
}
function animTeste(tipo, sub) {
  const ov = $('ov');
  // Se já existe um teste/VAR aberto (vídeo tocando, canvas rodando), fecha ele DIREITO primeiro
  // — nunca sobrescrever via innerHTML por cima de um <video> vivo, isso deixa o decodificador de
  // vídeo da Smart TV num estado inconsistente e a próxima tentativa vira tela preta.
  if (window.__fechaAnimAtual) { window.__fechaAnimAtual(); window.__fechaAnimAtual = null; }
  ov.className = 'show';
  ov.innerHTML = '<canvas id="cvp"></canvas>';
  // Botão global (fora de #ov, ver #btn-fechar-global no HTML): não fica escondido atrás do
  // vídeo real, que vive num container irmão de #ov com z-index maior (#video-lance-fixo).
  const btnFechar = $('btn-fechar-global');
  const cv = $('cvp');
  let stopAnim = null;
  let finalizado = false;
  const fecha = () => {
    if (finalizado) return;
    finalizado = true;
    clearTimeout(timerAuto);
    window.removeEventListener('keydown', onKey);
    if (stopAnim) { stopAnim(); stopAnim = null; }
    ov.className = '';
    ov.innerHTML = '';
    window.__fechaAnimAtual = null;
    if (btnFechar) btnFechar.style.display = 'none';
  };
  window.__fechaAnimAtual = fecha;
  if (btnFechar) { btnFechar.style.display = ''; btnFechar.onclick = e => { e.stopPropagation(); fecha(); }; }

  // Testa vídeo real quando o lance tem um pronto (hoje só "gol"); os demais ainda não têm vídeo
  // gerado, então caem direto na animação vetorial (ver VIDEO_ARQUIVOS acima).
  const nivelVideo = ['gol', 'vermelho', 'amarelo', 'impedimento', 'penalti', 'defesa', 'hattrick', 'semanainvicta', 'golcontra', 'bolacheia'].includes(tipo) ? tipo : null;
  stopAnim = nivelVideo && typeof tocaVideoLance === 'function' ? tocaVideoLance(cv, nivelVideo, null, 30000, fecha) : null;
  if (!stopAnim) {
    if (tipo === 'hattrick') stopAnim = iniciaAnimHatTrick(cv, {
      vendedor: 'PAULO ROBSON (TBL)',
      sub: sub || '3 VITÓRIAS CONSECUTIVAS DE RODADA · +15 PTS BÔNUS',
      clientes: [
        { nome: 'SUPERMERCADO RAVI', valor: 'R$ 8.450' },
        { nome: 'CASA DE CARNES MODELO', valor: 'R$ 12.800' },
        { nome: 'MERCADO BOM DIA', valor: 'R$ 9.150' }
      ]
    });
    else if (tipo === 'semanainvicta') stopAnim = iniciaAnimSemanaInvicta(cv, {vendedor: 'EQUIPE TBL (LONDRINA)', sub: sub || '5 VITÓRIAS DE SEGUNDA A SEXTA · +30 PTS EXTRAS'});
    else if (tipo === 'golcontra') stopAnim = iniciaAnimCartao(cv, {vendedor: 'MARCOS MILITAO (TBL)', cliente: 'COMERCIAL SILVA', sub: sub || 'Devolução comercial: CLIENTE SEM DINHEIRO (R$ 1.250)'}, false);
    else if (tipo === 'gol') stopAnim = iniciaAnimGol(cv, {vendedor: 'GABRIEL MEDINA (TBL)', cliente: 'SUPERMERCADO ALVORADA', valor: 'R$ 28.500', sub: sub || 'SUPER PEDIDO DE R$ 28.500 FATURADO HOJE!'});
    else if (tipo === 'vermelho') stopAnim = iniciaAnimCartao(cv, {vendedor: 'ELIAS GARCIA (TBL)', cliente: 'COMERCIAL SILVA', sub: sub || 'Devolução registrada: CLIENTE NÃO PEDIU (R$ 8.900)'}, true);
    else if (tipo === 'amarelo') stopAnim = iniciaAnimCartao(cv, {vendedor: 'MARCOS MILITAO (TBL)', sub: sub || '1º Check-in atrasado: rota ativa sem nenhuma venda até às 10h'}, false);
    else if (tipo === 'impedimento') stopAnim = iniciaAnimImpedimento(cv, {vendedor: 'RODRIGO FARIA (TBL)', cliente: 'SUPERMERCADO MODELO', sub: sub || 'Visita instantânea de 00:00 (check-in/check-out simultâneo)'});
    else if (tipo === 'defesa') stopAnim = iniciaAnimDefesa(cv, {vendedor: 'TIAGO SILVA (TBL)', cliente: 'MERCEARIA CENTRAL', sub: sub || 'Venda de R$ 7.200 em cliente recorrente na bacia das almas'});
    else stopAnim = iniciaAnimPenalti(cv, {vendedor: 'ANDREA DO ROCIO (TBL)', cliente: 'SUPERMERCADO RAVI', motivo: 'Cliente com 45+ dias sem compra e estoque disponível na filial'});
  }

  const timerAuto = setTimeout(fecha, 35000); // teto do teste manual: acima do maior vídeo real possível (até 30s)
  const onKey = e => { if (e.key === 'Escape') fecha(); };
  window.addEventListener('keydown', onKey);

  ov.onclick = e => { if (e.target === ov || e.target === cv) fecha(); };
}

window.iniciaAnimHatTrick = iniciaAnimHatTrick;
window.iniciaAnimSemanaInvicta = iniciaAnimSemanaInvicta;
window.iniciaAnimGol = iniciaAnimGol;
window.iniciaAnimCartao = iniciaAnimCartao;
window.iniciaAnimImpedimento = iniciaAnimImpedimento;
window.iniciaAnimDefesa = iniciaAnimDefesa;
window.iniciaAnimPenalti = iniciaAnimPenalti;
window.animTeste = animTeste;
window.videosProntos = videosProntos;
window.tocaVideoLance = tocaVideoLance;
})(window);

// Gol qualificado (Vitório, 05/10/2026): nível pela quantidade de INDÚSTRIAS no pedido do cliente (carteira MONDELEZ: categorias).
// Mesma escada de functions/_lib/qualificacao_gol.js: 1 bronze +0 · 2 prata +1 · 3 ouro +2 · 4 diamante +3 · 5+ platina +4.
// carteira AUTO (TSJ): mais de 90% do valor dos pedidos de hoje em Mondelez = carteira so Mondelez
window.carteiraEfetivaUI = function (v) {
  const c0 = String((v && v.carteira) || '').toUpperCase();
  if (c0 !== 'AUTO') return c0;
  let mond = 0, total = 0;
  ((v && v.cl) || []).forEach((c) => (c.industrias || []).forEach((x) => { total += Number(x.v) || 0; if (x.n === 'MONDELEZ BRASIL') mond += Number(x.v) || 0; }));
  return total > 0 && mond / total > 0.9 ? 'MONDELEZ' : '';
};
window.qualificaGolUI = function (carteira, c) {
  const so = String(carteira || '').toUpperCase() === 'MONDELEZ';
  const lista = c && (so ? c.categorias : c.industrias);
  if (!Array.isArray(lista) || !lista.length) return null;
  const E = [[5, 'PLATINA', 4], [4, 'DIAMANTE', 3], [3, 'OURO', 2], [2, 'PRATA', 1], [1, 'BRONZE', 0]];
  const d = E.find((e) => lista.length >= e[0]);
  const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { nivel: d[1], extra: d[2], n: lista.length, unidade: so ? 'categoria' : 'indústria', detalhe: lista.map((x) => x.n + ' ' + brl(x.v)).join('; ') };
};

// ====================== SUPERVISORES: cards com fotos + painel gerencial da semana (Vitório, 06/10/2026) ======================
// Mesmo formato na Matriz (botão Supervisores) e na TV da filial. Fonte: /api/tv-supervisores (dia) e /api/tv-supervisores-semana (segunda a sexta).
(function () {
  const css = document.createElement('style');
  css.textContent =
    '.sxc{padding:12px 18px;border-radius:12px;background:var(--card2,#131c30);margin-bottom:8px}' +
    '.sxc.bad{background:#2a0a0a;border:2px solid var(--bad,#ef4444)}.sxc.warn{border:1px solid var(--warn,#f59e0b)}' +
    '.sxcab{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;font-weight:700;font-size:20px}' +
    '.sxchip{font-size:14px;font-weight:800;padding:5px 12px;border-radius:99px;white-space:nowrap}' +
    '.sxok{background:#22c55e26;color:#86efac}.sxno{background:var(--bad,#ef4444);color:#fff}' +
    '.sxret{display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;font-size:14px;color:var(--mut,#8b9bbd)}' +
    '.sxfotos{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.sxfotos img{width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--line,#1e2a44)}' +
    '.sxt{width:100%;border-collapse:separate;border-spacing:3px;margin-top:6px}.sxt th{color:var(--mut,#8b9bbd);font-size:12px;text-transform:uppercase;text-align:center;padding:4px;letter-spacing:.05em}' +
    '.sxt th:first-child,.sxt td:first-child{text-align:left}' +
    '.sxt td{text-align:center;padding:6px 4px;border-radius:6px;font-weight:800;font-size:14px;background:var(--card2,#131c30)}' +
    '.sxt td.n{font-weight:600;font-size:16px;background:transparent}.sxt td.fez{background:#14532d;color:#86efac}.sxt td.nao{background:#7f1d1d;color:#fecaca}' +
    '.sxt td.par{background:#78350f;color:#fde68a}.sxt td.pen{background:#1e293b;color:#cbd5e1}.sxt td.fut{color:var(--mut,#8b9bbd);font-weight:500}' +
    '.sxt td small{display:block;font-weight:500;font-size:11px;opacity:.85}.sxt td.tot{background:transparent;font-size:15px}';
  document.head.appendChild(css);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peso = (x) => (!x.fez_compromisso && !x.iniciou_ret ? 0 : !x.fez_compromisso || !x.iniciou_ret ? 1 : 2);

  // cards do dia (nome, compromisso, rota/RET, PDVs, nota media e fotos) — lista de /api/tv-supervisores
  window.supCardsHtml = function (lista) {
    const ord = [...(lista || [])].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome));
    if (!ord.length) return '<div style="color:var(--mut,#8b9bbd);padding:12px 0">Sem supervisores com dados no CEVEN.</div>';
    return ord.map((x) => {
      const d = x.retDetalhe;
      const ret = d ? '<div class="sxret"><span>📍 ' + d.pdvs + ' PDV(s) visitado(s)' + (d.primeiroCheckin ? ' · ' + e(d.primeiroCheckin) + (d.ultimoCheckout ? '–' + e(d.ultimoCheckout) : '') : '') + '</span>' +
        (d.scoreMedio != null ? '<span>⭐ Nota média ' + d.scoreMedio + '</span>' : '') + (d.rca ? '<span>RCA em rota: ' + e(d.rca) + '</span>' : '') + '</div>' +
        (Array.isArray(d.fotos) && d.fotos.length ? '<div class="sxfotos">' + d.fotos.slice(0, 6).map((f) => '<img src="' + e(f.url) + '" title="' + e(f.cliente || '') + (f.score != null ? ' · nota ' + f.score : '') + '" loading="lazy">').join('') + '</div>' : '') : '';
      return '<div class="sxc ' + (peso(x) === 0 ? 'bad' : peso(x) === 1 ? 'warn' : '') + '"><div class="sxcab"><span>' + e(x.nome) + '</span>' +
        '<span class="sxchip ' + (x.fez_compromisso ? 'sxok' : 'sxno') + '">' + (x.fez_compromisso ? '✅ Compromisso' : '❌ Sem compromisso') + '</span>' +
        '<span class="sxchip ' + (x.iniciou_ret ? 'sxok' : 'sxno') + '">' + (x.iniciou_ret ? '✅ Em rota (RET)' : '❌ RET não iniciou') + '</span></div>' + ret + '</div>';
    }).join('');
  };

  // painel gerencial da semana: supervisor x (seg..sex) = FEZ / PARCIAL / NÃO FEZ (fez = compromisso matinal E rota RET)
  window.supSemanaHtml = function (lista, semana) {
    if (!semana || !semana.dias) return '<div style="color:var(--mut,#8b9bbd);padding:8px 0">Carregando a semana dos supervisores…</div>';
    if (!lista || !lista.length) return '';
    const NOMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    const cab = '<tr><th>Supervisor</th>' + semana.dias.map((d, i) => '<th>' + NOMES[i] + '<br>' + d.slice(8, 10) + '/' + d.slice(5, 7) + '</th>').join('') + '<th>Semana</th></tr>';
    const linhas = lista.map((s) => {
      let fez = 0, total = 0;
      const tds = s.dias.map((dia) => {
        if (dia.estado === 'feriado') return '<td class="fut">feriado</td>';
        if (dia.estado === 'futuro') return '<td class="fut">—</td>';
        const hoje = dia.data === semana.hoje, ambos = dia.comp && dia.ret, algum = dia.comp || dia.ret;
        const det = '<small>matinal ' + (dia.comp ? '✓' : '✗') + ' · rota ' + (dia.ret ? '✓' : '✗') + '</small>';
        if (ambos) { fez++; total++; return '<td class="fez">FEZ' + det + '</td>'; }
        if (hoje && !algum) return '<td class="pen">PENDENTE' + det + '</td>'; // o dia de hoje ainda nao acabou: nao conta como "nao fez"
        total++;
        return algum ? '<td class="par">PARCIAL' + det + '</td>' : '<td class="nao">NÃO FEZ' + det + '</td>';
      }).join('');
      return '<tr><td class="n">' + (s.filial ? '<b style="color:var(--acc,#38bdf8);margin-right:8px">' + e(s.filial) + '</b>' : '') + e(s.nome) + '</td>' + tds + '<td class="tot">' + fez + '/' + total + '</td></tr>';
    }).join('');
    return '<table class="sxt">' + cab + linhas + '</table>';
  };
})();

// Linhas do popup de gol de cliente com os dados REAIS do CEVEN: pedido de hoje e, na dobradinha, pedidos de cada quinzena (Vitório, 06/10/2026: sem estimativa)
window.golClienteLinhasHtml = function (c, subt, brl, esc) {
  if (!c) return '';
  let h = '';
  const p = c.pedidoHoje;
  if (p && p.num) h += '<div class="ln"><b>PEDIDO DE HOJE</b><span>' + esc(p.num) + ' · ' + esc(p.status_pedido || 'sem status') + ' · ' + brl(p.valor) + '</span></div>';
  if (subt === 'dobradinha_quinzenas') {
    const q = c.quinzenas;
    if (!q) return h + '<div class="ln"><b>QUINZENAS</b><span>sem dado no CEVEN</span></div>';
    const lista = (g) => g.pedidos.length ? g.pedidos.map((x) => x.data.slice(8, 10) + '/' + x.data.slice(5, 7) + ' ped ' + esc(x.num) + ' ' + brl(x.valor)).join(' · ') : 'sem pedido';
    h += '<div class="ln hot"><b>FATURAMENTO TOTAL</b><span>' + brl(q.q1.valor + q.q2.valor) + '</span></div>';
    h += '<div class="ln"><b>1ª QUINZENA</b><span>' + brl(q.q1.valor) + ' · ' + lista(q.q1) + '</span></div>';
    h += '<div class="ln"><b>2ª QUINZENA</b><span>' + brl(q.q2.valor) + ' · ' + lista(q.q2) + '</span></div>';
  }
  return h;
};

// ====================== PAINEIS ESCOLHIDOS PELO GESTOR (Vitório, 06/10/2026) ======================
// Cada quadro do Painel pode mostrar: alertas, justificativas, digitado, pênaltis ou a lista de cartões vermelhos/amarelos, gols, defesas, impedimentos, gol contra do dia.
window.PAINEIS_OPCOES = [['alertas', '🚨 Alertas ativos'], ['justificativas', '📝 Justificativas de hoje'], ['digitado', '💰 Digitado hoje · ranking'], ['penaltis', '🚨 Ranking de pênaltis'],
  ['vermelhos', '🟥 Cartões vermelhos de hoje'], ['amarelos', '🟨 Cartões amarelos de hoje'], ['gols', '⚽ Gols de hoje'], ['defesas', '🧤 Defesas de hoje'], ['impedimentos', '🚩 Impedimentos de hoje'], ['golcontra', '⚽ Gol contra (devoluções)']];
window.PAINEIS_PADRAO = ['alertas', 'justificativas', 'digitado', 'penaltis'];
window.painelSeletorHtml = function (i, escolhido) {
  return '<select class="psel" onchange="painelSlotSet(' + i + ', this.value)" style="background:#0f1626;color:#cbd5e1;border:1px solid #1e2a44;border-radius:6px;padding:2px 6px;font-size:12px;margin-bottom:4px;max-width:100%">' +
    window.PAINEIS_OPCOES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === escolhido ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
};
window.painelLancesBlocoHtml = function (id, log, esc, tag) {
  const NIV = { vermelhos: ['vermelho', 'venda10', 'visita10'], amarelos: ['amarelo'], gols: ['gol', 'hattrick'], defesas: ['defesa'], impedimentos: ['impedimento'], golcontra: ['golcontra'] };
  const op = window.PAINEIS_OPCOES.find(function (o) { return o[0] === id; });
  const niv = NIV[id];
  if (!op || !niv) return '';
  const l = (log || []).filter(function (e) { return niv.indexOf(e.nivel) >= 0; }).sort(function (a, b) { return String(b.t || '').localeCompare(String(a.t || '')); });
  const cab = '<' + tag + '><span>' + op[1] + '</span><b>' + l.length + '</b></' + tag + '>';
  if (!l.length) return cab + '<div style="color:var(--mut,#8b9bbd);padding:10px 0">Nenhum lance deste tipo hoje.</div>';
  return cab + l.slice(0, 80).map(function (e) {
    const quem = esc(e.vendedor || '') + (e.rca && e.rca !== 'sup' ? ' <span style="color:var(--mut,#8b9bbd)">(RCA ' + esc(e.rca) + ')</span>' : '');
    const onde = [e.sig || e.filial || '', e.cliente || '', e.motivo || '', e.supervisor ? 'sup. ' + e.supervisor : ''].filter(Boolean).map(esc).join(' · ');
    return '<div class="row" style="grid-template-columns:auto 1fr"><span class="tg" style="background:var(--card2,#131c30)">' + esc(String(e.t || '').slice(0, 5)) + '</span><div class="n">' + quem + '<small>' + onde + '</small></div></div>';
  }).join('');
};

// Marca como linha inteira (.w) os campos de texto longo do popup de decisão; os curtos ficam lado a lado (ver CSS "POPUP COMPACTO")
window.compactaDecHtml = function (dec) {
  return String(dec).replace(/<div class="ln([^"]*)"><b>([^<]*)<\/b><span>([\s\S]*?)<\/span><\/div>/g, function (m, cls, lab, val) {
    const txt = val.replace(/<[^>]*>/g, '');
    const larga = /^(LANCE|CLIENTE)|QUALIFIC|PEDIDO|QUINZENA|FATURAMENTO|MOTIVO|DEVOLU|PROVA|ANULADO|ALERTA|SEMANA|ITENS|DETALHE/i.test(lab) || txt.length > 34;
    const extra = (/^VENDEDOR$/i.test(lab) ? ' vend' : '') + (larga ? ' w' : ''); // VENDEDOR vira o 2o destaque (nome grande logo abaixo dos pontos)
    return extra ? m.replace('class="ln' + cls + '"', 'class="ln' + cls + extra + '"') : m;
  });
};

// Coloca o seletor de painel NO CABECALHO do quadro (titulo fixo no topo): so se troca o menu, o resto rola por baixo
window.painelComSeletor = function (i, escolhido, bloco) {
  const sel = window.painelSeletorHtml(i, escolhido).replace(' style="', ' style="margin:0 8px;flex:0 1 auto;');
  return String(bloco).replace('<b>', sel + '<b>');
};

// Cartoes por horario (amarelo 10h, vermelho de abandono 11h): o coletor do servidor registra no minuto exato; a tela nao os via como "novos".
// Aqui eles viram UM aviso por filial, uma vez por dia em cada navegador, ate 3 h depois do horario do lance.
window.cartoesDoServidor = function (rows, jaAvisou, marca, agoraSeg, secDe, sigDe) {
  const grupos = {};
  (rows || []).forEach(function (r) {
    const k = /(^|[|])ven10[|]/.test(r.chave) ? 'amarelos' : /(^|[|])vis11[|]/.test(r.chave) ? 'visita10' : null;
    if (!k) return;
    const idade = agoraSeg - secDe(r.hora_sp);
    if (!(idade >= 0 && idade <= 3 * 3600)) return;
    const sig = sigDe(r), gk = k + '|' + sig;
    if (jaAvisou(gk)) return;
    (grupos[gk] = grupos[gk] || { tipo: k, sig: sig, l: [], gk: gk }).l.push({ v: { id: r.rca, nome: r.vendedor, sup: r.supervisor || '' }, txt: (r.obs && String(r.obs).length > 3) ? r.obs : '', subtipo: /nenhuma visita/.test(r.obs || '') ? 'sem_checkin' : 'sem_venda' });
  });
  return Object.keys(grupos).map(function (g) { marca(g); return grupos[g]; });
};
