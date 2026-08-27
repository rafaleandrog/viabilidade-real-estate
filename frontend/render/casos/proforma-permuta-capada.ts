// Caso de render: o aviso de excedente de permuta física na Proforma.
//
// Este caso mede FIAÇÃO, não cálculo. `permutaCapada` sair do motor não obriga
// `tela-proforma.ts` a mostrar nada: apagar `_renderAvisoPermuta` do template
// deixa a suíte de lógica pura inteira verde — nenhum teste dela monta a tela —
// e a Proforma volta a exibir VGV zero sem dizer por quê, que é a metade do
// defeito que a correção do cap não resolve sozinha. O `exigir` de
// `urbi-banner.aviso-permuta` é a prova de que o aviso está na tela.
//
// O estudo tem catálogo pequeno e uma permuta física em m² ABSOLUTOS, muito
// maior que a área do catálogo: a permuta pedida vale mais que a base, o motor
// capa o excedente e o VGV residencial para em zero.
//
// ⚠️ O modo tem que ser `area_m2`. Desde a #570 o modo "% área venda" incide
// sobre a área do catálogo da categoria e é valorado pelo preço médio dela, de
// modo que 100% vale exatamente o VGV bruto da categoria — nunca mais que ele.
// Um caso em `pct_area_venda: 100` deixaria de capar, o banner sumiria e o
// `exigir` abaixo reprovaria por um motivo que não é o que se quer medir aqui.

import '../../tela-proforma.js';
import { ESTUDO, forcarEstado } from './dados.js';

// Base de R$ 6.820.000 (10 unidades) contra uma permuta de 4.960 m² ×
// R$ 11.000 = R$ 54.560.000 — excedente largo, para o cap não depender de
// arredondamento.
const PRODUTOS_PEQUENOS = [
  { id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 62, preco_venda_m2: 11_000, unidades: 10 },
];

const ESTUDO_COM_PERMUTA = {
  ...ESTUDO,
  permuta_fisica_modo: 'area_m2',
  permuta_fisica_area_m2: 4_960, // 8× os 620 m² do catálogo
};

export const caso = {
  nome: 'proforma-permuta-capada',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo".
  exigir: [
    { seletor: 'urbi-banner.aviso-permuta', minimo: 1 },
    { seletor: 'table.pf', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. O harness confronta nos dois sentidos (usada e não declarada → falha;
  // declarada e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` roda no `connectedCallback`, é assíncrono e ESCREVE POR CIMA do
    // estado forçado: com o `{ dados: [] }` default do espelho o catálogo
    // voltaria a vazio depois da montagem e a tela cairia no estado vazio, sem
    // aviso nenhum. Mutação do MESMO objeto `urbiVerso` que o script clássico
    // do harness define.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_PEQUENOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO_COM_PERMUTA, secao: 'proforma', benchmarks: [],
      produtos: PRODUTOS_PEQUENOS, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
