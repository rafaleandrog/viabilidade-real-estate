// Caso de render: o modal EDITAR NOME DO ESTUDO, aberto sobre o cabeçalho do
// estudo (#678 — movido do Painel, onde a #660 tinha colocado).
//
// Ele é markup NOVO — `urbi-input`, uma linha de apoio com o `id_legivel` e a
// dupla Cancelar/Salvar — e nenhuma outra camada deste repositório o enxerga:
// `estudo-status.test.ts` prova o parser do nome, `tela-estudo.test.ts` prova
// que o componente o chama, e nenhum dos dois monta DOM.
//
// A fixture usa um `id_legivel` LONGO de propósito. A linha de apoio interpola
// esse identificador dentro de uma frase, e é exatamente a forma que estoura a
// caixa do modal quando o texto cresce — a classe de defeito que o `urbi-kpi`
// já produziu quatro vezes (#176, #262, #326, #352) e que só o render pega.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho: tem as declarações `:host` reais,
// mas não o overlay nem o posicionamento internos. O que se mede é o layout do
// CONTEÚDO do modal.

import '../../tela-estudo.js';
import { forcarEstado } from './dados.js';

/**
 * O estudo sob edição. `id_legivel` no formato real e comprido que
 * `gerarIdentificacao` produz para um nome longo — é ele que a linha de apoio
 * interpola, e o pior caso de largura dela. Nível Preliminar de propósito:
 * monta o ramo mais leve (`viab-tela-preliminar`) atrás do modal.
 */
const ESTUDO = {
  id: 660,
  nome: 'Pátio Urbitá Residencial e Comercial — Fase 1',
  nome_exibicao: 'INC - Pátio Urbitá Residencial e Comercial — Fase 1 - DF - 012',
  id_legivel: 'inc_patiourbitaresidencialecomercialfase1_df_012',
  tipo_empreendimento: 'incorporacao',
  nivel_analise: 'preliminar',
  status: 'rascunho',
  uf: 'DF',
  sequencia: 12,
  _permissao: { podeEditar: true, funcao: 'aprovador' },
};

export const caso = {
  nome: 'estudo-editar-nome',
  // `exigir` é OBRIGATÓRIO: um caso que não renderiza nada passa por todas as
  // lentes com "limpo". Estes três seletores são o modal (o primitivo), o campo
  // de nome e a linha de apoio com o identificador — se qualquer um sumir do
  // template, o caso reprova em vez de aprovar o vazio.
  exigir: [
    { seletor: 'urbi-modal', minimo: 1 },
    { seletor: 'urbi-input', minimo: 1 },
    { seletor: 'div.apoio-nome', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — a lista foi
  // MEDIDA (o harness reprova tanto a que falta quanto a declarada à toa).
  // Quase todas são da PÁGINA DE PREMISSAS atrás do modal, que sobe junto
  // porque `viab-tela-preliminar` normaliza qualquer `aba` desconhecida de
  // volta para `'premissas'` (ver comentário em `montar`, abaixo) — não há
  // como montar `viab-tela-estudo` sem trazer essa página junto.
  // As duas que são do modal em si: `urbi-input.label` (o stub desenha o
  // campo, não o rótulo) e `urbi-modal.title` (o stub não desenha a barra de
  // título).
  aceitaNaoReproduzido: [
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-badge.cor',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-input.label',
    'urbi-input.obrigatorio',
    'urbi-input.placeholder',
    'urbi-modal.title',
    'urbi-nav.ativo',
    'urbi-nav.secoes',
    'urbi-shell-page.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-estudo');
    raiz.appendChild(el);
    // Depois do append: `connectedCallback` dispara `_carregar()`, que chama
    // `buscarEstudo(0)` e volta cedo (sem `estudoId`, ver `updated()`). Forçar
    // o estado ANTES seria sobrescrito por ele.
    await (el as any).updateComplete;
    // `aba` NÃO é forçada: `viab-tela-preliminar` normaliza qualquer valor
    // fora de premissas/proforma/graficos/apelo de volta para 'premissas'
    // (`tela-preliminar.ts`, "URLs desconhecidas caem em 'premissas'") — não
    // há como escapar para um estado vazio por essa via. A página real de
    // Premissas sobe atrás do modal; o teste de render escopa a medição ao
    // MODAL, e documenta por quê (ver `estudo-editar-nome.render.test.ts`).
    forcarEstado(el, {
      carregando: false,
      estudo: ESTUDO,
      editarAlvo: true,
      editarNome: ESTUDO.nome,
      editarErro: '',
      salvandoNome: false,
    });
    await (el as any).updateComplete;
  },
};
