# Conferência do importador com os 4 formulários, na Pinguim (2026-10-14)

Nota datada (fotografia, não guia). Instância **Pinguim** (`homolog.urbiverso.com.br`), app `viabilidade` na versão `0.1.40`
(a mesma do `manifesto.json` da `main`), identidade **QA Principal**. O importador é o de `scripts/formularios/importar_formulario.py`
já com o id impresso assim que o estudo é criado.

## O que foi feito

Os 4 formulários de `referencia/formularios/exemplos/` foram importados, um de cada vez, com `--executar` e o nome acrescido de
` (importador v3)`. Antes de cada execução, a lista de ids dos estudos foi guardada (rede de segurança do roteiro da skill
`instancia-urbiverso`). Autorizado pelo autor na conversa, com a lista dos quatro estudos e a opção do nome.

| Estudo | Formulário | Chamadas | Releitura | Saída |
|---|---|---|---|---|
| 38 | Aurora Parque — Preliminar (Incorporação) | 7 | 0 divergência, 0 falha HTTP | 0, `RESULTADO: OK` |
| 39 | Vale do Sol — Preliminar (Loteamento) | 6 | 0 divergência, 0 falha HTTP | 0, `RESULTADO: OK` |
| 40 | Aurora Parque — Avançado (Incorporação) | 38 | 0 divergência, 0 falha HTTP | 0, `RESULTADO: OK` |
| 41 | Vale do Sol — Avançado (Loteamento) | 35 | 0 divergência, 0 falha HTTP | 0, `RESULTADO: OK` |

Nos dois Avançados o pagamento foi convertido para o formato canônico (`componentes`) sem erro: Aurora com 4 componentes na fase
"Residencial" e 3 na "Lojas"; Vale do Sol com 2 em cada etapa.

## O que o motor do repositório deu

Medido depois, por `scripts/conferir-estudo.ts` rodado de novo sobre os estudos 38 a 41 (saída 0), não só pela execução do importador.

| Estudo | Números |
|---|---|
| 38 (Preliminar) | VGV R$ 139.704.323,22 · receita líquida R$ 123.890.325,80 · resultado R$ 43.414.840,60 · margem 31,08% · ROI 53,95% |
| 39 (Preliminar) | VGV R$ 209.250.000,00 · receita líquida R$ 174.242.475,00 · resultado R$ 87.218.100,00 · margem 41,68% · ROI 100,22% |
| 40 (Avançado) | VGV de tabela R$ 143.244.200,00 · VPL R$ 29.777.195,13 · TIR 48,78% a.a. · payback mai/2030 (mês 41) · exposição máxima −R$ 46.826.322,08 · juros de clientes R$ 18.969.063,01 · carteira máxima R$ 81.396.230,71 (mês 39) |
| 41 (Avançado) | VGV de tabela R$ 232.500.000,00 · VPL R$ 49.713.246,52 · TIR 39,25% a.a. · payback jan/2031 (mês 47) · exposição máxima −R$ 56.006.227,68 · juros de clientes R$ 83.836.084,21 · carteira máxima R$ 120.736.073,21 (mês 37) |

Os dois Preliminares fecham com "0 divergência" nos invariantes do app. Os dois Avançados repetem os números que a nota
`diagnostico-formularios-qa-2026-10-13.md` registrou para os estudos 27 e 28, criados na véspera pelo importador anterior: Aurora com
TIR 48,78%, VPL R$ 29,78 mi, exposição máxima −R$ 46,8 mi e payback mai/2030; Vale do Sol com TIR 39,25% e juros de clientes de
R$ 83,8 mi. Os estudos 25 a 28 já tinham sido apagados quando esta conferência rodou, então a comparação é contra o que aquela
nota registrou, não contra os estudos vivos.

## Achados do motor

Nenhum achado novo. Tudo o que apareceu já estava registrado em issue, e o importador os marca como `conhecido:` com o número.

| Estudo | Achado | Issue |
|---|---|---|
| 40 | `FALHA` VGV Σ do catálogo e das alocações contra o `vgvTotal` do motor (esperado R$ 126.883.200,00, obtido R$ 143.244.200,00): a conta do script ignora a área aberta | #835 |
| 40 | `FALHA` Σ legado entrada+parcelas "Residencial" (40%) e "Lojas" (50%): o repasse é derivado no formato canônico | #827 |
| 40 e 41 | `[alerta]` `CAMADAS_DIVERGEM_PERMUTA_FISICA`: o Catálogo declara permuta física (260 m² e 30.000 m²) e as Premissas mostram 0 m² | #832 |
| 40 e 41 | `[alerta]` `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING` (mês 21 e mês 1): o funding dos exemplos foi montado sem checar o caixa; é o alerta D14, esperado | — |

No estudo 41 as conferências de VGV batem (Δ R$ 0,00) porque a área aberta do Loteamento é 0.

## Resíduo

- **Criados e ficam:** os estudos **38, 39, 40 e 41** na Pinguim, em rascunho, nome com ` (importador v3)`.
- **Apagados, com autorização do autor, um a um:** os estudos **25, 26, 27 e 28** (os de 2026-10-13), depois de conferir que cada id
  ainda era o estudo esperado pelo nome. Ficaram intocados os estudos 19 a 22 e 24, que não são desta rodada.
- Os relatórios JSON do importador ficaram no diretório temporário da sessão, não no repositório.

## O que a conferência não prova

Prova que o estudo gravado bate com a planilha (releitura) e que o motor o calcula (`conferir-estudo`). Não prova que a planilha de
exemplo descreve um projeto real, nem cobre campo fora dos dois projetos de exemplo. Região de mercado, apelo comercial, imagem
principal e vínculo com o Núcleo não vão pelo importador e não foram exercitados.
