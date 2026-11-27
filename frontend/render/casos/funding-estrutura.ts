// Caso de render: a aba Estrutura de capital do Funding, montada pela TELA.
//
// ⚠️ O que este caso existe para pegar, e o teste de unidade não pega — a
// FIAÇÃO (classe de defeito nº 1 do `CLAUDE.md`):
//   · a aba monta `viab-grafico-stack-capital` (apagar a montagem tira
//     `viab-grafico-stack-capital` e as camadas, e o `exigir` reprova);
//   · a torre recebe as camadas da aba (apagar `.camadas=` deixa a torre vazia:
//     "Nenhuma camada com valor." e nenhuma `div.camada`);
//   · as camadas saem na ordem de senioridade, com o Financiamento à produção
//     na BASE — `medir()` devolve a ordem do DOM e a vertical, e o teste exige
//     as duas;
//   · a tabela da sequência repete, LETRA POR LETRA, o "depois" que cada cartão
//     da aba Operações mostra (o stub de `urbi-abas` monta as abas juntas, então
//     os cartões e a tabela estão no mesmo DOM). O stub de `urbi-tabela` não
//     desenha célula: `medir()` desenha as células com as próprias colunas que
//     a tela passou, sobre as linhas que ela passou.

import { render } from 'lit';
import '../../tela-funding.js';
import type { OperacaoFunding } from '../../funding-motor.js';
import { estadoFundingCarregado, forcarEstado } from './dados.js';
import { medirStack } from './medir-stack.js';

const OPERACOES: (OperacaoFunding & { id: number; ordem: number })[] = [
  {
    id: 1, ordem: 0, tipo: 'divida', nome: 'Crédito de terreno com um nome bem comprido para truncar na camada',
    valor: 5_000_000, inicio_mes: 0, distribuir_aporte: true, aporte_meses: 3,
    taxa_anual: 20, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12,
  } as any,
  {
    id: 2, ordem: 1, tipo: 'financiamento_producao', nome: 'Financiamento à produção',
    taxa_anual: 12.5, exposicao_minima: 20, percentual_financiavel: 80,
    amortizar_com_caixa_disponivel: true, ativo: true,
  } as any,
  {
    id: 3, ordem: 2, tipo: 'equity', nome: 'Investidor',
    valor: 3_000_000, inicio_mes: 0, modo_retorno: 'permuta_financeira', pct_retorno: 15,
  } as any,
];

export const caso = {
  nome: 'funding-estrutura',
  exigir: [
    { seletor: 'viab-grafico-stack-capital', minimo: 1 },
    // Uma camada por operação efetiva com valor, mais o incorporador.
    { seletor: 'div.camada[role="listitem"]', minimo: 3 },
    // A seção da tabela da sequência. O stub de `urbi-tabela` não desenha
    // linha (caixa de altura zero, e a prova de montagem só conta nó visível):
    // a presença da tabela e o texto dela são exigidos em `medir()`.
    { seletor: 'section.bloco-estrutura', minimo: 2 },
    { seletor: 'div.total', minimo: 4 },
    { seletor: 'ul.apoio', minimo: 1 },
    // Os cartões da aba Operações, para a comparação de texto.
    { seletor: 'viab-funding-cartao', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-badge.cor',
    'urbi-input.desabilitado',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-funding') as any;
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado' }, // sem `id` — impede o fetch real em updated()
      carregando: false,
      ...estadoFundingCarregado(OPERACOES),
      editavel: false,
      abaAtiva: 'estrutura',
    });
    raiz.appendChild(el);
    await el.updateComplete;
    el._recalcular();
    await el.updateComplete;
    for (const c of el.shadowRoot.querySelectorAll('viab-funding-cartao, viab-grafico-stack-capital')) {
      await (c as any).updateComplete;
    }
  },
  async medir(raiz: HTMLElement) {
    const tela = raiz.querySelector('viab-funding') as any;
    const sr: ShadowRoot = tela.shadowRoot;
    const grafico = sr.querySelector('viab-grafico-stack-capital') as any;
    const stack = await medirStack(grafico);

    // A tabela: desenha cada célula com a coluna que a tela passou.
    const tabela = sr.querySelector('urbi-tabela.sequencia') as any;
    const colunas: any[] = tabela?.colunas ?? [];
    const linhas: any[] = tabela?.linhas ?? [];
    const celula = (col: any, linha: any, i: number): string => {
      if (col.render) {
        const d = document.createElement('div');
        render(col.render(linha, i), d);
        return (d.textContent ?? '').replace(/\s+/g, ' ').trim();
      }
      return String(col.valor?.(linha, i) ?? '');
    };
    const tabelaTexto = linhas.map((l, i) => Object.fromEntries(colunas.map((c) => [c.id, celula(c, l, i)])));

    // O "depois" de cada cartão: o texto do valor, sem o "antes" riscado nem a seta.
    const cartoes = [...sr.querySelectorAll('viab-funding-cartao')] as any[];
    const depoisDoCartao = Object.fromEntries(cartoes.map((c) => {
      const kpis = [...c.shadowRoot.querySelectorAll('.kpi')] as HTMLElement[];
      const val = (rotulo: string) => {
        const k = kpis.find((x) => x.querySelector('.rot')?.textContent?.trim() === rotulo);
        const v = k?.querySelector('.val');
        const ultimo = v?.lastElementChild;
        return (ultimo?.textContent ?? '').replace(/\s+/g, ' ').trim();
      };
      return [c.dataset.id, { tir: val('TIR alavancada'), exposicao: val('Exposição máxima') }];
    }));

    return {
      stack,
      tabelas: sr.querySelectorAll('urbi-tabela.sequencia').length,
      tabelaTexto,
      depoisDoCartao,
      totais: [...sr.querySelectorAll('div.total')].map((t) => ({
        rotulo: t.querySelector('.rot')?.textContent?.trim() ?? '',
        valor: (t.querySelector('.val')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        titulo: t.querySelector('.val span')?.getAttribute('title') ?? null,
      })),
      apoio: (sr.querySelector('ul.apoio')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      larguraTotais: (() => {
        const g = sr.querySelector('div.totais') as HTMLElement | null;
        return g ? { scroll: g.scrollWidth, client: g.clientWidth } : null;
      })(),
    };
  },
};
