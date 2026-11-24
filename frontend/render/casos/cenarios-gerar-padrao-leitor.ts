// Caso de render: a mesma aba Cenários de `cenarios-gerar-padrao.ts`, vista
// por quem não pode escrever (leitor, ou editor com o estudo travado). O
// botão "Gerar otimista, base e pessimista" não aparece, pela mesma régua que
// esconde Salvar e Remover (#889). As colunas novas da tabela continuam.

import '../../tela-cenarios.js';
import { forcarEstado } from './dados.js';
import { PARAMS_TELA, medirGerarPadrao } from './cenarios-gerar-padrao.js';

export const caso = {
  nome: 'cenarios-gerar-padrao-leitor',
  exigir: [
    { seletor: 'table.cen', minimo: 1 },
    { seletor: 'table.cen tbody tr', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.interativo',
    'urbi-badge.cor',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-grafico-linha.categorias',
    'urbi-grafico-linha.formato',
    'urbi-grafico-linha.legenda',
    'urbi-grafico-linha.marcadores',
    'urbi-grafico-linha.minY',
    'urbi-grafico-linha.maxY',
    'urbi-grafico-linha.series',
    'urbi-icone.classe',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-cenarios');
    forcarEstado(el, { ...PARAMS_TELA, editavel: false });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  medir: medirGerarPadrao,
};
