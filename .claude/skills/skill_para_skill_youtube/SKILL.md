---
name: youtube-para-skill
description: Pesquisa um assunto no YouTube navegando como usuário (navegador anônimo, sem login, sem API), lê páginas como texto sem screenshot, extrai e limpa transcrições, remove propaganda, ranqueia o conteúdo pelos projetos do usuário, pede aprovação item a item e gera uma SKILL.md compacta. Use quando pedirem "crie uma skill sobre X a partir do YouTube", "aprenda X pelo YouTube" ou "extraia conhecimento de vídeos".
---

# YouTube → Skill

Caminhos `scripts/`, `modelos/` e `referencias/` são relativos à pasta desta skill. Arquivos de trabalho vão em `./trabalho/` (pasta atual).

## Ferramentas
| função | ferramenta | detalhe |
|---|---|---|
| navegar e se localizar na página | **Playwright MCP** (`@playwright/mcp`) | Chrome real, janela visível, perfil em memória (`--isolated`) = anônimo, sem login, sem histórico |
| ver a tela sem print | `browser_find` + `browser_evaluate` | `browser_find` devolve o elemento (ref) pelo texto visível; `browser_evaluate` roda JS e devolve só os dados em texto/JSON |
| clicar, digitar, rolar | `browser_click`, `browser_type` (`slowly: true`), `browser_press_key` (`PageDown`, `k`) | ações de usuário, nunca URL de API |
| pausas humanas | `browser_wait_for` (`time` em segundos) | valores na tabela Ritmo |
| transcrição (1ª opção) | painel "Mostrar transcrição" do YouTube + `scripts/js/transcricao.js` | sem custo |
| transcrição (2ª opção) | **yt-dlp** → `scripts/obter_transcricao.py <id>` | legendas manuais ou automáticas |
| transcrição (3ª opção) | **yt-dlp + ffmpeg + OpenAI Whisper** → `scripts/obter_transcricao.py <id> --audio` | vídeo sem legenda; US$ 0,006/min |
| limpar e tirar propaganda | `scripts/limpar.py` | regras + capítulos + selo "promoção paga" |
| ranquear e fundir repetidos | `scripts/ranquear.py` | ordena por relevância aos projetos |
| aplicar escolha do usuário | `scripts/decidir.py` | adicionar / descartar |
| modelo de IA | Claude Sonnet 5.5 conduz; Claude Haiku 5.5 extrai (subagente) | sem modelo local |

Proibido: `browser_take_screenshot`, `browser_snapshot` da página inteira, YouTube Data API, login.

## Instalação (uma vez)
1. Node 18+, Google Chrome, Python 3.10+.
2. `claude mcp add playwright -- npx @playwright/mcp@latest --browser chrome --isolated --snapshot-mode none --viewport-size 1366x768 --caps vision --output-dir ./trabalho`
   (Claude Desktop: usar `config/playwright-mcp.json`.)
3. `pip install yt-dlp requests`
4. Só para a 3ª opção de transcrição: `ffmpeg` no PATH e `OPENAI_API_KEY`.
5. Copiar `modelos/projetos.md` para `./projetos.md` e preencher.

## Etapa 0 — Preparar
1. Ler `./projetos.md`; se não existir, `modelos/projetos.md` preenchido na pasta da skill; se nenhum, perguntar ao usuário 1–3 projetos (objetivo, ferramentas, problemas) e criar `./projetos.md`.
2. Definir: assunto, N vídeos (padrão 5), idioma (padrão pt-BR).
3. Criar `./trabalho/`. Ler `./trabalho/historico.json` se existir: ids já processados não são abertos de novo.

## Etapa 1 — Abrir navegador anônimo
1. `browser_navigate` → `https://www.youtube.com/`
2. `browser_wait_for` time 3–5.
3. `browser_evaluate` com o conteúdo de `scripts/js/estado.js`.
   - `consentimento: true` → `browser_find` text "Rejeitar tudo" (ou "Recusar tudo"/"Reject all") → `browser_click` no ref → espera 2–3.
   - `verificacao: true` → `browser_close`, esperar 10 min, reabrir. Segunda vez → encerrar e informar.

## Etapa 2 — Buscar como usuário
1. `browser_find` text "Pesquisar" (placeholder da caixa de busca) → `browser_click` no ref.
2. `browser_type` no mesmo ref: `text` = termo, `slowly: true`, `submit: true`.
3. `browser_wait_for` time 3–5.
4. `browser_press_key` `PageDown`, espera 1–3; repetir 2 vezes (carrega mais resultados).
5. `browser_evaluate` com `scripts/js/resultados.js` → lista `{n,id,titulo,canal,duracao_s,views,publicado,trecho,selos}`.
6. Resultados fracos (< 8 válidos) → nova busca com variação do termo (sinônimo, "como fazer", "tutorial", "passo a passo"); máx. 3 buscas.

## Etapa 3 — Escolher vídeos
Critérios, nesta ordem:
1. Excluir: `duracao_s` < 240 ou > 3600; título com review, unboxing, compre, promoção, lançamento, #publi, "vale a pena", "melhor X para comprar"; id no histórico.
2. Priorizar: título com os termos do assunto; views altas; publicado nos últimos 3 anos; selo de legendas.
3. Diversidade: máx. 2 vídeos por canal.
Separar N principais + 3 reservas.

## Etapa 4 — Abrir vídeo e ler dados
1. Na página de resultados: `browser_find` text = início do título → `browser_click`.
2. `browser_wait_for` time 4–7.
3. `browser_evaluate` `scripts/js/estado.js`:
   - `pular_anuncio: true` → `browser_find` "Pular" → `browser_click`.
   - `anuncio_tocando: true` sem botão → `browser_wait_for` time 6, repetir até 3×.
4. `browser_press_key` `k` (pausa o vídeo).
5. `browser_evaluate` `scripts/js/video.js`, `filename` = `<id>.video.json`.

## Etapa 5 — Transcrição
1. `browser_find` text "...mais" (ou "mais"/"more") na descrição → `browser_click` → espera 1–2.
2. `browser_find` text "Mostrar transcrição" (ou "Show transcript") → `browser_click` → espera 2–3.
   - Não encontrou → `browser_evaluate` `scripts/js/abrir_transcricao.js`.
3. `browser_evaluate` `scripts/js/transcricao.js`, `filename` = `<id>.transcricao.json`.
4. Lista vazia → `python scripts/obter_transcricao.py <id>` → falhou → `python scripts/obter_transcricao.py <id> --audio`.
5. Confirmar `./trabalho/<id>.transcricao.json` (se `browser_evaluate` salvou em outro caminho, mover para lá).
6. `browser_navigate_back`, `browser_wait_for` time 5–15, próximo vídeo.

## Etapa 6 — Limpar e separar propaganda
1. `python scripts/limpar.py trabalho/<id>.transcricao.json trabalho/<id>.video.json`
2. Saída: `<id>.limpo.txt` (blocos `[m:ss] texto`) + `<id>.filtro.json`.
3. `video_comercial: true` → descartar vídeo, abrir reserva.
4. Blocos marcados `[?]`: decidir na extração; venda/autopromoção → ignorar; marca citada tecnicamente → conteúdo.

O que conta como propaganda: patrocínio, cupom, código de desconto, link de compra/afiliado, venda de curso/mentoria/produto do autor, pedido de inscrição/like, capítulo com título publi/patrocínio/oferta, vídeo com selo "Inclui promoção paga", descrição com #publi/parceria paga.

## Etapa 7 — Extrair conteúdo
Por vídeo (subagente com modelo Haiku quando disponível; um vídeo por subagente):
- Entrada: `<id>.limpo.txt` + `./projetos.md`. Nunca ler `.transcricao.json`.
- Saída: `trabalho/<id>.itens.json`, máx. 20 itens:
```json
[{"tipo":"passo|numero|erro|cuidado|ferramenta|fato|conceito","texto":"frase telegráfica ≤ 25 palavras","t":125,"projeto":"nome do projeto ou -","relevancia":3,"motivo":"≤ 12 palavras"}]
```
- `relevancia`: 3 aplicável já num projeto; 2 útil num projeto; 1 conhecimento geral do assunto; 0 irrelevante.
- `t` = segundos do bloco de origem. Números com unidade. Só o que está no texto.

## Etapa 8 — Ranquear
`python scripts/ranquear.py` → funde itens iguais entre vídeos, ordena por relevância × repetição × tipo, grava `trabalho/revisao.md` e `trabalho/revisao.json`.

## Etapa 9 — Apresentar e decidir
Mostrar ao usuário, nesta ordem:
1. Um cartão por vídeo usado:
```
▶ <título> — <canal> — <duração> — https://youtu.be/<id>
  propaganda removida: <fração>% (<faixas m:ss>) | itens extraídos: <n>
  conteúdo: <1 linha do que o vídeo ensina>
```
2. Vídeos descartados: título + motivo (comercial / sem transcrição / pouco conteúdo).
3. Tabela de `trabalho/revisao.md`.
4. Pergunta (AskUserQuestion quando disponível): **Adicionar alta + média** | **Adicionar só alta** | **Escolher números** | **Descartar tudo**. Texto livre aceito: `adicionar 1,3,5-8; descartar 4`.
5. `python scripts/decidir.py "<resposta>"` → `aprovados.json`, `descartados.json`.

## Etapa 10 — Gerar a skill
1. Fonte única: `trabalho/aprovados.json`.
2. Formato: `referencias/formato-skill.md`. Máx. 1.500 tokens.
3. Salvar `skills/<slug-do-assunto>/SKILL.md` e `skills/<slug-do-assunto>/fontes.md` (vídeo, canal, URL com `&t=<s>s` de cada item).
4. Atualizar `trabalho/historico.json`: `{id: {"data": "AAAA-MM-DD", "assunto": "...", "aprovados": n, "descartados": n}}`.
5. `browser_close`.
6. Mostrar caminho da skill e 1 linha de resumo.

## Ritmo de navegação
| ação | pausa (s) |
|---|---|
| após abrir página | 3–5 |
| entre teclas ao digitar | `slowly: true` |
| entre rolagens | 1–3 |
| após abrir vídeo | 4–7 |
| entre vídeos | 5–15 |
| limite por sessão | 20 vídeos/h |
Sortear valor diferente a cada pausa. Uma aba só. Sem abrir URLs de vídeo direto quando houver o link na página: clicar.

## Economia de tokens
- Elemento para clicar: `browser_find` pelo texto; `browser_snapshot` só com `depth` ≤ 3 quando `browser_find` falhar.
- Dado grande (transcrição, descrição): `browser_evaluate` com `filename`; ler o arquivo limpo, nunca o bruto.
- Extração em subagente Haiku; condução em Sonnet.
- Não repetir leitura de arquivo já lido. Não reabrir vídeo do histórico.

## Falhas
| sintoma | ação |
|---|---|
| `browser_find` não acha | `browser_snapshot` depth 3 na região → `browser_click` no ref |
| resultados vazios | esperar 3 s, `PageDown`, repetir `resultados.js` |
| painel de transcrição não abre | `abrir_transcricao.js` → `obter_transcricao.py` → `--audio` |
| tela de verificação | fechar navegador, esperar 10 min, reabrir; 2ª vez → encerrar |
| vídeo comercial | descartar, abrir reserva |
| < 3 vídeos válidos | nova busca com variação do termo |

## Custos (estimativa, 5 vídeos de 15 min)
| item | custo |
|---|---|
| navegação, legendas, yt-dlp, scripts | 0 |
| Claude Sonnet 5.5 conduzindo + Haiku 5.5 extraindo (API) | ~US$ 0,30–0,60 por skill |
| tudo em Haiku 5.5 (API) | ~US$ 0,03–0,06 por skill |
| plano Claude (Pro/Max) no Claude Code | sem cobrança por token; consome o limite do plano |
| Whisper (só vídeo sem legenda) | US$ 0,006/min ≈ US$ 0,09 por vídeo de 15 min |
