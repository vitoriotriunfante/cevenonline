const fs=require('fs');const T=process.env.TEMP||'/tmp';
const raw=fs.readFileSync(T+'/eq_q.json','utf8');const c=JSON.parse(JSON.parse(raw.slice(raw.indexOf('[')))[0].results[0].conteudo_json);
let a=0,b=0;for(const v of c.filiais.TCG||[]){v.carteira='MONDELEZ';a++;}for(const v of c.filiais.TSJ||[]){v.carteira='AUTO';b++;}
let sim=0,nao=0;for(const l of Object.values(c.filiais))for(const v of l)(v.mostra?sim++:nao++);
const esc=s=>String(s).replace(/'/g,"''");const u='Claude (por ordem do Vitório: TCG só Mondelez; TSJ automático >90% Mondelez, 05/10/2026)';
fs.writeFileSync(T+'/eq_q2.sql',"UPDATE config_equipe_soberana SET conteudo_json='"+esc(JSON.stringify(c))+"', atualizado_por='"+esc(u)+"', atualizado_em=datetime('now') WHERE id=1;\nINSERT INTO audit_alteracoes_equipe (alterado_em, usuario, total_rcas, resumo) VALUES (datetime('now'),'"+esc(u)+"',"+(sim+nao)+",'carteira: TCG "+a+" vendedores = MONDELEZ; TSJ "+b+" = AUTO (>90% Mondelez)');\n");
console.log('TCG',a,'TSJ',b);
