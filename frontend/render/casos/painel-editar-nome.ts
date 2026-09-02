// Caso de render: o modal EDITAR NOME DO ESTUDO, aberto sobre o Painel (#660).
//
// Ele é markup NOVO — `urbi-input`, uma linha de apoio com o `id_legivel` e a
// dupla Cancelar/Salvar — e nenhuma outra camada deste repositório o enxerga:
// `estudo-status.test.ts` prova o parser do nome, `tela-dashboard.test.ts` prova
// que o componente o chama, e nenhum dos dois monta DOM.
//
// A fixture usa um `id_legivel` LONGO de propósito. A linha de apoio interpola
// esse identificador dentro de uma frase, e é exatamente a forma que estoura a
// caixa do modal quando o texto cresce — a classe de defeito que o `urbi-kpi`
// já produziu quatro vezes (#176, #262, #326, #352) e que só o render pega.
//
// ⚠️ **O que este caso NÃO mede, e é preciso dizer:** a COLUNA DE AÇÕES da
// linha do Painel, que a #659 levou de 2 para até 7 botões. Ela vive dentro de
// `urbi-tabela`, que recebe `colunas`/`linhas` por PROPRIEDADE — o stub gerado
// do espelho não desenha o conteúdo da tabela, então pedir a fila de botões
// aqui mediria o vazio e voltaria "limpo". É a mesma limitação declarada em
// `funding-abas.ts` para a aba Operações. Quem confirma a geometria daquela
// linha é o autor, na instância intermediária.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho: tem as declarações `:host` reais,
// mas não o overlay nem o posicionamento internos. O que se mede é o layout do
// CONTEÚDO do modal.

import '../../tela-dashboard.js';
import { forcarEstado } from './dados.js';

/**
 * O estudo sob edição. `id_legivel` no formato real e comprido que
 * `gerarIdentificacao` produz para um nome longo — é ele que a linha de apoio
 * interpola, e o pior caso de largura dela.
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
  _funcao: 'aprovador',
};

export const caso = {
  nome: 'painel-editar-nome',
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
  // MEDIDA (o harness reprova tanto a que falta quanto a declarada à toa), e
  // revisada uma a uma. Não é isenção: é o registro do que a medida não cobre.
  //
  // Quase todas são da TELA ATRÁS do modal, que sobe junto porque o modal é
  // renderizado pelo próprio `viab-tela-dashboard`: o cabeçalho
  // (`urbi-shell-page.titulo`), as abas (`urbi-abas.abas`/`.ativa`, só
  // propriedade) e as badges de nível do formulário de criar estudo. As duas
  // que são do modal em si: `urbi-input.label` (o stub desenha o campo, não o
  // rótulo) e `urbi-modal.title` (o stub não desenha a barra de título).
  aceitaNaoReproduzido: [
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-abas.expandir',
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-input.label',
    'urbi-input.obrigatorio',
    'urbi-input.placeholder',
    'urbi-modal.title',
    'urbi-shell-page.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-dashboard');
    raiz.appendChild(el);
    // Depois do append: `connectedCallback` dispara `_carregar()`, que zera
    // `carregando` com a resposta vazia do stub de API. Forçar o estado ANTES
    // seria sobrescrito por ele.
    await (el as any).updateComplete;
    forcarEstado(el, {
      carregando: false,
      estudos: [ESTUDO],
      editarAlvo: ESTUDO,
      editarNome: ESTUDO.nome,
      editarErro: '',
      salvandoNome: false,
    });
    await (el as any).updateComplete;
  },
};
