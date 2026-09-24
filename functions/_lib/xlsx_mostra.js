// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: leitor mínimo de .xlsx que roda no Cloudflare Worker (sem bibliotecas) — lê só a aba
//          MOSTRA_DISPAROS de "VENDEDORES AUDITADOS.xlsx" e devolve a lista de vendedores da TV.
// PROJETO: CFTV/TV. PREMISSA: 100% ONLINE (ver PREMISSA_ONLINE.md). Usado por functions/api/tv-mostra.js.
// COMO: um .xlsx é um ZIP de XMLs. Lê o diretório do ZIP, descomprime (deflate-raw) só os 4 arquivos
//       necessários e monta as linhas da aba. Não é um leitor genérico de Excel.
// =========================================================================

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const td = new TextDecoder('utf-8');

async function inflar(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

function entradasZip(b) {
  let e = b.length - 22;
  while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('ZIP invalido');
  const n = u16(b, e + 10); let o = u32(b, e + 16); const mapa = {};
  for (let i = 0; i < n; i++) {
    if (u32(b, o) !== 0x02014b50) throw new Error('diretorio ZIP corrompido');
    const metodo = u16(b, o + 10), csize = u32(b, o + 20), nl = u16(b, o + 28), el = u16(b, o + 30), cl = u16(b, o + 32), lo = u32(b, o + 42);
    const nome = td.decode(b.subarray(o + 46, o + 46 + nl));
    mapa[nome] = { metodo, csize, lo };
    o += 46 + nl + el + cl;
  }
  return mapa;
}

async function ler(b, mapa, nome) {
  const m = mapa[nome]; if (!m) return null;
  const nl = u16(b, m.lo + 26), el = u16(b, m.lo + 28), ini = m.lo + 30 + nl + el;
  const dados = b.subarray(ini, ini + m.csize);
  return td.decode(m.metodo === 8 ? await inflar(dados) : dados);
}

const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const attr = (tag, nome) => { const m = tag.match(new RegExp(nome + '="([^"]*)"')); return m ? dec(m[1]) : null; };
const colIdx = (ref) => { const l = ref.match(/^[A-Z]+/)[0]; let n = 0; for (const ch of l) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

export async function lerAbaXlsx(arrayBuffer, nomeAba) {
  const b = new Uint8Array(arrayBuffer), mapa = entradasZip(b);
  const wb = await ler(b, mapa, 'xl/workbook.xml'), rels = await ler(b, mapa, 'xl/_rels/workbook.xml.rels'), ss = await ler(b, mapa, 'xl/sharedStrings.xml');
  if (!wb || !rels) throw new Error('xlsx sem workbook');
  let rid = null;
  for (const t of wb.match(/<sheet\b[^>]*>/g) || []) if (attr(t, 'name') === nomeAba) rid = attr(t, 'r:id');
  if (!rid) throw new Error('aba nao encontrada: ' + nomeAba);
  let alvo = null;
  for (const t of rels.match(/<Relationship\b[^>]*>/g) || []) if (attr(t, 'Id') === rid) alvo = attr(t, 'Target');
  if (!alvo) throw new Error('relacao da aba nao encontrada');
  const caminho = alvo.startsWith('/') ? alvo.slice(1) : 'xl/' + alvo;
  const xml = await ler(b, mapa, caminho); if (!xml) throw new Error('arquivo da aba ausente: ' + caminho);
  const strings = ss ? (ss.match(/<si\b[\s\S]*?<\/si>/g) || []).map((si) => dec((si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))) : [];
  const linhas = [];
  for (const rowM of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const linha = [];
    for (const c of rowM[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r'); if (!ref) continue; const tipo = attr(c[1], 't'); const corpo = c[2] || '';
      let v = '';
      if (tipo === 's') { const m = corpo.match(/<v>([\s\S]*?)<\/v>/); v = m ? strings[+m[1]] ?? '' : ''; }
      else if (tipo === 'inlineStr') v = dec((corpo.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
      else { const m = corpo.match(/<v>([\s\S]*?)<\/v>/); v = m ? dec(m[1]) : ''; }
      linha[colIdx(ref)] = v;
    }
    linhas.push(linha);
  }
  return linhas;
}

// Converte as linhas da aba MOSTRA_DISPAROS no mesmo formato de public/mostra_vendedores.json
export function montaMostra(linhas) {
  const cab = (linhas[0] || []).map((x) => String(x || '').trim());
  const ix = (nome) => cab.indexOf(nome);
  const I = { f: ix('Filial'), g: ix('Gerente Geral'), ns: ix('Nome Supervisor'), rca: ix('Cód. Vendedor (RCA)'), nv: ix('Nome do Vendedor'), can: ix('Canal Oficial'), m: ix('MOSTRA NOS DISPAROS'), mot: ix('MOTIVO (se NÃO)') };
  if (I.f < 0 || I.rca < 0 || I.m < 0) throw new Error('colunas esperadas nao encontradas na aba MOSTRA_DISPAROS');
  const clean = (s) => String(s == null ? '' : s).replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();
  // NORMALIZAÇÃO ÚNICA: na planilha uma filial pode vir dividida (ex.: TPH_VAGNER, TPH_FABIO, MCD_CLEVERSON).
  // Aqui vira filial canônica (TPH) + campo `grupo` (VAGNER). Divisão nova = só escrever SIGLA_NOME na planilha.
  const filiais = {}, grupos = {}; let sim = 0, nao = 0;
  for (const r of linhas.slice(1)) {
    const bruto = String(r[I.f] || '').toUpperCase().trim(), f = bruto.split('_')[0], grupo = bruto.split('_').slice(1).join('_');
    if (grupo) (grupos[f] = grupos[f] || new Set()).add(grupo); const rca = String(r[I.rca] == null ? '' : r[I.rca]).trim().replace(/\.0+$/, '');
    if (!f || !rca) continue;
    const mostra = String(r[I.m] || '').toUpperCase().trim() === 'SIM'; mostra ? sim++ : nao++;
    (filiais[f] = filiais[f] || []).push({ rca, grupo, nome: clean(r[I.nv]), supervisor: clean(r[I.ns]), gerente: String(r[I.g] || '').trim(), canal: String(r[I.can] || '').trim(), mostra, motivo: mostra ? '' : String(r[I.mot] || '') });
  }
  const g = {}; Object.keys(grupos).forEach((k) => (g[k] = [...grupos[k]]));
  return { total_sim: sim, total_nao: nao, grupos: g, filiais };
}
