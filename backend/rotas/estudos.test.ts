import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateTransicao, montarCopiaEstudo } from './estudos.js';

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
