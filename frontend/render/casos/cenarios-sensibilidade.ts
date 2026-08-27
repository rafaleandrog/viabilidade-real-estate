// Caso de render: a sub-aba CENÁRIOS (análise de sensibilidade) do Preliminar.
//
// #568: este caso mede FIAÇÃO, não cálculo. `calcularProforma` reprecificar o
// catálogo pelo fator de stress não obriga `_renderSensibilidade` a PASSAR o
// fator — e essa era exatamente a metade do bug que teste de lógica pura não
// enxerga: `_aplicarFator` podia parar de montar o `sensibilidade` (ou montá-lo
// com fator 1) e a suíte inteira ficaria verde, com os três cenários idênticos
// na tela.
//
// A prova é `td.num.neg`: no fixture (`frontend/fixtures/sensibilidade-catalogo.ts`)
// só o cenário BEAR fecha com Resultado negativo — R$ −598.646,51, contra
// +R$ 1.475.348,32 do Base. Se o fator não chega ao catálogo, os três cenários
// viram o Base, nenhuma célula é negativa, o seletor não casa nada e o harness
// REJEITA a montagem. É também a única camada que enxerga a classe `neg`
// sobrepondo a cor do cenário, que é CSS e não existe fora do navegador.
//
// Não havia caso nenhum desta sub-aba antes desta issue — `secao: 'cenarios'`
// nunca tinha sido montado em Chromium.

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';
import { ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE } from '../../fixtures/sensibilidade-catalogo.js';

export const caso = {
  nome: 'cenarios-sensibilidade',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele.
  exigir: [
    // As duas tabelas da sensibilidade (monetária e indicadores) e o seletor da
    // variável estressada — a prova de que a sub-aba montada é esta.
    { seletor: 'table.pf.sens', minimo: 2 },
    { seletor: 'urbi-select', minimo: 1 },
    // 7 linhas monetárias × 3 cenários: as células com a cor do cenário. Se o
    // `style` inline voltar no lugar das classes `cen-*`, a marca de negativo
    // deixa de conseguir sobrepô-lo — e este seletor cai junto.
    { seletor: 'table.pf.sens td.num.cen-base', minimo: 7 },
    { seletor: 'table.pf.sens td.num.cen-bear', minimo: 7 },
    { seletor: 'table.pf.sens td.num.cen-bull', minimo: 7 },
    // A PROVA DE FIAÇÃO: o Resultado negativo que só o Bear produz, e só se o
    // fator de stress tiver alcançado o catálogo de Produtos.
    { seletor: 'table.pf.sens td.num.cen-bear.neg', minimo: 1 },
    // ...e as 5 linhas de receita do Base continuam positivas (as 2 de despesa
    // não ganham classe de sinal, igual à tabela principal): se algum cenário
    // "vazasse" para os outros, esta linha e a de cima não poderiam valer
    // juntas.
    { seletor: 'table.pf.sens td.num.cen-base.pos', minimo: 5 },
    // Badges: 3 no cabeçalho de cada tabela + 2 linhas de indicador × 3.
    { seletor: 'urbi-badge', minimo: 12 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. O harness confronta nos dois sentidos (usada e não declarada → falha;
  // declarada e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    // A cor do badge (perigo/sucesso/info por cenário) não é reproduzida pelo
    // stub — mesma declaração de medidores-resumo.ts e modal-absorcao.ts. O que
    // este caso mede é a cor das CÉLULAS monetárias, que vem do CSS da própria
    // tela (classes `cen-*`/`neg`) e não do primitivo.
    'urbi-badge.cor',
    // Binding de PROPRIEDADE (o Lit nem escreve atributo); o stub não desenha
    // opção nenhuma — mesma natureza documentada em modal-pagamento.ts,
    // kpis-resumo.ts e grupo-badge-legado.ts. O seletor de variável estressada
    // fica, portanto, mais estreito e mais baixo aqui do que na tela real: as
    // duas tabelas medidas abaixo dele não dependem dessa altura.
    'urbi-select.label',
    'urbi-select.opcoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` roda no `connectedCallback`, é assíncrono e ESCREVE POR CIMA do
    // estado forçado: com o `{ dados: [] }` default do espelho o catálogo
    // voltaria a vazio depois da montagem e o VGV iria a zero nos três
    // cenários — o caso passaria a medir outra coisa.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_SENSIBILIDADE };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    // `benchmarks: []` de propósito: sem indicador de sensibilidade o
    // componente cai no fallback de ±10%, que é o que o fixture documenta.
    forcarEstado(el, {
      estudo: ESTUDO_SENSIBILIDADE, secao: 'cenarios', benchmarks: [],
      produtos: PRODUTOS_SENSIBILIDADE, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
