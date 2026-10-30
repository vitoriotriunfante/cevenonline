// =========================================================================
// FICHA DO ARQUIVO: pipeline/disparar_guia_supervisores.mjs
// O QUE É: Motor de disparo do Guia de Comandos do Jota para os 62 SUPERVISORES (Vitório, 29/10/2026).
//   - Agendado para as 07:00 BRT (10:00 UTC).
//   - Envia texto puro profissional com exemplos operacionais e ZERO LINKS.
//   - Espaçamento seguro de 5 segundos entre cada envio (anti-spam).
//   - Suporta flags:
//       --dry-run          (não envia nada, só simula e mostra os textos)
//       --destino=vitorio  (envia apenas para o WhatsApp de teste do Vitório)
//       --destino=todos    (envia para todos os supervisores ativos pendentes)
// =========================================================================
import { execSync } from 'child_process';
import R from '../public/regras.js';
import { textoSupervisores } from '../functions/api/jota-cardapio.js';

const EVO_URL = (process.env.EVO_URL || 'https://137-131-147-223.sslip.io').replace(/\/$/, '');
const EVO_KEY = process.env.EVO_KEY || '';
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'ceven-noc';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const destinoArg = (args.find((a) => a.startsWith('--destino=')) || '').replace('--destino=', '') || 'todos';

function d1Query(sql) {
  const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --json --command "${sql.replace(/"/g, '\\"')}"`;
  const out = execSync(cmd, { maxBuffer: 10 * 1024 * 1024 }).toString();
  return JSON.parse(out)[0].results || [];
}

function d1Run(sql, params = []) {
  // Executa query de escrita no D1
  let queryFinal = sql;
  for (const p of params) {
    const val = typeof p === 'string' ? `'${p.replace(/'/g, "''")}'` : p;
    queryFinal = queryFinal.replace('?', val);
  }
  const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --command "${queryFinal.replace(/"/g, '\\"')}"`;
  execSync(cmd, { stdio: 'pipe' });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enviarWhatsApp(numero, texto) {
  if (isDryRun) {
    return { ok: true, status: 200, ensaio: true };
  }
  const cfg = { url: EVO_URL, key: EVO_KEY, instancia: EVO_INSTANCE };
  return await R.evolution(cfg, '/message/sendText', {
    number: String(numero).replace(/\D/g, ''),
    text: texto
  });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🤖 DISPARO OFICIAL DO GUIA DO JOTA AOS SUPERVISORES`);
  console.log(`⏰ Horário: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} BRT`);
  console.log(`🎯 Modo: ${isDryRun ? 'DRY-RUN (Simulação)' : 'ENVIO REAL'} | Destino: ${destinoArg}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (destinoArg === 'vitorio') {
    const vitorioCel = '554187525605';
    const fakeSup = { nome: 'VITÓRIO NETO', filial: 'API', celular: vitorioCel };
    const texto = textoSupervisores(fakeSup);
    console.log(`\nEnviando teste para Vitório (${vitorioCel})...`);
    console.log(`\n[TEXTO DA MENSAGEM]:\n${texto}\n`);
    const res = await enviarWhatsApp(vitorioCel, texto);
    console.log(`Resultado:`, res);
    return;
  }

  // 1. Busca todos os supervisores ativos
  console.log('Consultando supervisores ativos no D1...');
  const supervisoresRaw = d1Query(
    "SELECT celular, nome, filial, papel FROM bot_contatos WHERE papel = 'supervisor' AND ativo = 1 ORDER BY filial, nome"
  );

  // 2. Busca quem já recebeu
  const jaEnviados = d1Query(
    "SELECT DISTINCT celular, nome FROM bot_msgs WHERE tipo = 'cardapio' AND direcao = 'out'"
  );
  const nomesEnviados = new Set(jaEnviados.map((m) => String(m.nome || '').trim().toUpperCase()));
  const celsEnviados = new Set(jaEnviados.map((m) => String(m.celular || '').replace(/\D/g, '')));

  // 3. Deduplica por nome
  const porNome = new Map();
  for (const s of supervisoresRaw) {
    const nomeNorm = String(s.nome || '').trim().toUpperCase();
    if (nomesEnviados.has(nomeNorm)) continue;
    if (celsEnviados.has(String(s.celular).replace(/\D/g, ''))) continue;

    if (!porNome.has(nomeNorm)) {
      porNome.set(nomeNorm, s);
    } else {
      const atual = porNome.get(nomeNorm);
      if (s.celular.length > atual.celular.length) {
        porNome.set(nomeNorm, s);
      }
    }
  }

  const pendentes = [...porNome.values()];
  pendentes.sort((a, b) => a.filial.localeCompare(b.filial) || a.nome.localeCompare(b.nome));

  console.log(`Total de supervisores cadastrados: ${supervisoresRaw.length}`);
  console.log(`Já receberam anteriormente: ${jaEnviados.length}`);
  console.log(`Supervisores pendentes para envio: ${pendentes.length}`);

  if (pendentes.length === 0) {
    console.log('✅ Todos os supervisores já receberam o guia! Nada a enviar.');
    return;
  }

  let sucessos = 0;
  let falhas = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const s = pendentes[i];
    const texto = textoSupervisores(s);
    const prefixo = `[${i + 1}/${pendentes.length}] ${s.filial} · ${s.nome} (${s.celular})`;

    process.stdout.write(`${prefixo} ... `);

    try {
      const resp = await enviarWhatsApp(s.celular, texto);
      if (resp.ok) {
        sucessos++;
        console.log('✅ OK');
        if (!isDryRun) {
          try {
            d1Run(
              "INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)",
              [s.celular, s.nome, 'out', texto, 'cardapio']
            );
          } catch (eSql) {
            console.error(`  (Aviso: registro no D1 falhou: ${eSql.message})`);
          }
        }
      } else {
        falhas++;
        console.log(`❌ FALHOU: status=${resp.status} ${resp.erro || ''}`);
      }
    } catch (e) {
      falhas++;
      console.log(`❌ ERRO: ${e.message}`);
    }

    // Intervalo de segurança anti-spam: 5 segundos entre envios
    if (i < pendentes.length - 1 && !isDryRun) {
      await sleep(5000);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏁 DISPARO CONCLUÍDO: ${sucessos} enviados com sucesso, ${falhas} falhas.`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err) => {
  console.error('Erro fatal no motor de disparo:', err);
  process.exit(1);
});
