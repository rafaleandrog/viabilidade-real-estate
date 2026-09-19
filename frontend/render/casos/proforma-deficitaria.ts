// Caso de render: a Proforma de um estudo DEFICITÁRIO — custo do terreno tão
// acima do VGV que a Receita operacional e o Resultado saem negativos.
//
// #567: este caso mede FIAÇÃO, não cálculo. `calcularProforma` devolver
// `receitaOperacional`/`resultado` negativos não obriga `tela-proforma.ts` a
// MOSTRAR o sinal — o bug original (`_fmtContabil` chamando `Math.abs` sem
// condição para toda linha de receita) deixava a suíte de lógica pura inteira
// verde, porque nenhum teste dela monta a tela: o próprio `celulaProforma`
// isolado prova a regra de sinal, mas não prova que `_renderTabela` ainda o
// chama. O `exigir` de `td.neg` na linha "Receita operacional" é a prova —
// sem a ligação, o seletor não casa nada e o harness rejeita a montagem.
//
// O estudo é o `ESTUDO` de referência (incorporação) com um catálogo pequeno
// (mesmo VGV de `proforma-permuta-capada.ts`, R$ 6.820.000) e o custo do
// terreno inflado para R$ 50.000/m² — R$ 240.000.000 numa gleba de 4.800 m²,
// bem acima da receita líquida. Não é caso de borda por arredondamento: é
// deficit por mais de uma ordem de grandeza, para não depender de precisão.

import '../../tela-proforma.js';
import { ESTUDO, forcarEstado } from './dados.js';

const PRODUTOS_PEQUENOS = [
  { id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 62, preco_venda_m2: 11_000, unidades: 10 },
];

const ESTUDO_DEFICITARIO = {
  ...ESTUDO,
  custo_terreno_m2: 50_000,
};

export const caso = {
  nome: 'proforma-deficitaria',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele.
  exigir: [
    { seletor: 'table.pf', minimo: 1 },
    // "= Receita operacional" (tipo consolidado, natureza receita) negativa:
    // antes da #567 saía sempre em módulo, sem a classe `neg` — o verde fixo
    // de `.nat-receita` continuava por cima, como se fosse receita positiva.
    { seletor: 'tr.consolidado.nat-receita td.neg', minimo: 1 },
    // "= Resultado" negativo — já funcionava antes da #567 (guarda de
    // regressão: a mesma classe, agora computada por `ehLinhaReceitaOuResultado`
    // em vez de comparar só `tipo === 'resultado'`).
    { seletor: 'tr.resultado td.neg', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. O harness confronta nos dois sentidos (usada e não declarada → falha;
  // declarada e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` roda no `connectedCallback`, é assíncrono e escreve por cima
    // do estado forçado — a resposta precisa trazer o MESMO catálogo pequeno.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_PEQUENOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO_DEFICITARIO, secao: 'proforma', benchmarks: [],
      produtos: PRODUTOS_PEQUENOS, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  // #754: a sonda de DOM contra REALOCAÇÃO — a trava `proforma-inteiros.test.ts`
  // conta chamadas de `celulaInteira(` por arquivo, e contagem não vê a chamada
  // movida para um ponto morto com a célula devolvida a `fmtR$` (mesmo limite
  // que `cascata-milhoes.test.ts` documenta e fecha com a sonda de
  // `casos/grafico-cascata.ts`). Só o texto publicado na tela responde isso:
  // toda célula da coluna R$ tem de sair SEM centavos.
  async medir(raiz: HTMLElement): Promise<{ celulasRs: number; comCentavos: string[] }> {
    const tela = raiz.querySelector('viab-tela-proforma')! as any;
    // A linha da `table.pf` tem CINCO células: toggle+nome, memo (`.desc`), R$,
    // R$/m², % VGV — a coluna R$ é a TERCEIRA. A primeira versão desta sonda lia
    // a segunda (o memo) e ficava verde para sempre: bloqueante da rodada 2.
    const textos = [...tela.shadowRoot!.querySelectorAll('table.pf tr td:nth-child(3)')]
      .map((td) => ((td as HTMLElement).textContent ?? '').trim())
      .filter((t) => /\d/.test(t));
    return { celulasRs: textos.length, comCentavos: textos.filter((t) => /\d,\d{2}\)?$/.test(t)) };
  },
};
