// #566: fim da permuta física por seleção de unidade (só m² e % área venda).
//
// `PERMUTA_UNIDADE`/`PERMUTA_FIS_NR` são exatamente o array que o template
// percorre para desenhar as badges (`cu.opcoes.map(...)`, em
// `_custoUnidade`) — testar o array direto não é "cobertura decorativa" no
// sentido que o CLAUDE.md acusa (função pura testada, nunca chamada pela
// tela): aqui não há gap de fiação possível, porque o template lê o MESMO
// objeto que o teste importa. Mutação — recolocar `{ valor: 'unidade', ... }`
// em qualquer um dos dois — deixa este teste vermelho.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERMUTA_UNIDADE, PERMUTA_FIS_NR, modoEfetivo, colunasProduto, linhasCascataIncorporacao, campoMudou } from './tela-premissas.js';

/** Mesma função das outras suítes de fiação — comentário não pode fingir chamada. */
function semComentariosPremissas(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => { const i = linha.indexOf('//'); return i === -1 ? linha : linha.slice(0, i); })
    .join('\n');
}
import type { ProformaInput } from './proforma.js';

test('#566: Permuta física (R/Loteamento) só oferece m² e % área de venda', () => {
  assert.deepEqual(PERMUTA_UNIDADE.opcoes.map((o) => o.valor), ['area_m2', 'pct_area_venda']);
  assert.ok(!PERMUTA_UNIDADE.opcoes.some((o) => o.valor === 'unidade'), 'badge "Unidade" voltou');
});

test('#566: Permuta física não residencial só oferece m² e % área de venda', () => {
  assert.deepEqual(PERMUTA_FIS_NR.opcoes.map((o) => o.valor), ['area_m2', 'pct_area_venda']);
  assert.ok(!PERMUTA_FIS_NR.opcoes.some((o) => o.valor === 'unidade'), 'badge "Unidade" voltou');
});

test('#566: modoEfetivo trata modo aposentado/desconhecido como o padrão do campo', () => {
  // Estudo salvo ANTES da migração 036 rodar: `permuta_fisica_modo` ainda é
  // 'unidade' — a tela não pode indexar `opcoes` fora do array nem travar.
  assert.equal(modoEfetivo(PERMUTA_UNIDADE, 'unidade'), 'area_m2');
  assert.equal(modoEfetivo(PERMUTA_FIS_NR, 'unidade'), 'area_m2');
  // Qualquer outro valor nunca visto (defensivo) cai no mesmo padrão.
  assert.equal(modoEfetivo(PERMUTA_UNIDADE, 'modo_inexistente'), 'area_m2');
  // Sem valor salvo (campo novo/nulo), usa o padrão declarado.
  assert.equal(modoEfetivo(PERMUTA_UNIDADE, undefined), PERMUTA_UNIDADE.padrao);
});

test('#566: modoEfetivo preserva um modo válido em uso (não força o padrão)', () => {
  assert.equal(modoEfetivo(PERMUTA_UNIDADE, 'pct_area_venda'), 'pct_area_venda');
  assert.equal(modoEfetivo(PERMUTA_FIS_NR, 'area_m2'), 'area_m2');
});

// #570 / rodada 1 de revisão — a coluna "Tipo" do grid de Produtos não existe
// no Loteamento.
//
// ⚠️ A prova mora AQUI, e não no harness de render, porque o harness só sabe
// exigir PRESENÇA (`exigir`/`minimo`): ele não conta células nem prova que algo
// está ausente. É o mesmo recurso que a #566 usou para provar que a Permuta
// física parou de oferecer "Unidade" — a lista é exportada e conferida direto.
test('rev1: o grid de Produtos não tem a coluna "Tipo" no Loteamento', () => {
  const chaves = colunasProduto(true).map((c) => c.chave);
  assert.ok(!chaves.includes('tipo'),
    `o Loteamento não edita categoria — o motor normaliza tudo para residencial: ${chaves.join(',')}`);
  assert.deepEqual(chaves, ['nome', 'area', 'preco', 'unidades', 'vgv']);
});

test('rev1: na Incorporação a coluna "Tipo" continua entre Nome e Área média', () => {
  const chaves = colunasProduto(false).map((c) => c.chave);
  assert.deepEqual(chaves, ['nome', 'tipo', 'area', 'preco', 'unidades', 'vgv']);
  // A posição importa: é o que o caso de render `catalogo-produtos-tipo` mede
  // pelo `colgroup`, e as duas provas têm que concordar.
  assert.equal(chaves.indexOf('tipo'), chaves.indexOf('nome') + 1);
  assert.equal(chaves.indexOf('area'), chaves.indexOf('tipo') + 1);
});

test('rev1: as duas configurações diferem em UMA coluna, e só nela', () => {
  const lot = colunasProduto(true).map((c) => c.chave);
  const inc = colunasProduto(false).map((c) => c.chave);
  assert.equal(inc.length, lot.length + 1, 'a diferença tem que ser exatamente uma coluna');
  assert.deepEqual(inc.filter((c) => c !== 'tipo'), lot);
});

// #698 — prova de FIAÇÃO: `linhasCascataIncorporacao` é a MESMA função que
// `_renderTabelaAreasIncorporacao` chama (`frontend/tela-premissas.ts`), então
// este teste quebra se o componente voltar a usar a Área do Terreno como base
// da coluna de %, em vez da Área Potencial (`terreno × coeficiente máximo`).
// Sem esta prova, só a função pura de `areas-cascata.ts` estaria coberta —
// exatamente a classe de defeito "a fiação, não o cálculo" do CLAUDE.md.
test('#698: linhasCascataIncorporacao usa a Área Potencial como base da %, não a Área do Terreno', () => {
  const entrada: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual', terreno_manual_area: 5_760.27,
    coef_aproveitamento_maximo: 3,
  } as ProformaInput;
  // área potencial = 5.760,27 × 3 = 17.280,81 (o mesmo `tetoAproveitamentoM2` do KPI).
  const linhas = linhasCascataIncorporacao(
    { pvt_r_fechada: { modo: 'm2', valor: 14_481.94 } },
    5_760.27,
    entrada,
  );
  const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
  // Contra a Área do Terreno isso daria 100%; contra a Área Potencial, ~33,3%.
  assert.ok(Math.abs(porId.terreno.pctAncora1 - (5_760.27 / 17_280.81) * 100) < 0.01);
  assert.notEqual(Math.round(porId.terreno.pctAncora1), 100, 'regrediu para a base antiga (Área do Terreno)');
  // Contra a Área do Terreno isso daria 251,4% (o número real que motivou a #698).
  assert.ok(Math.abs(porId.pvt_r_fechada.pctAncora1 - (14_481.94 / 17_280.81) * 100) < 0.01);
});

test('#698: linhasCascataIncorporacao cai em 0% sem coeficiente máximo preenchido — sem divisão por zero', () => {
  const entrada: ProformaInput = {
    tipo_empreendimento: 'incorporacao', origem_terreno: 'manual', terreno_manual_area: 5_760.27,
  } as ProformaInput;
  const linhas = linhasCascataIncorporacao({ pvt_r_fechada: { modo: 'm2', valor: 100 } }, 5_760.27, entrada);
  const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
  assert.equal(porId.terreno.pctAncora1, 0);
  assert.equal(porId.pvt_r_fechada.pctAncora1, 0);
});

// ─────────────────────────────────────────────────────────────────────────
// Salvar premissas manda só o DIFF — as duas camadas
// ─────────────────────────────────────────────────────────────────────────
//
// Por que existe: até 2026-09-15 `_salvar` mandava o registro quase inteiro
// (tudo menos 16 chaves de identidade) a partir de um retrato feito quando a
// aba carregou. Enquanto o PATCH falhava — a coluna `decimal` volta do
// Postgres como STRING e o shell recusava por `typeof` —, o estrago ficava
// escondido atrás do erro. Com o PATCH consertado, o eco vira SOBRESCRITA
// silenciosa de campos cujo dono é outra tela (`ret_pct` é escrito por
// Custos → Financeiro; num estudo Avançado, a aba Financeiro inteira, que o
// filtro de nível do backend não protege).
//
// Duas camadas, como `tela-estudo.test.ts` faz: a SEMÂNTICA do predicado, e a
// FIAÇÃO dele (que olha o fonte, porque teste de função pura não prova que o
// componente a chama — classe de defeito nº 1 do CLAUDE.md).

test('campoMudou: campo intocado não conta como alteração, inclusive decimal em string', () => {
  const registro = { ret_pct: '4.00', gabarito_maximo: '12.00', nome: 'X', custo_construcao_m2: '4800.00' };
  const form = { ...registro };
  for (const k of Object.keys(registro)) {
    assert.equal(campoMudou(form, registro, k), false, `${k} não deveria contar como alterado`);
  }
});

test('campoMudou: `\'\'` e `null` são a mesma coisa — limpar input vazio não é edição', () => {
  assert.equal(campoMudou({ a: '' }, { a: null }, 'a'), false);
  assert.equal(campoMudou({ a: null }, { a: '' }, 'a'), false);
  assert.equal(campoMudou({ a: undefined }, { a: null }, 'a'), false);
});

test('campoMudou: edição de verdade conta — inclusive limpar um valor', () => {
  assert.equal(campoMudou({ a: 5 }, { a: '4.00' }, 'a'), true);
  assert.equal(campoMudou({ a: null }, { a: '4.00' }, 'a'), true, 'limpar um custo por unidade é edição');
  assert.equal(campoMudou({ a: 'novo' }, { a: 'velho' }, 'a'), true);
});

test('fiação: `_salvar` pula o campo que não mudou, e usa o MESMO predicado da faixa de não-salvo', () => {
  // Mutação que este teste existe para pegar: apagar o `continue` de `_salvar`
  // devolve o eco do registro inteiro, e nenhum teste de função pura fica
  // vermelho por causa disso.
  const fonte = semComentariosPremissas(
    readFileSync(new URL('./tela-premissas.ts', import.meta.url), 'utf8'),
  );
  assert.match(fonte, /if \(!this\._campoMudou\(k\)\) continue;/,
    '`_salvar` deixou de filtrar pelo diff — o registro inteiro voltou a viajar');
  assert.match(fonte, /_campoMudou\(k: string\): boolean \{\s*return campoMudou\(this\.form, this\._snapshot, k\);/,
    '`_campoMudou` deixou de delegar à função pura testada acima');
  assert.match(fonte, /_formDifereSnapshot\(\): boolean \{\s*return Object\.keys\(this\.form\)\s*\.filter\(\(k\) => !CHAVES_NAO_ENVIADAS\.has\(k\)\)\s*\.some\(\(k\) => this\._campoMudou\(k\)\);/,
    'a faixa de "alterações não salvas" deixou de varrer o MESMO conjunto de chaves do Salvar');
  assert.match(fonte, /if \(CHAVES_NAO_ENVIADAS\.has\(k\)\) continue;/,
    '`_salvar` deixou de usar a lista compartilhada — duas listas iguais divergem');
});
