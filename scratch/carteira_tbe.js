const fs=require('fs');const T=process.env.TEMP||'/tmp';
const raw=fs.readFileSync(T+'/eq_q.json','utf8');const arr=JSON.parse(raw.slice(raw.indexOf('[')));
const c=JSON.parse(arr[0].results[0].conteudo_json);
let n=0;for(const v of c.filiais.TBE||[]){if(v.carteira!=='MONDELEZ'){v.carteira='MONDELEZ';n++;}}
const esc=s=>String(s).replace(/'/g,"''");const u='Claude (por ordem do Vitório: gol qualificado, carteira só Mondelez em TBE, 05/10/2026)';
let sim=0,nao=0;for(const l of Object.values(c.filiais))for(const v of l)(v.mostra?sim++:nao++);
fs.writeFileSync(T+'/eq_q.sql',"UPDATE config_equipe_soberana SET conteudo_json='"+esc(JSON.stringify(c))+"', atualizado_por='"+esc(u)+"', atualizado_em=datetime('now') WHERE id=1;\nINSERT INTO audit_alteracoes_equipe (alterado_em, usuario, total_rcas, resumo) VALUES (datetime('now'),'"+esc(u)+"',"+(sim+nao)+",'Campo novo carteira=MONDELEZ para os "+n+" vendedores de TBE (gol qualificado conta categorias)');\n");
console.log('TBE marcados',n,'total',sim+nao);
