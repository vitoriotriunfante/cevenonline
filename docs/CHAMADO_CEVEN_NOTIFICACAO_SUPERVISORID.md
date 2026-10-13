# Chamado ao desenvolvedor do CEVEN — respeitar `supervisorid` no webhook de notificações

**Data:** 13/10/2026 · **Solicitante:** Vitório Neto (Grupo Triunfante) · **Sistema que envia:** Brasileirão Triunfante (CFTV Matriz)
**Prioridade:** alta — supervisores estão vendo a pontuação e os erros uns dos outros.

## 1. Problema (com evidência)

Hoje, às **09:03 (BRT)**, o nosso sistema enviou uma notificação para o supervisor **Igor Rodrigues Duarte (filial TBL, supervisorId 118)**, usando o campo `supervisorid: 118`.
Ela apareceu no sino do supervisor **Kleberson Batista Liduário (também TBL)**, que tem outro id.

Ou seja: o webhook **aceita** o campo, mas a notificação continua sendo entregue a **todos** os supervisores da filial. Isso expõe o desempenho (e as penalizações) de uma equipe a outra.

## 2. O que o nosso sistema envia (exatamente)

```
POST https://ceven.drivetriunfante-locomotiva.com.br/api/notificacoes/webhook/tbl1
Content-Type: application/json
X-Webhook-Secret: <o mesmo segredo já combinado>

{
  "origem": "Brasileirão Triunfante",
  "mensagem": "📊 Igor Rodrigues Duarte · sua equipe (09:03–10:00)\nSaldo: +6 pts\n⚽ 1 gol (+6)\n\n✅ O QUE DEU CERTO\n• Ivan Silva — Resgate de Inativo / Drible da Vaca Bronze (+6)",
  "supervisorid": 118
}
```

- `supervisorid` é **numérico** e vem da própria árvore do CEVEN (`cascata.supervisores[].supervisorId`).
- Enviamos **uma notificação por supervisor**, de hora em hora (09h às 20h59), só se houver lance novo da equipe dele.
- Se não conseguirmos resolver o id do supervisor, **não enviamos** (nunca fazemos broadcast).
- Cada envio fica gravado no nosso lado (`notif_envio_log`: filial, supervisor, supervisorid, status, payload) para auditoria.

## 3. Comportamento esperado

| Situação | Quem recebe |
|---|---|
| `supervisorid` informado e existe na filial | **somente** o supervisor com esse id **+** Master e Gerente da filial |
| `supervisorid` omitido ou nulo | todos os supervisores da filial (comportamento atual; manter por compatibilidade) |
| `supervisorid` informado mas **não pertence** à filial da rota | rejeitar com **400** e mensagem clara (não fazer broadcast) |

Demais regras (inalteradas): o sino só aparece para Master, Gerente e Supervisor; badge de não lidas zera ao abrir o drawer; cada item mostra origem, mensagem e data/hora, com lixeira para excluir individualmente; Master em "Todas as filiais" vê o agregado.

## 4. Critérios de aceite (como vamos testar)

1. Enviar com `supervisorid` = Igor (118) na filial `tbl1` → aparece **só** para o Igor (e para Master/Gerente TBL). **Não** aparece para Kleberson nem para os demais supervisores TBL.
2. Enviar **sem** `supervisorid` → continua aparecendo para todos os supervisores TBL.
3. Enviar com `supervisorid` de outra filial → **400**.
4. O campo é **persistido** junto da notificação (tabela/coleção), para consulta e auditoria.
5. Resposta 200/201 em todos os casos válidos (compatível com as integrações atuais).

## 5. Observações

- Não é necessário alterar o segredo nem a rota; só passar a honrar o campo que já enviamos.
- Se o campo preferido tiver outro nome (`supervisorId`, `supervisor_id`), nos avise: o nosso envio muda em uma linha.
