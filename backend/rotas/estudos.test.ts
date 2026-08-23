import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateTransicao, montarCopiaEstudo, montarPatchEstudo, agruparProdutosPorEstudo } from './estudos.js';

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
