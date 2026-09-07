const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'ceven_noc.db');
const db = new Database(dbPath);

// Habilita WAL mode para alta concorrência
db.pragma('journal_mode = WAL');

// Inicializa o schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

const FILIAIS_OFICIAIS = [
  { id: 'tca1', codigo: 'TCA', nome: 'TCA' },
  { id: 'mcd1', codigo: 'MCD', nome: 'MCD' },
  { id: 'tcg1', codigo: 'TCG', nome: 'TCG' },
  { id: 'tcv1', codigo: 'TCV', nome: 'TCV' },
  { id: 'abc1', codigo: 'ABC', nome: 'ABC' },
  { id: 'tbl1', codigo: 'TBL', nome: 'TBL' },
  { id: 'api1', codigo: 'API', nome: 'API' },
  { id: 'tph1', codigo: 'TPH', nome: 'TPH' },
  { id: 'tbe1', codigo: 'TBE', nome: 'TBE' },
  { id: 'tpa1', codigo: 'TPA', nome: 'TPA' },
  { id: 'tsj1', codigo: 'TSJ', nome: 'TSJ' }
];

// Preenche filiais
const insertFilial = db.prepare('INSERT OR IGNORE INTO filiais (id, codigo, nome) VALUES (?, ?, ?)');
const insertConfigTV = db.prepare('INSERT OR IGNORE INTO config_tv (filial_id) VALUES (?)');

for (const f of FILIAIS_OFICIAIS) {
  insertFilial.run(f.id, f.codigo, f.nome);
  insertConfigTV.run(f.id);
}

module.exports = {
  db,
  FILIAIS_OFICIAIS,
  
  // Helpers
  getFiliais: () => db.prepare('SELECT * FROM filiais').all(),
  getRepresentantesByFilial: (filialSigla) => {
    if (!filialSigla || filialSigla === 'TODAS') {
      return db.prepare('SELECT * FROM representantes ORDER BY nome').all();
    }
    const f = FILIAIS_OFICIAIS.find(x => x.codigo === filialSigla.toUpperCase());
    const filialId = f ? f.id : filialSigla.toLowerCase() + '1';
    return db.prepare('SELECT * FROM representantes WHERE filial_id = ? ORDER BY nome').all(filialId);
  },
  getConfigTV: (filialId) => {
    const row = db.prepare('SELECT * FROM config_tv WHERE filial_id = ?').get(filialId);
    return row || { grid_default: '3x3', tempo_rotacao_seg: 60, intervalo_alerta_min: 30, duracao_alerta_min: 5 };
  }
};
