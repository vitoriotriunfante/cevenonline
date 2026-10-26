# JOTA entendendo com IA — medição em massa (2026-10-26)

**3411 perguntas** = as 1448 da reunião tensa reescritas por regra (sinônimos, abreviado, coloquial). Foram para a IA: 279.

| | Acerto | Disse que não tem (honesto) | Errada | Sem resposta |
|---|---|---|---|---|
| Só palavras-chave | 85,6% | 9,8% | 0,3% | 4,3% |
| Com a IA entendendo | 89,9% | 9,6% | 0,4% | 0,1% |

## Por jeito de escrever (acerto + honesto)
| Estilo | Perguntas | Antes | Depois |
|---|---|---|---|
| sinônimos | 662 | 91,1% | 99,8% |
| abreviado | 1301 | 97,5% | 99,2% |
| coloquial | 1448 | 95,4% | 99,5% |

## Por tema (acerto + honesto)
| Tema | Perguntas | Antes | Depois |
|---|---|---|---|
| Passado · mês passado | 230 | 100,0% | 100,0% |
| Passado · vendedor x mês passado | 85 | 100,0% | 100,0% |
| Passado · indústria/produto mês a mês | 88 | 100,0% | 100,0% |
| Passado · ontem | 96 | 100,0% | 100,0% |
| Passado · ano/histórico longo | 25 | 100,0% | 100,0% |
| Presente · resumo | 66 | 66,7% | 100,0% |
| Presente · quanto falta / MN | 136 | 100,0% | 100,0% |
| Presente · supervisores | 80 | 72,5% | 98,8% |
| Presente · vendedor no detalhe | 96 | 100,0% | 100,0% |
| Presente · rota e visitas | 144 | 100,0% | 100,0% |
| Presente · zerados | 80 | 100,0% | 100,0% |
| Presente · positivação | 153 | 100,0% | 100,0% |
| Presente · liga/Champions | 184 | 63,0% | 100,0% |
| Presente · lances (pênalti, impedimento) | 112 | 100,0% | 100,0% |
| Presente · devolução/corte/bloqueio | 77 | 100,0% | 100,0% |
| Presente · compromisso/RET | 60 | 100,0% | 100,0% |
| Presente · carteira/pendente | 50 | 100,0% | 100,0% |
| Presente · incentivo | 176 | 100,0% | 100,0% |
| Presente · marca própria | 30 | 100,0% | 100,0% |
| Indústria · metas (Premiação RV) | 204 | 100,0% | 100,0% |
| Indústria · dia da semana que mais vende | 50 | 100,0% | 100,0% |
| Indústria · vendedor específico | 60 | 100,0% | 100,0% |
| Indústria · semana a semana | 60 | 100,0% | 100,0% |
| Indústria · positivação e recuperação | 112 | 100,0% | 100,0% |
| Indústria · preço médio | 12 | 100,0% | 100,0% |
| Indústria · sell-out / estoque no PDV | 36 | 100,0% | 100,0% |
| Indústria · share / concorrente | 35 | 100,0% | 100,0% |
| Futuro · projeção de fechamento | 99 | 100,0% | 100,0% |
| Futuro · plano / quem cobrar | 136 | 100,0% | 100,0% |
| Oportunidades · clientes parados | 132 | 100,0% | 100,0% |
| Oportunidades · +MIX | 132 | 80,3% | 100,0% |
| Oportunidades · onde perdemos venda | 66 | 100,0% | 100,0% |
| Oportunidades · motivos de não venda (justificativas) | 153 | 92,8% | 92,8% |
| CEO · margem e rentabilidade | 6 | 100,0% | 100,0% |
| CEO · Premiação RV individual (holerite) | 66 | 97,0% | 100,0% |
| Vendedor · eu mesmo | 84 | 92,9% | 92,9% |

## O que ainda falha (exemplos)
- **Presente · supervisores** · "sup jonatas da" (original: "supervisor Jonatas Da") → nada: null
- **Oportunidades · motivos de não venda (justificativas)** · "por q os clientes n compram na tbe" (original: "por que os clientes não compram na TBE?") → errada: 🚨 *TBE — clientes há mais de 30 dias sem comprar*: *541*
- **Oportunidades · motivos de não venda (justificativas)** · "quais clientes o jorge leandro 303 visitou e n vendeu" (original: "quais clientes o Jorge Leandro 303 visitou e não vendeu?") → errada: Jorge Leandro Severo (TBE) não tem clientes na rota de hoje.
- **Vendedor · eu mesmo** · "como estou" (original: "como estou?") → nada: null
- **Vendedor · eu mesmo** · "me diz uma coisa, como estou?" (original: "como estou?") → nada: null
