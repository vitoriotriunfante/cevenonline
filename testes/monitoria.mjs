// =========================================================================
// testes/monitoria.mjs — Suite de testes do MONITOR.IA (Onda 1)
// =========================================================================
import assert from 'node:assert/strict';
import {
  NUMEROS_VITORIO,
  BONEQUINHO_MIDIA,
  listarRegras,
  atualizarRegra,
  emitirEvento,
  simularOnda1,
} from '../functions/_lib/monitoria/motor.js';
import { detectarEventos } from '../functions/_lib/monitoria/detector.js';
import { formataS3Travados, formataS5Fechamento, executarCicloSupervisores } from '../functions/_lib/monitoria/supervisores.js';

let ok = 0;
function teste(nome, cond) {
  assert.ok(cond, nome);
  ok++;
  console.log(`  ok     - ${nome}`);
}

function criaMockDb() {
  const regras = [
    { id: 'V1', onda: 1, papel: 'vendedor', nome: 'Matinal', horario: '07:30', bonequinho: 'BOPE_OPERACAO', modo: 'SIMULACAO_VITORIO', ativo: 1 },
    { id: 'V4', onda: 1, papel: 'vendedor', nome: 'Oportunidade', horario: '11:00', bonequinho: 'BOPE_TROPA', modo: 'SIMULACAO_VITORIO', ativo: 1 },
    { id: 'S1', onda: 1, papel: 'supervisor', nome: 'Matinal Sup', horario: '07:45', bonequinho: 'CARD_PNG', modo: 'SIMULACAO_VITORIO', ativo: 1 },
    { id: 'S2', onda: 1, papel: 'supervisor', nome: 'RET Unificada', horario: '09:30', bonequinho: 'TEXTO', modo: 'SIMULACAO_VITORIO', ativo: 1 },
    { id: 'G1', onda: 1, papel: 'gerente', nome: 'Matinal Ger', horario: '08:00', bonequinho: 'CARD_PNG', modo: 'SIMULACAO_VITORIO', ativo: 1 },
    { id: 'G3', onda: 1, papel: 'gerente', nome: 'MP & Ind', horario: '10:30', bonequinho: 'BOPE_TROPA', modo: 'SIMULACAO_VITORIO', ativo: 1 },
    { id: 'D1', onda: 1, papel: 'diretoria', nome: 'Pulso Brasil', horario: '08:15', bonequinho: 'CARD_PNG', modo: 'SIMULACAO_VITORIO', ativo: 1 },
    { id: 'D2', onda: 1, papel: 'diretoria', nome: 'Auditoria', horario: '19:00', bonequinho: 'TEXTO', modo: 'SIMULACAO_VITORIO', ativo: 1 },
  ];
  const events = new Map();
  const envios = new Map();
  return {
    _regras: regras,
    _events: events,
    _envios: envios,
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...a) { args = a; return stmt; },
        async all() {
          if (sql.includes('FROM regras_monitoria')) return { results: regras };
          if (sql.includes('FROM monitoria_envios')) return { results: [{ status: 'SIMULADO', q: envios.size }] };
          if (sql.includes('FROM domain_events')) return { results: [{ q: events.size }] };
          return { results: [] };
        },
        async first() { return null; },
        async run() {
          if (sql.startsWith('UPDATE regras_monitoria')) {
            const id = args[args.length - 1];
            const r = regras.find((x) => x.id === id);
            if (r && sql.includes('modo = ?')) r.modo = args[0];
            return { success: true };
          }
          if (sql.includes('INSERT OR IGNORE INTO domain_events')) {
            const k = `${args[0]}|${args[1]}`;
            if (!events.has(k)) events.set(k, args);
            return { success: true };
          }
          if (sql.includes('INSERT INTO monitoria_envios')) {
            const k = `${args[0]}|${args[1]}|${args[2]}|${args[7]}`;
            envios.set(k, args);
            return { success: true };
          }
          return { success: true };
        },
      };
      return stmt;
    },
  };
}

console.log('== Testes MONITOR.IA Onda 1 ==');
teste('whitelist contem os dois numeros do Vitorio', NUMEROS_VITORIO.includes('554187525605') && NUMEROS_VITORIO.includes('5566996389884') && NUMEROS_VITORIO.length === 2);
teste('bonequinhos BOPE mapeados para stickers .webp em /figurinhas/bope/', BONEQUINHO_MIDIA.BOPE_OPERACAO.endsWith('.webp') && BONEQUINHO_MIDIA.BOPE_TROPA.endsWith('.webp') && BONEQUINHO_MIDIA.BOPE_GUERRA.endsWith('.webp'));

const db = criaMockDb();
const lista = await listarRegras(db);
teste('listarRegras retorna as 8 regras de Onda 1', lista.length === 8);

const rUpd = await atualizarRegra(db, { id: 'V1', modo: 'SIMULACAO_VITORIO' });
teste('atualizarRegra aceita modo SIMULACAO_VITORIO', rUpd.ok === true);
const rInvalid = await atualizarRegra(db, { id: 'V1', modo: 'QUALQUER' });
teste('atualizarRegra rejeita modo invalido', rInvalid.ok === false);

await emitirEvento(db, { event_type: 'PEDIDO_BLOQUEADO', entity_key: 'PED-999', filial: 'TCV', rca: '352', payload: { valor: 2500 } });
await emitirEvento(db, { event_type: 'PEDIDO_BLOQUEADO', entity_key: 'PED-999', filial: 'TCV', rca: '352', payload: { valor: 2500 } });
teste('emitirEvento garante idempotencia por (event_type, entity_key)', db._events.size === 1);

const bloqueado = await simularOnda1('https://ceven-cftv-matrix.pages.dev', { DB: db }, { enviarVitorio: true, celularVitorio: '5511999999999' });
teste('simularOnda1 bloqueia envio para numero fora da whitelist do Vitorio', bloqueado.ok === false && /whitelist/i.test(bloqueado.erro));

const bloqDet = await detectarEventos('https://ceven-cftv-matrix.pages.dev', { DB: db }, { enviarVitorio: true, celularVitorio: '5511999999999' });
teste('detectarEventos bloqueia envio para numero fora da whitelist do Vitorio', bloqDet.ok === false && /whitelist/i.test(bloqDet.erro));

const s3Txt = formataS3Travados({
  nome: 'Equipe Teste',
  vend: [{ nome: 'Joao Silva', rca: '101', papel: 'vendedor', meta: 10000, visP: 5, visF: 0, dig: 0 }],
});
teste('formataS3Travados detecta vendedor com rota sem check-in', typeof s3Txt === 'string' && s3Txt.includes('Joao Silva'));
teste('formataS3Travados silencia quando nao ha vendedor travado', formataS3Travados({ nome: 'Equipe OK', vend: [{ nome: 'Ana', rca: '102', papel: 'vendedor', meta: 10000, visP: 5, visF: 3, dig: 1200 }] }) === null);

const s5Txt = formataS5Fechamento({
  nome: 'Equipe Teste',
  vend: [{ nome: 'Joao Silva', rca: '101', papel: 'vendedor', meta: 10000, visP: 5, visF: 2, dig: 1500 }],
});
teste('formataS5Fechamento resume digitado hoje sem falsos zerados', typeof s5Txt === 'string' && s5Txt.includes('Zero vendedores'));

const bloqSup = await executarCicloSupervisores('https://ceven-cftv-matrix.pages.dev', { DB: db }, { regra: 'S2', enviarVitorio: true, celularVitorio: '5511999999999' });
teste('executarCicloSupervisores bloqueia envio fora da whitelist', bloqSup.ok === false && /whitelist/i.test(bloqSup.erro));

console.log(`RESULTADO MONITOR.IA: ${ok} de ${ok} testes OK`);

