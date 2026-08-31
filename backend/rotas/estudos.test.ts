import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gateTransicao, montarCopiaEstudo, montarPatchEstudo, agruparProdutosPorEstudo,
  percentualEstrito,
  montarCopiasFilhas, FILHAS_SIMPLES,
} from './estudos.js';
import { CAMPOS as CAMPOS_PRODUTO } from './preliminar-produtos.js';
import { readFileSync } from 'node:fs';

// Ciclo de vida do estudo (spec §3):
//   rascunho → em_analise (editor)
//   em_analise → aprovado | reprovado | rascunho (aprovador)
//   arquivado → rascunho (aprovador reabre)
//   * → arquivado (aprovador), exceto de aprovado/arquivado

test('editor submete rascunho para em_analise', () => {
  assert.equal(gateTransicao('rascunho', 'em_analise'), 'editor');
});

test('aprovador aprova, reprova e devolve estudos em análise', () => {
  assert.equal(gateTransicao('em_analise', 'aprovado'), 'aprovador');
  assert.equal(gateTransicao('em_analise', 'reprovado'), 'aprovador');
  assert.equal(gateTransicao('em_analise', 'rascunho'), 'aprovador');
});

test('aprovador reabre estudo arquivado para rascunho', () => {
  assert.equal(gateTransicao('arquivado', 'rascunho'), 'aprovador');
});

test('arquivamento manual exige aprovador e não vale para aprovado/arquivado', () => {
  assert.equal(gateTransicao('rascunho', 'arquivado'), 'aprovador');
  assert.equal(gateTransicao('em_analise', 'arquivado'), 'aprovador');
  assert.equal(gateTransicao('reprovado', 'arquivado'), 'aprovador');
  assert.equal(gateTransicao('aprovado', 'arquivado'), null);
  assert.equal(gateTransicao('arquivado', 'arquivado'), null);
});

test('transições inválidas retornam null', () => {
  assert.equal(gateTransicao('rascunho', 'aprovado'), null); // pula em_analise
  assert.equal(gateTransicao('rascunho', 'reprovado'), null);
  assert.equal(gateTransicao('aprovado', 'em_analise'), null);
  assert.equal(gateTransicao('reprovado', 'rascunho'), null);
  assert.equal(gateTransicao('em_analise', 'em_analise'), null); // no-op
});

// ── Duplicação: montar cópia sem reenviar numéricos opcionais nulos (#244) ──

test('montarCopiaEstudo remove campos gerados/de junção do shell', () => {
  const orig = {
    id: 7, id_legivel: 'INC-0007', nome_exibicao: 'X', sequencia: 7, status: 'aprovado',
    autor_id: 3, autor_nome: 'Ana', autor_avatar_url: 'u', criado_em: 't', atualizado_em: 't',
    removido_em: null, removido_por_id: null,
    nome: 'Estudo', tipo_empreendimento: 'incorporacao', uf: 'DF',
  };
  const copia = montarCopiaEstudo(orig);
  for (const k of ['id', 'id_legivel', 'nome_exibicao', 'sequencia', 'status', 'autor_id',
    'autor_nome', 'autor_avatar_url', 'criado_em', 'atualizado_em', 'removido_em', 'removido_por_id']) {
    assert.equal(k in copia, false, `${k} não deve ser copiado`);
  }
  assert.deepEqual(copia, { nome: 'Estudo', tipo_empreendimento: 'incorporacao', uf: 'DF' });
});

test('montarCopiaEstudo omite numéricos nulos do Avançado num Preliminar', () => {
  // Um Preliminar deixa os campos exclusivos do Avançado em null; reenviá-los
  // faria o validador do shell recusar a criação com "deve ser um número".
  const preliminar = {
    id: 1, status: 'rascunho', autor_id: 2,
    nome: 'Terreno A', tipo_empreendimento: 'loteamento', uf: 'GO',
    nivel_analise: 'preliminar', origem_terreno: 'manual',
    taxa_desconto_aa: null, estrutura_capital_proprio_pct: null,
    aliquota_pis_pct: null, financiamento_prazo_meses: null, investidor_aporte_valor: null,
    terreno_manual_area: null,
  };
  const copia = montarCopiaEstudo(preliminar);
  for (const k of ['taxa_desconto_aa', 'estrutura_capital_proprio_pct', 'aliquota_pis_pct',
    'financiamento_prazo_meses', 'investidor_aporte_valor', 'terreno_manual_area']) {
    assert.equal(k in copia, false, `${k} nulo não deve ser reenviado`);
  }
  // Campos preenchidos seguem copiados.
  assert.equal(copia.nome, 'Terreno A');
  assert.equal(copia.nivel_analise, 'preliminar');
  assert.equal(copia.origem_terreno, 'manual');
});

test('montarCopiaEstudo preserva numéricos preenchidos de um Avançado', () => {
  const avancado = {
    id: 9, status: 'aprovado', autor_id: 4,
    nome: 'Torre B', tipo_empreendimento: 'incorporacao', uf: 'DF',
    nivel_analise: 'avancado',
    taxa_desconto_aa: 12.5, financiamento_prazo_meses: 36, investidor_aporte_valor: 0,
  };
  const copia = montarCopiaEstudo(avancado);
  assert.equal(copia.taxa_desconto_aa, 12.5);
  assert.equal(copia.financiamento_prazo_meses, 36);
  assert.equal(copia.investidor_aporte_valor, 0); // zero é valor válido, não nulo
});

// ── agruparProdutosPorEstudo (#407) ─────────────────────────────────────
//
// `GET /estudos` não devolvia `produtos`, e `calcularProforma` escolhe a
// fonte do VGV pela PRESENÇA deles: sem a lista, um estudo Preliminar cujo
// VGV vem só do catálogo caía no ramo legado (área × preço, vazio) e a
// listagem mostrava "—" em VGV, Resultado e Margem.

test('#407 agrupa produtos por estudo e ignora os de estudos fora da página', () => {
  const produtos = [
    { id: 1, estudo_id: 10, nome: 'Tipo A' },
    { id: 2, estudo_id: 10, nome: 'Tipo B' },
    { id: 3, estudo_id: 11, nome: 'Tipo C' },
    { id: 4, estudo_id: 99, nome: 'de outro estudo' },
  ];
  const r = agruparProdutosPorEstudo(produtos, new Set([10, 11]));
  assert.deepEqual(r.get(10)?.map((p) => p.id), [1, 2]);
  assert.deepEqual(r.get(11)?.map((p) => p.id), [3]);
  assert.equal(r.has(99), false, 'produto de estudo fora da página não pode entrar');
});

test('#407 estudo_id vem como string do banco e ainda assim casa', () => {
  const r = agruparProdutosPorEstudo([{ id: 1, estudo_id: '10' }], new Set([10]));
  assert.equal(r.get(10)?.length, 1);
});

test('#407 lista vazia, nula ou sem correspondência não quebra', () => {
  assert.equal(agruparProdutosPorEstudo([], new Set([1])).size, 0);
  assert.equal(agruparProdutosPorEstudo(undefined as any, new Set([1])).size, 0);
  assert.equal(agruparProdutosPorEstudo([{ id: 1, estudo_id: 7 }], new Set([1])).size, 0);
});

// ─────────────────────────────────────────────────────────────────────────
// #486 — nao existe promocao Preliminar -> Avancado, e por isso nada converte
// ─────────────────────────────────────────────────────────────────────────
//
// A issue perguntava se os 18% de permuta fisica sumiram porque a promocao de
// nivel nao converte. A resposta e que NAO EXISTE promocao: `nivel_analise` e
// imutavel apos a criacao (`estudos.ts`, 422 NIVEL_IMUTAVEL), e a duplicacao
// PRESERVA o nivel e os campos de permuta. O estado observado em Pinguim
// (`modo: 'area_m2'` com valores nulos e quantidade 0) e o PADRAO de criacao
// declarado em `schema.json` (`permuta_fisica_modo.padrao = "area_m2"`), nao o
// residuo de uma conversao perdida.
//
// Estes testes existem para que, no dia em que alguem adicionar um caminho de
// promocao, ele nao possa ser adicionado em silencio: a conversao
// `pct_area_venda -> area_m2` vira requisito explicito, e nao descoberta de
// auditoria seis meses depois.

test('#486: duplicar PRESERVA o nivel de analise — nao ha promocao por copia', () => {
  const preliminar = {
    id: 7, nivel_analise: 'preliminar', nome: 'Calliandra',
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 18,
  };
  const copia = montarCopiaEstudo(preliminar);
  assert.equal(copia.nivel_analise, 'preliminar');
});

test('#486: duplicar carrega a permuta em percentual, em vez de zera-la', () => {
  // Se a copia perdesse estes campos, ela SIM produziria o estado observado —
  // e ai a hipotese de bug de conversao voltaria a valer.
  const preliminar = {
    id: 7, nivel_analise: 'preliminar',
    permuta_fisica_modo: 'pct_area_venda',
    permuta_fisica_pct: 18,
    permuta_fisica_area_m2: null,
    permuta_fisica_area_canonica: null,
  };
  const copia = montarCopiaEstudo(preliminar);
  assert.equal(copia.permuta_fisica_modo, 'pct_area_venda');
  assert.equal(copia.permuta_fisica_pct, 18);
  // Os nulos continuam omitidos, para o padrao do schema valer na copia.
  assert.ok(!('permuta_fisica_area_m2' in copia));
  assert.ok(!('permuta_fisica_area_canonica' in copia));
});

test('#486: um Avancado com permuta em area_m2 mantem os valores na copia', () => {
  const avancado = {
    id: 9, nivel_analise: 'avancado',
    permuta_fisica_modo: 'area_m2',
    permuta_fisica_area_m2: 1234.56,
    permuta_fisica_quantidade: 42,
  };
  const copia = montarCopiaEstudo(avancado);
  assert.equal(copia.nivel_analise, 'avancado');
  assert.equal(copia.permuta_fisica_area_m2, 1234.56);
  assert.equal(copia.permuta_fisica_quantidade, 42);
});

// ─────────────────────────────────────────────────────────────────────────
// #486 — o guard em que o veredito se apoia, agora alcancavel por teste
// ─────────────────────────────────────────────────────────────────────────
//
// A primeira versao deste PR declarava que nenhum teste puro alcanca o 422
// NIVEL_IMUTAVEL porque ele mora inline no handler. Era verdade, e era desculpa:
// o mesmo arquivo ja tinha extraido `gateTransicao` e `montarCopiaEstudo` por
// esse exato motivo. Como TODO o veredito da #486 se apoia neste guard, deixa-lo
// sem teste era deixar sem teste justamente a peca que importa.

const AVANCADO = { nivel_analise: 'avancado', status: 'em_analise' };
const PRELIMINAR = { nivel_analise: 'preliminar', status: 'em_analise' };

test('#486: trocar nivel_analise e recusado com 422 NIVEL_IMUTAVEL', () => {
  const r = montarPatchEstudo({ nivel_analise: 'preliminar', nome: 'x' }, AVANCADO);
  assert.deepEqual(r, {
    http: 422, codigo: 'NIVEL_IMUTAVEL',
    mensagem: 'nivel_analise não pode ser alterado após a criação do estudo',
  });
});

test('#486: recusa vale nos DOIS sentidos', () => {
  const r = montarPatchEstudo({ nivel_analise: 'avancado' }, PRELIMINAR);
  assert.equal('codigo' in r && r.codigo, 'NIVEL_IMUTAVEL');
});

test('#486: repetir o nivel ATUAL passa, e nao vai para o banco', () => {
  // O payload da tela costuma reenviar o objeto inteiro; recusar isso quebraria
  // o salvamento normal. O campo e ignorado, nao gravado.
  const r = montarPatchEstudo({ nivel_analise: 'avancado', nome: 'x' }, AVANCADO);
  assert.deepEqual(r, { dados: { nome: 'x' } });
});

test('#486: o guard nao depende da ORDEM das chaves do payload', () => {
  // `nivel_analise` depois de um campo valido ainda recusa — o laco nao
  // "escapa" por ja ter montado dados.
  const r = montarPatchEstudo({ nome: 'x', uf: 'DF', nivel_analise: 'preliminar' }, AVANCADO);
  assert.equal('codigo' in r && r.codigo, 'NIVEL_IMUTAVEL');
});

test('#486: nivel_analise NAO esta entre os campos engolidos em silencio', () => {
  // Duas armadilhas reais: se o campo estivesse em CAMPOS_BLOQUEADOS_PATCH ou em
  // CAMPOS_SOMENTE_AVANCADO, o `continue` correria ANTES do guard e a troca
  // passaria calada, sem erro e sem gravar. Este teste morre nos dois casos.
  const r = montarPatchEstudo({ nivel_analise: 'avancado' }, PRELIMINAR);
  assert.ok('codigo' in r, 'trocar o nivel tem que ERRAR, nao ser ignorado');
});

test('PATCH: tipo_empreendimento so muda em rascunho', () => {
  assert.equal(
    'codigo' in (montarPatchEstudo({ tipo_empreendimento: 'loteamento' }, AVANCADO) as any)
      && (montarPatchEstudo({ tipo_empreendimento: 'loteamento' }, AVANCADO) as any).codigo,
    'TIPO_TRAVADO');
  assert.deepEqual(
    montarPatchEstudo({ tipo_empreendimento: 'loteamento' }, { ...AVANCADO, status: 'rascunho' }),
    { dados: { tipo_empreendimento: 'loteamento' } });
});

test('PATCH: campo bloqueado sozinho da NENHUM_CAMPO, nao grava id', () => {
  const r = montarPatchEstudo({ id: 99, status: 'aprovado' }, AVANCADO);
  assert.equal('codigo' in r && r.codigo, 'NENHUM_CAMPO');
});

test('PATCH: campo so-do-Avancado e filtrado em estudo Preliminar', () => {
  // Sem isso o shell devolve "Campo X deve ser um numero" ao salvar Premissas.
  assert.equal('codigo' in montarPatchEstudo({ taxa_desconto_aa: null }, PRELIMINAR), true);
  assert.deepEqual(montarPatchEstudo({ taxa_desconto_aa: 12 }, AVANCADO), { dados: { taxa_desconto_aa: 12 } });
});

// ── #609: duplicar copia absolutamente tudo ────────────────────────────────
//
// Decisão do autor (2026-08-28), verbatim: "o correto é copiar absolutamente
// tudo, se for difícil fazer isso me avise". A parte PURA da cópia é
// `montarCopiasFilhas` — o resto é I/O e fica com o autor no ambiente
// autenticado (SDK 401 aqui). Molde de `agruparProdutosPorEstudo`, acima.

test('#609 montarCopiasFilhas reaponta estudo_id e leva só os campos declarados', () => {
  const produtos = [
    { id: 7, estudo_id: 1, nome: 'Lote padrão', tipo: 'residencial', area_media_m2: 300, preco_venda_m2: 1000, unidades: 130, ordem: 0, criado_em: '2026-01-01' },
    { id: 8, estudo_id: 1, nome: 'Lote esquina', tipo: 'residencial', area_media_m2: 450, preco_venda_m2: 1200, unidades: 20, ordem: 1, criado_em: '2026-01-02' },
  ];
  const copias = montarCopiasFilhas(produtos, 99, CAMPOS_PRODUTO);
  assert.equal(copias.length, 2);
  assert.deepEqual(copias[0], {
    estudo_id: 99, nome: 'Lote padrão', tipo: 'residencial',
    area_media_m2: 300, preco_venda_m2: 1000, unidades: 130, ordem: 0,
  });
  // O que NÃO viaja é o ponto: `id` e `criado_em` são do shell, e mandá-los no
  // `criar` é erro de gravação, não uma cópia mais fiel.
  for (const c of copias) {
    assert.equal('id' in c, false);
    assert.equal('criado_em' in c, false);
    assert.equal(c.estudo_id, 99, 'toda linha aponta para o estudo NOVO');
  }
});

test('#609 campo ausente é OMITIDO (cai no padrão da coluna), não vira null', () => {
  // Produto criado por "Adicionar produto": só `nome` e `ordem`; `tipo` cai no
  // padrão `residencial` da coluna, e `unidades`/`ordem` nos seus. Mandar
  // `undefined` explícito faria o validador do shell recusar — mesma razão de
  // `montarCopiaEstudo` omitir nulos.
  const [copia] = montarCopiasFilhas([{ id: 1, estudo_id: 3, nome: '', ordem: 0 }], 5, CAMPOS_PRODUTO);
  assert.deepEqual(copia, { estudo_id: 5, nome: '', ordem: 0 });
  assert.equal('tipo' in copia, false);
  assert.equal('area_media_m2' in copia, false);
});

test('#609 valor NULO viaja (é dado), diferente de campo ausente', () => {
  // Distinção que a omissão acima não pode engolir: `preco_venda_m2: null` é
  // "o usuário apagou o preço", e a cópia precisa nascer igual — não com o
  // padrão da coluna.
  const [copia] = montarCopiasFilhas(
    [{ id: 1, estudo_id: 3, nome: 'X', tipo: 'nao_residencial', area_media_m2: 100, preco_venda_m2: null, unidades: 0, ordem: 2 }],
    5, CAMPOS_PRODUTO,
  );
  assert.equal(copia.preco_venda_m2, null);
  assert.equal(copia.tipo, 'nao_residencial');
});

test('#609 lista vazia, nula ou indefinida devolve lista vazia', () => {
  assert.deepEqual(montarCopiasFilhas([], 1, CAMPOS_PRODUTO), []);
  assert.deepEqual(montarCopiasFilhas(null as any, 1, CAMPOS_PRODUTO), []);
  assert.deepEqual(montarCopiasFilhas(undefined as any, 1, CAMPOS_PRODUTO), []);
});

test('#609 o catálogo de Produtos está entre as filhas copiadas, com os campos da rota', () => {
  // A fiação: a tabela existir não basta — ela precisa estar na LISTA que o
  // `duplicar` percorre, e com a mesma lista de campos que a rota de Produtos
  // grava. Sem esta asserção, apagar a entrada deixaria a suíte verde.
  const produtos = FILHAS_SIMPLES.find((f) => f.tabela === 'preliminar_produtos');
  assert.ok(produtos, 'preliminar_produtos saiu de FILHAS_SIMPLES — é o P1 desta issue');
  assert.deepEqual(produtos!.campos, CAMPOS_PRODUTO,
    'os campos da cópia divergiram dos que a rota de Produtos grava');
});

test('#609 as três filhas de remapeamento simples estão declaradas, e nenhuma tabela MORTA entrou', () => {
  assert.deepEqual(
    FILHAS_SIMPLES.map((f) => f.tabela),
    ['preliminar_produtos', 'analise_mercado', 'apelo_comercial'],
  );
  // O `deepEqual` acima é a trava contra as tabelas de modelos APAGADOS
  // (avancado_linhas_receita e a aposentada avancado_capital_instrumentos, do
  // Capital Stack da #355): a lista é comparada por CONTAGEM EXATA, então
  // qualquer entrada a mais — morta ou viva — fica vermelha. Os nomes ficam
  // neste comentário de propósito: `guard-tabelas-obsoletas` barra menção de
  // tabela aposentada em CÓDIGO fora dos caminhos permitidos, e comentário é
  // a forma dispensada. Copiá-las propagaria dado morto a todo estudo duplicado.
  // E nenhuma das que dependem de remapeamento de id pode estar aqui: elas
  // precisam de mais que um `estudo_id` novo.
  for (const comRemap of ['estudo_imoveis', 'avancado_fases', 'avancado_linhas_custo', 'avancado_funding_operacoes']) {
    assert.equal(FILHAS_SIMPLES.some((f) => f.tabela === comRemap), false, `${comRemap} exige remapeamento`);
  }
});

test('#609 toda filha declara `por_pagina` acima de 1 — sem truncamento silencioso', () => {
  // Um `por_pagina: 1` aqui copiaria UMA linha do catálogo e nada acusaria: a
  // cópia teria produtos, só que menos. É o mesmo cuidado do `anexarProdutos`.
  for (const f of FILHAS_SIMPLES) {
    assert.ok(f.porPagina > 1, `${f.tabela} com por_pagina=${f.porPagina}`);
    assert.ok(f.campos.length > 0, `${f.tabela} sem campos declarados`);
  }
});

// ── #609: a FIAÇÃO da duplicação ───────────────────────────────────────────
//
// ⚠️ POR QUE LER O FONTE. `FILHAS_SIMPLES` e `montarCopiasFilhas` são dados e
// função pura: apagar o LAÇO que percorre a lista dentro de
// `POST /estudos/:id/duplicar` deixa **todos** os testes acima verdes, e a
// duplicação volta a não copiar nada — que é exatamente o defeito desta issue.
// Subir servidor e banco para provar isto não é possível nesta sessão (o SDK é
// privado e dá 401), então a camada que resta é a leitura do código-fonte.
// Mesma técnica de `frontend/tela-graficos.test.ts`, e pela mesma razão.
//
// Os comentários são removidos antes do casamento porque este próprio arquivo
// e o de rotas CITAM os nomes na prosa: um `includes()` ingênuo continuaria
// achando `montarCopiasFilhas` depois de alguém apagar a chamada.
function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => { const i = linha.indexOf('//'); return i === -1 ? linha : linha.slice(0, i); })
    .join('\n');
}

const FONTE_ESTUDOS = semComentarios(
  readFileSync(new URL('./estudos.ts', import.meta.url), 'utf8'),
);

test('#609 a rota de duplicar PERCORRE FILHAS_SIMPLES e chama montarCopiasFilhas', () => {
  assert.ok(
    /for \(const \{[^}]*\} of FILHAS_SIMPLES\)/.test(FONTE_ESTUDOS),
    'o laço sobre FILHAS_SIMPLES sumiu de estudos.ts — sem ele a lista existe e ninguém a usa, ' +
    'e a duplicação volta a não copiar o catálogo de Produtos (o P1 da #609).',
  );
  // Âncora na forma de CHAMADA (`of montarCopiasFilhas(`), nunca no identificador
  // solto: /montarCopiasFilhas\(/ casaria com a própria DECLARAÇÃO da função, que
  // sobrevive a qualquer mutação do sítio de chamada — defesa declarada e
  // inexistente, a classe do #491/PR 557 (achado da lente na rodada 1 deste PR).
  assert.ok(
    /of montarCopiasFilhas\(/.test(FONTE_ESTUDOS),
    'estudos.ts declara montarCopiasFilhas mas não a CHAMA no laço das filhas.',
  );
  // A cópia tem que ficar DENTRO do try/catch compensatório (critério 2 da
  // issue): o laço aparece depois do `try {` e antes do `catch (falha)`.
  // Âncoras que sobrevivem à remoção dos comentários: a criação do estudo novo
  // (última linha ANTES do try) e o `catch (falha)` que o compensa.
  const posCriarEstudo = FONTE_ESTUDOS.indexOf("criar('estudos', copia)");
  const posCatch = FONTE_ESTUDOS.indexOf('catch (falha)');
  const posLaco = FONTE_ESTUDOS.search(/for \(const \{[^}]*\} of FILHAS_SIMPLES\)/);
  assert.ok(posCriarEstudo !== -1 && posCatch !== -1, 'as âncoras do try/catch mudaram de forma');
  assert.ok(posLaco > posCriarEstudo && posLaco < posCatch,
    'a cópia das filhas saiu do try/catch que remove o estudo novo quando uma estrutura filha falha');
});

const FONTE_AVANCADO = semComentarios(
  readFileSync(new URL('./avancado.ts', import.meta.url), 'utf8'),
);

test('#609 duplicarDadosAvancado copia as operações de funding, com os dois remapeamentos', () => {
  assert.ok(
    /criar\('avancado_funding_operacoes'/.test(FONTE_AVANCADO),
    'duplicarDadosAvancado parou de criar avancado_funding_operacoes — um Avançado duplicado ' +
    'perde a estrutura de capital inteira, e o fluxo alavancado da cópia nasce diferente.',
  );
  // Âncora na forma de CHAMADA com o argumento real (`= remapearCustoLinhaIds(op.`),
  // nunca no identificador solto: /remapearCustoLinhaIds\(/ casaria com a própria
  // DECLARAÇÃO da função em avancado.ts, e a mutação "copiar cru" — exatamente o
  // defeito que este PR conserta — ficava verde (medido: 156/156 com a chamada
  // apagada). Achado da lente na rodada 1 deste PR.
  assert.ok(
    /custo_linha_ids = remapearCustoLinhaIds\(op\./.test(FONTE_AVANCADO),
    'custo_linha_ids voltou a ser copiado CRU — a base do financiamento da cópia passaria a ' +
    'apontar para linhas de custo do estudo original.',
  );
  assert.ok(
    /fase_ancora_id = mapaFase\.get\(Number\(op\./.test(FONTE_AVANCADO),
    'fase_ancora_id da OPERAÇÃO de funding voltou a viajar cru — a âncora `Number(op.` ' +
    'distingue este remapeamento do das linhas de custo (`Number(custo.`).',
  );
  assert.ok(
    /mapaCusto\.set\(/.test(FONTE_AVANCADO),
    'o mapa id-antigo → id-novo das linhas de custo sumiu; sem ele não há como remapear.',
  );
  assert.ok(
    /copia\.permuta_tipologia_id = mapaTipologia\.get\(/.test(FONTE_AVANCADO),
    'permuta_tipologia_id voltou a viajar cru — a linha de permuta física da cópia apontaria ' +
    'para uma tipologia do estudo ORIGINAL.',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// #585 — o domínio de `juros_tabela_aa_padrao` no PATCH
// ─────────────────────────────────────────────────────────────────────────
//
// A coluna deixou de ser default de linhas novas e passou a governar o cálculo
// de TODAS as linhas de receita. A tela barra em `erroJurosTabelaEstudo`, mas
// tela é feedback, não fronteira — `PATCH /estudos/:id` é chamável direto.
//
// ⚠️ Este arquivo NÃO roda no ambiente Claude Code (o `express` não instala pelo
// 401 do SDK). A execução é do autor, no ambiente autenticado.

test('#585 PATCH recusa juros_tabela_aa_padrao negativo', () => {
  const r = montarPatchEstudo({ juros_tabela_aa_padrao: -5 }, AVANCADO);
  assert.ok('codigo' in r, 'taxa negativa passou pelo PATCH');
  assert.equal((r as any).codigo, 'TAXA_INVALIDA');
  assert.equal((r as any).http, 400);
  // A faixa que o motor NÃO defende: ele só clampa `aa <= -100`.
  assert.ok('codigo' in montarPatchEstudo({ juros_tabela_aa_padrao: -0.01 }, AVANCADO));
  assert.ok('codigo' in montarPatchEstudo({ juros_tabela_aa_padrao: 'abc' }, AVANCADO));
});

test('#585 PATCH aceita 0, valor positivo e limpeza da taxa', () => {
  // `0` é "venda sem juros", escolha explícita — nunca pode virar erro.
  assert.ok('dados' in montarPatchEstudo({ juros_tabela_aa_padrao: 0 }, AVANCADO));
  assert.ok('dados' in montarPatchEstudo({ juros_tabela_aa_padrao: 12.5 }, AVANCADO));
  // `null` é "não configurado" e continua sendo gravável — é como o usuário
  // esvazia o campo.
  assert.ok('dados' in montarPatchEstudo({ juros_tabela_aa_padrao: null }, AVANCADO));
});

// A MESMA tabela de `frontend/tela-financeiro.test.ts`. Ela existe porque
// `estudos.juros_tabela_aa_padrao` é validada em três runtimes que não podem
// compartilhar código — tela, PATCH e a migração `037` —, e três regras para um
// campo é exatamente como a classe de defeito da #585 começa.
//
// Medido antes do conserto: a migração rejeitava `'0x10'`, `'1e3'`, `'  '`,
// `true` e `[]`, e o PATCH os aceitava como 16, 1000, 0, 1 e 0.
//
// ⚠️ Este arquivo NÃO roda no ambiente Claude Code (o `express` não instala
// pelo 401 do SDK). A execução é do autor.
const ENTRADAS_DA_COLUNA: Array<[unknown, boolean, string]> = [
  [12.5,     true,  'número decimal, o caso normal'],
  [0,        true,  '0% é venda sem juros — escolha explícita'],
  ['12.5',   true,  'string decimal é aceitável: vem do JSON/PATCH'],
  [-5,       false, 'negativo inverte o fluxo de caixa do estudo'],
  [-0.01,    false, 'a faixa que o motor NÃO defende'],
  ['0x10',   false, "Number('0x10') é 16"],
  ['1e3',    false, "Number('1e3') é 1000"],
  ['  ',     false, "Number('  ') é 0"],
  ['12,5',   false, 'vírgula: é dado persistido, não digitação'],
  ['abc',    false, 'lixo'],
  [true,     false, 'Number(true) é 1'],
  [[],       false, 'Number([]) é 0'],
  [[12.5],   false, 'Number([12.5]) é 12.5 — array não é número'],
  [{},       false, 'objeto'],
  ['+12.5', true,  'sinal positivo: decimal inequívoco que o leitor antigo lia'],
  ['.5',    true,  'ponto inicial: idem'],
  ['12.',   true,  'ponto final: idem'],
  [Infinity, false, 'não finito'],
  [NaN,      false, 'não finito'],
];

test('#585 o PATCH usa a MESMA tabela de entradas que a tela', () => {
  for (const [valor, aceita, motivo] of ENTRADAS_DA_COLUNA) {
    const r = montarPatchEstudo({ juros_tabela_aa_padrao: valor }, AVANCADO);
    const passou = 'dados' in r;
    assert.equal(passou, aceita,
      `${JSON.stringify(valor)} deveria ser ${aceita ? 'aceito' : 'recusado'} pelo PATCH — ${motivo}`);
    if (!passou) assert.equal((r as any).codigo, 'TAXA_INVALIDA');
  }
});

test('#585 percentualEstrito não é Number(): rejeita hex, científica e espaço', () => {
  // O predicado sozinho, para o erro apontar a função e não a rota.
  assert.equal(percentualEstrito('0x10'), null);
  assert.equal(percentualEstrito('1e3'), null);
  assert.equal(percentualEstrito('  '), null);
  assert.equal(percentualEstrito(true), null);
  assert.equal(percentualEstrito([] as unknown), null);
  assert.equal(percentualEstrito(12.5), 12.5);
  assert.equal(percentualEstrito('12.5'), 12.5);
  assert.equal(percentualEstrito(' -3 '), -3, 'o sinal é lido; quem recusa negativo é o chamador');
});
