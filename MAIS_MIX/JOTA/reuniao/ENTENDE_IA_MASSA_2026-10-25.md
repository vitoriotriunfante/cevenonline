# JOTA entendendo com IA — medição em massa (2026-10-25)

**3411 perguntas** = as 1448 da reunião tensa reescritas por regra (sinônimos, abreviado, coloquial). Foram para a IA: 299.

| | Acerto | Disse que não tem (honesto) | Errada | Sem resposta |
|---|---|---|---|---|
| Só palavras-chave | 92,1% | 2,0% | 1,5% | 4,4% |
| Com a IA entendendo | 96,0% | 2,5% | 1,0% | 0,5% |

## Por jeito de escrever (acerto + honesto)
| Estilo | Perguntas | Antes | Depois |
|---|---|---|---|
| sinônimos | 662 | 91,5% | 100,0% |
| abreviado | 1301 | 94,5% | 97,4% |
| coloquial | 1448 | 95,0% | 98,8% |

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
| Presente · supervisores | 80 | 73,8% | 98,8% |
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
| Indústria · vendedor específico | 60 | 98,3% | 98,3% |
| Indústria · semana a semana | 60 | 100,0% | 100,0% |
| Indústria · positivação e recuperação | 112 | 100,0% | 100,0% |
| Indústria · preço médio | 12 | 100,0% | 100,0% |
| Indústria · sell-out / estoque no PDV | 36 | 100,0% | 100,0% |
| Indústria · share / concorrente | 35 | 100,0% | 100,0% |
| Futuro · projeção de fechamento | 99 | 100,0% | 100,0% |
| Futuro · plano / quem cobrar | 136 | 100,0% | 100,0% |
| Oportunidades · clientes parados | 132 | 87,9% | 88,6% |
| Oportunidades · +MIX | 132 | 83,3% | 100,0% |
| Oportunidades · onde perdemos venda | 66 | 100,0% | 100,0% |
| Oportunidades · motivos de não venda (justificativas) | 153 | 66,7% | 77,8% |
| CEO · margem e rentabilidade | 6 | 100,0% | 100,0% |
| CEO · Premiação RV individual (holerite) | 66 | 100,0% | 100,0% |
| Vendedor · eu mesmo | 84 | 100,0% | 100,0% |

## O que ainda falha (exemplos)
- **Presente · supervisores** · "sup jonatas da" (original: "supervisor Jonatas Da") → nada: null
- **Indústria · vendedor específico** · "tem algum vend especifico q vende mais sakura na tpa" (original: "tem algum vendedor específico que vende mais Sakura na TPA?") → errada: 🏭 *Sakura Nakaya Alimentos* — TPA, no mês (até 23/10)
- **Oportunidades · clientes parados** · "meus clientes q n compraram no mes" (original: "meus clientes que não compraram no mês") → nada: null
- **Oportunidades · clientes parados** · "meus clientes q n compraram no mes" (original: "meus clientes que não compraram no mês") → nada: null
- **Oportunidades · motivos de não venda (justificativas)** · "quais clientes o danilo henrique 328 visitou e n vendeu" (original: "quais clientes o Danilo Henrique 328 visitou e não vendeu?") → errada: Danilo Henrique Dos Santos Braga (TCV) não tem clientes na rota de hoje (fim de semana: sem rota).
- **Oportunidades · motivos de não venda (justificativas)** · "preciso saber quais clientes o Danilo Henrique 328 visitou e não vendeu?" (original: "quais clientes o Danilo Henrique 328 visitou e não vendeu?") → errada: Danilo Henrique Dos Santos Braga (TCV) não tem clientes na rota de hoje (fim de semana: sem rota).
