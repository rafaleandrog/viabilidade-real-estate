// Caso de render: #573 — o ESTADO DE EXCESSO do indicador de área privativa
// alocada, aba "Produtos" da Incorporação
// (`frontend/tela-premissas.ts:_renderAreaAlocada`).
//
// A prova de que o AVISO está na tela (e não só o cálculo, testado em
// `proforma.test.ts`) só existe aqui: nenhum teste de lógica pura vê o DOM, e
// apagar `_renderAreaAlocada` do template deixaria a suíte de lógica pura
// inteira verde — mesma classe de defeito que `aproveitamento-coeficiente-
// excedido.ts` cobre para o indicador irmão (#569).

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

// ESTUDO base: área PVT residencial fechada 4.960 m² (registrada). O
// catálogo abaixo aloca 100 × 80 m² = 8.000 m² — 3.040 m² de excedente sobre
// os 4.960 m² registrados, largo o bastante para o estouro não depender de
// arredondamento.
const PRODUTOS_EXCEDENTE = [
  { id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 80, preco_venda_m2: 11_000, unidades: 100 },
];

export const caso = {
  nome: 'area-alocada-excedente',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.prod', minimo: 1 },
    // O indicador (3 `urbi-kpi`: alocada, registrada, diferença) continua
    // presente mesmo em excesso — só o aviso é que é condicional.
    { seletor: '.kpis.area-alocada', minimo: 1 },
    { seletor: '.kpis.area-alocada urbi-kpi', minimo: 3 },
    // A prova do critério 2 da #573: o AVISO na tela, não só
    // `diferencaAreaAlocada` no motor.
    { seletor: 'urbi-banner.aviso-area-alocada', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    // O `urbi-card` da aba (não tem título desenhado pelo stub) — mesma
    // natureza de `catalogo-produtos-tipo.ts`.
    'urbi-card.titulo',
    // Célula "Nome" do catálogo (`urbi-input placeholder="Ex.: Lote"`) e
    // célula "Tipo" (`urbi-select .opcoes=`, binding de PROPRIEDADE — o Lit
    // nem escreve atributo) — mesma natureza de `catalogo-produtos-tipo.ts`.
    'urbi-input.placeholder',
    'urbi-select.opcoes',
    // Botão "Remover" de cada linha (`pequeno`) e "Adicionar Produto`
    // (`icone`) — mesma natureza de `catalogo-produtos-tipo.ts`.
    'urbi-botao.pequeno',
    'urbi-botao.icone',
    'urbi-botao.variante',
    // Os 3 `urbi-kpi` do indicador ligam `variante` (o 3º vira "erro" em
    // excesso) — mesma natureza de `aproveitamento-coeficiente-excedido.ts`.
    // E o `urbi-banner` do aviso liga `variante="erro"` — mesma natureza.
    'urbi-kpi.variante',
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` roda no `connectedCallback`, é assíncrono e escreve por cima do
    // estado forçado — a resposta precisa trazer as MESMAS linhas, senão este
    // caso mediria o catálogo default do stub em vez do que se quer medir.
    // Mesmo padrão de `catalogo-produtos-tipo.ts`.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_EXCEDENTE };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, tipo_empreendimento: 'incorporacao' },
      secao: 'produtos',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS_EXCEDENTE,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
