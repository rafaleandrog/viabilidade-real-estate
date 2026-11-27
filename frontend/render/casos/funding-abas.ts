// Caso de render: a aba Operações do Funding em CARTÕES.
//
// ⚠️ O que este caso existe para pegar, e nenhuma outra camada pega. Os testes
// de `frontend/funding-abas.test.ts` e `funding-cartao-dados.test.ts` provam a
// PARTIÇÃO dos tipos e o CONTEÚDO de cada cartão (funções puras). Nenhum dos
// dois enxerga se a tela MONTA os cartões, se a sequência "antes → depois"
// chega a eles, nem se a leitura aparece — é a classe de defeito nº 1 do
// `CLAUDE.md`, "o defeito mora na FIAÇÃO, não no cálculo".
//
// O `exigir` abaixo é a prova de montagem:
//   · um `viab-funding-cartao` por operação listável (dívida e equity; o
//     Financiamento à produção NÃO vira cartão). Apagar a montagem dos
//     cartões em `render()` deixa este caso vermelho;
//   · `div.leitura` em cada cartão — apagar a chamada de `leituraDaOperacao`
//     (ou a da sequência, que alimenta a frase da exposição) a esvazia;
//   · `s.antes`, o "antes" riscado da exposição máxima — só existe com o passo
//     da sequência; apagar `sequenciaDeEstrutura` em `_recalcular` o tira.
//
// `medir()` acrescenta o que o `exigir` não diz: zero `urbi-tabela` (a tabela
// compilada saiu), a GEOMETRIA de cada cartão nos dois temas — nada transborda
// do cartão nem da grade, e cada valor cabe na moldura — e a BARRA DE ABAS que
// a tela entrega ao `urbi-abas`: exatamente Operações, Financiamento à produção
// e Estrutura de capital, um `urbi-hospedeiro` por aba, e a aba que abre na
// montagem (a aba ativa é estado interno, não sai da URL nem do navegador).

import '../../tela-funding.js';
import type { OperacaoFunding } from '../../funding-motor.js';
import { estadoFundingCarregado, forcarEstado } from './dados.js';

const OPERACOES: (OperacaoFunding & { id: number; ordem: number })[] = [
  {
    id: 1, ordem: 0, tipo: 'divida', nome: 'Capital de giro',
    valor: 5_000_000, inicio_mes: 0, distribuir_aporte: true, aporte_meses: 3,
    taxa_anual: 20, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12,
  },
  {
    id: 2, ordem: 1, tipo: 'financiamento_producao', nome: 'Financiamento à produção',
    taxa_anual: 12.5, exposicao_minima: 20, percentual_financiavel: 80,
    // Desligado: o gráfico da aba dele (montada junto, porque o stub de
    // urbi-abas não esconde a aba inativa) não é o que este caso mede.
    amortizar_com_caixa_disponivel: true, ativo: false,
  } as any,
  {
    id: 3, ordem: 2, tipo: 'equity', nome: 'Investidor com um nome bem comprido para testar a quebra',
    valor: 3_000_000, inicio_mes: 0, modo_retorno: 'permuta_financeira', pct_retorno: 15,
  } as any,
];

export const caso = {
  nome: 'funding-abas',
  exigir: [
    { seletor: 'urbi-abas', minimo: 1 },
    { seletor: 'viab-funding-cartao', minimo: 2 },
    { seletor: 'div.leitura', minimo: 2 },
    { seletor: 's.antes', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    // Banner regulatório (§17/#277) — fica FORA das abas, no topo.
    'urbi-banner.variante',
    // O primitivo de abas: `abas` é só-propriedade, `ativa` não dimensiona.
    'urbi-abas.abas',
    'urbi-abas.ativa',
    // O badge do tipo em cada cartão: a cor não dimensiona.
    'urbi-badge.cor',
    // Formulário da aba Financiamento à produção, montada junto. (Os
    // checkboxes dele saem com caixa de área zero no stub e não entram na conta.)
    'urbi-input.desabilitado',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-funding') as any;
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado' }, // sem `id` — impede o fetch real em updated()
      carregando: false,
      ...estadoFundingCarregado(OPERACOES),
      editavel: false,
    });
    raiz.appendChild(el);
    await el.updateComplete;
    el._recalcular();
    await el.updateComplete;
    for (const c of el.shadowRoot.querySelectorAll('viab-funding-cartao')) await (c as any).updateComplete;
  },
  async medir(raiz: HTMLElement) {
    const tela = raiz.querySelector('viab-funding') as any;
    const sr: ShadowRoot = tela.shadowRoot;
    const cartoes = [...sr.querySelectorAll('viab-funding-cartao')] as any[];
    const grade = sr.querySelector('div.cartoes') as HTMLElement | null;
    const temas: Record<string, unknown> = {};
    const variantes = ['0', '1'];
    for (const v of variantes) {
      document.documentElement.dataset.variante = v;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      temas[v] = {
        grade: grade ? { scroll: grade.scrollWidth, client: grade.clientWidth } : null,
        cartoes: cartoes.map((c) => {
          const caixa = c.getBoundingClientRect();
          const valores = [...c.shadowRoot.querySelectorAll('.val, .nome, .leitura p')] as HTMLElement[];
          return {
            scroll: c.scrollWidth,
            client: c.clientWidth,
            largura: caixa.width,
            // Valor que sai da moldura: borda direita do texto além da do cartão.
            fora: valores.filter((x) => x.getBoundingClientRect().right > caixa.right + 0.5
              || x.scrollWidth > x.clientWidth + 1).length,
          };
        }),
      };
    }
    document.documentElement.dataset.variante = '0';
    const abas = sr.querySelector('urbi-abas') as any;
    return {
      abas: (abas?.abas ?? []).map((a: { id: string; label: string }) => `${a.id}:${a.label}`),
      slots: [...sr.querySelectorAll('urbi-abas > urbi-hospedeiro')].map((h) => h.getAttribute('slot')),
      ativa: tela.abaAtiva,
      paineisAlternativas: sr.querySelectorAll('viab-funding-alternativas').length,
      tabelas: sr.querySelectorAll('urbi-tabela').length,
      ids: cartoes.map((c) => c.dataset.id),
      kpisPorCartao: cartoes.map((c) => c.shadowRoot.querySelectorAll('.kpi').length),
      termosPorCartao: cartoes.map((c) => c.shadowRoot.querySelectorAll('.termo').length),
      tituloLeitura: cartoes.map((c) => c.shadowRoot.querySelector('.leitura h4')?.textContent?.trim() ?? null),
      temas,
    };
  },
};
