// Caso de render: a EDIÇÃO de unidades e de unidades permutadas no catálogo de
// Produtos (`frontend/tela-premissas.ts:_linhaProduto`).
//
// Mede FIAÇÃO: `dadosEdicaoUnidades` e `dadosEdicaoUnidadesPermutadas` são puras
// e testadas, mas o que vai para a API é o que o handler do template passa. Trocar
// o handler de Unidades por `{ unidades: valor }` (sem levar as permutadas) ou o de
// Permutadas por `{ unidades_permutadas: valor }` (sem o teto) deixa a suíte de
// lógica pura verde e derruba a `medir()` lida pelo teste.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const PRODUTOS = [
  { id: 1, nome: 'Apto', ordem: 0, tipo: 'residencial', area_media_m2: 60, preco_venda_m2: 11_000, unidades: 40, unidades_permutadas: 4 },
];

export interface MedidaEdicaoPermuta {
  /** Corpos dos PATCH enviados, na ordem. */
  patches: Array<Record<string, any>>;
}

export const caso = {
  nome: 'catalogo-produtos-permuta-edicao',
  exigir: [
    { seletor: 'table.prod tbody td.num viab-num.u-permutadas', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.ariaLabel',
    'urbi-card.titulo',
    'urbi-select.opcoes',
    'urbi-input.placeholder',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-kpi.variante',
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const patches: Array<Record<string, any>> = [];
    (globalThis as any).__patchesProdutos = patches;
    (globalThis as any).urbiVerso.api = async (rota: string, opcoes?: any) => {
      if (rota.includes('/preliminar/produtos')) {
        if (opcoes?.method === 'PATCH') { patches.push(JSON.parse(opcoes.body)); return {}; }
        return { dados: PRODUTOS };
      }
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, tipo_empreendimento: 'incorporacao', area_pvt_r_fechada: 2400, area_pvt_nr_fechada: 400 },
      secao: 'produtos',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS.map((p) => ({ ...p })),
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<MedidaEdicaoPermuta> {
    const tela = raiz.querySelector('viab-tela-premissas')! as any;
    const linha = () => tela.shadowRoot!.querySelector('table.prod tbody tr') as HTMLElement;
    const digitar = async (seletor: string, valor: number | null) => {
      linha().querySelector(seletor)!.dispatchEvent(
        new CustomEvent('urbi:input-numero-change', { detail: { valor }, bubbles: true, composed: true }));
      await tela.updateComplete;
      await new Promise((r) => setTimeout(r, 0));
    };
    // `unidades` 40 → 3, abaixo das 4 permutadas: as permutadas descem junto.
    await digitar('td.num viab-num:not(.u-permutadas)[casas-decimais="0"]', 3);
    // Permutadas 99, acima das 3 unidades que sobraram: cortadas no teto.
    await digitar('viab-num.u-permutadas', 99);
    return { patches: (globalThis as any).__patchesProdutos };
  },
};
