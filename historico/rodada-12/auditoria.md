# Rodada 12 — auditoria de KPIs/gráficos do Preliminar (Fase 0)

Origem: documento de handoff `tela_kpis_viabilidade_handoff.md` (anexado pelo autor,
2026-09-14), com uma especificação de redesenho de KPIs e gráficos para estudos de viabilidade
imobiliária **sem fluxo de caixa mês a mês** — o caso do estudo **Preliminar**. O plano completo
(escopo, decisões do autor, ordem de PRs) está registrado na conversa que abriu esta rodada; este
documento é só a saída da Fase 0 (auditoria), que o plano marca como **bloqueante** para a Fase 1
(redesenho de UI).

Método: os 7 testes de reconciliação da seção 2 do handoff, aplicados contra o motor **real** do
Preliminar (`calcularProforma`, `frontend/proforma.ts`) em fixtures determinísticas — não há acesso
a um estudo de produção neste ambiente, então a reprodutibilidade pedida pelo handoff é satisfeita
por fixtures, no mesmo padrão que `frontend/proforma.test.ts` já usa. Os testes executáveis estão
em `frontend/auditoria-indicadores-preliminar.test.ts`.

## Placar

| # | Defeito (handoff §2) | Veredito | Evidência |
|---|---|---|---|
| 2.1 | Rótulo que não corresponde ao denominador | ✅ não achado — "Margem sobre VGV" reproduz `resultado/vgv` | teste `2.1`, `proforma.ts:708` |
| 2.2 | Indicadores algebricamente redundantes | ✅ não achado — ROI e Margem sobre VGV **não** são redundantes pela identidade `retorno=margem/(1-margem)` do handoff; denominadores genuinamente distintos (`investimentoTotal` × `vgv`) | teste `2.2` |
| 2.3 | Medidores duplicados com rótulos diferentes | ✅ **consertado** — o medidor "Resultado final" plotava o mesmo valor que "Margem sobre VGV"; aposentado | teste `2.3` (confirma o conserto), `tela-graficos.ts:254` |
| 2.4 | Mesmo rótulo, valores diferentes em telas diferentes | ✅ não achado — "Margem sobre VGV" (Preliminar) e "Margem sobre Receita Bruta" (Avançado) são rótulos distintos | teste `2.4`, `frontend/rotulos-indicador.ts` |
| 2.5 | Indicador que não reconcilia com nenhuma base | ✅ não achado (hoje) — `roiPct`/`margemLiquidaPct`/`custoObrasVgvPct` são `null`, não `0`, quando o denominador é ≤ 0 | teste `2.5` |
| 2.6 | Benchmark que reprova metade do painel | ✅ não achado — metas padrão não reprovam estudos saudáveis em massa | teste `2.6` |
| 2.7 | Sensibilidade sem indicação de relevância | 🟡 **achado declarativo, fora de escopo** — a Análise de Sensibilidade lista variáveis em ordem fixa, sem ranquear por impacto | sem teste (comportamento de tela, não do motor); resolvido pelo "tornado de alavancas" do handoff §4.2, Fase 2 (fora de escopo aprovado) |

## Disposição de cada achado

### 2.3 — medidor duplicado (bloqueante, consertado)

`tela-graficos.ts:_renderMedidores` passava `resultado_final: p.margemLiquidaPct` —
literalmente o mesmo valor de `margem_liquida` — para `resolverIndicadoresBenchmark`.
`backend/rotas/benchmarks.ts` semeia os dois benchmarks (`resultado_final` meta 25%,
`margem_liquida` meta 20%) em todo estudo novo. Resultado: dois medidores, dois rótulos, metas
diferentes, o mesmo número plotado nos dois.

**Disposição:** aposentado, não reescalado — decisão do autor. A chave saiu da chamada a
`resolverIndicadoresBenchmark`; `resultado_final` agora é descartado com o mesmo motivo que
`eficiencia_aproveitamento` já tinha no Resumo do Avançado (`SEM_VALOR_NESTA_TELA_MOTIVO`). O
backend continua semeando o benchmark `resultado_final` (compartilhado com o Avançado, fora do
escopo desta rodada) — só o Preliminar parou de desenhar um medidor duplicado com ele.

### 2.7 — sensibilidade sem ranking (registrado, não corrigido)

A Análise de Sensibilidade (`frontend/tela-proforma.ts`, `_variaveis`) lista as variáveis
estressadas em ordem fixa por tipo de empreendimento, sem indicar qual delas tem maior impacto no
resultado. O handoff resolveria isso com um "tornado de alavancas" (§4.2), que depende de recalcular
o proforma ±10% por premissa — calculável hoje sem mudança de schema, mas **fora do escopo
aprovado** desta rodada (Fases 0–1 só). Fica registrado para uma rodada futura.

> ⚠️ **Superada em 2026-09-25 (Rodada 13).** O tornado foi entregue no PR 757 (issues #727/#728/#729:
> `frontend/tornado-alavancas.ts` e `viab-grafico-tornado`), e a aba Cenários inteira foi
> reconstruída em seguida (#730, #731, #734, #735). A nota acima fica como fotografia do que a
> Rodada 12 decidiu; ver `historico/rodada-13/planejamento.md`.

### Achado que NÃO se sustentou: o bug do ROI (armadilha 11 do `CLAUDE.md`)

A armadilha 11 do `CLAUDE.md` deste repo registra um bug histórico — catálogo precificado sem
custo lançado (`investimentoTotal=0`) fazendo o Painel publicar "ROI 0,0%" em vez de indefinido —
como **"ainda aberto"** (PR 649). O teste `2.5` desta auditoria **mede, não assume**: com
`investimentoTotal=0`, `roiPct` é hoje `null` (`proforma.ts:719-720`, `roiMedido = investimentoTotal
> 0`), não `0`. **O bug está corrigido** — a nota do `CLAUDE.md` estava desatualizada; corrigida
nesta mesma rodada (ver `CLAUDE.md`, seção da armadilha 11).

## O que a Fase 0 NÃO cobre

Os blocos "Margem de segurança" (handoff §4.3) e benchmark editável por tipologia/praça (§Fase 3)
exigem um campo `base_calculo` por linha de custo, hoje inexistente de forma uniforme no schema do
Preliminar — fora do escopo desta rodada por decisão do autor.
 Ver o plano completo da rodada
(registrado na conversa que a abriu) para a lista completa de decisões e a ordem de PRs.

> ⚠️ **A premissa do `base_calculo` não se sustentou — corrigida em 2026-09-25 (Rodada 13).** A
> decomposição analítica por base de cálculo é um jeito de CALCULAR, não o resultado:
> `calcularProforma` já sabe qual base cada linha usa, e **inverter o motor numericamente**
> (secante + bisseção com verificação do resíduo, precedente `precoSugeridoM2`) entregou a margem
> de segurança sem campo novo, sem migração e sem bump da `versao` — `frontend/margem-seguranca.ts`,
> PR 757 (#732/#733). O benchmark por praça continua fora, esse sim por exigir schema.

