// Gera public/catalogo_industrias.json (codigo do produto -> industria; Mondelez tambem -> categoria)
// a partir de config/catalogo_produtos_por_filial.csv. Usado por functions/api/tv-vendedor.js (Gol qualificado: bronze..platina).
// Uso: node gerar_catalogo_industrias.js   (rodar de novo quando o catalogo mudar)
const fs = require('fs');
const path = require('path');
const csv = fs.readFileSync(path.join(__dirname, 'config', 'catalogo_produtos_por_filial.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
const h = csv[0].split(';');
const linhas = csv.slice(1).map((l) => { const c = l.split(';'); const o = {}; h.forEach((k, i) => (o[k] = c[i])); return o; });

// nome unico por industria (sem prefixo "A - ", sufixos juridicos e variacoes de grafia)
function industria(f) {
  let n = String(f || '').toUpperCase().trim();
  if (/^TRIUNFANTE/.test(n)) return 'MARCA PROPRIA TRIUNFANTE';
  n = n.replace(/^A ?- ?/, '').replace(/\.{2,}.*$/, '').replace(/\s*\(M\)\s*$/, '').replace(/\s+(LTDA|LT|SA|S A|S\.A\.)\.?$/, '').trim();
  n = n.replace(/^1 /, '').replace(/.-M-$/, '');
  if (/^MASTERFOODS/.test(n)) return 'MASTERFOODS BRASIL';
  if (/^LINDT/.test(n)) return 'LINDT SPRUNGLI';
  if (/^ARCOR/.test(n)) return 'ARCOR DO BRASIL';
  if (/^HEINZ/.test(n)) return 'HEINZ BRASIL';
  return n;
}
// categoria so para a Mondelez (carteira "so Mondelez": TBE, TCG, TSJ). Marca -> categoria.
const CATEGORIAS = [
  ['CHOCOLATE', /TOBLERONE|TABL SHOT|AMANDITA|LACTA|BIS |^BIS|BISAO|OURO BRANCO|SONHO D|DIAMANTE NEGRO|LAKA|CHOCOLICIA|COOKIE LACTA|5STAR|MIX LACTA/],
  ['BISCOITO', /OREO|BELVITA|BISC |CLUB SOCIAL|CLUB CROSTINI|TRAKINAS|TORTUGUITA|CLUB /],
  ['GOMA E BALA', /BUBBALOO|HALLS|TRIDENT|CHICLETE|BALA /],
  ['REFRESCO', /CLIGHT|FRESH|TANG /],
  ['SOBREMESA E FERMENTO', /ROYAL|GELATINA|PUDIM|FERMENTO/],
  ['PAO E SNACK', /7DAYS|CROISSANT/]
];
function categoria(desc) {
  const d = String(desc || '').toUpperCase();
  for (const [nome, re] of CATEGORIAS) if (re.test(d)) return nome;
  return 'OUTROS MONDELEZ';
}
const ind = {}; const cat = {}; const naoClass = [];
for (const x of linhas) {
  if (x.ignorar || !x.codprod) continue;
  const i = industria(x.fornecedor);
  ind[x.codprod] = i;
  if (i === 'MONDELEZ BRASIL') { cat[x.codprod] = categoria(x.descricao); if (cat[x.codprod] === 'OUTROS MONDELEZ') naoClass.push(x.descricao); }
}
fs.writeFileSync(path.join(__dirname, 'public', 'catalogo_industrias.json'), JSON.stringify({ gerado_de: 'config/catalogo_produtos_por_filial.csv', i: ind, c: cat }));
console.log('produtos', Object.keys(ind).length, '| industrias', new Set(Object.values(ind)).size, '| mondelez', Object.keys(cat).length, '| sem categoria', naoClass.length);
console.log([...new Set(Object.values(ind))].sort().join(' | '));
console.log('SEM CATEGORIA:', [...new Set(naoClass)].join(' ; '));
