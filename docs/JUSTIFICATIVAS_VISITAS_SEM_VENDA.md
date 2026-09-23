# Justificativas de visita sem venda

## O que é

Desde 23/09/2026, o vendedor precisa justificar quando visita um cliente e não
vende. A CEVEN já captura isso na API (campo `motivo_nao_visita` do endpoint
`/api/rca/roteiro-hoje`), inclusive em visitas com status `VISITADO` (não só
em não-visitas). Pedido do Vitório: começar a tabular isso junto com as
visitas diárias, pra análise futura (ainda sem relatório pronto).

## As 10 categorias reais (levantadas direto na API em 23/09/2026, amostra de 400 vendedores)

1. PEDIDO A DIGITAR
2. RESPONSAVEL PELA COMPRA AUSENTE (COMPRADOR / DONO)
3. ESTOQUE SUFICIENTE
4. CLIENTE SEM INTERESSE
5. PEDIDO ANTERIOR AINDA NAO ENTREGUE
6. ENCERROU AS ATIVIDADES
7. ESTABELECIMENTO TEMPORARIAMENTE FECHADO
8. CREDITO SUSPENSO
9. TROCAS PENDENTES
10. FALTA DE PRODUTO NA DISTRIBUIDORA

Pode aparecer alguma categoria nova rara no futuro (a lista não é fixa no
código, é só o que apareceu na amostra do dia). Se quiser confirmar a lista
atual, rode: `node scripts/coletar_justificativas_visitas.js` e olhe os
valores distintos de `motivo` no jsonl.

## Onde os dados ficam

`analises/historico_justificativas_visitas.jsonl` — append-only, 1 linha por
visita-com-justificativa-registrada, 1 dia por rodada do script. Cada linha:

```json
{
  "data": "2026-09-23",
  "filial": "TBL",
  "rca": "181",
  "vendedor": "GIOVANA ...",
  "supervisor": "...",
  "gerente": "...",
  "id_cliente": "96978",
  "cliente": "MERCADO BEIRA RIO",
  "cnpj": "...",
  "status_visita": "VISITADO",
  "motivo": "ESTOQUE SUFICIENTE",
  "observacao": null,
  "data_ultima_compra": "2026-09-19",
  "dias_sem_compra": 4
}
```

## Como coletar

```
node scripts/coletar_justificativas_visitas.js
```

Roda manual por enquanto — não está em nenhum workflow/cron agendado.
`roteiro-hoje` é sempre o dia corrente real da API (não dá pra coletar
retroativo), então cada rodada só vale pro dia em que rodou. Se quiser
consistência garantida, o ideal é rodar perto do fim do expediente (ex: junto
do fechamento das 18:30), quando a maioria das visitas do dia já aconteceu.

## O que ainda falta (próximos passos possíveis)

- Não está em nenhum cron/workflow ainda — cada dia precisa rodar manual (ou
  pedir pra automatizar).
- Ainda não existe relatório/análise pronta em cima do dataset — só a coleta.
- Rodar mais de uma vez no mesmo dia duplica as linhas desse dia (o script
  não faz dedup); se precisar, filtrar por `data` antes de reprocessar.
