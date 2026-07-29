---
titulo: Análise de Mercado — projeto × mercado
descricao: Como o app compara os números do estudo com os do mercado (preço/m², custo de obra/m², VSO e macros), de onde vem cada lado e por que o lado "projeto" não é digitado.
tipo: app
ordem: 10
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Análise de Mercado

Aba do nível **Avançado** que confronta os números do estudo com os do mercado da região.
Introduzida na issue **#199**.

---

## 1. Os dois lados têm origens diferentes

Esta é a ideia central da tela, e o que explica quase todas as decisões abaixo.

| Lado | De onde vem | Persistido? |
|---|---|---|
| **Projeto** | Derivado do próprio estudo, em tempo de render (`frontend/analise-mercado.ts`) | **Não** |
| **Mercado** | Snapshot na tabela `analise_mercado`, preenchido pela rota de IA (**#200**) | Sim |

**Por que o lado "projeto" não é digitado nem salvo:** todos esses números já existem no estudo —
preço vem das tipologias, custo de obra vem das linhas de custo, velocidade vem da absorção. Pedir
que o usuário os redigite aqui criaria uma segunda fonte de verdade que ficaria velha no instante
em que ele editasse qualquer outra aba, e ninguém saberia qual das duas está certa. É a mesma razão
pela qual o nº de parcelas "ao longo da obra" é derivado e não gravado (#190/#191).

---

## 2. Como cada número do projeto é derivado

| Indicador | Fórmula | Observação |
|---|---|---|
| **Preço de venda (R$/m²)** | `VGV total ÷ área privativa total` | Média **ponderada pela área**, não a média aritmética dos `preco_m2` — senão um studio pesaria igual a uma cobertura |
| **Custo de obra (R$/m²)** | `Σ linhas do grupo obra ÷ área privativa total` | Usa as linhas **já resolvidas pelo motor** (`FluxoCalc.linhasCusto`), não o `orcamento_valor` cru — a resolução de unidade (R$/m², % VGV, % Obra) mora num lugar só |
| **Velocidade de vendas (%/mês)** | média de `100 ÷ meses com venda`, **ponderada pelo VGV** de cada fase | Lê a premissa de absorção como VSO. Uma fase que responde por 80% do VGV manda 80% do resultado |

Todas devolvem **`null`**, nunca `0`, quando não dá para derivar (sem tipologia, sem linha de obra,
sem cronograma). Zero é um valor legítimo e diria ao usuário algo diferente de "sem dado".

Cobertas por `frontend/analise-mercado.test.ts`.

---

## 3. Ausência de dado é estado de primeira classe

Três ausências diferentes, tratadas separadamente:

1. **Sem snapshot de mercado** — o estudo existe e nunca rodou a análise. O `GET` responde
   `{ analise: null }` (**não** 404) e a tela mostra o lado projeto normalmente, com um banner
   explicando que a comparação aparece quando a análise for gerada.
2. **Sem série do município** — a coluna `abrangencia` (`municipio` \| `uf` \| `nacional`) diz o
   alcance real do dado. Quando não é `municipio`, a tela avisa que a referência é mais ampla e
   menos específica, em vez de fingir precisão local.
3. **Sem dado do projeto** — um indicador isolado sai como `—` sem derrubar os outros.

---

## 4. Decisão de navegação: Análise de mercado ≠ Apelo Comercial

Até o #199 a aba "Análise de mercado" renderizava o **Apelo Comercial**. São coisas diferentes:

- **Apelo Comercial** pontua o **ativo** — localização, infraestrutura, vetor de crescimento,
  concorrência, demanda, segurança jurídica. É um score qualitativo por IA.
- **Análise de Mercado** compara os **números do projeto** com os do mercado.

O #199 resolveu a ambiguidade **sem remover nada**: a aba "Análise de mercado" passou a ser a
análise de verdade e o Apelo Comercial ganhou **página própria**, com o mesmo componente
(`viab-tela-apelo`) e o mesmo backend de antes.

---

## 5. Schema

Tabela **`analise_mercado`** (`acesso_externo: restrito`), um snapshot por estudo:

| Coluna | Tipo | Papel |
|---|---|---|
| `estudo_id` | referência → `estudos` (cascata) | dono do snapshot |
| `abrangencia` | texto (`municipio`/`uf`/`nacional`) | alcance real do dado |
| `localidade` | texto | nome do município/UF usado |
| `preco_medio_m2`, `custo_obra_m2` | decimal(12,2) | R$/m² de mercado |
| `vso_pct` | decimal(5,1) | VSO de mercado, %/mês |
| `ipca_pct`, `selic_pct`, `incc_pct` | decimal(5,1) | macros observados |
| `focus_ipca_pct`, `focus_selic_pct` | decimal(5,1) | projeções Focus |
| `riscos` | json | sinais de risco (renderizados no **#201**) |
| `resultado` | json | payload bruto da IA (mesmo padrão de `apelo_comercial`) |
| `origem`, `data_referencia` | texto | procedência e data do dado |

Migração `012_analise_mercado.js` — **aditiva**, sem transformação de dado (a entidade nasce aqui);
`versao` `0.1.10` → `0.1.11`. Seed fica fora da migração por contrato: quem popula é a rota do #200,
sob ação do usuário.

---

## 6. Limites — o que esta tela não é

- **Não é recomendação de investimento.** O banner de isenção é fixo e não pode ser removido.
- **Não diz se estar acima do mercado é bom ou ruim.** Preço acima pode ser produto premium ou
  preço irreal; custo acima pode ser padrão alto ou orçamento estourado. `compararProjetoMercado`
  devolve posição (`acima`/`abaixo`/`alinhado`) e magnitude, deliberadamente sem juízo de valor —
  quem interpreta é o usuário e, no **#201**, os sinais de risco.

---

## Veja também

- `docs/viabilidade/apelo-comercial.md` — o score qualitativo do ativo, que **não** é isto
- `docs/viabilidade/formulas.md` — demais fórmulas do app
- `docs/viabilidade/modelo-de-dados.md` — schema completo
