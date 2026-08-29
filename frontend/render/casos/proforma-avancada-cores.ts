// Caso de render: a Proforma do AVANÇADO com cor por natureza de linha (#593),
// num estudo DEFICITÁRIO — para que `pos` e `neg` apareçam no mesmo caso.
//
// ⚠️ O QUE ESTE CASO MEDE, E O QUE ELE NÃO MEDE. Ele mede a FIAÇÃO: que as
// classes que o CSS da #593 seleciona chegam mesmo ao DOM da tela montada.
// `receita`, `custo`, `resultado` e `informativo` já vinham no `<tr>` antes
// desta issue; o que é NOVO é `pos`/`neg` na célula numérica, e é por isso que
// os dois `exigir` de `td.pos`/`td.neg` são a prova: apagar
// `class="num ${sinal}"` em `_renderProforma` faz os dois seletores não
// casarem nada, e o harness REJEITA a montagem em vez de reportar "limpo" para
// uma tabela que perdeu a marca de sinal. Nenhum teste de lógica pura pega
// isso — `sinalLinhaProformaAv` continua correta e testada com a chamada
// apagada.
//
// O que este caso NÃO mede é se as REGRAS de CSS existem: o harness expõe
// presença de seletor e as lentes de layout/tema, não o estilo computado de um
// seletor arbitrário. Quem prova que as declarações existem — e que são as
// MESMAS do Preliminar, token a token e proporção a proporção — é
// `frontend/proforma-cores.test.ts`, que confronta os dois arquivos entre si.
// As duas camadas são complementares: apagar o CSS deixa aquele teste
// vermelho, apagar a fiação deixa este caso vermelho.
//
// Por que DEFICITÁRIO: num estudo saudável só existiria `td.pos`, e a metade
// `neg` do conserto ficaria sem medida. Aqui a receita continua positiva
// (`td.pos` nas linhas de receita) e o resultado sai negativo (`td.neg`), como
// no caso irmão `proforma-deficitaria.ts` do Preliminar (#567). O custo do
// terreno vai a R$ 240.000.000 numa gleba de 4.800 m² contra um VGV de
// R$ 54.560.000 — deficit por mais de uma ordem de grandeza, não caso de borda
// por arredondamento.

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, forcarEstado } from './dados.js';
import { calcularFluxo } from '../../fluxo-caixa-motor.js';

const CUSTOS_DEFICITARIOS = CUSTOS.map((c) => (
  c.grupo === 'terreno' ? { ...c, orcamento_valor: 240_000_000 } : c
));

export const caso = {
  nome: 'proforma-avancada-cores',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.proforma', minimo: 1 },
    // As quatro naturezas que a #593 passou a distinguir. `receita` são duas
    // linhas ("Receita bruta (VGV)" e "= Receita líquida"); `n0.custo` são os
    // dois subtotais ("= Custo direto total", "= Custo indireto total").
    { seletor: 'tr.receita', minimo: 2 },
    { seletor: 'tr.n1.custo', minimo: 1 },
    { seletor: 'tr.n0.custo', minimo: 2 },
    { seletor: 'tr.resultado', minimo: 1 },
    { seletor: 'tr.informativo', minimo: 1 },
    // A PROVA DE FIAÇÃO da #593 — as duas metades do sinal, no mesmo caso.
    { seletor: 'tr.receita td.pos', minimo: 1 },
    { seletor: 'tr.resultado td.neg', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim. O harness
  // confronta nos dois sentidos (usada e não declarada → falha; declarada e sem
  // uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const c = calcularFluxo({
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      cronograma: CRONO,
      linhasReceita: RECEITAS,
      linhasCusto: CUSTOS_DEFICITARIOS,
      curvas: [],
      areaTerreno: 4_800,
      ret: { ativo: true, pct: 4 },
    });
    const el = document.createElement('viab-fluxo-ver');
    // `estudo` fica de fora de propósito: é o que impede `updated()` de disparar
    // o carregamento por API. O estado já calculado entra aqui.
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: c,
      vista: 'proforma',
      visao: 'mensal',
      colapso: {},
      operacoes: [],
      fundingCalc: null,
      funding: null,
      divergencias: [],
      permutaFisica: [],
      dados: {
        receitas: RECEITAS, custos: CUSTOS_DEFICITARIOS, curvas: [], tipologias: [],
        crono: CRONO, dataInicio: DATA_INICIO, taxa: 12,
      },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
