// Caso de render: o botão "Criar estudo Avançado a partir deste" no cabeçalho de um estudo PRELIMINAR,
// aberto por um editor. O botão só chega à tela por `podeCriarAvancado(...)` dentro de
// `_renderAcoesStatus`; `relatorio-derivacao.test.ts` prova a regra, e só este caso prova a fiação: apagar a
// chamada do template deixa a suíte de unidade verde e este caso vermelho.
//
// O `exigir` aponta o botão pelo ícone, que é o atributo estático dele no template.

import '../../tela-estudo.js';
import { forcarEstado } from './dados.js';

export const ESTUDO_PRELIMINAR = {
  id: 833,
  nome: 'Pátio Urbitá 1',
  nome_exibicao: 'INC - Pátio Urbitá 1 - DF - 001',
  id_legivel: 'inc_patiourbita1_df_001',
  tipo_empreendimento: 'incorporacao',
  nivel_analise: 'preliminar',
  status: 'rascunho',
  uf: 'DF',
  sequencia: 1,
  _permissao: { podeEditar: true, podeAprovar: false, funcao: 'editor' },
};

export const SELETOR_BOTAO = 'urbi-botao[icone="fa-solid fa-diagram-project"]';

/**
 * Props que o stub do espelho não reproduz e a PÁGINA atrás (Premissas, que sobe junto porque não há estado
 * vazio) usa. Lista medida: o harness reprova tanto a que falta quanto a declarada à toa.
 */
export const ACEITA_NAO_REPRODUZIDO = [
  'urbi-abas.abas',
  'urbi-abas.ativa',
  'urbi-badge.cor',
  'urbi-botao.icone',
  'urbi-botao.pequeno',
  'urbi-botao.variante',
  'urbi-card.titulo',
  'urbi-nav.ativo',
  'urbi-nav.secoes',
  'urbi-shell-page.titulo',
];

/** Monta `viab-tela-estudo` com o estado dado, depois de o `connectedCallback` ter rodado. */
export async function montarEstudo(raiz: HTMLElement, estado: Record<string, unknown>): Promise<HTMLElement> {
  const el = document.createElement('viab-tela-estudo');
  raiz.appendChild(el);
  await (el as any).updateComplete;
  forcarEstado(el, { carregando: false, estudo: ESTUDO_PRELIMINAR, ...estado });
  await (el as any).updateComplete;
  return el;
}

export const caso = {
  nome: 'estudo-derivar-botao',
  exigir: [
    { seletor: SELETOR_BOTAO, minimo: 1 },
    { seletor: 'urbi-botao[icone="fa-solid fa-users"]', minimo: 1 },
  ],
  aceitaNaoReproduzido: ACEITA_NAO_REPRODUZIDO,
  async montar(raiz: HTMLElement): Promise<void> {
    await montarEstudo(raiz, {});
  },
};
