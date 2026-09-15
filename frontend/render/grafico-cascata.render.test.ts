// Render de <viab-grafico-cascata> standalone, já na forma de COLUNAS
// VERTICAIS.
//
// ⚠️ O transbordo de TEXTO/corte por overflow oculto deste caso é REPORTADO
// E NÃO ASSEVERADO, mesmo padrão de `tabela-fluxo.render.test.ts`: o rótulo da
// coluna é um bloco de altura fixa de **44px** (`frontend/grafico-cascata.ts`,
// `.rotulo`) — três linhas de 11px com `line-height: 1.25`, cortadas por
// `-webkit-line-clamp: 3` —, estreito de propósito para 14 colunas caberem, e
// rótulos longos em português ("(-) Permuta financeira não residencial")
// truncam, com o texto inteiro no `title` (tooltip). Quantas linhas cabem e
// quantos pixels truncam depende da métrica de glifo da fonte da máquina, não
// da da instância (Montserrat).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Cascata do resultado: as colunas, trilhos, barras e valores chegam à tela', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'grafico-cascata' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  // Sonda de TECLADO — a única camada deste repositório que enxerga "o
  // componente não reage a Enter/Espaço". Os seletores `[role]`/`[tabindex]`/
  // `[aria-expanded]` provam a marcação; isto prova o comportamento.
  const k = a.extra?.['900'] as {
    enter: number; espaco: number; repetido: number; outraTecla: number;
    defaultCancelado: boolean; defaultCanceladoNoRepeat: boolean;
  } | undefined;
  assert.ok(k, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));
  assert.equal(k!.enter, 1, 'Enter não ativou a coluna expansível' + relato(a));
  assert.equal(k!.espaco, 1, 'Espaço não ativou a coluna expansível' + relato(a));
  assert.equal(k!.repetido, 0, 'auto-repeat do Espaço disparou o evento em rajada' + relato(a));
  assert.equal(k!.outraTecla, 0, 'tecla irrelevante ativou a coluna' + relato(a));
  assert.equal(k!.defaultCancelado, true, 'o Espaço não cancelou o default — a página rolaria' + relato(a));
  assert.equal(
    k!.defaultCanceladoNoRepeat, true,
    'o Espaço REPETIDO não cancelou o default — com a guarda de `ev.repeat` antes do '
    + '`preventDefault`, segurar a tecla rola a página em rajada' + relato(a),
  );

  const texto = contar(a, 'transbordoDeTexto');
  const cortado = contar(a, 'corte');
  if (texto + cortado > 0) {
    console.log(`  nota: ${texto} transbordo(s) de TEXTO e ${cortado} corte(s) por overflow oculto — dependem da fonte, não asseverados.${relato(a)}`);
  }
});
