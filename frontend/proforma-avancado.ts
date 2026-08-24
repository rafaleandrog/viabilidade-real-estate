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
//      (`fluxo-caixa-motor.ts:2010-2101`), a partir de `fluxoMensal` /
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
//   | aba Fluxo de Caixa      | CAIXA       | AS DUAS PONTAS: a liberação   |
//   | (`fluxo-tabela.ts`,     |             | no bloco "Funding — Capital   |
//   |  bloco `funding-capital`|             | (entradas)" e o serviço da    |
//   |  + subtotal do grupo    |             | dívida dentro do subtotal do  |
//   |  `financeiro`)          |             | grupo `financeiro`            |
//   | aba Resultados / Painel | ECONÔMICA,  | NENHUMA PONTA                 |
//   | (esta função)           | antes de    |                               |
//   |                         | capitalizar |                               |
//   | aba Cenários, KPI       | ECONÔMICA   | SÓ O CUSTO: subtrai juros de  |
//   | "Resultado após custo   | menos o     | toda dívida + retorno de      |
//   | financeiro"             | custo de    | equity do resultado DESTA     |
//   | (`tela-cenarios.ts`     | capital     | função — nunca o principal    |
//   |  `:256-265`, `:363`)    |             |                               |
//
// A terceira linha é a que confunde: ela NÃO é uma variante desta função, é uma
// subtração feita depois, na tela de Cenários. Quem for reabrir o rótulo (#447)
// precisa das três, não das duas primeiras.
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
  tipo: 'receita' | 'custo' | 'resultado';
}

export interface ProformaAvancado {
  linhas: LinhaProformaAv[];
  /** Base de "% VGV" e do R$/m² — expostas para a tela não recalcular. */
  vgv: number;
  areaPrivativa: number;
  resultado: number;
  margemPct: number;
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
   */
  roiPct: number;
}

const soma = (serie: number[]): number => serie.reduce((s, v) => s + v, 0);

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
    linhas.push({ nome: `(-) ${GRUPO_CUSTO_LABEL[g]}`, valor: -total, nivel: 1, tipo: 'custo' });
  }
  linhas.push({ nome: '= Custo direto total', valor: -custoDireto, nivel: 0, tipo: 'custo' });

  const custoIndireto = totalDoGrupo('indireto');
  if (linhasDoGrupo('indireto').length > 0) {
    linhas.push({ nome: `(-) ${GRUPO_CUSTO_LABEL.indireto}`, valor: -custoIndireto, nivel: 1, tipo: 'custo' });
  }
  linhas.push({ nome: '= Custo indireto total', valor: -custoIndireto, nivel: 0, tipo: 'custo' });

  const resultado = receitaLiquida - custoDireto - custoIndireto;
  linhas.push({ nome: '= Resultado', valor: resultado, nivel: 0, tipo: 'resultado' });

  const investimentoTotal = custoDireto + custoIndireto;

  return {
    linhas,
    vgv: receitaBruta,
    areaPrivativa,
    resultado,
    margemPct: receitaBruta > 0 ? (resultado / receitaBruta) * 100 : 0,
    investimentoTotal,
    roiPct: investimentoTotal > 0 ? (resultado / investimentoTotal) * 100 : 0,
  };
}
