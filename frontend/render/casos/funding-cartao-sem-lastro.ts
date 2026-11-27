// Caso de render: o CARTÃO de uma antecipação de recebíveis SEM LASTRO.
//
// A cessão no mês 0, antes de qualquer venda, não tem parcela a ceder: o motor
// devolve valor de face zero, e o cartão troca os números da cessão por "—" e
// mostra o aviso de que não há o que ceder, abaixo da grade de KPIs. O conteúdo
// do cartão é testado como função pura (`funding-cartao-dados.test.ts`); este
// caso prova que a tela de verdade chega a esse estado e o desenha: a grade
// continua com quatro KPIs (os dois da cessão em "—"), e o aviso vem depois
// dela, sem sobrepor nada.

import '../../tela-funding.js';
import { estadoFundingCarregado, forcarEstado } from './dados.js';

const ANTECIPACAO = {
  id: 40, ordem: 0, tipo: 'antecipacao_recebiveis', nome: 'Cessão sem lastro',
  inicio_mes: 0, cronograma_evento: 'customizado', pct_carteira_cedida: 50, taxa_anual: 18,
} as any;

export const caso = {
  nome: 'funding-cartao-sem-lastro',
  exigir: [
    { seletor: 'viab-funding-cartao', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-badge.cor',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-funding') as any;
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado' }, // sem `id` — `updated()` não carrega sozinho
      carregando: false,
      ...estadoFundingCarregado([ANTECIPACAO]),
      editavel: false,
    });
    raiz.appendChild(el);
    await el.updateComplete;
    el._recalcular();
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  },
  async medir(raiz: HTMLElement) {
    const tela = raiz.querySelector('viab-funding') as any;
    const cartao = tela.shadowRoot.querySelector('viab-funding-cartao') as any;
    await cartao.updateComplete;
    const r = cartao.shadowRoot as ShadowRoot;
    const kpis = [...r.querySelectorAll('div.kpis div.kpi')].map((k) => ({
      rotulo: k.querySelector('.rot')?.textContent?.trim() ?? '',
      valor: k.querySelector('.val')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    }));
    const grade = (r.querySelector('div.kpis') as HTMLElement).getBoundingClientRect();
    const aviso = r.querySelector('p.aviso') as HTMLElement | null;
    const caixaAviso = aviso?.getBoundingClientRect();
    return {
      kpis,
      aviso: aviso?.textContent?.trim() ?? null,
      avisoAbaixoDaGrade: caixaAviso ? caixaAviso.top >= grade.bottom - 0.5 : false,
    };
  },
};
