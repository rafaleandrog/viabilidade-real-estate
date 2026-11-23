// Caso de render: permuta física POR PRODUTO na aba Permutas — o campo por área
// da categoria cuja permuta vem do catálogo sai DESABILITADO, com o aviso
// (`frontend/tela-premissas.ts:_renderAvisoPermutaPorProduto`); o da outra
// categoria continua habilitado. Incorporação: residencial com unidades
// permutadas, não residencial sem. A coluna do catálogo é medida em
// `catalogo-produtos-permuta.ts`.
//
// Mede FIAÇÃO: apagar o `dis || permutaProd…` do template deixa a lógica pura
// verde e derruba a `medir()` lida pelo teste.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const PRODUTOS = [
  { id: 1, nome: 'Apto', ordem: 0, tipo: 'residencial', area_media_m2: 60, preco_venda_m2: 11_000, unidades: 40, unidades_permutadas: 4 },
  { id: 2, nome: 'Lojas', ordem: 1, tipo: 'nao_residencial', area_media_m2: 40, preco_venda_m2: 12_000, unidades: 10, unidades_permutadas: 0 },
];

export interface MedidaPermutaProduto {
  camposPermutaFisica: number;
  desabilitadosResidencial: boolean;
  desabilitadosNaoResidencial: boolean;
  avisos: number;
  textoAviso: string;
}

export const caso = {
  nome: 'permutas-permuta-por-produto',
  exigir: [
    { seletor: 'div.campo-unidade', minimo: 4 },
    { seletor: 'urbi-banner.aviso-permuta-produto', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.interativo',
    'urbi-badge.ativo', 'urbi-badge.cor', 'urbi-botao.variante', 'urbi-card.titulo',
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, tipo_empreendimento: 'incorporacao', area_pvt_r_fechada: 2400, area_pvt_nr_fechada: 400 },
      secao: 'permutas',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<MedidaPermutaProduto> {
    const tela = raiz.querySelector('viab-tela-premissas')! as any;
    const campos = [...tela.shadowRoot!.querySelectorAll('div.campo-unidade')] as HTMLElement[];
    const fisicos = campos.filter((c) => c.querySelector('.cu-rotulo')?.textContent?.includes('Permuta física'));
    // Rótulo EXATO: "Permuta física residencial" está contido em "…não residencial".
    const desab = (rotulo: string): boolean => {
      const c = fisicos.find((x) => (x.querySelector('.cu-rotulo')?.textContent ?? '').replace('*', '').trim() === rotulo)!;
      return c.querySelector('viab-num.cu-valor')!.hasAttribute('desabilitado');
    };
    const avisos = [...tela.shadowRoot!.querySelectorAll('urbi-banner.aviso-permuta-produto')] as HTMLElement[];
    return {
      camposPermutaFisica: fisicos.length,
      desabilitadosResidencial: desab('Permuta física residencial'),
      desabilitadosNaoResidencial: desab('Permuta física não residencial'),
      avisos: avisos.length,
      textoAviso: avisos[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  },
};
