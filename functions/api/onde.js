// Diagnostico (16/10/2026): de qual data center/pais as Functions estao chamando a internet (o CEVEN bloqueia fora do Brasil)
export async function onRequestGet() {
  const t = await fetch('https://www.cloudflare.com/cdn-cgi/trace').then((r) => r.text()).catch(() => '');
  const pega = (k) => (t.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || null;
  return new Response(JSON.stringify({ colo: pega('colo'), loc: pega('loc') }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
