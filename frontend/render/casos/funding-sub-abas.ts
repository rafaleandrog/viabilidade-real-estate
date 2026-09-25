// Caso de render: sub-abas por OPERAÇÃO dentro de um tipo (Dívida/Equity),
// pedido do autor — quando há mais de uma operação do mesmo tipo, cada uma
// ganha sua própria sub-aba em vez de ficarem empilhadas na mesma página
// (`_renderAbaTipo`, `frontend/tela-funding.ts`).
//
// ⚠️ O que este caso existe para pegar, e nenhum outro pega: apagar o
// `urbi-abas` interno (voltar a empilhar num `<div>`) ou trocar
// `@urbi:aba-selecionar` por um handler mudo deixaria todo teste de FUNÇÃO
// PURA (`funding-abas.test.ts`) verde — é a classe de defeito nº 1 do
// CLAUDE.md: o defeito mora na fiação, não no cálculo. A prova aqui é
// clicar de verdade na sub-aba e ler o formulário que ficou visível.

import '../../tela-funding.js';
import { fundingDoEstudo, type OperacaoFunding } from '../../funding-motor.js';
import { mesRepasse } from '../../fluxo-shared.js';
import { CRONO, DATA_INICIO, CUSTOS, fluxo, forcarEstado } from './dados.js';

// Duas operações de DÍVIDA — o menor conjunto que exige sub-abas (com uma só,
// `_renderAbaTipo` renderiza o card direto, sem `urbi-abas` por cima).
const OPERACOES: (OperacaoFunding & { id: number; ordem: number })[] = [
  {
    id: 10, ordem: 0, tipo: 'divida', nome: '1º Dívida',
    valor: 4_000_000, inicio_mes: 0, taxa_anual: 14,
    periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
  },
  {
    id: 11, ordem: 1, tipo: 'divida', nome: '2º Dívida',
    valor: 6_000_000, inicio_mes: 6, taxa_anual: 16,
    periodo_amortizacao_meses: 24, periodo_carencia_meses: 3,
  },
];

export const caso = {
  nome: 'funding-sub-abas',
  // ⚠️ O QUE ESTE CASO NÃO MEDE, e por quê — mesmo limite já documentado em
  // `funding-abas.ts` para a aba Operações (`urbi-tabela` sem markup interno
  // no stub, altura ZERO), agora também nas outras duas hospedeiro sem
  // operação: como esta fixture só tem Dívida, as abas Financiamento à
  // produção e Equity caem no ramo `urbi-estado-vazio`, que o stub também não
  // sabe desenhar (altura ZERO) — MEDIDO com `debug-hospedeiro`: das 6
  // `urbi-hospedeiro` (4 de topo + 2 sub-abas de Dívida), só as 3 com conteúdo
  // real (Dívida, e as duas sub-abas 10/11) ficam com área positiva.
  exigir: [
    { seletor: 'urbi-abas', minimo: 2 }, // a de topo (Operações/…/Dívida/Equity) + a interna da aba Dívida
    { seletor: 'urbi-hospedeiro', minimo: 3 }, // Dívida (topo) + as 2 sub-abas (10, 11)
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-select.desabilitado',
    'urbi-select.opcoes',
    'urbi-input.desabilitado',
    'urbi-abas.abas',
    'urbi-abas.ativa',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const calc = fluxo();
    const funding = fundingDoEstudo(
      OPERACOES, calc.fluxoMensal, calc.receitaMensal,
      calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1], mesRepasse(CRONO), 12,
    );
    const el = document.createElement('viab-funding');
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado' }, // sem `id` — impede o fetch real em updated()
      carregando: false,
      calc,
      funding,
      operacoes: OPERACOES,
      custos: CUSTOS,
      crono: CRONO,
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      editavel: false,
      abaAtiva: 'divida',
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  /** Roda DENTRO do navegador, depois do assentamento: dispara o evento real
   * de troca de sub-aba (o mesmo que `urbi-abas` dispara ao clicar) e lê a
   * prop `.ativa` de volta — prova que o evento chega em `opAtivaPorTipo` e
   * que o RE-RENDER passa o novo id de volta para o primitivo, não só que o
   * estado interno mudou sem ninguém ler.
   *
   * ⚠️ Não usa `.valor` de `urbi-input` para provar isto: o stub de
   * `urbi-abas` (gerado do espelho, que só carrega `:host`) NÃO sabe esconder
   * a sub-aba inativa — as duas operações continuam montadas no DOM, então o
   * PRIMEIRO `urbi-input` do shadow root seria sempre o mesmo, ativa ou não
   * (mesma limitação documentada em `funding-abas.ts`). A prop `.ativa`, ao
   * contrário, é o dado que `urbi-abas` de verdade usa para decidir — e ela
   * É reproduzida fielmente pelo binding do Lit.
   */
  async medir(raiz: HTMLElement): Promise<{ ativaAntes: string | null; ativaDepois: string | null }> {
    const tela = raiz.querySelector('viab-funding')! as any;

    // A sub-aba interna é a SEGUNDA `urbi-abas` do shadow root da tela: a
    // primeira é a navegação de topo (Operações/…/Dívida/Equity).
    const abasInternas = tela.shadowRoot!.querySelectorAll('urbi-abas')[1] as any;
    const ativaAntes = abasInternas?.ativa ?? null;

    abasInternas.dispatchEvent(new CustomEvent('urbi:aba-selecionar', {
      detail: { id: '11' }, bubbles: true, composed: true,
    }));
    await tela.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await tela.updateComplete;

    const abasInternasDepois = tela.shadowRoot!.querySelectorAll('urbi-abas')[1] as any;
    const ativaDepois = abasInternasDepois?.ativa ?? null;
    return { ativaAntes, ativaDepois };
  },
};
