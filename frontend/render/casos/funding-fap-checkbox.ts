// Caso de render: #587 — o checkbox "Ativo" da aba Financiamento à produção
// precisa de fato mandar `ativo` para o backend quando clicado. Nenhum teste
// de função pura enxerga isso: `simularFinanciamentoProducao` já trata
// `ativo: false` corretamente (`frontend/funding-motor.test.ts`), mas isso não
// prova que o CHECKBOX da tela chama `_ligarDesligarFinanciamento`, que chama
// `atualizarFundingOperacao` com o valor certo — é a classe de defeito nº 1 do
// CLAUDE.md: o defeito mora na fiação, não no cálculo. Apagar o
// `@urbi:checkbox-change` do template deixaria todo teste de função pura
// verde e este caso vermelho.
//
// ⚠️ O stub de API precisa REFLETIR o PATCH, não só capturá-lo. Medido:
// `_ligarDesligarFinanciamento` chama `_carregar()` depois do PATCH — se o
// stub de `listarFundingOperacoes` devolvesse `dados: []` genérico (como os
// outros endpoints, que este caso não usa), o reload apagaria a própria
// operação da tela, e o `exigir` abaixo reprovaria por um motivo que não é o
// achado deste caso.

import '../../tela-funding.js';
import { type OperacaoFunding } from '../../funding-motor.js';
import { CRONO, DATA_INICIO, CUSTOS, fluxo, forcarEstado } from './dados.js';

const OPERACAO_FAP: OperacaoFunding & { id: number; ordem: number } = {
  id: 2, ordem: 0, tipo: 'financiamento_producao', nome: 'Financiamento à produção',
  taxa_anual: 12.5, exposicao_minima: 20, percentual_financiavel: 80,
  amortizar_com_caixa_disponivel: true, ativo: true,
} as any;

export const caso = {
  nome: 'funding-fap-checkbox',
  // `exigir` é OBRIGATÓRIO em todo caso — sem ele um caso que não monta nada
  // reporta "limpo" em todas as lentes.
  //
  // ⚠️ NÃO exige `urbi-checkbox` visível — o espelho declara `:host {
  // display: inline-block }` sem largura/altura mínima, e o stub só pinta
  // conteúdo para as props `rotulo`/`valor` (nenhuma delas é `label`, a prop
  // real do primitivo); o resultado é caixa de área ZERO, que
  // `scripts/render-check.mjs` conta como OCULTA — o mesmo limite que
  // `casos/funding-abas.ts` documenta para `urbi-tabela`. A prova de fiação
  // não depende de visibilidade: `medir()` acha o nó por `querySelector`
  // (que enxerga elementos ocultos) e dispara o evento nele mesmo assim.
  // `urbi-card` é o que prova que a aba montou.
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-input.desabilitado',
    'urbi-select.desabilitado',
    'urbi-select.opcoes',
    'urbi-checkbox.desabilitado',
    'urbi-checkbox.label',
    'urbi-checkbox.marcado',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // Captura a chamada PATCH que o clique deve disparar — ver `medir()` — e
    // REFLETE o patch na própria fixture, para o `_carregar()` que
    // `_ligarDesligarFinanciamento` dispara depois devolver o estado
    // ATUALIZADO, não apagar a operação.
    (globalThis as any).__patchFunding = null;
    (globalThis as any).urbiVerso.api = async (rota: string, opts?: any) => {
      if (opts?.method === 'PATCH') {
        const body = JSON.parse(opts.body);
        (globalThis as any).__patchFunding = { rota, body };
        Object.assign(OPERACAO_FAP, body);
        return { ...OPERACAO_FAP };
      }
      if (rota.includes('/avancado/funding')) return { dados: [OPERACAO_FAP] };
      return { dados: [] };
    };

    const calc = fluxo();
    const el = document.createElement('viab-funding');
    forcarEstado(el, {
      // Sem `id` no estudo, de propósito (mesmo padrão de `funding-abas.ts`):
      // `updated()` só chama `_carregar()` com `estudo.id` presente, e aqui o
      // estado já vem pronto — o caso mede o clique, não o carregamento
      // inicial. O reload PÓS-clique passa por `_carregar()` de verdade
      // (chamado direto por `_ligarDesligarFinanciamento`, não por
      // `updated()`), e usa o stub acima.
      estudo: { nivel_analise: 'avancado' },
      carregando: false,
      calc,
      funding: null,
      operacoes: [OPERACAO_FAP],
      custos: CUSTOS,
      crono: CRONO,
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      editavel: true,
      abaAtiva: 'financiamento_producao',
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  // Roda DENTRO do navegador, depois do assentamento (ver
  // `scripts/render-check.mjs`) — clica o checkbox de verdade e lê o que a
  // fiação de fato mandou para a API stub.
  async medir(raiz: HTMLElement): Promise<{ patchChamado: boolean; ativoNoPatch: unknown }> {
    const tela = raiz.querySelector('viab-funding')! as any;
    const checkbox = tela.shadowRoot!.querySelector('urbi-checkbox')!;
    checkbox.dispatchEvent(new CustomEvent('urbi:checkbox-change', {
      detail: { marcado: false }, bubbles: true, composed: true,
    }));
    // `_ligarDesligarFinanciamento` é async (PATCH + `_carregar()`, que por
    // sua vez dispara mais Promises) — espera o ciclo de update do Lit
    // resolver de verdade em vez de contar frames às cegas.
    await tela.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await tela.updateComplete;

    const chamada = (globalThis as any).__patchFunding;
    return { patchChamado: !!chamada, ativoNoPatch: chamada?.body?.ativo };
  },
};
