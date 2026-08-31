import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fluxoPagamentoParaSalvar, formularioPagamento } from './fluxo-pagamento-editor.js';
import { taxaMensalDeAnual } from './fluxo-caixa-motor.js';

/**
 * #585: a taxa de tabela do ESTUDO, e a mensal que ela projeta. A fixture
 * trazia o literal `0.0098636` — a taxa que o estudo 5 recebeu pela API. Desde
 * a #585 a `taxaMensal` persistida é PROJEÇÃO da taxa anual do estudo, então a
 * fixture tem de declará-la assim para que "abrir e aplicar sem editar" siga
 * byte-idêntico. **Consequência declarada da issue:** uma linha legada com a
 * mensal arredondada é reescrita na primeira gravação (8e-9 ao mês de
 * diferença); essa reescrita é a única coisa que a #585 tira da regra de
 * classe da #431.
 */
const TAXA_ESTUDO_AA = 12.5;
const TAXA_ESTUDO_MENSAL = taxaMensalDeAnual(TAXA_ESTUDO_AA);
import { absorcaoParaSalvar, formularioAbsorcao } from './fluxo-absorcao-editor.js';

// ─────────────────────────────────────────────────────────────────────────
// #431 — a REGRA DA CLASSE, e não os dois casos
// ─────────────────────────────────────────────────────────────────────────
//
// A decisão D-Q05 fundiu duas issues numa porque o defeito é o mesmo: um
// formulário mais pobre que o dado regenera o JSON persistido inteiro e apaga o
// que não sabe mostrar. O critério de pronto não é "os dois modais pararam de
// destruir" — é **o terceiro modal que alguém escrever nascer certo**.
//
// Por isso este arquivo não testa Pagamento nem Absorção: testa a REGRA, sobre
// uma lista de pares `(formulárioX, xParaSalvar)`. Um par novo entra na lista
// `PARES` abaixo e ganha os dois testes de graça — e, o que importa mais, um
// par que NÃO entra na lista é uma omissão visível, em vez de um teste que
// ninguém pensou em escrever.
//
//   A regra: abrir um modal e aplicar sem alterar campo nenhum é NO-OP. O JSON
//   persistido resultante é `deepEqual` ao de entrada. E aplicar de novo sobre
//   o que foi gravado também não move nada.
//
// ⚠️ O que este arquivo NÃO cobre, e nenhum teste de módulo puro cobre: que a
// TELA de fato chame estas funções. Isso é fiação de componente, e mora nos
// testes de cada editor mais na revisão do diff de `tela-fluxo-receitas.ts`.

interface ParDeModal {
  /** Nome do modal, como o usuário o vê. */
  nome: string;
  /** A coluna `json` que ele edita — para a mensagem de falha ser localizável. */
  coluna: string;
  /** Um registro persistido REAL, com algo que o formulário não sabe representar. */
  dado: () => any;
  /** `parse`: projeta o dado no formulário do modal. */
  ler: (dado: any) => any;
  /** `serializa`: o JSON que o "Aplicar" gravaria. */
  salvar: (form: any, dado: any) => any;
  /** O que exatamente o formulário não sabe representar — para o teste dizer. */
  oQueOFormularioNaoSabe: string;
  /**
   * #452: campos que o "Aplicar" LEGITIMAMENTE deixa de regravar. Não é
   * violação da regra da classe — é limpeza deliberada de campo morto: o
   * sub-objeto `ret` por linha (RET virou global do estudo na #346) saiu do
   * TIPO `FormularioPagamento`, então o spread de `fluxoPagamentoParaSalvar`
   * para de reproduzi-lo. Um registro real de ANTES da #452 ainda o carrega
   * (por isso a fixture abaixo o mantém — é o dado real que existe hoje); o
   * "Aplicar" sobre ele não é mais byte-idêntico NESTE campo, e é isso que se
   * quer. Vazio por default; só o par com a exceção declara.
   */
  camposRemovidos?: string[];
}

const CRONO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 27 }]; // fim 38, repasse 39

const PARES: ParDeModal[] = [
  {
    nome: 'Fluxo de pagamento',
    coluna: 'avancado_fases.fluxo_pagamento',
    // #455: `sinalPct` SAIU desta lista — o espelho (parcelas[].sinalPct)
    // passou a sabê-lo, e a fixture abaixo tem sinalPct 0 nos dois lados
    // (persistido e mirror), então o no-op continua fechando sem ele.
    oQueOFormularioNaoSabe: 'taxaMensal, jurosNoMesDaContratacao e rotulo por componente',
    // A linha "Tabela longa (80%)" do estudo 5 de Pinguim.
    dado: () => ({
      comissao: { ativo: true, tipo: 'embutida', pct: 0 },
      ret: { ativo: false, pct: 0 },
      entrada: [],
      parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
      repasse: { apos_entrega_meses: 0 },
      componentes: [
        {
          tipo: 'ate_marco', rotulo: 'Tabela longa, juros 12,5% a.a.', marcoMes: 38,
          sinalPct: 0, taxaMensal: TAXA_ESTUDO_MENSAL, defasagemMeses: 1,
          participacaoPct: 30, jurosNoMesDaContratacao: false,
        },
        { tipo: 'concentrado', rotulo: 'Repasse', mesPagamento: 39, taxaMensal: TAXA_ESTUDO_MENSAL, participacaoPct: 70 },
      ],
      aplicado: true,
    }),
    ler: (dado) => formularioPagamento(dado),
    salvar: (form) => fluxoPagamentoParaSalvar(form, CRONO, TAXA_ESTUDO_AA),
    camposRemovidos: ['ret'],
  },
  {
    nome: 'Absorção de vendas',
    coluna: 'avancado_fases.absorcao',
    oQueOFormularioNaoSabe: 'o modo e a curva mensal própria (meses[])',
    // A linha do estudo 6 de Pinguim: curva personalizada de 43 pontos.
    dado: () => ({
      modo: 'personalizado',
      correcao_estoque: false,
      meses: Array.from({ length: 43 }, (_, i) => ({ mes: 3 + i, pct: 100 / 43 })),
      aplicado: true,
    }),
    ler: (dado) => formularioAbsorcao(dado, true),
    salvar: (form, dado) => absorcaoParaSalvar(form, dado),
  },
];

for (const par of PARES) {
  test(`#431 regra da classe · ${par.nome}: parse → serializa sem edição é deepEqual`, () => {
    const dado = par.dado();
    const salvo = par.salvar(par.ler(dado), dado);
    const esperado = { ...dado };
    for (const campo of par.camposRemovidos ?? []) delete esperado[campo];
    assert.deepEqual(salvo, esperado,
      `o modal "${par.nome}" reescreveu ${par.coluna} sem o usuário editar nada. `
      + `O formulário não sabe representar: ${par.oQueOFormularioNaoSabe}.`);
  });

  test(`#431 regra da classe · ${par.nome}: aplicar de novo sobre o gravado não move nada`, () => {
    const dado = par.dado();
    const uma = par.salvar(par.ler(dado), dado);
    const duas = par.salvar(par.ler(uma), uma);
    assert.deepEqual(duas, uma, `o modal "${par.nome}" não é idempotente em ${par.coluna}`);
  });
}

test('#431 regra da classe: a lista de pares não está vazia nem encolheu sem alguém notar', () => {
  // Um par que sai da lista é a mesma falha calada que a regra existe para
  // impedir — os testes acima simplesmente deixariam de ser gerados, e a suíte
  // continuaria verde com menos cobertura.
  assert.deepEqual(PARES.map((p) => p.nome).sort(), ['Absorção de vendas', 'Fluxo de pagamento']);
});
