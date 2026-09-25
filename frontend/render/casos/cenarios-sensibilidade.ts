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
    // As duas tabelas da sensibilidade (monetária e indicadores) e o seletor
    // de PASSO (±5/±10/±15) — o único `urbi-select` que sobra depois do #729:
    // o dropdown de variável estressada morreu, substituído pelo tornado.
    { seletor: 'table.pf.sens', minimo: 2 },
    { seletor: 'urbi-select', minimo: 1 },
    // Rodada 13 (#729): a prova de que o TORNADO é quem seleciona a variável
    // agora, não mais o dropdown — o componente monta com 5 alavancas.
    { seletor: 'viab-grafico-tornado', minimo: 1 },
    // Rodada 13 (#733): o bloco "Margem de segurança", 4 cartões.
    { seletor: 'div.margem-cartao', minimo: 4 },
    // 8 linhas monetárias × 3 cenários (2026-09-14: "Deduções sobre VGV" — a
    // MESMA linha da Proforma — entrou entre "Receita bruta" e "Receita
    // líquida", eram 7): as células com a cor do cenário. Se o `style` inline
    // voltar no lugar das classes `cen-*`, a marca de negativo deixa de
    // conseguir sobrepô-lo — e este seletor cai junto.
    { seletor: 'table.pf.sens td.num.cen-base', minimo: 8 },
    { seletor: 'table.pf.sens td.num.cen-bear', minimo: 8 },
    { seletor: 'table.pf.sens td.num.cen-bull', minimo: 8 },
    // A PROVA DE FIAÇÃO: o Resultado negativo que só o Bear produz, e só se o
    // fator de stress tiver alcançado o catálogo de Produtos. O caso força
    // `_varSensManual: 'preco'` (abaixo) para este teste continuar
    // determinístico — sem isso, a seleção seguiria "a maior amplitude do
    // ranking", que É medida (o fixture tem outras alavancas com efeito real:
    // `custo_obras` via `custo_construcao_m2` e `custo_indireto` via
    // `marketing_global_pct`/`gestao_indiretos_pct` — achado da lente L2, PR
    // #757) e portanto sujeita a mudar de variável a cada edição do motor ou
    // do fixture, sem que ninguém precise tocar este arquivo. Fixar a
    // variável é o que faz a prova (o fator alcança o catálogo) resistir a
    // essas edições futuras.
    { seletor: 'table.pf.sens td.num.cen-bear.neg', minimo: 1 },
    // ...e as 5 linhas de receita do Base continuam positivas (as 3 de despesa
    // — Custo direto total, Custo indireto total e, desde 2026-09-14,
    // Deduções sobre VGV — não ganham classe de sinal, igual à tabela
    // principal): se algum cenário "vazasse" para os outros, esta linha e a
    // de cima não poderiam valer juntas.
    { seletor: 'table.pf.sens td.num.cen-base.pos', minimo: 5 },
    // Badges: 3 no cabeçalho de cada tabela + 2 linhas de indicador × 3.
    { seletor: 'urbi-badge', minimo: 12 },
    // #730: sete colunas (rótulo, Bear, Δ%, Base, Bull, Δ%, amplitude) nas
    // duas tabelas, o Δ% de cada lado em toda linha e a coluna de amplitude
    // ordenável. Estressando o PREÇO tudo se move: nenhum grupo recolhido.
    { seletor: 'table.pf.sens colgroup col', minimo: 14 },
    { seletor: 'table.pf.sens th.delta', minimo: 4 },
    { seletor: 'table.pf.sens td.delta', minimo: 20 },
    { seletor: 'table.pf.sens th.amplitude[aria-sort] button.ordenar', minimo: 1 },
    { seletor: 'table.pf.sens td.amplitude', minimo: 10 },
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
    // kpis-resumo.ts e grupo-badge-legado.ts. Hoje é só o seletor de PASSO
    // (±5/±10/±15) — o de variável estressada morreu com o #729.
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
    // `_varSensManual: 'preco'` fixa a seleção — ver o comentário acima do
    // seletor `cen-bear.neg`.
    forcarEstado(el, {
      estudo: ESTUDO_SENSIBILIDADE, secao: 'cenarios', benchmarks: [],
      produtos: PRODUTOS_SENSIBILIDADE, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    // #730: `_init()` (connectedCallback) zera `_varSensManual` depois de dois
    // `await`, então forçá-la ANTES de montar não sobrevivia — o caso só
    // passava porque o preço também é a alavanca de maior amplitude no
    // ranking. Espera o assentamento e seleciona, como o clique no tornado.
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
    (el as any)._varSensManual = 'preco';
    await (el as any).updateComplete;
  },
};
