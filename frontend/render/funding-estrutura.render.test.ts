// Render da aba Estrutura de capital do Funding e da torre do capital stack —
// a prova de FIAÇÃO e de GEOMETRIA que os testes de função pura não dão. Ver o
// topo de `casos/funding-estrutura.ts` e `casos/grafico-stack-capital.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';
import { ALTURA_MINIMA_CAMADA } from '../stack-capital-desenho.js';
import { fmtPct } from '../viab-format.js';
import { CAMADAS } from './casos/grafico-stack-capital.js';
import type { MedidaStack } from './casos/medir-stack.js';

const pular = await motivoParaPular();

const LARGURAS = [1280, 900, 600];
/** Contraste mínimo de texto normal (WCAG AA). */
const CONTRASTE_MINIMO = 4.5;

/**
 * Transbordo de texto, fora o rótulo de mês do eixo do gráfico do Financiamento
 * à produção. Aquele gráfico é da aba do FàP, que o stub de `urbi-abas` monta
 * junto (o stub não esconde aba inativa); o caso da tela precisa do FàP LIGADO
 * para medir a camada dele na base da torre, e o rótulo do eixo — texto SVG
 * medido contra uma caixa de 24px — não é desta aba. Só esse caminho é
 * dispensado; qualquer outro transbordo reprova.
 */
function transbordosDeTexto(a: any): unknown[] {
  return Object.values(a.larguras as Record<string, any>)
    .flatMap((m) => m.transbordoDeTexto)
    .filter((t: any) => !/svg\.grafico > text\.eixo-mes/.test(JSON.stringify(t)));
}

function lentesLimpas(a: any): void {
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'algo estourou a caixa' + relato(a));
  assert.deepEqual(transbordosDeTexto(a), [], 'texto saltou para fora do quadro' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'duas caixas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
}

/** A geometria que vale para toda torre: nada transborda, piso respeitado, contraste em todo tema. */
function geometriaDaTorre(s: MedidaStack, l: number): void {
  assert.ok(s.torreDireita <= s.larguraDocumento + 0.5, `a torre passou da página em ${l}px: ${s.torreDireita} > ${s.larguraDocumento}`);
  assert.ok(s.torreScroll <= s.torreClient + 1, `a torre transbordou em ${l}px`);
  for (const c of s.camadas) {
    assert.deepEqual(c.fora, [], `texto fora da camada ${c.id} em ${l}px: ${c.fora.join(', ')}`);
    assert.ok(c.altura >= ALTURA_MINIMA_CAMADA - 0.5, `camada ${c.id} abaixo da altura mínima em ${l}px: ${c.altura}`);
  }
  for (const [tema, r] of Object.entries(s.contrastePorTema)) {
    assert.ok(r >= CONTRASTE_MINIMO, `contraste do texto na camada abaixo de ${CONTRASTE_MINIMO} no tema ${tema}, em ${l}px: ${r.toFixed(2)}`);
  }
}

test('torre: camada pequena no piso e numa linha, valor e % nunca cortados, sem transbordo, contraste em todo tema', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'grafico-stack-capital', larguras: LARGURAS });
  lentesLimpas(a);
  const desenhadas = CAMADAS.filter((c) => c.valor > 0);
  for (const l of LARGURAS) {
    const s = a.extra?.[String(l)] as MedidaStack | undefined;
    assert.ok(s, `o caso não devolveu a medida em ${l}px` + relato(a));
    geometriaDaTorre(s!, l);
    // A camada de valor zero não é desenhada; a ordem do DOM é a de senioridade.
    assert.deepEqual(s!.camadas.map((c) => c.id), desenhadas.map((c) => String(c.id)));
    // A base é a mais sênior: cada camada fica ABAIXO da seguinte.
    for (let i = 1; i < s!.camadas.length; i++) {
      assert.ok(s!.camadas[i].topo < s!.camadas[i - 1].topo, `a camada ${s!.camadas[i].id} não está acima da ${s!.camadas[i - 1].id}`);
    }
    // A camada de 0,3% fica no piso, numa linha, com o % verdadeiro escrito.
    const pequena = s!.camadas.find((c) => c.id === '3')!;
    const real = CAMADAS.find((c) => c.id === 3)!;
    assert.ok(real.pct! < 1, 'a fixture tem uma camada abaixo de 1%');
    assert.ok(Math.abs(pequena.altura - ALTURA_MINIMA_CAMADA) < 1, `a camada pequena não está no piso: ${pequena.altura}`);
    assert.equal(pequena.linhas, 'uma');
    assert.equal(pequena.pct, fmtPct(real.pct!));
    // As grandes não foram para o piso: a de bilhão é a mais alta.
    const maior = s!.camadas.find((c) => c.id === '1')!;
    assert.ok(maior.altura > 4 * ALTURA_MINIMA_CAMADA && maior.linhas === 'duas', `a camada grande foi esmagada: ${maior.altura}`);
    // Bilhão e nove dígitos em milhões, e o nome acessível com o valor exato.
    assert.match(maior.texto.replace(/ /g, ' '), /R\$ 1\.234,5 mi/);
    assert.match(s!.camadas.find((c) => c.id === '2')!.rotuloAcessivel.replace(/ /g, ' '), /R\$ 123\.456\.789,00, .*% do total das camadas$/);
  }
});

test('torre sem camada com valor: o texto no lugar, sem torre', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'grafico-stack-capital-vazio', larguras: [900] });
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  const x = a.extra?.['900'] as any;
  assert.equal(x?.texto, 'Nenhuma camada com valor.');
  assert.equal(x?.torres, 0);
});

test('aba Estrutura de capital: torre na senioridade com o FàP na base, totais, e a tabela com o texto dos cartões', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-estrutura', larguras: LARGURAS });
  lentesLimpas(a);
  for (const l of LARGURAS) {
    const x = a.extra?.[String(l)] as any;
    assert.ok(x, `o caso não devolveu a medida em ${l}px` + relato(a));
    const s = x.stack as MedidaStack;
    geometriaDaTorre(s, l);
    // Ordem de senioridade: FàP (2) → dívida (1) → equity (3) → incorporador.
    assert.deepEqual(s.camadas.map((c) => c.id), ['2', '1', '3', 'incorporador'], 'camadas fora da senioridade');
    // O FàP é a BASE: a camada mais baixa da torre.
    const maisBaixa = [...s.camadas].sort((p, q) => q.topo - p.topo)[0];
    assert.equal(maisBaixa.id, '2', 'o Financiamento à produção não está na base');
    // Os quatro totais, em milhões com o exato no título.
    assert.deepEqual(x.totais.map((t: any) => t.rotulo), ['Usos totais', 'Dívida', 'Equity de terceiros', 'Incorporador no pico']);
    for (const t of x.totais) {
      assert.match(t.valor.replace(/ /g, ' '), /^R\$ [\d.]+,\d mi$/, `total fora do formato: ${t.valor}`);
      assert.match((t.titulo ?? '').replace(/ /g, ' '), /^R\$ [\d.]+,\d\d$/, `total sem o exato no título: ${t.titulo}`);
    }
    assert.ok(x.larguraTotais && x.larguraTotais.scroll <= x.larguraTotais.client, `os totais transbordaram em ${l}px`);
    // A tabela: projeto sem funding, um passo por operação, na senioridade.
    assert.equal(x.tabelas, 1, 'a tabela da sequência não está na aba');
    const passos = x.tabelaTexto.map((r: any) => r.passo);
    assert.equal(passos[0], 'Projeto sem funding');
    assert.equal(passos.length, 4);
    // As MESMAS strings dos cartões, por operação.
    for (const id of ['1', '3']) {
      const cartao = x.depoisDoCartao[id];
      assert.ok(cartao && cartao.exposicao, `o cartão ${id} não mostrou a exposição`);
      const linha = x.tabelaTexto[id === '1' ? 2 : 3];
      assert.equal(linha.exposicao, cartao.exposicao, `exposição da tabela ≠ cartão (${id})`);
      assert.equal(linha.tir, cartao.tir, `TIR da tabela ≠ cartão (${id})`);
    }
    // A última linha é a estrutura completa: o "incorporador no pico".
    assert.equal(x.tabelaTexto[3].exposicao, x.totais[3].valor, 'a última linha não é a estrutura completa');
    // O texto de apoio traz a D9 junto da frase do pagamento pelo contrato, e
    // não afirma que não há cascata: o Financiamento à produção varre o caixa.
    assert.match(x.apoio, /ordem de pagamento e a ordem de entrada na comparação\. O app paga todo terceiro pelo contrato/);
    assert.match(x.apoio, /nenhuma operação recebe menos do que o contrato dela prevê por estar abaixo de outra/);
    assert.doesNotMatch(x.apoio, /cascata/i, 'o texto de apoio voltou a negar a cascata');
    // Os totais amarrados às camadas da torre, pelo valor exato (título do total
    // e nome acessível da camada): dívida = FàP + dívida, equity = o investidor,
    // incorporador no pico = a camada do incorporador.
    const exato = (t: string | null) => Number((t ?? '').replace(/[^\d,]/g, '').replace(',', '.'));
    const daCamada = (id: string) => {
      const c = s.camadas.find((k) => k.id === id);
      assert.ok(c, `camada ${id} ausente`);
      const m = c!.rotuloAcessivel.replace(/\u00a0/g, ' ').match(/R\$ [\d.]+,\d\d/);
      assert.ok(m, `camada ${id} sem o valor exato no nome acessível`);
      return exato(m![0]);
    };
    const perto = (a: number, b: number) => Math.abs(a - b) < 0.015;
    assert.ok(perto(exato(x.totais[1].titulo), daCamada('2') + daCamada('1')), `total Dívida ≠ FàP + dívida: ${x.totais[1].titulo}`);
    assert.ok(perto(exato(x.totais[2].titulo), daCamada('3')), `total Equity ≠ camada do investidor: ${x.totais[2].titulo}`);
    assert.ok(perto(exato(x.totais[3].titulo), daCamada('incorporador')), `total Incorporador ≠ camada do incorporador: ${x.totais[3].titulo}`);
    // O eixo lateral: "mais júnior" em cima, "mais sênior" embaixo, fora da árvore acessível.
    assert.ok(s.eixo, 'o eixo lateral sumiu');
    assert.deepEqual(s.eixo!.textos.map((t) => t.texto), ['mais júnior', 'mais sênior']);
    assert.ok(s.eixo!.textos[0].topo < s.eixo!.textos[1].topo, '"mais júnior" não está acima de "mais sênior"');
    assert.equal(s.eixo!.ocultoDoLeitor, true, 'o eixo lateral não está aria-hidden');
  }
});
