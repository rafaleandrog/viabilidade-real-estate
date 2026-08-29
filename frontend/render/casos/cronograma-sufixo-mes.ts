// Caso de render: os campos Início/Duração do Cronograma do Avançado com os
// DOIS afixos preenchidos — `sufixo` (a unidade: "º mês" / "meses") e
// `sufixo-mes` (o mês calendário: "jan/27") — que é a combinação da #583
// ("o sufixo de mês transborda a caixa do campo").
//
// Por que um caso PRÓPRIO, e não uma lente a mais num caso existente: nenhum
// caso deste diretório monta `viab-fluxo-cronograma`, e `sufixo-mes` só é
// usado por esta tela (4 ocorrências em `frontend/tela-fluxo-cronograma.ts`,
// as únicas do repositório). O defeito precisa do par
// `.campo-mes viab-num { max-width: 18ch }` + os dois afixos para aparecer —
// medir `viab-num` fora da tela mediria uma caixa mais folgada que a real.
//
// ⚠️ `viab-num` é componente DESTE repositório, não um primitivo `urbi-*`
// stubado: aqui o harness mede o markup real do shadow DOM (input + stepper +
// os dois `.afixo`), então o caveat de `docs/ui-urbiverso/LEIA.md` — "o stub
// tem conteúdo genérico, não julgue o layout de DENTRO de um urbi-*" — não se
// aplica a este caso.
//
// A fixture cobre o que o critério 1 da issue pede: valores de 1, 2 e 3
// dígitos, nas duas colunas, em linha travada (sem stepper) e editável (com
// stepper), nas fases fixas e nas customizadas — que são os quatro pontos de
// montagem do `viab-num` nesta tela.

import '../../tela-fluxo-cronograma.js';
import { DATA_INICIO, forcarEstado } from './dados.js';

// Fases fixas. `travado_inicio`/`travado_duracao` vêm do backend e decidem se
// a seta ⇅ aparece — a linha travada é a de menor largura mínima, e a
// editável a de maior; as duas precisam caber.
const CRONO_STRESS = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6, travado_inicio: false, travado_duracao: false },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6, travado_inicio: true, travado_duracao: false },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1, travado_inicio: true, travado_duracao: false },
  { evento: 'obra', inicio_mes: 13, duracao_meses: 24, travado_inicio: true, travado_duracao: false },
  // 3 dígitos nas DUAS colunas — o pior caso do critério 1 ("valores de 1 a 3
  // dígitos"). 120 + 240 - 1 = mês 359 ⇒ "dez/56": a mesma largura de glifo de
  // qualquer outro rótulo (`rotuloMesRelativo` é sempre "mmm/AA", 6 caracteres).
  { evento: 'pos_obra', inicio_mes: 120, duracao_meses: 240, travado_inicio: false, travado_duracao: false },
];

// Fases customizadas — o outro par de `viab-num` da tela (o que `_linhaFase`
// monta), que nunca é travado e por isso sempre carrega o stepper.
const FASES_STRESS = [
  { id: 1, nome: 'Comercialização', inicio_mes: 12, duracao_meses: 36 },
  { id: 2, nome: 'Repasse', inicio_mes: 361, duracao_meses: 9 },
];

export const caso = {
  nome: 'cronograma-sufixo-mes',
  exigir: [
    // Uma tabela por padrão de estudo — ver PADROES abaixo.
    { seletor: 'table.crono', minimo: 2 },
    // (5 fases fixas + 2 customizadas) × 2 campos × 2 padrões.
    { seletor: 'viab-num', minimo: 28 },
  ],
  // Props que o espelho declara, o stub não reproduz e esta tela usa — todas
  // fora dos campos medidos (cabeçalho do card, ações, parâmetros do topo).
  aceitaNaoReproduzido: [
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-checkbox.label',
    'urbi-checkbox.marcado',
    'urbi-input-data.label',
    'urbi-input-data.obrigatorio',
    'urbi-input.placeholder',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // Rede de segurança: `cronoCarregado` abaixo já impede o carregamento por
    // `updated()`, mas um caso que dependesse da API silenciosamente seria a
    // classe de defeito que `exigir` existe para pegar.
    (globalThis as any).urbiVerso.api = async () => ({ dados: [] });
    // Critério 7 da issue (paridade Avançado): a tela é MEDIDA nos dois
    // padrões, e não declarada igual por leitura. `viab-fluxo-cronograma` não
    // cita `tipo_empreendimento` em lugar nenhum — montar os dois lado a lado
    // é o que transforma essa ausência de ramificação em medida: se algum dia
    // alguém ramificar, o padrão novo passa a ser medido junto, de graça.
    for (const padrao of ['incorporacao', 'loteamento']) {
      const el = document.createElement('viab-fluxo-cronograma');
      forcarEstado(el, {
        estudo: { id: 1, nome: 'Render Check', nivel_analise: 'avancado', tipo_empreendimento: padrao },
        editavel: true,
        // `cronoCarregado` é o campo privado que `updated()` consulta antes de
        // chamar `_carregarCronograma()`; pré-marcá-lo mantém o caso fora da
        // camada de API, como `forcarEstado` documenta.
        cronoCarregado: true,
        paramsForm: { data_inicio_projeto: DATA_INICIO, tem_pre_lancamento: true },
        crono: CRONO_STRESS,
        fases: FASES_STRESS,
      });
      raiz.appendChild(el);
      await (el as any).updateComplete;
    }
  },
};
