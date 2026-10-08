const B='https://ceven-cftv-matrix.pages.dev';const j=async u=>(await fetch(u)).json();
(async()=>{const [snap,mostra]=await Promise.all([j(B+'/api/central-snapshot?filial=TCV'),j(B+'/api/tv-mostra')]);
const eq={};for(const[k,l]of Object.entries(mostra.filiais))if(k.startsWith('TCV'))for(const x of l)eq[String(x.rca)]=x;
console.log('snapshot',snap.dia,'linhas',snap.total);
for(const[rca,r]of Object.entries(snap.rcas)){const e=eq[rca];if(!e)continue;
const vis=(r.roteiro||[]).filter(c=>!['AGENDADO','ABERTO'].includes(c.status)&&c.checkin_horario).map(c=>({h:c.checkin_horario,v:['POSITIVADO','EFETIVADO'].includes(c.status),n:c.nome_cliente})).sort((a,b)=>a.h.localeCompare(b.h));
let hat=null;for(let i=0;i+2<vis.length;i++)if(vis[i].v&&vis[i+1].v&&vis[i+2].v){hat=vis[i].h+' '+vis[i+1].h+' '+vis[i+2].h;break}
if(hat)console.log(rca,e.nome.slice(0,26).padEnd(26),'sup:',(e.supervisor||'').slice(0,22).padEnd(22),'<== HAT-TRICK',hat,'| seq:',vis.map(x=>x.v?'V':'.').join(''))}})();
