# Formato da skill gerada

Regras:
- Telegráfico, imperativo. Sem introdução, conclusão, cortesia.
- Só itens de `aprovados.json`. Nada novo.
- Itens repetidos já vêm fundidos; não repetir ideia em duas seções.
- Siglas definidas uma vez no Glossário.
- Item com 1 fonte e relevância ≤ 1: sufixo `(1 fonte)`.
- Números sempre com unidade.
- Seção sem itens: omitir.
- Máx. 1.500 tokens.

Mapa tipo → seção:
| tipo | seção |
|---|---|
| passo | Procedimento (numerado, na ordem lógica) |
| numero | Valores de referência (tabela) |
| erro | Erros comuns |
| cuidado | Cuidados |
| ferramenta | Ferramentas |
| fato, conceito | Conceitos |

Modelo:
```markdown
---
name: <slug>
description: <1 linha: quando usar>
---
# <Título>

## Quando usar
- <situação>

## Aplicação nos projetos
- <projeto>: <itens de relevância 3 em 1 linha>

## Procedimento
1. <passo>

## Valores de referência
| parâmetro | valor |
|---|---|

## Ferramentas
- <ferramenta>: <para quê>

## Erros comuns
- <erro> → <correção>

## Cuidados
- <cuidado>

## Conceitos
- <termo>: <definição curta>

## Glossário
- <SIGLA>: <significado>

## Fontes
- fontes.md
```
