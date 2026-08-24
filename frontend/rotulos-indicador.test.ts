import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROTULOS_INDICADOR, ROTULOS_COM_EXCECAO_DOCUMENTADA } from './rotulos-indicador.js';

// #443 critério de aceite 3: "um teste de unicidade de rótulo... sobre uma
// tabela ROTULOS_INDICADOR exportada (rótulo → função-fonte). O teste afirma
// que nenhum rótulo aparece duas vezes com funções-fonte diferentes."
//
// A tabela é mantida à mão (não há parser de AST aqui) — o que a torna mais
// que decoração são as DUAS asserções abaixo: a de unicidade confere a
// TABELA em si (pega quem adiciona uma entrada conflitante); a de "wiring"
// confere que o texto de cada `rotulo` REALMENTE existe no arquivo citado
// (pega quem reverte um rótulo no componente sem atualizar esta tabela — ou
// vice-versa). Nenhuma das duas sozinha bastaria.

test('ROTULOS_INDICADOR: nenhum rótulo repete com função-fonte diferente (fora das exceções documentadas)', () => {
  const porRotulo = new Map<string, Set<string>>();
  for (const r of ROTULOS_INDICADOR) {
    if (!porRotulo.has(r.rotulo)) porRotulo.set(r.rotulo, new Set());
    porRotulo.get(r.rotulo)!.add(r.fonte);
  }
  for (const [rotulo, fontes] of porRotulo) {
    assert.equal(
      fontes.size, 1,
      `rótulo "${rotulo}" aparece com ${fontes.size} funções-fonte diferentes: ${[...fontes].join(' | ')}. ` +
      'Ou é o mesmo rótulo/fórmula (junte as entradas), ou é uma colisão real (renomeie um dos dois).',
    );
  }
});

test('ROTULOS_INDICADOR: nenhuma entrada duplicada exata (mesmo rótulo + mesmo arquivo)', () => {
  const chaves = new Set<string>();
  for (const r of ROTULOS_INDICADOR) {
    for (const arq of r.arquivos) {
      const chave = `${r.rotulo}::${arq}`;
      assert.ok(!chaves.has(chave), `entrada duplicada: ${chave}`);
      chaves.add(chave);
    }
  }
});

/**
 * Remove comentários (`//...` e `/* ... *&#47;`) antes de procurar um rótulo no
 * código-fonte.
 *
 * ⚠️ Sem isto o teste de wiring é decorativo: os próprios comentários que
 * este PR (#443/#474) acrescentou explicando a renomeação CITAM o texto do
 * rótulo novo em prosa (ex.: "...(VGV potencial, Resultado, Margem de
 * caixa...)"). Reverter o `rotulo="VGV potencial"` de volta para `"VGV"` no
 * template deixa o comentário intacto, e um `includes()` ingênuo continua
 * achando "VGV potencial" — só que na FRASE, não no CÓDIGO. Medido por
 * mutação nesta sessão: reverter os três `rotulo=` de `tela-resumo.ts`
 * SEM esta função passava os 4 testes deste arquivo. Com ela, quebra.
 */
function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('//');
      return i === -1 ? linha : linha.slice(0, i);
    })
    .join('\n');
}

test('ROTULOS_INDICADOR: cada rótulo declarado existe DE FATO no(s) arquivo(s) citado(s), FORA de comentários (wiring)', () => {
  for (const r of ROTULOS_INDICADOR) {
    for (const arq of r.arquivos) {
      // `arq` é relativo à raiz do repo; este arquivo de teste mora em
      // `frontend/`, um nível abaixo — daí o `../`.
      const bruto = readFileSync(new URL(`../${arq}`, import.meta.url), 'utf8');
      const conteudo = semComentarios(bruto);
      assert.ok(
        conteudo.includes(r.rotulo),
        `"${r.rotulo}" não foi encontrado em CÓDIGO (fora de comentários) de ${arq} — a tabela ` +
        'ROTULOS_INDICADOR desincronizou do código (rótulo revertido no componente, ou a tabela ' +
        'nunca foi atualizada). Um comentário citando o texto não basta.',
      );
    }
  }
});

test('ROTULOS_COM_EXCECAO_DOCUMENTADA: as colunas VGV e Margem do Painel REALMENTE usam o mecanismo de title por linha (wiring)', () => {
  // A tabela só documenta a DECISÃO (tooltip por linha em vez de colapsar a
  // grandeza) — quem prova que a tela ainda FAZ isso é este teste, lendo o
  // código-fonte real de `tela-dashboard.ts:_colunas`. Sem ele, alguém pode
  // reverter `render: numeroTitulo(...)` de volta para `valor: numero(...)`
  // (perdendo o `title` que desambigua Preliminar × Avançado) e nada no
  // resto da suíte acusa — medido por mutação nesta sessão: reverter as
  // duas colunas para `valor: numero(...)` deixa `tela-dashboard.test.ts`
  // inteiro verde, porque ele testa `resumoListagem` (a função pura), não a
  // definição de coluna que decide COMO renderizar o valor dela.
  const fonte = semComentarios(readFileSync(new URL('../frontend/tela-dashboard.ts', import.meta.url), 'utf8'));
  for (const id of ['vgv', 'margem']) {
    const idx = fonte.indexOf(`id: '${id}'`);
    assert.ok(idx >= 0, `coluna "${id}" não encontrada em tela-dashboard.ts`);
    const trecho = fonte.slice(idx, idx + 300);
    assert.ok(
      /render:\s*numeroTitulo\(/.test(trecho),
      `coluna "${id}" não usa mais "render: numeroTitulo(...)" — perdeu o title por linha que ` +
      'desambigua Preliminar × Avançado (exceção documentada acima). Se voltou a ser "valor: numero(...)", ' +
      'reverteu a #443 item 2/6 sem querer.',
    );
  }
});

test('ROTULOS_COM_EXCECAO_DOCUMENTADA: cada exceção trava em exatamente DUAS fontes conhecidas', () => {
  for (const [rotulo, fontes] of Object.entries(ROTULOS_COM_EXCECAO_DOCUMENTADA)) {
    assert.equal(
      new Set(fontes).size, 2,
      `exceção "${rotulo}" precisa ter exatamente 2 fontes distintas documentadas (tem ${new Set(fontes).size}) — ` +
      'uma terceira fonte para o mesmo rótulo é uma colisão nova, não uma exceção conhecida.',
    );
  }
  // As duas colunas do Painel que hoje usam esta exceção — se uma delas
  // sumir do código (ex.: painel deixa de existir, ou vira uma coluna por
  // nível), a tabela fica órfã e é hora de apagar a exceção.
  const fonte = readFileSync(new URL('../frontend/tela-dashboard.ts', import.meta.url), 'utf8');
  for (const rotulo of Object.keys(ROTULOS_COM_EXCECAO_DOCUMENTADA)) {
    assert.ok(
      fonte.includes(`label: '${rotulo}'`),
      `coluna "${rotulo}" (exceção documentada) não existe mais em tela-dashboard.ts — apague a exceção`,
    );
  }
});
