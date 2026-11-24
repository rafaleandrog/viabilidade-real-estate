// Render da sub-aba Data room de Empreendimento no Avançado. Prova a fiação até
// a tela: a sub-aba monta o `viab-data-room`, que carrega as duas rotas e
// desenha as seis categorias com o checklist. Nenhum teste de função pura
// (`frontend/data-room.test.ts`) alcança isto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('Data room: a sub-aba monta o painel com as 6 categorias e o checklist', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'data-room', larguras: [900] });

  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  // Geometria da página inteira não é julgada aqui: o transbordo de 2px do `div.layout` da
  // tela-avancado vem do stub de `urbi-nav`, fora do painel. Este caso prova a FIAÇÃO e o conteúdo.
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));

  const m = a.extra?.['900'] as
    | { ativa: boolean; arquivoApelo: string[]; secoes: string[]; nomes: string[]; checklist: string[]; semTipo: string[] }
    | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra' + relato(a));
  assert.equal(m!.ativa, true, 'o painel deve receber ativa=true quando a sub-aba Data room é a ativa' + relato(a));
  assert.deepEqual(m!.arquivoApelo, ['arquivo no Apelo Comercial'],
    'a fonte do Apelo com arquivo diz onde abrir, sem prometer link' + relato(a));
  assert.deepEqual(
    m!.secoes, ['terreno', 'juridico', 'projeto', 'comercial', 'financeiro', 'outros'],
    'as 6 seções, na ordem' + relato(a),
  );
  assert.deepEqual(
    m!.nomes.sort(),
    ['Texto: Anúncios coletados na região', 'capa.png', 'mercado.pdf', 'planta-tipo.pdf'],
    'todo documento anexado aparece, inclusive a fonte só de texto' + relato(a),
  );
  assert.ok(m!.checklist.some((t) => t.startsWith('✓ Planta')), 'Planta presente' + relato(a));
  assert.ok(m!.checklist.some((t) => t.includes('Render') && t.includes('pendente')), 'Render pendente' + relato(a));
  assert.equal(m!.semTipo.filter((t) => t.includes('Ainda não há tipo de documento')).length, 3,
    'Terreno, Jurídico e Financeiro dizem que ainda não há tipo' + relato(a));
});

test('Data room: rota do Apelo falha -> checklist dela "não verificado", não "pendente"', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'data-room-falha', larguras: [900] });
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  const m = a.extra?.['900'] as { checklist: string[]; semTipo: string[] } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra' + relato(a));
  assert.equal(m!.checklist.filter((t) => t.includes('não verificado')).length, 3,
    'Anúncios, População e Mercado ficam não verificados' + relato(a));
  assert.ok(m!.checklist.some((t) => t.startsWith('✓ Planta')), 'a fonte que carregou segue verificada' + relato(a));
  assert.ok(m!.checklist.some((t) => t.includes('Render') && t.includes('pendente')), 'Render segue pendente' + relato(a));
  assert.ok(!m!.checklist.some((t) => t.includes('Mercado') && t.includes('pendente')), 'Mercado não é pendente' + relato(a));
  assert.equal(m!.semTipo.filter((t) => t.includes('Não foi possível carregar estes documentos')).length, 2,
    'Comercial e Outros (que recebe do Apelo) avisam a falha' + relato(a));
});
