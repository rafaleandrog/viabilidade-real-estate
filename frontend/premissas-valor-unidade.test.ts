// #664 — a badge não desenha um número que a Proforma não usa.
//
// O cenário é degenerado de propósito, e é o que torna o defeito invisível: exige
// a grandeza de LIGAÇÃO do destino zerada (VGV 0, ou área vendável 0) num estudo
// que JÁ tem canônico gravado. O cálculo permanece correto o tempo todo — o que
// engana é só a exibição, e é a mesma classe de mentira da #442.
//
// Achado do revisor externo na revisão do PR 663, registrado como issue em vez de
// consertado ali por R3: aquele PR era sobre QUANDO a badge pode trocar; este é
// sobre O QUE ela desenha depois de trocar.
//
// ⚠️ Este teste exercita o MÉTODO DO COMPONENTE, não a função pura de conversão.
// É deliberado: `converterUnidade` já devolvia `null` corretamente antes do
// conserto — o defeito morava no `?? this._num(op.campo)` da FIAÇÃO, que é
// exatamente a classe de defeito nº 1 do CLAUDE.md. Um teste de função pura
// passaria com o bug intacto.
import { test } from 'node:test';
import assert from 'node:assert/strict';

(globalThis as any).urbiVerso = { api: async () => ({}), notificar: () => {} };

const { ViabTelaPremissas, PERMUTA_UNIDADE } = await import('./tela-premissas.js');

/** Monta a tela com o form dado, sem tocar em rede nem em DOM. */
function tela(form: Record<string, unknown>) {
  const el: any = new ViabTelaPremissas();
  el.estudo = { id: 1, tipo_empreendimento: 'incorporacao', nivel_analise: 'preliminar' };
  el.form = form;
  el.produtos = [];
  el.benchmarks = [];
  return el;
}

const PCT_AREA = PERMUTA_UNIDADE.opcoes.find((o: any) => o.valor === 'pct_area_venda')!;
const M2 = PERMUTA_UNIDADE.opcoes.find((o: any) => o.valor === 'area_m2')!;

test('#664: canônico presente + grandeza de ligação ZERADA → campo VAZIO, não o histórico', () => {
  // Canônico gravado (500 m²), e a área vendável — a ligação de `% área venda` —
  // em zero, porque não há produto nenhum. A coluna histórica de percentual
  // carrega 30, de quando a ligação não era zero.
  const el = tela({
    permuta_fisica_area_canonica: 500,
    permuta_fisica_pct: 30,
    permuta_fisica_modo: 'pct_area_venda',
  });

  assert.equal(
    el._valorUnidade(PERMUTA_UNIDADE, PCT_AREA), null,
    'com canônico presente e ligação zerada, a tela tem de deixar o campo VAZIO — '
      + 'desenhar o 30 histórico é mostrar um número que a Proforma não usa',
  );
});

test('#664: o canônico converte normalmente quando a unidade NÃO precisa de ligação', () => {
  // Controle do teste acima: sem ele, um `_valorUnidade` que devolvesse `null`
  // sempre passaria na asserção principal sem entregar nada.
  const el = tela({ permuta_fisica_area_canonica: 500, permuta_fisica_area_m2: 42 });
  assert.equal(el._valorUnidade(PERMUTA_UNIDADE, M2), 500,
    'm² é conversão identidade sobre o canônico — 500, nunca o 42 histórico');
});

test('#664: o ramo LEGADO não muda — sem canônico, o histórico continua sendo a fonte', () => {
  // A distinção que sustenta o conserto: sem canônico o histórico é a ÚNICA fonte
  // que existe, e lê-lo não contradiz motor nenhum.
  const el = tela({ permuta_fisica_pct: 30, permuta_fisica_modo: 'pct_area_venda' });
  assert.equal(el._valorUnidade(PERMUTA_UNIDADE, PCT_AREA), 30,
    'estudo legado (canônico ausente) continua lendo a coluna por unidade');
});
