import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contarConfiguracoesAvancadas,
  type LinhaReceitaAuditavel,
} from './auditoria-configuracoes.js';

test('#464: linha vazia — todos os contadores zerados, exceto total', () => {
  const r = contarConfiguracoesAvancadas([]);
  assert.deepEqual(r, {
    total: 0, comTaxa: 0, comSinal: 0, comJurosNaContratacao: 0,
    absorcaoPersonalizada: 0, ramoLegado: 0,
  });
});

test('#464: linhas null/undefined não quebra — trata como vazio', () => {
  assert.equal(contarConfiguracoesAvancadas(null).total, 0);
  assert.equal(contarConfiguracoesAvancadas(undefined).total, 0);
});

test('#464: ramoLegado — componentes AUSENTE conta; componentes [] (array vazio) NÃO conta', () => {
  const semComponentes: LinhaReceitaAuditavel = { fluxo_pagamento: {} };
  const componentesNulo: LinhaReceitaAuditavel = { fluxo_pagamento: { componentes: null } };
  const componentesVazio: LinhaReceitaAuditavel = { fluxo_pagamento: { componentes: [] } };
  const semFluxoPagamento: LinhaReceitaAuditavel = {};

  const r1 = contarConfiguracoesAvancadas([semComponentes]);
  assert.equal(r1.ramoLegado, 1);
  assert.equal(r1.total, 1);

  const r2 = contarConfiguracoesAvancadas([componentesNulo]);
  assert.equal(r2.ramoLegado, 1);

  // Array vazio é um `componentes` VÁLIDO, só sem itens — não é ramo legado.
  const r3 = contarConfiguracoesAvancadas([componentesVazio]);
  assert.equal(r3.ramoLegado, 0);
  assert.equal(r3.comTaxa, 0);

  const r4 = contarConfiguracoesAvancadas([semFluxoPagamento]);
  assert.equal(r4.ramoLegado, 1);
});

test('#464: comTaxa — taxaMensal 0, null e undefined NÃO contam; número ≠ 0 conta', () => {
  const linha = (taxaMensal: unknown): LinhaReceitaAuditavel => ({
    fluxo_pagamento: { componentes: [{ tipo: 'prazo_fixo', taxaMensal }] },
  });
  assert.equal(contarConfiguracoesAvancadas([linha(0)]).comTaxa, 0);
  assert.equal(contarConfiguracoesAvancadas([linha(null)]).comTaxa, 0);
  assert.equal(contarConfiguracoesAvancadas([linha(undefined)]).comTaxa, 0);
  assert.equal(contarConfiguracoesAvancadas([linha('')]).comTaxa, 0);
  assert.equal(contarConfiguracoesAvancadas([linha(0.0098636)]).comTaxa, 1);
  // exatamente o caso real do estudo 5 de Pinguim, citado na issue.
  assert.equal(contarConfiguracoesAvancadas([linha(0.0098636)]).total, 1);
});

test('#464: comTaxa — basta UM componente da linha ter taxa para a linha inteira contar', () => {
  const linha: LinhaReceitaAuditavel = {
    fluxo_pagamento: {
      componentes: [
        { tipo: 'imediato', taxaMensal: 0 },
        { tipo: 'prazo_fixo', taxaMensal: 0.01 },
      ],
    },
  };
  assert.equal(contarConfiguracoesAvancadas([linha]).comTaxa, 1);
});

test('#464: comSinal — mesma regra de zero/null/undefined que comTaxa', () => {
  const linha = (sinalPct: unknown): LinhaReceitaAuditavel => ({
    fluxo_pagamento: { componentes: [{ tipo: 'concentrado', sinalPct }] },
  });
  assert.equal(contarConfiguracoesAvancadas([linha(0)]).comSinal, 0);
  assert.equal(contarConfiguracoesAvancadas([linha(null)]).comSinal, 0);
  assert.equal(contarConfiguracoesAvancadas([linha(15)]).comSinal, 1);
});

test('#464: comJurosNaContratacao — só true conta, não truthy genérico', () => {
  const linha = (jurosNoMesDaContratacao: unknown): LinhaReceitaAuditavel => ({
    fluxo_pagamento: { componentes: [{ tipo: 'concentrado', jurosNoMesDaContratacao }] },
  });
  assert.equal(contarConfiguracoesAvancadas([linha(true)]).comJurosNaContratacao, 1);
  assert.equal(contarConfiguracoesAvancadas([linha(false)]).comJurosNaContratacao, 0);
  assert.equal(contarConfiguracoesAvancadas([linha(1)]).comJurosNaContratacao, 0);
  assert.equal(contarConfiguracoesAvancadas([linha(undefined)]).comJurosNaContratacao, 0);
});

test('#464: absorcaoPersonalizada — só o modo "personalizado" conta', () => {
  const linha = (modo: unknown): LinhaReceitaAuditavel => ({ absorcao: { modo } });
  assert.equal(contarConfiguracoesAvancadas([linha('personalizado')]).absorcaoPersonalizada, 1);
  assert.equal(contarConfiguracoesAvancadas([linha('distribuido')]).absorcaoPersonalizada, 0);
  assert.equal(contarConfiguracoesAvancadas([linha(undefined)]).absorcaoPersonalizada, 0);
  assert.equal(contarConfiguracoesAvancadas([{}]).absorcaoPersonalizada, 0);
});

test('#464: os seis contadores juntos, num payload sintético com um exemplar de cada caso', () => {
  const linhas: LinhaReceitaAuditavel[] = [
    // estudo 5 de Pinguim: taxa real, sem sinal, ramo canônico.
    {
      fluxo_pagamento: { componentes: [{ tipo: 'prazo_fixo', taxaMensal: 0.0098636, sinalPct: 0 }] },
      absorcao: { modo: 'distribuido' },
    },
    // estudo 6 de Pinguim: absorção personalizada, sem taxa.
    {
      fluxo_pagamento: { componentes: [{ tipo: 'ate_marco', taxaMensal: 0 }] },
      absorcao: { modo: 'personalizado' },
    },
    // ramo legado: sem componentes.
    { fluxo_pagamento: {}, absorcao: { modo: 'distribuido' } },
    // sinal + juros na contratação, sem taxa.
    {
      fluxo_pagamento: { componentes: [{ tipo: 'concentrado', sinalPct: 15, jurosNoMesDaContratacao: true }] },
      absorcao: { modo: 'distribuido' },
    },
  ];
  const r = contarConfiguracoesAvancadas(linhas);
  assert.deepEqual(r, {
    total: 4, comTaxa: 1, comSinal: 1, comJurosNaContratacao: 1,
    absorcaoPersonalizada: 1, ramoLegado: 1,
  });
});
