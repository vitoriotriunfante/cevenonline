# JOTA — o assistente do +MIX no WhatsApp

Pasta criada em 22/10/2026 (Vitório: "nosso robô vai se chamar JOTA; tudo referente às mensagens fica aqui").

## O que é
O Jota conversa pelo WhatsApp oficial **Mais Mix Triunfante (41 8880-5727)** com diretoria, gerentes e (em breve) supervisores.
Responde com os números da mesma base da TV, do CEVEN, do +MIX e da Champions Triunfante, e sempre termina com uma sugestão prática.

## Onde está cada coisa
| O quê | Onde |
|---|---|
| Código do Jota (recebe e responde) | `functions/api/whatsapp/bot.js` |
| Quem pode falar com ele | D1 `bot_contatos` (celular, nome, papel, filial, grupo) |
| Histórico das conversas | D1 `bot_msgs` |
| Servidor do WhatsApp (Evolution) | ver `OPERACAO_WHATSAPP/REGRAS_E_MEMORIA_OPERACIONAL.md` |
| IA da conversa livre | Cloudflare Workers AI (gratuita), modelo Llama 3.3 70B |
| Persona (jeito de falar) | `PERSONA.md` (esta pasta) |
| Imagens (foto de perfil, figurinhas) | `imagens/` |
| Respostas prontas (o que ele sabe responder) | `respostas/CATALOGO.md` |
| Exportações de conversas | `conversas/` |

## Regras
1. Nunca inventar número. Sem dado = "sem dado".
2. Cada pessoa vê só a sua filial (gerente de TPH/MCD vê só o seu grupo). Diretoria vê tudo.
3. Número desconhecido não recebe resposta.
4. Faturado e pendente sempre separados (igual à TV).
