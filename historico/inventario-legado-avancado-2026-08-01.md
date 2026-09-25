# Inventário de dados legados do Avançado — estratégia de compatibilidade (#221 / EVI-002)

**Sessão:** diagnóstico (Fase 2 da trilha Rodadas 5+6). **Escopo:** documentação.
**Nenhuma linha de runtime, schema, migração ou teste foi alterada.** Este documento é o **portão
P3** da Rodada 5: nenhuma issue que escreve dados novos (#230, #257, #258, #260, #271…) deve rodar
sem estratégia de compatibilidade registrada aqui.

Base de evidência lida em `schema.json`, `migracoes/*`, `backend/rotas/avancado.ts`,
`frontend/fluxo-caixa-motor.ts`, `frontend/fluxo-shared.ts` — não presumida.

---

## 1. Matriz campo / formato / versão / consumidor

| Estrutura | Onde | Formato | Consumidores | Estratégia |
|---|---|---|---|---|
| `avancado_cronograma` | tabela | 5 eventos fixos; `inicio_mes`/`duracao_meses`/`travado_*` | `recalcularTravados`, motor, cronograma | **Preservar.** #224–#226 mudam derivação, não shape |
| `avancado_fases` (`tipo`) | tabela | `receita` = Grupo comercial · `cronograma` = marcador gantt (#168/#010) | Receitas, cronograma, motor | **Preservar.** #222 só renomeia rótulo (Fase→Grupo), não a coluna |
| `avancado_tipologias` + `avancado_alocacoes` | tabelas | catálogo + Grupo×tipologia×preço | motor, Receitas, permuta | **Preservar.** #266/#267 acrescentam fonte de permuta física |
| **`avancado_linhas_receita`** | tabela | `absorcao`+`fluxo_pagamento` JSON | **nenhum** (só citada em comentário `avancado.ts:10`; a duplicação **não** a copia) | **Vestigial.** Superada por `fases`+`alocacoes`. Remoção por migração é de issue futura, **não desta**; até lá, tolerada e ignorada |
| `absorcao` (JSON) | `fases`/`linhas_receita` | 3 períodos (`lancamento`/`obra`/`pos_obra`) + legado `personalizado`/`meses`/`blocos` (compat em `fluxo-shared.ts:264-280`) | `faixasAbsorcao`, `absorcaoMensal`, gráfico | **Adaptar.** #225/#226 vão para 4 períodos; adapter lê o de 3 e o `personalizado`. **Sem versão hoje** |
| `fluxo_pagamento` (JSON) | `fases`/`linhas_receita` | `comissao`, `ret`, `entrada[]`, `parcelas[]`, `repasse.apos_entrega_meses`; normalizado ad-hoc por `normalizarLinhasPagamento` (`motor:166`) | motor (recebíveis, repasse, horizonte) | **Adaptar → contrato de componentes (#230).** Adapter obrigatório lê o shape atual. **Sem versão hoje** |
| `avancado_linhas_custo` | tabela | `orcamento_valor`+`orcamento_unidade` (6 opções), `obrigatoria`, `distribuicao_modo` (3 opções), âncora | motor, Custos, terreno | **Adaptar.** #256/#257 mexem em `subcategoria`/`obrigatoria`/Preço; #260 no valor canônico |
| Bloco G (aba Financeiro) | `estudos` | ~25 campos `taxa_desconto_aa`, `estrutura_*`, `aliquota_*`, `financiamento_*`, `investidor_*`, `regime_tributario` | **inerte** — 0 refs no motor (grep) | **Bloco morto.** #239/FIN decide integrar por instrumentos; #271 migra como rascunho. Preliminar lê alguns via `proforma.ts` |
| `unidades_permutadas` | `tipologias` | inteiro por tipologia | motor (`vgvVendavelLinha`, #195), `fluxo-shared` | **Migrar depois.** #253 retira **só após** #267 criar a fonte nova |

## 2. Migrações executadas e a `versao`

`001`…`013` na `main`; `manifesto.json` `versao = 0.1.12`. Regra da plataforma: **`z` sobe só com
migração nova**. A `004_fases_gantt.js` entrou uma vez **sem** bump (registrado no `PROGRESSO.md`) —
é o antipadrão a não repetir. Issues que só transformam dado existente **podem** exigir migração +
bump (#257, #258, #253); as que só leem/derivam **não** (#225, #226, #260 se não persistir).

## 3. Formas legadas ainda toleradas pelo motor

- **`absorcao.personalizado` / `.meses` / `.blocos`** — `fluxo-shared.ts:264-280` ainda lê. Qualquer
  issue que reescreva absorção mantém este ramo até a migração explícita.
- **`fluxo_pagamento.entrada`/`.parcelas` como listas** — `normalizarLinhasPagamento` aceita lista,
  objeto único e ausência. O contrato de componentes (#230) **tem de** preservar essa leitura.
- **`repasse.apos_entrega_meses`** — usado no horizonte (`motor:540`) e no repasse (`motor:274`).
  #231 (horizonte) e #234 (repasse) não podem quebrar a leitura sem migração.

## 4. Impacto em duplicação, importação e exportação

- **Duplicação** (`duplicarDadosAvancado`) copia cronograma, tipologias, fases, alocações, custos e
  cenários por campos explícitos (`CAMPOS_*`) — **não** copia `avancado_linhas_receita` (confirma o
  status vestigial) nem o Bloco G por linha (vai junto no clone de `estudos`, tratado pela #244).
  Qualquer shape novo precisa entrar nas listas `CAMPOS_*` **e** no round-trip.
- **Exportação** (`exportar.ts`) depende do shape atual de fases/alocações/custos e já usa
  `toFixed(2)` — a #281 alinha a tela a isso. Séries novas (#241) precisam de coluna própria.
- **Importação automática de planilha:** não existe e permanece fora de escopo.

## 5. Contagens de produção — **execução do autor** (fora do ambiente Claude Code)

O ambiente Claude Code não acessa o Postgres de produção. Estas contagens **bloqueiam a
implementação** das issues citadas e são levantamento do autor:

1. Estudos com `pos_obra.duracao_meses ≠ 12` → dimensiona o impacto de **#226**.
2. Estudos com `unidades_permutadas > 0` → dimensiona **#253/#258**.
3. Linhas `Preço` do terreno **sem** `obrigatoria=true`, ou **mais de uma** por estudo → **#256**.
4. Estudos com `fluxo_pagamento` fora do shape de 3 períodos / com `personalizado` → **#230**.
5. Estudos com Bloco G preenchido (algum `estrutura_*`/`financiamento_*` não nulo) → **#271**.

## 6. Regras não negociáveis desta estratégia

- **Nenhuma proposta destrutiva sem rollback.** Toda migração que transforma dado tem inverso
  documentado ou preservação do original até validação.
- **Ler o legado antes de escrever o novo.** Shape novo entra com adapter do antigo no mesmo PR; a
  **remoção** do suporte legado é PR separado, depois da migração.
- **Bump vinculado a migração**, nos dois sentidos (nem migração sem bump, nem bump sem migração).

## Veja também
- `docs/viabilidade/modelo-de-dados.md` — modelo de dados canônico (este inventário alimenta o Anexo C do padrão)
- `docs/issues-evi-propostas-2026-07-31.md` — corpos e emendas das #220–#241
- `docs/lista-bugs-planejamento-2026-07-31.md` — precedências de terreno/custos (#256→#257→#258)
