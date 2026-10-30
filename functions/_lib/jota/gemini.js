// =========================================================================
// JOTA · functions/_lib/jota/gemini.js
// O QUE É: Análise estratégica comercial avançada com Google Gemini API.
// Conecta os dados reais do CEVEN/D1 com a inteligência do Gemini para
// responder perguntas executivas de gerentes e diretores (ex.: Fábio/TBL).
// =========================================================================

export async function analisaEstrategiaComGemini({ env, B, c, texto, E, dadosContexto }) {
  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_KEY;

  const promptSistema = `Você é o JOTA Estratégico, o mais sênior consultor e diretor comercial do Grupo Triunfante / Mais Mix no CEVEN.
Seu papel é orientar gerentes e supervisores comerciais com clareza executiva, foco absoluto em metas, agressividade comercial saudável e ações práticas para o dia de hoje.
Regras fundamentais:
1. NUNCA invente números ou clientes fictícios. Use exclusivamente os dados fornecidos no contexto.
2. Seja direto, prático e estruturado para o WhatsApp (use negritos, emojis com moderação, listas numeradas curtas).
3. Entregue um plano de ação claro: quem abordar, qual volume buscar e qual argumento comercial usar.
4. Linguagem comercial profissional, sem enrolação.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${promptSistema}\n\n--- DADOS REAIS DO CEVEN ---\n${JSON.stringify(dadosContexto, null, 2)}\n\n--- PERGUNTA DO GESTOR (${c.nome} - ${c.papel} ${c.filial || ''}) ---\n"${texto}"` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200
    }
  };

  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const textoGerado = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textoGerado) return textoGerado.trim();
      }
    } catch (e) {
      console.error('Erro ao chamar Gemini API:', e);
    }
  }

  // Fallback inteligente estruturado caso a chave do Gemini ainda não esteja cadastrada no Cloudflare
  return null;
}
