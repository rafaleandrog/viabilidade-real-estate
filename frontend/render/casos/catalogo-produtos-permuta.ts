// Caso de render: permuta física POR PRODUTO — a coluna "Unidades permutadas" do
// catálogo de Produtos (`frontend/tela-premissas.ts:_linhaProduto`).
//
// Mede FIAÇÃO, não cálculo: `colunasProdutoTabela` e o motor podem estar certos
// e o template não desenhar a célula. Apagar o `case 'unidadesPermutadas'` do
// template derruba o `exigir` abaixo e deixa a suíte de lógica pura verde.
//
// O estado desabilitado da aba Permutas é medido em
// `permutas-permuta-por-produto.ts`: `medir()` roda ANTES do `exigir`, então
// trocar de sub-aba aqui apagaria a tabela que o `exigir` procura.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const PRODUTOS = [
  { id: 1, nome: 'Apto', ordem: 0, tipo: 'residencial', area_media_m2: 60, preco_venda_m2: 11_000, unidades: 40, unidades_permutadas: 4 },
  { id: 2, nome: 'Lojas', ordem: 1, tipo: 'nao_residencial', area_media_m2: 40, preco_venda_m2: 12_000, unidades: 10, unidades_permutadas: 0 },
];

export const caso = {
  nome: 'catalogo-produtos-permuta',
  exigir: [
    { seletor: 'table.prod', minimo: 1 },
    // A coluna: `<col>` do colgroup + uma célula editável por linha de produto.
    { seletor: 'colgroup col.p-uperm', minimo: 1 },
    { seletor: 'table.prod tbody td.num viab-num.u-permutadas', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-select.opcoes',
    'urbi-input.placeholder',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, tipo_empreendimento: 'incorporacao', area_pvt_r_fechada: 2400, area_pvt_nr_fechada: 400 },
      secao: 'produtos',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
