// Render da janela de criar e editar operação do Funding. Ver o topo de
// `casos/funding-janela.ts`: é a fiação entre a tela, a janela e a API, mais a
// geometria da janela nas três larguras e nos dois temas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

const norm = (s: string | null | undefined) => String(s ?? '').replace(/\s/g, ' ');

test('Funding: a janela de operação cria e edita só ao confirmar, com resumo ao vivo e tipo travado', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-janela', larguras: [1280, 900, 600] });

  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'transbordoDeTexto'), 0, 'texto saltou para fora da caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  // O modal cobre a página por desenho: sobreposição entre um nó DENTRO da
  // janela e um da página atrás dela não é defeito. Entre dois nós do mesmo
  // lado, é.
  for (const [largura, m] of Object.entries(a.larguras) as [string, any][]) {
    const mesmos = (m.sobreposicao as any[]).filter((o) => String(o.a).includes('div.janela') === String(o.b).includes('div.janela'));
    assert.deepEqual(mesmos, [], `${largura}px: sobreposição dentro da janela ou dentro da página` + relato(a));
  }
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  // ── Geometria, em criação e em edição, nos dois temas ──
  const esperado: Record<string, { largura: number; ladoALado: boolean }> = {
    1280: { largura: 920, ladoALado: true },
    900: { largura: 780, ladoALado: false },
    600: { largura: 480, ladoALado: false },
  };
  for (const [largura, e] of Object.entries(esperado)) {
    const x = (a.extra as any)?.[largura];
    assert.ok(x, `sem medida extra em ${largura}px` + relato(a));
    for (const modo of ['geoCriar', 'geoEditar']) {
      for (const tema of ['0', '1']) {
        const g = x[modo][tema];
        const onde = `${largura}px, ${modo}, tema ${tema}`;
        assert.equal(g.largura, e.largura, `${onde}: largura da janela`);
        assert.equal(g.dentro, true, `${onde}: uma coluna saiu da janela`);
        assert.equal(g.semRolagem, true, `${onde}: a janela rolou na horizontal`);
        assert.equal(g.ladoALado, e.ladoALado, `${onde}: colunas ${e.ladoALado ? 'deviam' : 'não deviam'} estar lado a lado`);
        assert.equal(g.empilhado, !e.ladoALado, `${onde}: colunas ${e.ladoALado ? 'não deviam' : 'deviam'} estar empilhadas`);
        if (e.ladoALado) assert.deepEqual(g.larguras, [190, 418, 280], `${onde}: trilho, campos, resumo`);
      }
      // O raio do KPI vem do token do tema, não de literal: os temas diferem.
      assert.notEqual(x[modo]['0'].raioKpi, x[modo]['1'].raioKpi, `${largura}px ${modo}: o raio não seguiu o token`);
    }
  }

  const x = (a.extra as any)['900'];

  // ── Abrir em criação: nada gravado, foco no seletor de tipo, Detalhes gerais ──
  assert.deepEqual(x.abrir, {
    aberta: true, titulo: 'Nova operação', fechaNoFundo: false, escritas: 0, foco: 'campo:tipo', etapa: 'geral',
    tipos: ['Dívida / Capital de giro', 'Equity', 'Antecipação de recebíveis'],
    trilho: ['Detalhes gerais', 'Aporte', 'Amortização', 'Juros', 'Custos'],
    nome: '1º Dívida',
  });
  assert.equal(x.etapaAporte, 'aporte', 'o trilho não trocou de etapa');

  // ── Resumo e prévia a cada tecla, sem API ──
  assert.match(x.resumoInicial, /Custo efetivo=— \| Custo financeiro=— \| Maior saldo devedor=—/, 'valor zero: "—" no resumo');
  assert.notEqual(x.resumoComValor, x.resumoInicial, 'digitar o valor não recalculou o resumo');
  assert.match(norm(x.resumoComValor), /Maior saldo devedor=R\$ 8\.000\.000,00/);
  assert.equal(x.graficoComValor, true, 'a prévia do fluxo não desenhou com valor');
  assert.equal(x.ancora.mesDepois, 'jan/28', 'trocar a âncora não mostrou o mês derivado do Cronograma');
  assert.notEqual(x.ancora.resumoDepois, x.ancora.resumoAntes, 'trocar a âncora não recalculou o resumo');
  assert.equal(x.escritasAoDigitar, 0, 'digitar na janela chamou a API');

  // ── Regra violada: na etapa dona, antes de gravar ──
  assert.equal(x.regra.indicador, 'alerta', 'a etapa Amortização não ganhou indicador de erro');
  assert.equal(x.regra.escritas, 0, 'Criar com regra violada chamou a API');
  assert.equal(x.regra.etapaAposCriar, 'amortizacao', 'Criar com regra violada não levou à etapa do erro');
  assert.match(x.regra.banner, /“Carência” deve ser menor que “Amortização”/);

  // ── Recusa do servidor: dentro da janela, que fica aberta com o rascunho ──
  assert.deepEqual(x.recusa, { aberta: true, mensagem: 'Recusado pelo servidor de teste.', valorIntacto: 8_000_000, escritas: 1 });
  // O foco volta para dentro da janela, no aviso do servidor — medido no
  // `document.activeElement` e no `activeElement` de cada shadow root, não só na espia.
  assert.deepEqual(x.focoRecusa, { chamada: true, documento: true, tela: true, janela: true, papel: 'alert', tabindex: '-1' },
    'depois da recusa do servidor, o foco não voltou para o aviso dentro da janela');
  // Sem aviso, o primeiro campo da etapa aberta.
  assert.equal(x.focoSemAviso.primeiroDaEtapa, true, `sem aviso do servidor, o foco foi para ${x.focoSemAviso.alvo}`);

  // ── Criar: um POST só, mesmo com dois cliques; a página da criada abre ──
  assert.deepEqual(x.criar.chamadas, ['POST'], 'dois cliques em Criar operação gravaram duas vezes');
  assert.deepEqual(x.criar.corpo, {
    tipo: 'divida', nome: '1º Dívida', ordem: 3, valor: 8_000_000, cronograma_evento: 'lancamento',
    aporte_meses: 1, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6, taxa_anual: 12,
  });
  assert.equal(x.criar.janelaFechada, true);
  assert.equal(x.criar.opAberta, 99, 'a operação criada não abriu na página dela');
  assert.equal(x.criar.grafico, true, 'a página da criada não desenhou o gráfico da operação');

  // ── Gravação em curso: a janela congela; Cancelar, Esc e digitar esperam ──
  assert.deepEqual(x.emCurso, { aberta: true, perguntas: 0, escritas: 1, valor: 5_000_000, inerte: true, cancelarDesabilitado: true },
    'com a gravação em curso a janela fechou, perguntou ou aceitou edição');
  assert.deepEqual(x.emCursoDepois, { fechada: true, escritas: 1, valorGravado: 5_000_000, opAberta: 99 });

  // ── Cancelar e Esc ──
  assert.deepEqual(x.cancelar, { fechada: true, escritas: 0, perguntas: 0, foco: 'nova-operacao' });
  assert.deepEqual(x.escNao, { aberta: true, perguntas: 1, taxa: 15 }, 'Esc com alteração não perguntou, ou fechou sem confirmar');
  assert.deepEqual(x.escSim, { fechada: true, perguntas: 2, escritas: 0, foco: 'nova-operacao' });

  // ── A página em leitura ──
  assert.equal(x.paginaLeitura.campos, 0, 'a página da operação ainda tem campo editável');
  assert.ok(x.paginaLeitura.termos >= 8, `termos da dívida: ${x.paginaLeitura.termos}`);
  assert.equal(x.paginaLeitura.indicadores, 8, 'a "Visão do investidor" da dívida tem oito indicadores');
  assert.equal(x.paginaLeitura.grafico, true, 'a página não desenhou o gráfico da operação');
  assert.deepEqual(x.paginaLeitura.botoes, ['fa-solid fa-arrow-up', 'fa-solid fa-arrow-down', 'Editar', 'fa-solid fa-trash']);

  // ── Editar: tipo travado, foco no nome, PATCH só com o que mudou ──
  assert.deepEqual(x.editar, {
    titulo: 'Editar Capital de giro', tipoTravado: true, seletorDeTipo: false, foco: 'campo:nome',
    salvarDesabilitado: true, confirmarTexto: 'Salvar alterações', escritasAoAbrir: 0,
  });
  assert.deepEqual(x.nomeVazio, { escritas: 0, etapa: 'geral', erroNome: '“Nome” é obrigatório' },
    'nome vazio na edição não foi recusado na janela');
  assert.deepEqual(x.salvar, { chamadas: ['PATCH /funding/1'], corpo: { taxa_anual: 22 }, fechada: true, foco: 'editar' });

  // ── Remover: o foco vai a um alvo estável da lista ──
  assert.deepEqual(x.remover, { pagina: false, foco: 'cartao:3', documento: true, ativo: 'cartao:3' }, 'depois de remover, o foco não pousou no primeiro cartão');

  // ── Alvo de foco que não existe no desenho: descartado, não rouba o foco depois ──
  assert.deepEqual(x.alvoFantasma, { guardado: null, foco: 'pagina-operacao', documento: true, ativo: 'pagina-operacao' },
    'o alvo "editar" pedido sem a página aberta ficou guardado e roubou o foco quando a página abriu');

  // ── Leitor ──
  assert.deepEqual(x.leitor, { nova: false, janela: false, botoesNaPagina: 0 });
});
