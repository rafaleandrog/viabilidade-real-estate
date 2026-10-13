# Criar um estudo a partir de um formulário simplificado

Os formulários de `referencia/formularios/` têm uma aba só (Campo · Valor · Unidade · Chave técnica). Preenchido, o `.xlsx`
vira um estudo da instância com **um comando**, e o resultado é conferido antes de você dar o estudo por bom.

## Uso

```
python3 -I scripts/formularios/importar_formulario.py <preenchido.xlsx> --nome-estudo "qa-..." --executar --relatorio saida.json
```

Sem `--executar` só valida a planilha e mostra o plano. Ambiente: `URBIVERSO_QA_URL` e `URBIVERSO_QA_TOKEN_PCPAL` (o token nunca é
impresso), `python3` com `openpyxl`, e `pnpm install` feito no repositório (os passos 3 e 5 usam o motor do app).

## O que ele faz, nesta ordem

1. **Valida a planilha e para no primeiro problema, antes de escrever.** Barra: duas unidades preenchidas no mesmo campo; Σ % dos
   produtos ≠ 100; grupo ou tipologia que não existe; alocado acima do catálogo; Σ do pagamento acima de 100; categoria de custo com
   unidade que a tela não aceita; custo obrigatório ausente; valor na linha errada.
2. **Cria o estudo** pelas rotas do app, na ordem que o app exige (parâmetros antes do cronograma, tipologias antes das alocações…).
3. **Leva o pagamento ao formato canônico** (`aplicar-pagamento-canonico.ts`). Em instância com a normalização na API é um passo sem efeito.
4. **Relê** o que foi gravado e compara com a planilha (estudo, produtos, tipologias, grupos, custos, funding, cenários).
5. **Roda o motor do repositório** (`conferir-estudo.ts`) e separa defeito do estudo de achado conhecido do app (cada um com o número da issue).

Saída 0 = sem erro de preenchimento, sem divergência na releitura e sem problema novo no motor. Saída 1 = planilha com erro (nada foi
escrito). Saída 2 = o estudo foi criado, mas há pendência a olhar.

## Regras de preenchimento que o importador assume

- **Percentual:** o Excel guarda fração (4% = 0,04) e a API espera pontos (4). O importador converte pelo **formato da célula** — não troque o formato.
- **Uma unidade por campo:** nas linhas "— em m²", "— em % da poligonal"… preencha uma só.
- **Nomes que se referenciam** (grupo no pagamento e na alocação, tipologia na alocação e na permuta) têm de ser idênticos aos da seção de origem.
- **Distribuição de custo:** `Linear`, o nome de uma curva do catálogo da instância (ex.: `Curva S`), `unit_delivery` ou `sales_revenue`.
- **Cronograma do custo:** um evento (`planejamento`, `obra`…), `customizado` (com início e duração) ou `fase: <nome da fase>`.
- **Base financiável** do financiamento à produção: linhas de custo separadas por `;`, como `Categoria` ou `Categoria / Subcategoria`.

## O que NÃO é enviado (sempre listado como aviso, nunca calado)

Região de mercado, apelo comercial (texto e tipo), imagem principal e vínculo com imóvel do Núcleo (a origem do terreno tem de ser `manual`).
Esses vão pela tela.

## Chaves técnicas

`estudos.<coluna>`, `parametros.<campo>`, `cronograma.<evento>.<campo>`, `<coluna>_modo = <modo> → <coluna>_valor` (unidades alternativas) e
`<lista>[n].<campo>` (`custos[3].unidade`, `pagamento[2].sinal_pct`, `funding.divida[1].taxa_anual`). Chave sem tratamento no importador vai
para a lista de ignorados.

## Para uma sessão de QA

O roteiro é: receber o `.xlsx` preenchido, rodar o comando acima, e reportar o resultado dos passos 1, 4 e 5. Os estudos criados levam o nome
que a pessoa deu; use o prefixo `qa-`.
