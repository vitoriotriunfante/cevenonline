# Integração Brasileirão Triunfante → CEVEN: notificações do sino (webhook)

**Para:** desenvolvedor do CEVEN · **De:** Vitório Neto (Grupo Triunfante) · **Atualizado:** 13/10/2026

## 1. Resumo

O nosso sistema (Brasileirão Triunfante / CFTV) **lê** dados do CEVEN e **devolve ao CEVEN uma única coisa: notificações para o sino**, pelo webhook oficial.
Não gravamos pedidos, metas, clientes nem nada além disso.

| Sentido | O que | Como |
|---|---|---|
| CEVEN → nós | dashboard, produtividade, roteiro-hoje, devoluções por RCA; árvore (gerente/supervisor/vendedor) | `GET /api/rca/*` e login de gerente, com `X-App-Secret` (somente leitura) |
| **nós → CEVEN** | **notificações do sino** (uma por supervisor, de hora em hora) | `POST /api/notificacoes/webhook/{filial}` |

## 2. O webhook que usamos

```
POST https://ceven.drivetriunfante-locomotiva.com.br/api/notificacoes/webhook/{filial}
Content-Type: application/json
X-Webhook-Secret: <segredo combinado; fica em variável de ambiente, nunca no código>
```

`{filial}` ∈ `tca1, abc1, tcv1, api1, tpa1, tcg1, tbl1, tph1, mcd1, tsj1, tbe1`.

### Corpo (JSON)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `origem` | string | sim | sempre `"Brasileirão Triunfante"` |
| `mensagem` | string (até 1000) | sim | texto da notificação (exemplo abaixo) |
| **`supervisorid`** | **número** | **não** (mas **sempre enviado** por nós) | id do supervisor no CEVEN (`cascata.supervisores[].supervisorId` da árvore) |

### Exemplo real (13/10/2026, 09:03)

```json
POST /api/notificacoes/webhook/tbl1
{
  "origem": "Brasileirão Triunfante",
  "mensagem": "📊 Igor Rodrigues Duarte · sua equipe (09:03–10:00)\nSaldo: +6 pts\n⚽ 1 gol (+6)\n\n✅ O QUE DEU CERTO\n• Ivan Silva — Resgate de Inativo / Drible da Vaca Bronze (+6)",
  "supervisorid": 118
}
```

## 3. Quando e o que enviamos

- **Uma notificação por supervisor**, de hora em hora, entre **09:00 e 20:59 (Brasília)**.
- Só se houver **lance novo** da equipe dele desde o último envio (nunca mensagem vazia).
- Cada lance é avisado **uma única vez** (controle de idempotência do nosso lado).
- Se **não conseguirmos resolver o `supervisorid`** do supervisor, **não enviamos** (nunca fazemos broadcast).
- Chave de desligamento do nosso lado: `config_flags.notif_supervisores = '0'`.

## 4. De onde vem o `supervisorid`

Da árvore do próprio CEVEN, lida a cada ~45 min: `gerente-auth/login` por filial → `cascata.supervisores[].supervisorId` (ex.: Igor Rodrigues Duarte, TBL → **118**).
Nunca inventamos nem inferimos o id: se o supervisor não está na árvore, a notificação não sai.

## 5. Problema em aberto (o motivo deste documento)

Em **13/10/2026 às 09:03** enviamos a notificação acima com `"supervisorid": 118` (Igor, TBL).
Ela apareceu no sino do supervisor **Kleberson Batista Liduário (também TBL, id diferente)**.

→ O webhook **aceita** o campo, mas a notificação ainda é entregue a **todos** os supervisores da filial. Isso expõe o desempenho (e as penalizações) de uma equipe às outras.

## 6. Comportamento esperado

| Situação | Quem recebe |
|---|---|
| `supervisorid` válido na filial | **somente** esse supervisor **+** Master e Gerente da filial |
| `supervisorid` omitido ou nulo | todos os supervisores da filial (como hoje; manter compatibilidade) |
| `supervisorid` que **não pertence** à filial da rota | **400** com mensagem clara (sem broadcast) |

O restante não muda: sino só para Master/Gerente/Supervisor; badge zera ao abrir o drawer; item com origem, mensagem e data/hora; lixeira individual; Master em "Todas as filiais" vê o agregado.

## 7. Critérios de aceite (como vamos testar)

1. `supervisorid` = 118 em `tbl1` → aparece **só** para Igor (e Master/Gerente TBL); **não** aparece para o Kleberson nem para os demais supervisores TBL.
2. Sem `supervisorid` → aparece para todos os supervisores TBL (compatibilidade).
3. `supervisorid` de outra filial → **400**.
4. O campo é **persistido** na notificação (tabela/coleção) para consulta e auditoria.
5. 200/201 em todos os casos válidos.

## 8. Auditoria do nosso lado

Cada envio é gravado em `notif_envio_log` (data, filial, supervisor, `supervisorid`, status HTTP, trecho do payload). Com isso conseguimos provar **o que foi enviado e quando** em qualquer discussão sobre entrega.

## 9. Se o nome do campo for outro

Se o campo preferido for `supervisorId` ou `supervisor_id`, avise: a mudança do nosso lado é de **uma linha** (`functions/_lib/ceven_notificacao.js`).
