import { GRUPOS_CUSTO, GRUPO_CUSTO_LABEL } from './fluxo-tabela.js';
import type { FluxoCalc } from './fluxo-caixa-motor.js';

// ─────────────────────────────────────────────────────────────────────────
// #351: Proforma do nível AVANÇADO — a segunda sub-aba de Resultados.
//
// É uma leitura ECONÔMICA do mesmo `FluxoCalc` que alimenta a aba Fluxo de
// Caixa, na segmentação da imagem de referência da planilha (aba `#43`):
// Receita bruta (VGV) → deduções → Receita líquida → custo direto → custo
// indireto → Resultado, com três colunas (R$ · R$/m² · % VGV).
//
// Por que uma leitura nova em vez de reusar `proforma.ts` do Preliminar: o
// Preliminar calcula a proforma a partir de CAMPOS FIXOS do estudo
// (`custo_construcao_m2`, `outorga_pct`, …), que no Avançado não existem — lá
// o custo é uma LISTA livre de linhas classificadas em 5 grupos. Alimentar
// `calcularProforma` com um `ProformaInput` sintetizado exigiria inventar
// valores para campos que o Avançado não tem, e o resultado divergiria do
// fluxo. Aqui a proforma deriva das mesmas séries do motor, então as duas
// sub-abas nunca contam histórias diferentes.
//
// ⚠️ ESTA PROFORMA É DESALAVANCADA, E A FUNÇÃO NEM RECEBE `funding` (#426).
// Nenhuma ponta do funding entra: nem as entradas (liberações e aportes) na
// receita, nem as saídas (amortização e juros) no custo. Quatro razões, para
// ninguém reabrir isto ao contrário:
//
//   1. financiamento é atividade de FINANCIAMENTO, não custo econômico —
//      amortização devolve principal, e o custo do capital já é remunerado
//      pela TMA que o VPL/TIR descontam. Somar as SAÍDAS do funding
//      (amortização + juros) ao grupo `financeiro` cobrava o principal inteiro
//      como se fosse despesa, sem nunca creditar a liberação que o originou;
//   2. os indicadores de PROJETO já são desalavancados no app, e não por
//      convenção — por construção: `tir`, `vpl`, `paybackMes` e
//      `exposicaoMaxima` nascem dentro de `calcularFluxo`
//      (`fluxo-caixa-motor.ts:2742-2746`), a partir de `fluxoMensal` /
//      `fluxoAcumulado`, e essa função nunca vê funding — ele é costurado
//      depois, na tela. Proforma alavancada no meio de indicadores
//      desalavancados produz uma margem que nenhum outro número reconcilia;
//   3. o Painel de estudos compara Preliminar e Avançado nas MESMAS colunas
//      (VGV, Resultado, Margem, ROI), e o Preliminar não modela funding;
//   4. creditar as DUAS pontas também não serve: elas não se cancelam. Só o
//      principal devolvido cancela o principal liberado — os JUROS vêm por
//      cima, e num horizonte que termine antes da quitação ainda sobra saldo
//      devedor jamais pago. O resíduo vazaria para o Resultado como se fosse
//      lucro. Medido em `fluxo-apresentacao.test.ts`, teste "#426 proforma do
//      Avançado é DESALAVANCADA (D14)": R$ 1.053.567,77 de resíduo sobre
//      R$ 5.000.000,00 liberados.
//
// ⚠️ DESAMBIGUAÇÃO DO RÓTULO "Custos Financeiros" — ele significa coisas
// diferentes em duas telas, e sem saber disso alguém reabre o bug ao contrário
// ("sumiu o custo financeiro"):
//
//   | Superfície              | Visão       | Funding                       |
//   |-------------------------|-------------|-------------------------------|
//   | aba Fluxo de Caixa      | CAIXA       | AS DUAS PONTAS, e desde a     |
//   | (`fluxo-tabela.ts`,     |             | #592 as duas em BLOCO         |
//   |  blocos `funding-capital`|            | PRÓPRIO: a liberação em       |
//   |  e `funding-servico`)   |             | "Funding — Capital (entradas)"|
//   |                         |             | e o serviço em "Funding —     |
//   |                         |             | Serviço (saídas)", entre o    |
//   |                         |             | fecho do Fluxo de Caixa Livre |
//   |                         |             | e o do Fluxo de Caixa         |
//   | **aba Cenários,**       | CAIXA       | IDEM — é a MESMA função       |
//   | **tabela de fluxo**     |             | `tabelaFluxo`, provado por    |
//   | (`tela-cenarios.ts`     |             | `cenarios-heranca-fluxo.test.ts`|
//   |  `:403`)                |             | (#596)                        |
//   | aba Resultados / Painel | ECONÔMICA,  | NENHUMA PONTA                 |
//   | (esta função)           | antes de    |                               |
//   |                         | capitalizar |                               |
//
// ⚠️ **A #596 APAGOU a quarta leitura**, por decisão do autor. Era o KPI (e a
// coluna homônima da tabela de cenários) "Resultado após custo financeiro":
// visão ECONÔMICA menos o custo de capital — subtraía juros de toda dívida
// mais o retorno de equity do resultado DESTA função, **nunca o principal**.
//
// Ela não era redundante, e é exatamente por isso que saiu: depois da #592 a
// tela de Cenários passou a exibir três grandezas próximas, e essa terceira
// competia com o vocabulário novo sem que o rótulo dissesse que ela ignora o
// principal. A distinção era invisível para quem lesse os rótulos lado a lado.
//
// Quem for reintroduzi-la: o problema nunca foi a conta — era publicá-la sem
// dizer o que ela deixa de fora.
//
// ⚠️ A #592 mudou a PRIMEIRA linha desta tabela, e a correção veio junto com a
// #596. Antes ela dizia que o serviço da dívida vivia "dentro do subtotal do
// grupo `financeiro`" — verdade até a #592, falsa depois dela: o grupo
// `financeiro` voltou a valer só as linhas que o USUÁRIO classificou ali, e o
// serviço ganhou bloco próprio. Doc que descreve estrutura antiga é pior que
// doc ausente: manda o próximo leitor procurar no lugar errado e concluir que
// sumiu.
//
// Quem for reabrir o rótulo (#447) precisa das TRÊS leituras que sobraram — e
// de saber que existiu uma quarta, apagada pela #596 (o bloco acima), porque a
// pergunta "sumiu o custo financeiro de Cenários?" tem resposta, e ela é "saiu
// de propósito", não "regrediu".
//
// ⚠️ Note que "as duas pontas" NÃO quer dizer que elas se anulam: o principal
// devolvido cancela o principal liberado, mas os juros e qualquer saldo
// devedor remanescente no fim do horizonte não — é exatamente por isso que
// creditar as duas pontas AQUI não resolveria nada (razão 4 acima).
//
// Quem quiser ler o efeito do funding lê a aba Fluxo de Caixa, não esta. Aqui
// "(-) Custos Financeiros" vale EXATAMENTE as linhas de custo que o usuário
// classificou no grupo `financeiro` — nunca o serviço da dívida.
//
// 📎 Nota de referência (consultiva, não normativa): a planilha EVI do autor é
// PARCIALMENTE alavancada — ela agrega despesa financeira junto com os juros do
// financiamento à produção, em vez de deixar a proforma limpa. O app foi além e
// desalavancou a proforma inteira, pelas razões 2 e 3 acima. A divergência é
// deliberada e está registrada; a EVI é consultiva e não governa o runtime.
//
// ⚠️ O que desta nota é VERIFICÁVEL a partir deste repositório: a agregação da
// despesa financeira com os juros, em `docs/rodada-8/02-regras-evi.md:702`
// (célula `Premissas!P28`). O resto — o rótulo exato "Despesas Financeiras", a
// colocação dentro do "Custo direto total" e o "não soma amortização" — vem da
// leitura da planilha, que NÃO está no repo. Quem for citar isso numa issue
// (#447, #448) confira na planilha antes, em vez de citar este comentário.
// ─────────────────────────────────────────────────────────────────────────

export interface LinhaProformaAv {
  nome: string;
  /** R$ — custos e deduções entram NEGATIVOS, como na imagem de referência. */
  valor: number;
  /** 0 = subtotal/resultado (destacado); 1 = item detalhado. */
  nivel: 0 | 1;
  /**
   * #447: `'informativo'` é uma linha que a TELA soma de fora (nunca dentro
   * de `resultado`/`investimentoTotal`) — hoje só a leitura do serviço da
   * dívida do funding, montada em `tela-fluxo-ver.ts` porque esta função não
   * recebe `funding` (arity travada em teste, #426). Quem renderiza a lista
   * trata este tipo separado de `'custo'` para não somá-lo por engano.
   */
  tipo: 'receita' | 'custo' | 'resultado' | 'informativo';
  /**
   * #427 — % já calculado com a base PRÓPRIA da linha, para as linhas de
   * fecho cujo denominador não é o VGV puro (`Resultado + Permutas` usa
   * `VGV + permutas físicas`). Quando ausente, a tela calcula `valor / vgv`
   * como faz para todas as outras linhas.
   *
   * ⚠️ #604 — SÃO TRÊS ESTADOS, e confundir dois deles é o defeito.
   *   · `undefined` — a linha não tem base própria: a tela usa `valor / vgv`;
   *   · `number`    — a base própria mediu;
   *   · `null`      — a base própria é INVÁLIDA (≤ 0) e o percentual **não
   *                   existe**. Não é zero, e não é "use a outra base".
   *
   * Por isso quem consome NÃO pode escrever `pctOverride ?? pctVgv(valor)`:
   * `??` trata `null` como ausência e cairia no VGV puro, publicando um número
   * com o denominador errado. O teste discriminante é `!== undefined`.
   */
  pctOverride?: number | null;
  /**
   * #427 — nota do denominador usado (ex.: "1 / (VGV + Permutas Físicas)"),
   * no molde de `Premissas e Resultados!K36` da EVI: só presente quando a
   * base difere do VGV puro, isto é, só na linha `= Resultado + Permutas` e
   * só quando há permuta física.
   */
  notaBase?: string;
}

export interface ProformaAvancado {
  linhas: LinhaProformaAv[];
  /** Base de "% VGV" e do R$/m² — expostas para a tela não recalcular. */
  vgv: number;
  areaPrivativa: number;
  resultado: number;
  /**
   * #604 — `null` quando a Receita Bruta é ≤ 0: a margem não foi medida, e
   * "0,0%" ali seria um número inventado. É literalmente o mesmo valor de
   * `pctResultado` (o `pctOverride` da linha "= Resultado"), então tinha de
   * virar `null` junto — senão a MESMA grandeza sairia "—" na tabela e "0,0%"
   * no rodapé do mesmo card, a dois centímetros de distância.
   */
  margemPct: number | null;
  /**
   * #427 — segunda leitura da EVI (`Premissas e Resultados!P37/R37`):
   * `resultado` com a permuta financeira ESTORNADA de volta (ela havia sido
   * deduzida dentro de `receitaLiquida`). Denominador ainda é o VGV — a
   * permuta financeira já mora dentro dele, não muda o denominador.
   */
  resultadoMaisPermutaFinanceira: number;
  /** `resultadoMaisPermutaFinanceira / vgv * 100` — precisão plena (C7).
   * #604: `null` com VGV ≤ 0 — mesma base de `margemPct`, mesmo desfecho. */
  pctResultadoMaisPermutaFinanceira: number | null;
  /**
   * #427 — terceira leitura da EVI (`Premissas e Resultados!P35/R35`):
   * `resultadoMaisPermutaFinanceira` mais a permuta física (que nunca passou
   * pela receita — é só informativa). Aqui o denominador MUDA: soma a mesma
   * permuta física, porque ela também não estava no VGV.
   */
  resultadoMaisPermutas: number;
  /** `resultadoMaisPermutas / (vgv + permuta física) * 100` — precisão plena.
   * #604: `null` quando a base própria (`vgv + permuta física`) é ≤ 0. É uma
   * base DIFERENTE das outras duas: pode existir com o VGV zerado. */
  pctResultadoMaisPermutas: number | null;
  /**
   * Custo direto + custo indireto — a MESMA definição do Preliminar
   * (`proforma.ts`, `investimentoTotal = custoDiretoTotal + custoIndiretoTotal`).
   * Exposto porque a listagem precisa de ROI, e ROI sem denominador comum entre
   * os dois níveis compara coisas diferentes na mesma coluna.
   */
  investimentoTotal: number;
  /**
   * `resultado / investimentoTotal * 100` — de novo, literalmente a fórmula do
   * Preliminar. Não é indicador novo: é o mesmo indicador, calculado a partir das
   * séries do Avançado em vez dos campos fixos que ele não tem.
   *
   * #611 — `null` quando `investimentoTotal <= 0`: mesmo padrão que a #571
   * levou a `margemLiquidaPct`/`custoObrasVgvPct` no Preliminar, e que
   * `proforma.ts` já aplica ao `roiPct` gêmeo. A #604 (PR 647) deliberadamente
   * não tocou este campo — via um teste nomeado atribuindo-o a esta issue —
   * porque o denominador aqui é o investimento, não o VGV.
   */
  roiPct: number | null;
}

const soma = (serie: number[]): number => serie.reduce((s, v) => s + v, 0);
/** Contrato C7: todo valor monetário resultado de fórmula tem 2 casas. */
const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * #447: override LOCAL de rótulo, só para esta proforma — nunca edite
 * `GRUPO_CUSTO_LABEL` (`fluxo-tabela.ts:25`) para "consertar" isto, porque
 * esse mapa é compartilhado pela aba Fluxo de Caixa (`fluxo-tabela.ts`) e
 * pelo Resumo (`tela-resumo.ts`), e uma edição ali renomeia as duas.
 *
 * Aqui, e só aqui, "Custos Financeiros" ganha o parêntese porque esta
 * proforma é DESALAVANCADA (ver o cabeçalho do arquivo): o grupo vale
 * EXATAMENTE as linhas de custo que o usuário classificou como financeiras,
 * nunca o serviço da dívida do funding — que na aba Fluxo de Caixa está
 * incluído no mesmo rótulo, sem parêntese. Duas grandezas, dois rótulos.
 */
const ROTULO_PROFORMA: Partial<Record<string, string>> = {
  financeiro: 'Custos Financeiros (exclui serviço da dívida)',
};

/**
 * #447: linha do rodapé que avisa sobre o serviço da dívida do funding —
 * informativa, NUNCA somada em `resultado`/`investimentoTotal`. Existe fora
 * de `proformaAvancado` porque a função não recebe `funding` (arity travada
 * em teste pela #426); quem monta esta linha é a TELA
 * (`tela-fluxo-ver.ts`, que ainda tem `this.funding`) e a acrescenta ao final
 * de `p.linhas` antes de renderizar. `total` é `Σ funding.linhasSaida` — o
 * MESMO total que a aba Fluxo de Caixa soma dentro do subtotal do grupo
 * `financeiro` (`fluxo-tabela.ts`); aqui ele só é EXIBIDO, nunca somado.
 */
export function linhaInformativaFunding(totalSaidasFunding: number): LinhaProformaAv | null {
  if (Math.abs(totalSaidasFunding) < 0.005) return null;
  return {
    nome: 'Serviço da dívida do funding (informativo — efeito do funding: ver a aba Fluxo de Caixa)',
    valor: -totalSaidasFunding,
    nivel: 1,
    tipo: 'informativo',
  };
}

/**
 * #465: linha informativa da "Receita líquida de proforma" — a composição
 * da EVI (`Premissas e Resultados!P19` = Receita Bruta − imposto −
 * corretagem − marketing − permuta financeira), calculada por
 * `receitaLiquidaDeProformaMensal` (`fluxo-caixa-motor.ts`). Mesma técnica
 * de `linhaInformativaFunding` acima: existe FORA de `proformaAvancado`
 * porque a função não recebe `custosRaw` (só `linhasCusto`, sem
 * `categoria` — a arity é a mesma travada pela #426), então quem monta é a
 * TELA (`tela-fluxo-ver.ts`, que tem `d.custos`).
 *
 * `informativo`, nunca somada em `resultado` — é uma SEGUNDA leitura de
 * "receita líquida", ao lado de `= Receita líquida` (que continua sendo
 * `receitaMensal`, sem corretagem/marketing). Nenhum cálculo existente muda.
 */
export function linhaInformativaReceitaLiquidaEvi(receitaLiquidaEviTotal: number): LinhaProformaAv {
  return {
    nome: 'Receita líquida de proforma — composição EVI (informativo: imposto + corretagem + marketing + permuta financeira)',
    valor: receitaLiquidaEviTotal,
    nivel: 1,
    tipo: 'informativo',
  };
}

/**
 * Monta a proforma econômica do Avançado — sempre DESALAVANCADA.
 *
 * ⚠️ Não existe parâmetro de funding, e a ausência é deliberada (#426): o
 * conserto tirou o parâmetro em vez de ignorá-lo, para que reintroduzi-lo
 * exija mudar a assinatura e todos os call sites, em vez de bastar uma linha
 * esquecida. A arity está travada em teste.
 */
export function proformaAvancado(
  c: FluxoCalc,
  areaPrivativa: number,
): ProformaAvancado {
  const linhas: LinhaProformaAv[] = [];
  const receitaBruta = c.receitaBruta;
  const receitaLiquida = soma(c.receitaMensal);
  // Mesma ponte da tabela do fluxo (#349): a diferença entre bruta e líquida
  // é o RET mais a permuta financeira. Negativa, como toda dedução aqui.
  const deducoes = receitaLiquida - receitaBruta;

  linhas.push({ nome: 'Receita bruta (VGV)', valor: receitaBruta, nivel: 0, tipo: 'receita' });
  if (Math.abs(deducoes) > 0.005) {
    linhas.push({ nome: '(-) Impostos e deduções sobre a receita', valor: deducoes, nivel: 1, tipo: 'custo' });
  }
  linhas.push({ nome: '= Receita líquida', valor: receitaLiquida, nivel: 0, tipo: 'receita' });

  // Custo DIRETO = tudo que não é o grupo `indireto`. É a tradução da
  // segmentação da imagem (que põe Terreno, Construção, Gestão, Decoração,
  // Manutenção e Despesas Financeiras no direto, e só Marketing global e
  // Gestão/outros no indireto) para os 5 grupos que o Avançado modela.
  const linhasDoGrupo = (g: string) => c.linhasCusto.filter((x) => x.grupo === g);
  const totalDoGrupo = (g: string) => linhasDoGrupo(g).reduce((s, x) => s + x.total, 0);

  const diretos = GRUPOS_CUSTO.filter((g) => g !== 'indireto');
  let custoDireto = 0;
  for (const g of diretos) {
    const total = totalDoGrupo(g);
    const temLinha = linhasDoGrupo(g).length > 0;
    if (!temLinha) continue;
    custoDireto += total;
    linhas.push({ nome: `(-) ${ROTULO_PROFORMA[g] ?? GRUPO_CUSTO_LABEL[g]}`, valor: -total, nivel: 1, tipo: 'custo' });
  }
  linhas.push({ nome: '= Custo direto total', valor: -custoDireto, nivel: 0, tipo: 'custo' });

  const custoIndireto = totalDoGrupo('indireto');
  if (linhasDoGrupo('indireto').length > 0) {
    linhas.push({ nome: `(-) ${GRUPO_CUSTO_LABEL.indireto}`, valor: -custoIndireto, nivel: 1, tipo: 'custo' });
  }
  linhas.push({ nome: '= Custo indireto total', valor: -custoIndireto, nivel: 0, tipo: 'custo' });

  // #427 (achado do Codex, rodada 1): normaliza a 2 casas AQUI, antes de
  // derivar os outros dois fechos. `receitaLiquida`/`custoDireto`/
  // `custoIndireto` são somas de séries já round2'das mês a mês, mas somar
  // dezenas/centenas de valores de 2 casas em ponto flutuante ainda pode
  // deixar resíduo (`0.1 + 0.2 = 0.30000000000000004`). Sem este round2, a
  // 1ª linha (sem round2) e as duas linhas novas (com round2 explícito logo
  // abaixo) podiam divergir na última casa — quebrando o C7 na 1ª linha e a
  // igualdade exata que a degenerescência (permutas zeradas) promete.
  const resultado = round2(receitaLiquida - custoDireto - custoIndireto);

  // #427 — a EVI fecha com TRÊS leituras do mesmo projeto
  // (`Premissas e Resultados!K35/K37/K39`), cada uma com sua própria base:
  //   Resultado                  → resultado                          / VGV
  //   Resultado + Perm. Financ.  → resultado + permutaFinanceiraTotal  / VGV
  //   Resultado + Permutas       → (…) + vgvPermutaFisica              / (VGV + vgvPermutaFisica)
  // `permutaFinanceiraTotal` já vem ESTORNADO (positivo) do motor — somar,
  // não subtrair, é o mecanismo de `P37 = P39 − P15 − P16`. A permuta física
  // nunca passou pela receita, então soma no numerador E no denominador da
  // 3ª linha; a financeira já está dentro do VGV, então não muda a base.
  const resultadoMaisPermutaFinanceira = round2(resultado + c.permutaFinanceiraTotal);
  const resultadoMaisPermutas = round2(resultadoMaisPermutaFinanceira + c.vgvPermutaFisica);
  const baseComPermutaFisica = receitaBruta + c.vgvPermutaFisica;

  // #604 — denominador inválido devolve `null`, nunca 0. Mesmo mecanismo que a
  // #571 usou no Preliminar (`margemLiquidaPct`/`custoObrasVgvPct`/
  // `receitaLiquidaSobreVgvPct`): o motor distingue "mediu zero" de "não há
  // base para medir", e `fmtPctOuIndef` imprime "—". As três bases são
  // INDEPENDENTES — `baseComPermutaFisica` pode ser > 0 com a Receita Bruta
  // zerada, se houver permuta física —, então cada uma decide sozinha.
  const pctResultado = receitaBruta > 0 ? (resultado / receitaBruta) * 100 : null;
  const pctResultadoMaisPermutaFinanceira = receitaBruta > 0
    ? (resultadoMaisPermutaFinanceira / receitaBruta) * 100 : null;
  const pctResultadoMaisPermutas = baseComPermutaFisica > 0
    ? (resultadoMaisPermutas / baseComPermutaFisica) * 100 : null;

  // O rótulo/nota extra só aparece quando há permuta física — molde de
  // `K35` (rótulo condicional: "Resultado" & IF(OR(permutas≠0); " + Permutas"; ""))
  // e `K36` (nota de denominador gerada, também condicional à permuta física).
  // Com física E financeira zeradas as três linhas coincidem em valor e %, e
  // nem o rótulo nem a nota aparecem — degenerescência do critério de aceite 4.
  const temPermutaFisica = Math.abs(c.vgvPermutaFisica) > 0.005;

  linhas.push({ nome: '= Resultado', valor: resultado, nivel: 0, tipo: 'resultado', pctOverride: pctResultado });
  linhas.push({
    nome: '= Resultado + Perm. Financ.',
    valor: resultadoMaisPermutaFinanceira,
    nivel: 0,
    tipo: 'resultado',
    pctOverride: pctResultadoMaisPermutaFinanceira,
  });
  linhas.push({
    nome: temPermutaFisica ? '= Resultado + Permutas' : '= Resultado',
    valor: resultadoMaisPermutas,
    nivel: 0,
    tipo: 'resultado',
    pctOverride: pctResultadoMaisPermutas,
    ...(temPermutaFisica ? { notaBase: '1 / (VGV + Permutas Físicas)' } : {}),
  });

  const investimentoTotal = custoDireto + custoIndireto;

  return {
    linhas,
    vgv: receitaBruta,
    areaPrivativa,
    resultado,
    margemPct: pctResultado,
    resultadoMaisPermutaFinanceira,
    pctResultadoMaisPermutaFinanceira,
    resultadoMaisPermutas,
    pctResultadoMaisPermutas,
    investimentoTotal,
    // #611: denominador inválido devolve `null`, nunca 0 — mesmo mecanismo do
    // `roiPct` gêmeo em proforma.ts. A #604 (PR 647) deliberadamente não
    // tocou este campo, deixando-o para esta issue — ver o teste nomeado em
    // `frontend/proforma-avancado-vgv-zero.test.ts`, reescrito abaixo.
    roiPct: investimentoTotal > 0 ? (resultado / investimentoTotal) * 100 : null,
  };
}
