// Caso de render: o AVISO de submissão da aba "Produtos" da Incorporação
// (`frontend/tela-premissas.ts:_renderAvisoSubmissaoProdutos`) — produto com 0
// unidades, que o motor descarta do VGV em silêncio e que a submissão recusa.
//
// A regra é pura e testada em `produtos-submissao.test.ts`, e o portão do servidor em
// `backend/rotas/submissao-produtos-rota.test.ts`; nenhum dos dois vê o DOM, e
// apagar a chamada do template deixaria as duas suítes verdes.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

// A soma fecha 100% (o banner da soma NÃO aparece): o único aviso possível é o
// do produto sem VGV.
const PRODUTOS_SEM_VGV = [
  { id: 1, nome: 'Torre A', ordem: 0, pct_alv: 60, preco_venda_m2: 11_000, unidades: 50 },
  { id: 2, nome: 'Torre B', ordem: 1, pct_alv: 40, preco_venda_m2: 11_000, unidades: 0 },
];

export const caso = {
  nome: 'produto-sem-vgv-aviso',
  exigir: [
    { seletor: 'table.prod', minimo: 1 },
    { seletor: 'urbi-banner.aviso-submissao-produtos', minimo: 1 },
  ],
  // Mesma lista, e pela mesma natureza, de `area-alocada-excedente.ts`.
  aceitaNaoReproduzido: [
    'urbi-botao.ariaLabel',
    'urbi-card.titulo',
    'urbi-input.placeholder',
    'urbi-select.opcoes',
    'urbi-botao.pequeno',
    'urbi-botao.icone',
    'urbi-botao.variante',
    'urbi-kpi.variante',
    // O aviso liga `variante="alerta"`.
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_SEM_VGV };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, tipo_empreendimento: 'incorporacao' },
      secao: 'produtos',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS_SEM_VGV,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
