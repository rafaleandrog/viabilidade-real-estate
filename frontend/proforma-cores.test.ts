// #593 — a Proforma do Avançado passa a distinguir receita, custo, resultado e
// informativo por cor, com a MESMA linguagem visual do Preliminar.
//
// ⚠️ O QUE ESTE ARQUIVO MEDE, E POR QUE ELE NÃO COMPARA CONTRA UMA CONSTANTE.
// O critério de aceite 2 da issue não é "o Avançado tem cor": é "a linguagem
// visual é a mesma do Preliminar — mesmos tokens, mesmas proporções de
// `color-mix`". Isso é uma afirmação sobre DOIS arquivos, então o teste
// confronta os dois entre si, lendo as regras reais de
// `frontend/tela-proforma.ts` (o Preliminar, a origem) e de
// `frontend/tela-fluxo-ver.ts` (o Avançado, o destino).
//
// Comparar contra um literal escrito aqui deixaria passar exatamente o defeito
// que se quer barrar: a constante teria de ser copiada de um dos dois lados, e
// a partir daí os três podem divergir sem nada ficar vermelho. É a mesma razão
// pela qual `proforma-ordem-linhas.test.ts` compara tela × exportação em vez de
// comparar cada uma com uma lista fixa.
//
// O que este arquivo NÃO mede: se o navegador pinta. Nenhuma etapa de lógica
// pura lê CSS aplicado — quem prova que as classes chegam ao DOM da tela
// montada é `frontend/render/casos/proforma-avancada-cores.ts` (Chromium), e a
// especificidade/ordem das regras é responsabilidade do comentário que mora
// junto ao bloco em `tela-fluxo-ver.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sinalLinhaProformaAv } from './tela-fluxo-ver.js';
import { sinalSensibilidade } from './tela-proforma.js';

const PRELIMINAR = readFileSync(new URL('./tela-proforma.ts', import.meta.url), 'utf8');
const AVANCADO = readFileSync(new URL('./tela-fluxo-ver.ts', import.meta.url), 'utf8');

/**
 * Extrai o CORPO de uma regra CSS pelo seletor literal, normalizando espaço.
 * Os dois arquivos escrevem CSS dentro de template literal do lit, então não há
 * CSSOM para consultar — mas a regra é texto, e o seletor é âncora estável.
 */
function declaracoes(fonte: string, seletor: string): string {
  const i = fonte.indexOf(`\n    ${seletor} {`);
  assert.notEqual(i, -1, `regra \`${seletor}\` não existe no arquivo`);
  const abre = fonte.indexOf('{', i);
  const fecha = fonte.indexOf('}', abre);
  assert.ok(fecha > abre, `regra \`${seletor}\` não fecha`);
  return fonte
    .slice(abre + 1, fecha)
    .split(';')
    .map((d) => d.replace(/\s+/g, ' ').trim())
    .filter((d) => d !== '')
    .sort()
    .join('; ');
}

// Cada par é "a regra do Preliminar que define o tratamento" → "a regra do
// Avançado que tem de aplicá-lo". O mapeamento é o da issue #593.
const PARES: { o_que: string; preliminar: string; avancado: string }[] = [
  {
    o_que: 'consolidado de RECEITA (fundo verde) — #74',
    preliminar: '.pf tr.consolidado.nat-receita td',
    avancado: 'table.proforma tr.receita td',
  },
  {
    o_que: 'receita NEGATIVA sobrepõe o verde — #567',
    preliminar: '.pf tr.consolidado.nat-receita td.neg',
    avancado: 'table.proforma tr.receita td.neg',
  },
  {
    o_que: 'consolidado NEUTRO (subtotal de custo)',
    preliminar: '.pf tr.consolidado td',
    avancado: 'table.proforma tr.n0.custo td',
  },
  {
    o_que: 'linha de DESPESA (fundo vermelho a 8%) — #11',
    preliminar: '.pf.sens tr.nat-despesa',
    avancado: 'table.proforma tr.n1.custo',
  },
  {
    o_que: 'RESULTADO final',
    preliminar: '.pf tr.resultado td',
    avancado: 'table.proforma tr.resultado td',
  },
  {
    o_que: 'resultado positivo',
    preliminar: '.pf tr.resultado td.pos',
    avancado: 'table.proforma tr.resultado td.pos',
  },
  {
    o_que: 'resultado negativo',
    preliminar: '.pf tr.resultado td.neg',
    avancado: 'table.proforma tr.resultado td.neg',
  },
];

for (const par of PARES) {
  test(`#593: ${par.o_que} — o Avançado usa as MESMAS declarações do Preliminar`, () => {
    const origem = declaracoes(PRELIMINAR, par.preliminar);
    const destino = declaracoes(AVANCADO, par.avancado);
    assert.notEqual(origem, '', `a regra de origem \`${par.preliminar}\` ficou vazia`);
    assert.equal(
      destino,
      origem,
      `\`${par.avancado}\` (Avançado) divergiu de \`${par.preliminar}\` (Preliminar).\n`
      + `  Preliminar: ${origem}\n  Avançado:   ${destino}`,
    );
  });
}

test('#593: a ORDEM das regras sustenta a especificidade que o comentário promete', () => {
  // ⚠️ Este teste existe porque o bloco novo traz um comentário afirmando que
  // certas regras "precisam vir depois" — e comentário não é defesa. Duas
  // dessas ordens são a diferença entre pintar e não pintar, e nenhuma outra
  // camada as enxerga: trocar a ordem compila, passa nos testes de lógica pura
  // e passa no caso de render (que mede presença de classe, não estilo
  // computado). É exatamente a classe "defesa declarada e inexistente".
  const pos = (seletor: string) => {
    const i = AVANCADO.indexOf(`\n    ${seletor} {`);
    assert.notEqual(i, -1, `regra \`${seletor}\` não existe`);
    return i;
  };
  // `tr.receita td` e `tr.n0 td` têm a MESMA especificidade (1 classe + 3
  // tipos). Quem vier por último vence, e as duas casam as linhas de receita.
  assert.ok(
    pos('table.proforma tr.receita td') > pos('table.proforma tr.n0 td'),
    'tr.receita td precisa vir DEPOIS de tr.n0 td, senão o fundo verde nunca aparece',
  );
  // O override de receita negativa (#567) sobre o verde fixo.
  assert.ok(
    pos('table.proforma tr.receita td.neg') > pos('table.proforma tr.receita td'),
    'tr.receita td.neg precisa vir DEPOIS de tr.receita td',
  );
  // O `informativo` mantém tratamento próprio e não pode ser abafado pelas
  // regras novas (é `n1`, mas nunca `custo` — a garantia é o seletor, e a
  // ordem confirma).
  assert.ok(
    pos('table.proforma tr.informativo td') > pos('table.proforma tr.n1.custo'),
    'tr.informativo td precisa vir DEPOIS das regras de natureza',
  );
});

test('#593: nenhuma cor literal entrou junto — só token do design system', () => {
  // O contrato do CLAUDE.md permite cor literal apenas como FALLBACK de
  // `var(--token, …)`, e só isso: um `#hex` ou `rgb()` solto numa declaração de
  // cor seria violação. A exceção declarada (CSS de impressão de `exportar.ts`)
  // não vale aqui. `guard-tokens-css.mjs` confere que o token existe; o que ele
  // não confere é uma cor SEM token nenhum.
  for (const par of PARES) {
    for (const d of declaracoes(AVANCADO, par.avancado).split('; ')) {
      if (!/^(color|background(-color)?)\s*:/.test(d)) continue;
      assert.ok(
        d.includes('var(--'),
        `declaração de cor sem token em \`${par.avancado}\`: ${d}`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────
// O mapeamento de sinal — a única lógica nova, e ela é pura
// ─────────────────────────────────────────────────────────────────────────

const linha = (tipo: string, valor: number) => ({ tipo, valor } as any);

test('#593: só receita e resultado ganham pos/neg — custo e informativo, nunca', () => {
  // Custo é NEGATIVO por construção na Proforma do Avançado
  // (`frontend/proforma-avancado.ts`, `(-) …` e `= Custo … total`). Marcá-lo
  // como `neg` pintaria de "erro" o estado normal da tabela.
  assert.equal(sinalLinhaProformaAv(linha('custo', -1_000_000)), '');
  assert.equal(sinalLinhaProformaAv(linha('custo', 0)), '');
  // A linha do serviço da dívida do funding (#447) e a da receita líquida da
  // EVI (#465) são somadas de fora — não pertencem à leitura vertical.
  assert.equal(sinalLinhaProformaAv(linha('informativo', -500)), '');
  assert.equal(sinalLinhaProformaAv(linha('informativo', 500)), '');
});

test('#593: receita e resultado recebem o sinal do próprio valor', () => {
  assert.equal(sinalLinhaProformaAv(linha('receita', 12_000_000)), 'pos');
  assert.equal(sinalLinhaProformaAv(linha('receita', -3)), 'neg');
  assert.equal(sinalLinhaProformaAv(linha('resultado', 2_500_000)), 'pos');
  assert.equal(sinalLinhaProformaAv(linha('resultado', -2_500_000)), 'neg');
  // Zero é `pos`, não `neg` — mesma convenção do Preliminar (`v < 0`).
  assert.equal(sinalLinhaProformaAv(linha('resultado', 0)), 'pos');
});

// ─────────────────────────────────────────────────────────────────────────
// Critério 7 — paridade Loteamento × Incorporação
// ─────────────────────────────────────────────────────────────────────────

test('#593: a Proforma do Avançado não ramifica por padrão de estudo', () => {
  // A paridade aqui é ESTRUTURAL, não uma coincidência de valores: nem quem
  // classifica a linha (`proformaAvancado`, que atribui `tipo`) nem quem a
  // renderiza (`_renderProforma`) lê padrão de estudo em lugar nenhum, então a
  // mesma tabela e as mesmas cores servem os dois. Este teste não celebra a
  // paridade de hoje — ele barra a introdução da ramificação amanhã, que é o
  // que nenhuma outra camada acusaria (a ramificação compilaria limpa).
  //
  // Lê o fonte com os COMENTÁRIOS REMOVIDOS: a prosa dos dois arquivos cita
  // "incorporação" ao explicar a EVI, e um `includes()` ingênuo acusaria isso.
  const semComentarios = (c: string) => c
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); })
    .join('\n');

  const fonteProforma = semComentarios(readFileSync(new URL('./proforma-avancado.ts', import.meta.url), 'utf8'));
  const fonteTela = semComentarios(AVANCADO);
  for (const termo of ['tipo_empreendimento', 'loteamento', 'incorporacao']) {
    assert.ok(!fonteProforma.includes(termo), `proforma-avancado.ts passou a ramificar por "${termo}"`);
    assert.ok(!fonteTela.includes(termo), `tela-fluxo-ver.ts passou a ramificar por "${termo}"`);
  }
});

test('#593: a convenção de sinal é a MESMA do Preliminar, para os dois sinais', () => {
  // Confronto direto com a função do Preliminar, em vez de reafirmar a regra:
  // se um dos dois mudar de convenção, este teste acusa.
  for (const v of [-1_000_000, -0.01, 0, 0.01, 1_000_000]) {
    assert.equal(sinalLinhaProformaAv(linha('receita', v)), sinalSensibilidade(v, 'receita'), `valor ${v}`);
    assert.equal(sinalLinhaProformaAv(linha('custo', v)), sinalSensibilidade(v, 'despesa'), `valor ${v}`);
  }
});
