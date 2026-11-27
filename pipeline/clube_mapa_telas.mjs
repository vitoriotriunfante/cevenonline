// =========================================================================
// FICHA DO ARQUIVO: pipeline/clube_mapa_telas.mjs
// O QUE E: Mapeador 100% v2 do Clube da Venda (TradePro) — SOMENTE LEITURA.
//   Descobre todas as telas do menu, inspeciona estrutura, filtros, botoes,
//   tabelas (inclusive sub-tabelas/row-toggler), exportacoes Excel e sonda
//   especial da relatorioVenda.xhtml em 3 niveis. Suporta sharding em paralelo.
// SEGURANCA / REPO PUBLICO: nunca clica em botoes de escrita/exclusao/liberacao;
//   sanitiza todo output contra CNPJ, CPF e numeros longos (zero PII nos logs).
// =========================================================================
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import os from 'os';

const BASE = 'https://grupotriunfante.tradepro.com.br/grupotriunfante/';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

if (!process.env.TP_USER || !process.env.TP_PASS) {
  throw new Error('TP_USER / TP_PASS nao configurados');
}

function ultimoDiaUtilBRT() {
  const agoraBRT = new Date(Date.now() - 3 * 3600e3);
  const d = new Date(agoraBRT.getTime());
  if (agoraBRT.getUTCHours() < 18) d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const DIA_ALVO = /^\d{4}-\d{2}-\d{2}$/.test(process.env.DIA_ALVO || '')
  ? process.env.DIA_ALVO
  : ultimoDiaUtilBRT();
const diaBR = DIA_ALVO.split('-').reverse().join('/');
const diaCompacto = DIA_ALVO.replace(/-/g, '');

const PAGINAS = (process.env.PAGINAS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SHARD_IDX = Number(process.env.SHARD_IDX || 0);
const SHARD_TOTAL = Math.max(1, Number(process.env.SHARD_TOTAL || 1));

// Blacklist absoluta de escrita/mutacao
const RE_BLACKLIST = /salvar|gravar|excluir|apagar|deletar|remover|novo|incluir|adicionar|editar|alterar|liberar|reativar|enviar|confirmar|aprovar|rejeitar|senha|calcular|processar|importar|limpar|estornar|cancelar|bloquear|desbloquear|finalizar|fechar rota/i;
const RE_WHITELIST_CONSULTA = /^(Gerar|Gerar Relatório|Pesquisar|Buscar|Filtrar|Consultar|Exibir|Listar|Atualizar)$/i;
const RE_WHITELIST_EXPORT = /^(Excel|Exportar Excel|Exportar|Gerar venda de todos RCAs)$/i;

const TELAS_ESTRUTURA_APENAS = new Set([
  'reativaPedido.xhtml',
  'liberacaoPedido.xhtml',
  'calculaSenha.xhtml',
  'perfilUsuario.xhtml',
  'usuario.xhtml',
  'couching5a5.xhtml',
  'movimentacaoRoteiro.xhtml',
  'movimentacaoProposta.xhtml',
  'elaboradorProposta.xhtml',
  'planoAcao.xhtml',
  'jornada_trabalho.xhtml',
]);

const MENUS_ESTRUTURA_APENAS = new Set(['Manutenção', 'Configuração', 'Liberação']);

function sanitizaString(str) {
  if (typeof str !== 'string') return str;
  let s = str
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '[CNPJ]')
    .replace(/\d{2}\.\d{3}\.\d{3}/g, '[DOC]')
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF]')
    .replace(/\d{9,}/g, '[NUM]');
  return s.replace(/\s+/g, ' ').trim();
}

function sanitiza(val, depth = 0) {
  if (depth > 8 || val == null) return val;
  if (typeof val === 'string') return sanitizaString(val);
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return val.map((v) => sanitiza(v, depth + 1));
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = sanitiza(v, depth + 1);
    return out;
  }
  return val;
}

async function garantirLogin(page) {
  await page.goto(BASE + 'login.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  if (!/login\.xhtml/i.test(page.url())) {
    const ok = await page.evaluate(() => /Relat[oó]rio de Vendas|Filiais|Home/i.test(document.body.innerText || '')).catch(() => false);
    if (ok) return true;
  }
  for (let t = 0; t < 3; t++) {
    try {
      await page.locator('[id="j_idt6:j_username"]').fill(process.env.TP_USER, { timeout: 10000 });
      await page.locator('[id="j_idt6:j_password"]').fill(process.env.TP_PASS, { timeout: 10000 });
      await page.locator('input[type=submit]').click({ noWaitAfter: true, timeout: 10000 });
      break;
    } catch {
      await page.waitForTimeout(2500);
    }
  }
  for (let t = 0; t < 60; t++) {
    await page.waitForTimeout(1000);
    const tx = await page.evaluate(() => document.body.innerText || '').catch(() => '');
    if (/Relat[oó]rio de Vendas|Filiais/.test(tx)) return true;
  }
  throw new Error('login no Clube nao entrou');
}

async function abrirTela(page, arquivo) {
  await page.goto(BASE + arquivo, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  if (/login\.xhtml/i.test(page.url())) {
    log(`Sessao caiu ao abrir ${arquivo}; re-logando...`);
    await garantirLogin(page);
    await page.goto(BASE + arquivo, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
  }
}

async function descobrirMenu(page) {
  const itensBrutos = await page.evaluate(() => {
    const res = [];
    const links = [...document.querySelectorAll('a[href*=".xhtml"]')];
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const h = href.split('?')[0].split('/').pop();
      if (!h || h === 'login.xhtml' || !/\.xhtml$/i.test(h)) continue;
      const t = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);

      // Sobe ate o item raiz do menu (ui-menubar > ul > li ou nav > ul > li)
      let menu = 'Outro';
      let el = a.parentElement;
      const pais = [];
      while (el && el !== document.body) {
        if (el.tagName === 'LI') {
          const trigger = el.querySelector(':scope > a .ui-menuitem-text, :scope > a');
          const txt = trigger ? (trigger.innerText || trigger.textContent || '').trim().replace(/\s+/g, ' ') : '';
          if (txt) pais.push(txt);
        }
        el = el.parentElement;
      }
      if (pais.length > 0) {
        const topo = pais[pais.length - 1];
        if (/^(Home|Cadastro|Relat[oó]rio|Manuten[cç][aã]o|Configura[cç][aã]o|Libera[cç][aã]o)$/i.test(topo)) {
          menu = topo;
        } else if (pais.length >= 2 && /^(Home|Cadastro|Relat[oó]rio|Manuten[cç][aã]o|Configura[cç][aã]o|Libera[cç][aã]o)$/i.test(pais[pais.length - 2])) {
          menu = pais[pais.length - 2];
        } else {
          menu = topo.slice(0, 30);
        }
      }
      res.push({ h, t, menu });
    }
    return res;
  });

  const mapa = new Map();
  for (const item of itensBrutos) {
    if (!mapa.has(item.h)) {
      mapa.set(item.h, item);
    } else {
      const cur = mapa.get(item.h);
      if ((!cur.t && item.t) || (cur.menu === 'Outro' && item.menu !== 'Outro')) {
        mapa.set(item.h, {
          h: item.h,
          t: cur.t || item.t,
          menu: cur.menu !== 'Outro' ? cur.menu : item.menu,
        });
      }
    }
  }
  if (!mapa.has('relatorioVenda.xhtml')) {
    mapa.set('relatorioVenda.xhtml', { h: 'relatorioVenda.xhtml', t: 'Relatório de Vendas', menu: 'Home' });
  } else {
    const rv = mapa.get('relatorioVenda.xhtml');
    if (rv.t === '99' || !rv.t) rv.t = 'Relatório de Vendas';
  }
  if (!mapa.has('relatorioClientesSemRoteiro.xhtml')) {
    mapa.set('relatorioClientesSemRoteiro.xhtml', { h: 'relatorioClientesSemRoteiro.xhtml', t: 'Clientes Sem Roteiro', menu: 'Relatório' });
  }
  return [...mapa.values()];
}

async function extrairEstruturaEstatica(page) {
  return page.evaluate(() => {
    const isCal = (cols) => cols.length === 7 && cols.join(',') === 'D,S,T,Q,Q,S,S';
    const tituloEl = document.querySelector('h1, h2, h3, .ui-panel-title, .titulo, [class*="titulo" i]');
    let titulo = tituloEl ? (tituloEl.innerText || '').trim().replace(/\s+/g, ' ') : '';
    if (!titulo) {
      const cand = [...document.querySelectorAll('span, div, td')].find((el) => {
        const s = (el.innerText || '').trim();
        return s.length >= 4 && s.length <= 60 && /^(Relat[oó]rio|Cadastro|Manuten|Painel|Roteiro|Ranking|Mapa|Fatura|Carga|Rastreamento|Liber|Reativ)/i.test(s);
      });
      titulo = cand ? cand.innerText.trim() : '';
    }

    const labels = [...new Set(
      [...document.querySelectorAll('label')]
        .map((l) => (l.innerText || '').trim().replace(/\s+/g, ' '))
        .filter((s) => s && s.length < 45 && s !== '*')
    )];

    const selects = [...document.querySelectorAll('select')].map((s) => {
      const opts = [...s.options].map((o) => (o.text || o.innerText || '').trim());
      return {
        id: s.id || s.name || '',
        qtd_opcoes: opts.length,
        amostra_flags: {
          tem_tcv: opts.some((t) => /TRIUNFANTE\s*-\s*TCV/i.test(t)),
          tem_352: opts.some((t) => /^352\b|\b352\s*-/i.test(t)),
          primeiro_rotulo_eh_selecione: opts.length > 0 && /selecione|todos/i.test(opts[0]),
        },
      };
    });

    const ctxTxt = labels.join(' ') + ' ' + selects.map((s) => s.id).join(' ');
    const filtros = {
      labels,
      selects: selects.map((s) => ({ id: s.id, qtd_opcoes: s.qtd_opcoes })),
      temFilial: /filial/i.test(ctxTxt) || selects.some((s) => s.amostra_flags.tem_tcv),
      temCoordenador: /coordenador/i.test(ctxTxt),
      temRepresentante: /representante|vendedor|rca/i.test(ctxTxt) || selects.some((s) => s.amostra_flags.tem_352),
      temFornecedor: /fornecedor/i.test(ctxTxt),
    };

    const botoes = [...new Set(
      [...document.querySelectorAll('button, input[type=submit], input[type=button], a.ui-button')]
        .map((b) => (b.innerText || b.value || b.title || '').trim().replace(/\s+/g, ' '))
        .filter((s) => s && s.length < 45)
    )];

    const tabelas = [...document.querySelectorAll('table')]
      .map((t) => {
        const colunas = [...t.querySelectorAll('thead th')]
          .map((c) => (c.innerText || '').trim().replace(/\s+/g, ' '))
          .filter(Boolean);
        const trs = [...t.querySelectorAll('tbody tr')];
        const linhas = trs.filter((r) => !/Nenhum registro/i.test(r.innerText || '')).length;
        return { colunas, linhas };
      })
      .filter((t) => t.colunas.length >= 2 && !isCal(t.colunas));

    return { titulo, filtros, botoes, tabelas };
  });
}

async function preencherDatas(page) {
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('input')]
      .filter((i) => !i.disabled && (/data.*_input$/i.test(i.id) || i.classList.contains('hasDatepicker') || /_input$/i.test(i.id) && /dt|data/i.test(i.id)))
      .map((i) => i.id)
      .filter(Boolean)
  ).catch(() => []);
  for (const id of ids) {
    await page.locator(`[id="${id}"]`).fill(diaBR).catch(() => {});
  }
  return ids.length;
}

async function selecionarFiltrosSeguros(page, nivelObrigatorio = false) {
  const info = await page.evaluate((nivelObr) => {
    const escolhidos = [];
    const selects = [...document.querySelectorAll('select')];

    const disparaSelect = (sel, opt) => {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const baseId = sel.id ? sel.id.replace(/_input$/, '') : '';
      return { id: sel.id || sel.name || '', baseId, texto: opt.text.trim() };
    };

    // 1. Filial -> TRIUNFANTE - TCV
    for (const s of selects) {
      const opts = [...s.options];
      const tcv = opts.find((o) => /TRIUNFANTE\s*-\s*TCV/i.test(o.text));
      if (tcv) {
        if (s.value !== tcv.value) escolhidos.push({ tipo: 'filial', ...disparaSelect(s, tcv) });
        else escolhidos.push({ tipo: 'filial_ja_set', id: s.id || '', baseId: '' });
      }
    }

    // 2. Se nao tem Filial ou se estamos em retry por campo obrigatorio, selecionar Representante (352) / Coordenador / Fornecedor
    const temFilial = escolhidos.some((e) => e.tipo.startsWith('filial'));
    if (!temFilial || nivelObr) {
      for (const s of selects) {
        const id = (s.id || s.name || '').toLowerCase();
        const opts = [...s.options];
        if (opts.length <= 1) continue;
        const jaTemFilialNesse = opts.some((o) => /TRIUNFANTE\s*-\s*TCV/i.test(o.text));
        if (jaTemFilialNesse) continue;

        const ehRep = /representante|vendedor|rca/i.test(id) || opts.some((o) => /^352\b|\b352\s*-/i.test(o.text.trim()));
        if (ehRep) {
          const opt352 = opts.find((o) => /\b352\b/.test(o.text)) || opts.find((o) => o.value && !/selecione|todos|^0$/i.test(o.text.trim()));
          if (opt352 && s.value !== opt352.value) {
            escolhidos.push({ tipo: 'representante', ...disparaSelect(s, opt352) });
          }
        } else if (nivelObr) {
          const optVal = opts.find((o) => o.value && !/selecione|todos|^$/i.test(o.text.trim()));
          if (optVal && (!s.value || /selecione/i.test(s.options[s.selectedIndex]?.text || ''))) {
            escolhidos.push({ tipo: 'outro_select', ...disparaSelect(s, optVal) });
          }
        }
      }
    }
    return escolhidos;
  }, nivelObrigatorio).catch(() => []);

  // Sincronizar widget visual do PrimeFaces se existir (via menu UI somente se select nao refletiu)
  if (info.length > 0) await page.waitForTimeout(1500);
  return info.map((x) => x.tipo);
}

async function clicarBotaoWhitelist(page, regex) {
  const candidatos = page.locator('button, input[type=submit], input[type=button], a.ui-button');
  const n = await candidatos.count();
  for (let i = 0; i < n; i++) {
    const el = candidatos.nth(i);
    const vis = await el.isVisible().catch(() => false);
    if (!vis) continue;
    const txt = await el.evaluate((b) => (b.innerText || b.value || b.title || '').trim().replace(/\s+/g, ' ')).catch(() => '');
    if (!txt) continue;
    if (RE_BLACKLIST.test(txt)) continue;
    if (regex.test(txt)) {
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click({ noWaitAfter: true, timeout: 10000 }).catch(() => {});
      return txt;
    }
  }
  return null;
}

async function aguardarResultado(page, timeoutMs = 30000) {
  const fim = Date.now() + timeoutMs;
  let blockVisto = false;
  let blockSumiuEm = 0;
  while (Date.now() < fim) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      const isCal = (cols) => cols.length === 7 && cols.join(',') === 'D,S,T,Q,Q,S,S';
      const tabs = [...document.querySelectorAll('table')].map((t) => {
        const colunas = [...t.querySelectorAll('thead th')].map((c) => (c.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
        const linhas = [...t.querySelectorAll('tbody tr')].filter((r) => !/Nenhum/i.test(r.innerText || '')).length;
        return { colunas, linhas };
      }).filter((t) => t.colunas.length >= 2 && !isCal(t.colunas));

      const comDados = tabs.some((t) => t.linhas > 0);
      const msgs = [...document.querySelectorAll('.ui-messages, .ui-growl-message, .ui-message-error, .ui-message-warn')]
        .map((m) => (m.innerText || '').trim())
        .filter(Boolean);
      const body = document.body.innerText || '';
      const nenhum = /Nenhum registro|Nenhum dado|Nenhuma informa/i.test(body);
      const bloqueado = [...document.querySelectorAll('.ui-blockui, .ui-dialog-docking-zone, [id*="status" i] .ui-dialog')]
        .some((el) => el.offsetParent !== null && getComputedStyle(el).display !== 'none');
      const mapa = !!document.querySelector('.gm-style, canvas');
      return { comDados, msgs, nenhum, bloqueado, mapa };
    }).catch(() => null);

    if (!st) break;
    if (st.bloqueado) blockVisto = true;
    else if (blockVisto && !blockSumiuEm) blockSumiuEm = Date.now();

    if (st.comDados || st.msgs.length > 0 || st.nenhum) {
      await page.waitForTimeout(800);
      break;
    }
    if (blockSumiuEm && Date.now() - blockSumiuEm >= 3000) break;
  }
}

async function extrairResultadoTela(page) {
  return page.evaluate(() => {
    const isCal = (cols) => cols.length === 7 && cols.join(',') === 'D,S,T,Q,Q,S,S';
    const tabelas = [...document.querySelectorAll('table')]
      .map((t) => {
        const colunas = [...t.querySelectorAll('thead th')]
          .map((c) => (c.innerText || '').trim().replace(/\s+/g, ' '))
          .filter(Boolean);
        const trs = [...t.querySelectorAll('tbody tr')];
        const linhas = trs.filter((r) => !/Nenhum/i.test(r.innerText || '')).length;
        return { colunas, linhas };
      })
      .filter((t) => t.colunas.length >= 2 && !isCal(t.colunas));

    const pag = document.querySelector('.ui-paginator-current');
    const paginador = pag ? pag.innerText.trim().replace(/\s+/g, ' ') : '';
    const mensagens = [...new Set(
      [...document.querySelectorAll('.ui-messages, .ui-growl-message, .ui-message-error, .ui-message-warn')]
        .map((m) => (m.innerText || '').trim().replace(/\s+/g, ' '))
        .filter(Boolean)
    )];
    const tem_mapa_ou_canvas = !!document.querySelector('.gm-style, canvas, svg');
    const rotulos_sem_digitos = [...new Set(
      (document.body.innerText || '')
        .split('\n')
        .map((l) => l.trim().replace(/\s+/g, ' '))
        .filter((l) => l.length >= 3 && l.length <= 50 && !/\d/.test(l))
    )].slice(0, 25);

    const rowTogglers = document.querySelectorAll('.ui-row-toggler').length;
    return { tabelas, paginador, mensagens, tem_mapa_ou_canvas, rotulos_sem_digitos, rowTogglers };
  });
}

async function testarRowToggler(page) {
  const tog = page.locator('.ui-row-toggler').first();
  if (!(await tog.count())) return null;
  const vis = await tog.isVisible().catch(() => false);
  if (!vis) return null;
  await tog.click({ noWaitAfter: true, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return page.evaluate(() => {
    const exp = [...document.querySelectorAll('.ui-expanded-row-content table')];
    return exp.map((t) => ({
      colunas: [...t.querySelectorAll('thead th')].map((c) => (c.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean),
      linhas: t.querySelectorAll('tbody tr').length,
    }));
  }).catch(() => null);
}

async function testarExports(page, tmpDir, prefixo) {
  const exportsRes = [];
  const botoes = page.locator('button, a, input[type=submit], input[type=button]');
  const n = await botoes.count();
  const textosTentados = new Set();

  for (let i = 0; i < n; i++) {
    const el = botoes.nth(i);
    const vis = await el.isVisible().catch(() => false);
    if (!vis) continue;
    const txt = await el.evaluate((b) => (b.innerText || b.value || b.title || '').trim().replace(/\s+/g, ' ')).catch(() => '');
    if (!txt || RE_BLACKLIST.test(txt) || !RE_WHITELIST_EXPORT.test(txt)) continue;
    if (textosTentados.has(txt)) continue;
    textosTentados.add(txt);

    const dlProm = page.waitForEvent('download', { timeout: 45000 }).catch(() => null);
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click({ timeout: 10000 }).catch(() => {});
    const dl = await dlProm;
    if (!dl) {
      exportsRes.push({ botao: txt, baixou: false });
      continue;
    }

    const sug = dl.suggestedFilename() || 'export.xlsx';
    const ext = path.extname(sug).toLowerCase() || '.bin';
    const arq = path.join(tmpDir, `${prefixo}_${exportsRes.length}${ext}`);
    await dl.saveAs(arq);
    try {
      if (/\.(xlsx|xls|csv)$/i.test(ext)) {
        const w = XLSX.readFile(arq);
        const abas = w.SheetNames.map((nm) => {
          const rows = XLSX.utils.sheet_to_json(w.Sheets[nm], { header: 1, defval: null });
          const hi = rows.findIndex((r) => r && r.filter((c) => c != null && String(c).trim() !== '').length >= 3);
          const colunas = hi >= 0 ? rows[hi].map((c) => sanitizaString(String(c || '').trim())).filter(Boolean) : [];
          return {
            nome: nm,
            linhas: Math.max(0, rows.length - (hi >= 0 ? hi + 1 : 0)),
            colunas,
          };
        });
        exportsRes.push({ botao: txt, baixou: true, ext, abas });
      } else {
        const st = fs.statSync(arq);
        exportsRes.push({ botao: txt, baixou: true, ext, bytes: st.size, abas: [] });
      }
    } catch (e) {
      exportsRes.push({ botao: txt, baixou: true, ext, erro_leitura: String(e.message || e).slice(0, 100) });
    } finally {
      fs.rmSync(arq, { force: true });
    }
  }
  return exportsRes;
}

async function inspecionarTela(page, item, tmpDir) {
  const t0 = Date.now();
  const modoEstrutura = TELAS_ESTRUTURA_APENAS.has(item.h) || MENUS_ESTRUTURA_APENAS.has(item.menu);
  const res = {
    arquivo: item.h,
    nome_menu: item.t,
    menu: item.menu,
    modo: modoEstrutura ? 'estrutura_apenas' : 'leitura_completa',
    dia_alvo: DIA_ALVO,
  };

  try {
    await abrirTela(page, item.h);
    const est = await extrairEstruturaEstatica(page);
    res.titulo = est.titulo;
    res.filtros = est.filtros;
    res.botoes = est.botoes;
    res.tabelas_iniciais = est.tabelas;

    if (!modoEstrutura) {
      res.datas_preenchidas = await preencherDatas(page);
      res.filtros_aplicados = await selecionarFiltrosSeguros(page, false);

      const clicado = await clicarBotaoWhitelist(page, RE_WHITELIST_CONSULTA);
      res.botao_consulta = clicado;
      if (clicado) {
        await aguardarResultado(page, 30000);
      }
      let out = await extrairResultadoTela(page);

      // Auto-retry se pediu filtro obrigatorio
      if (out.mensagens.some((m) => /selecione|obrigat[oó]ri|informe|preencha/i.test(m)) && out.tabelas.every((t) => t.linhas === 0)) {
        const extra = await selecionarFiltrosSeguros(page, true);
        if (extra.length > 0 && clicado) {
          res.filtros_retry = extra;
          await clicarBotaoWhitelist(page, RE_WHITELIST_CONSULTA);
          await aguardarResultado(page, 25000);
          out = await extrairResultadoTela(page);
        }
      }

      res.tabelas_resultado = out.tabelas;
      res.paginador = out.paginador;
      res.mensagens = out.mensagens;
      res.tem_mapa_ou_canvas = out.tem_mapa_ou_canvas;
      res.rotulos_sem_digitos = out.rotulos_sem_digitos;
      res.row_togglers = out.rowTogglers;

      if (out.rowTogglers > 0) {
        res.subtabelas = await testarRowToggler(page);
      }

      res.exports = await testarExports(page, tmpDir, item.h.replace(/[^a-zA-Z0-9]/g, '_'));
    }
    res.status = 'ok';
  } catch (e) {
    res.status = 'erro';
    res.erro = String(e && e.message || e).slice(0, 180);
  }
  res.duracao_ms = Date.now() - t0;
  console.log('MAPA_TELA_JSON ' + JSON.stringify(sanitiza(res)));
}

async function sondaRelatorioVenda(page, tmpDir) {
  const niveis = [];
  const lerVenda = async (label, query) => {
    await page.goto(BASE + `relatorioVenda.xhtml?di=${diaCompacto}&df=${diaCompacto}&fo=-1&${query}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    if (/login\.xhtml/i.test(page.url())) {
      await garantirLogin(page);
      await page.goto(BASE + `relatorioVenda.xhtml?di=${diaCompacto}&df=${diaCompacto}&fo=-1&${query}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
    }
    const est = await extrairEstruturaEstatica(page);
    const out = await extrairResultadoTela(page);
    // Captura primeiro codigo numerico da tabela principal (para navegar para nivel supervisor sem PII)
    const primeiroCod = await page.evaluate(() => {
      const tr = document.querySelector('table tbody tr');
      if (!tr) return null;
      const td = tr.querySelector('td');
      const txt = td ? (td.innerText || '').trim() : '';
      return /^\d+$/.test(txt) ? txt : null;
    }).catch(() => null);

    let exports = [];
    if (label === 'raiz_filiais' || label === 'filial_pauta') {
      exports = await testarExports(page, tmpDir, `venda_${label}`);
    }
    return { label, query, botoes: est.botoes, tabelas: out.tabelas, primeiroCod, exports };
  };

  try {
    const n1 = await lerVenda('raiz_filiais', '');
    niveis.push(n1);

    const n2 = await lerVenda('filial_pauta', 'fi=4&n=PAUTA');
    niveis.push(n2);

    if (n2.primeiroCod) {
      const n3 = await lerVenda('supervisor_rep', `fi=4&n=REPRESENTANTE&co=${n2.primeiroCod}`);
      niveis.push(n3);

      if (n3.primeiroCod) {
        const n4 = await lerVenda('vendedor_forn', `fi=4&n=FORNECEDOR&co=${n2.primeiroCod}&re=${n3.primeiroCod}`);
        niveis.push(n4);
      }
    }
  } catch (e) {
    niveis.push({ erro: String(e && e.message || e).slice(0, 180) });
  }
  console.log('MAPA_VENDA_ESPECIAL_JSON ' + JSON.stringify(sanitiza({ dia_alvo: DIA_ALVO, niveis })));
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clube-mapa-'));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();

try {
  await garantirLogin(page);
  const menu = await descobrirMenu(page);
  console.log('MENU_TOTAL_JSON ' + JSON.stringify(sanitiza({ total: menu.length, dia_alvo: DIA_ALVO, itens: menu })));

  const alvos = PAGINAS.length
    ? menu.filter((m) => PAGINAS.includes(m.h)).concat(
        PAGINAS.filter((p) => !menu.some((m) => m.h === p)).map((p) => ({ h: p, t: '', menu: 'Manual' }))
      )
    : menu.filter((_, idx) => idx % SHARD_TOTAL === SHARD_IDX);

  log(`Shard ${SHARD_IDX + 1}/${SHARD_TOTAL} | Dia ${DIA_ALVO} | ${alvos.length} telas`);

  for (const item of alvos) {
    await inspecionarTela(page, item, tmpDir);
  }

  const rodaSonda = (PAGINAS.length === 0 && SHARD_IDX === 0) || PAGINAS.includes('relatorioVenda.xhtml');
  if (rodaSonda) {
    await sondaRelatorioVenda(page, tmpDir);
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  await browser.close();
}
log('Mapeamento finalizado');
