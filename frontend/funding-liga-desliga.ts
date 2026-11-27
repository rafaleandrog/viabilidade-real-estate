// O controle de liga/desliga do Financiamento à produção: o interruptor
// `urbi-toggle` quando a tag está registrada, e a caixa de seleção de antes
// (`urbi-checkbox`) quando não está.
//
// Por que a queda existe: o SDK lista o `urbi-toggle` como primitivo de "uso
// pontual", fora do registro global, e proíbe a app de importá-lo por subcaminho
// (`docs/ui.md` § Registro dos primitivos). O SDK diz que o `urbi-tabela` o usa
// por dentro; que isso deixe a tag registrada na página é inferência, que só a
// instância confirma. Num shell que não a registre, a tag
// seria um elemento vazio, sem clique e sem evento. A tela então pergunta ao
// registro na hora de desenhar e, sem a tag, desenha a caixa de seleção.
//
// Função pura, com o registro por parâmetro, para o teste não depender do
// `customElements` do navegador.

/** O mínimo do `CustomElementRegistry` que a escolha usa. */
export interface RegistroDeElementos {
  get(nome: string): unknown;
}

export type ControleLigaDesliga = 'toggle' | 'checkbox';

/** `'toggle'` quando `urbi-toggle` está registrado; senão `'checkbox'`. */
export function controleLigaDesliga(registro: RegistroDeElementos | null | undefined): ControleLigaDesliga {
  return registro?.get('urbi-toggle') ? 'toggle' : 'checkbox';
}

/** O texto visível ao lado do interruptor: o estado gravado, em palavras. */
export function rotuloDoEstado(ativo: boolean): string {
  return ativo ? 'Ligado' : 'Desligado';
}

/** O nome acessível do interruptor (`ariaLabel`). O estado é o próprio controle que anuncia. */
export const NOME_ACESSIVEL_LIGA_DESLIGA = 'Aplicar o Financiamento à produção no Fluxo de Caixa';
