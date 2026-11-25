// Caso de render: o botão "Dossiê do projeto" na barra de controles do FLUXO DE CAIXA (Avançado), ao
// lado de CSV e PDF.
//
// Mesma razão de `dossie-botao-proforma`: o cálculo do dossiê está em funções puras testadas, e só a
// montagem em Chromium prova que `viab-fluxo-ver` chega a oferecer o botão. Apagar a linha do template
// (ou o `@click`) faz o seletor não casar e o harness rejeita a montagem.

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, fluxo, forcarEstado } from './dados.js';

export const SELETOR_DOSSIE = 'urbi-botao[data-acao="dossie"]';

export const caso = {
  nome: 'dossie-botao-fluxo',
  exigir: [
    { seletor: SELETOR_DOSSIE, minimo: 1 },
    { seletor: 'table.fx', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-ver');
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: fluxo(),
      vista: 'fluxo-caixa',
      visao: 'mensal',
      colapso: {},
      operacoes: [],
      fundingCalc: null,
      funding: null,
      divergencias: [],
      permutaFisica: [],
      dados: {
        receitas: RECEITAS, custos: CUSTOS, curvas: [], tipologias: [],
        crono: CRONO, dataInicio: DATA_INICIO, taxa: 12,
      },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;

    const botao = (el as any).shadowRoot?.querySelector(SELETOR_DOSSIE);
    if (botao?.textContent?.trim() !== 'Dossiê do projeto') {
      throw new Error(`o botão do dossiê diz "${botao?.textContent?.trim()}", e deveria dizer "Dossiê do projeto"`);
    }
  },
};
