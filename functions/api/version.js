// Versão estática da build (Aciona Hot Reload Automático nas Smart TVs das Filiais)
const RELEASE_VERSION = 'v2.17.0-blocked-orders-6x-daily-schedule';

export async function onRequestGet() {
  return new Response(JSON.stringify({
    version: RELEASE_VERSION,
    timestamp: new Date().toISOString(),
    status: 'ONLINE'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
