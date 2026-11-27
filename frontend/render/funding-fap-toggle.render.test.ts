// Render do liga/desliga da aba Financiamento à produção: o interruptor
// (`urbi-toggle`) e a queda para a caixa de seleção "Ativo". Ver o topo de
// `casos/funding-fap-toggle.ts` para o porquê de medir aqui — a fiação entre o
// controle e `atualizarFundingOperacao`, que teste de função pura não alcança.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato } from './apoio.js';
import { NOME_ACESSIVEL_LIGA_DESLIGA } from '../funding-liga-desliga.js';

const pular = await motivoParaPular();

/** O cabeçalho do cartão cabe nele: cada peça dentro, sem rolagem, estado ao lado do interruptor. */
function conferirGeometria(geo: any, onde: string, comToggle: boolean) {
  assert.ok(geo, `${onde}: o cartão do Financiamento à produção não foi achado`);
  assert.equal(geo.dentro, true, `${onde}: uma peça do cabeçalho saiu do cartão: ${JSON.stringify(geo)}`);
  assert.equal(geo.semRolagem, true, `${onde}: o cabeçalho rola para o lado: ${JSON.stringify(geo)}`);
  assert.ok(geo.pecas.controle, `${onde}: o controle não está no cabeçalho: ${JSON.stringify(geo)}`);
  if (comToggle) {
    assert.ok(geo.pecas.controle.largura > 0, `${onde}: o controle não tem largura: ${JSON.stringify(geo)}`);
    assert.ok(geo.pecas.interruptor?.largura > 0, `${onde}: o interruptor não tem largura: ${JSON.stringify(geo)}`);
    assert.equal(geo.estadoAoLado, true, `${onde}: o texto do estado não está ao lado do interruptor: ${JSON.stringify(geo)}`);
  } else {
    // O stub do `urbi-checkbox` não desenha a caixa (só pinta `rotulo`/`valor`, e
    // a prop real é `label`): a caixa sai com área zero, o mesmo limite do caso
    // antigo. Aqui se confere só que nada do cabeçalho sai do cartão.
    assert.equal(geo.pecas.interruptor, undefined, `${onde}: a queda desenhou um interruptor`);
    assert.equal(geo.pecas.estado, undefined, `${onde}: a queda desenhou o texto do estado`);
  }
}

test('Financiamento à produção: o interruptor liga, desliga, volta ao gravado na recusa e não grava pelo leitor; sem a tag, a caixa de seleção', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-fap-toggle' });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'transbordoDeTexto'), 0, 'texto saltou para fora da caixa' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'dois nós visíveis se sobrepõem' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  for (const l of ['1280', '900', '600']) {
    const x = a.extra?.[l] as any;
    assert.ok(x, `o caso não devolveu a medida em ${l}px` + relato(a));
    for (const tema of ['0', '1']) {
      conferirGeometria(x.geoToggle[tema], `interruptor, ${l}px, variante ${tema}`, true);
      conferirGeometria(x.geoCaixa[tema], `caixa de seleção, ${l}px, variante ${tema}`, false);
    }
    // O texto do estado muda de cor com o tema (token, não literal).
    assert.notEqual(x.geoToggle['0'].corEstado, x.geoToggle['1'].corEstado, `a cor do estado não acompanhou o tema em ${l}px`);
  }

  const x = a.extra?.['900'] as any;

  // Estado inicial: interruptor, ligado, com nome acessível e papel de switch.
  assert.equal(x.inicial.controle, 'toggle', JSON.stringify(x.inicial));
  assert.equal(x.inicial.checked, true);
  assert.equal(x.inicial.estado, 'Ligado');
  assert.equal(x.inicial.papel, 'switch');
  assert.equal(x.inicial.ariaChecked, 'true');
  assert.equal(x.inicial.nomeAcessivel, NOME_ACESSIVEL_LIGA_DESLIGA, 'o interruptor tinha que ter nome acessível (.ariaLabel)');
  assert.equal(x.inicial.desabilitado, false);
  assert.equal(x.inicial.aviso, false);
  assert.equal(x.inicial.escutaCaixa, false, 'com o interruptor, não pode haver caixa de seleção ligada');

  // Desligar: o clique no interruptor (evento `urbi-toggle:change`, detail false) grava { ativo: false }.
  assert.deepEqual(x.desligar.patches, [{ ativo: false }],
    'desligar tinha que disparar UM PATCH { ativo: false } — apagar o `@urbi-toggle:change` do template, trocar o nome '
      + 'do evento ou ler o detail errado deixa este caso vermelho' + relato(a));
  assert.equal(x.desligar.checked, false);
  assert.equal(x.desligar.estado, 'Desligado');
  assert.equal(x.desligar.aviso, true, 'desligado, o aviso "Desligado — não entra no Fluxo de Caixa" continua');
  assert.equal(x.desligar.parametrosGuardados, 12.5, 'os parâmetros ficam guardados');
  assert.ok(x.desligar.campos > 0, 'desligado, a aba segue com os campos editáveis');

  // Religar.
  assert.deepEqual(x.ligar.patches, [{ ativo: true }]);
  assert.equal(x.ligar.checked, true);
  assert.equal(x.ligar.estado, 'Ligado');
  assert.equal(x.ligar.aviso, false);

  // Recusa: o interruptor mudou de posição no clique e volta ao gravado.
  assert.deepEqual(x.recusa.patches, [{ ativo: false }]);
  assert.equal(x.recusa.checkedNoClique, false, 'o stub tinha que mudar de posição no clique, como o primitivo');
  assert.equal(x.recusa.gravado, true);
  assert.equal(x.recusa.checked, true, 'na recusa, o interruptor tinha que voltar ao estado gravado (ligado)' + relato(a));
  assert.equal(x.recusa.ariaChecked, 'true');
  assert.equal(x.recusa.estado, 'Ligado');
  assert.deepEqual(x.recusa.notificacoes, ['erro:Recusado pelo servidor de teste.']);

  // Cliques seguidos com o PATCH em curso: um PATCH só, controle desabilitado.
  assert.equal(x.emCurso.patches, 1, `cliques seguidos dispararam ${x.emCurso.patches} PATCH`);
  assert.equal(x.emCurso.desabilitado, true, 'com o PATCH em curso, o interruptor fica desabilitado');
  assert.equal(x.emCurso.botaoDesabilitado, true);
  assert.equal(x.emCursoTerceiro, 1);
  assert.deepEqual(x.depoisDoCurso.patches, [{ ativo: false }]);
  assert.equal(x.depoisDoCurso.desabilitado, false);
  assert.equal(x.depoisDoCurso.checked, false);

  // A forma do controle não troca depois de desenhada.
  assert.deepEqual(x.naoTroca, { toggle: true, caixa: false });

  // Leitor: desabilitado, nada gravado.
  assert.equal(x.leitor.desabilitado, true);
  assert.equal(x.leitor.botaoDesabilitado, true, 'para o leitor, o switch tinha que estar desabilitado (anunciado como indisponível)');
  assert.equal(x.leitor.checked, true);
  assert.equal(x.leitor.estado, 'Ligado');
  assert.equal(x.leitor.escritas, 0, 'o leitor não pode gravar');
  assert.deepEqual(x.leitorVazio, { vazio: true, controle: false });

  // Estudo sem a operação: ela nasce criada e desligada.
  assert.deepEqual(x.criada.posts, [{ tipo: 'financiamento_producao', ativo: false }]);
  assert.equal(x.criada.checked, false);
  assert.equal(x.criada.estado, 'Desligado');
  assert.equal(x.criada.aviso, true);

  // Queda: sem a tag registrada, a caixa de seleção "Ativo", com o mesmo comportamento.
  assert.deepEqual(x.quedaInicial, { toggle: false, caixa: true, label: 'Ativo', marcado: true },
    'sem `urbi-toggle` registrado, tinha que aparecer a caixa de seleção' + relato(a));
  assert.deepEqual(x.quedaDesligar.patches, [{ ativo: false }]);
  assert.equal(x.quedaDesligar.marcado, false);
  assert.equal(x.quedaDesligar.aviso, true);
  assert.deepEqual(x.quedaRecusa.patches, [{ ativo: true }]);
  assert.equal(x.quedaRecusa.gravado, false);
  assert.equal(x.quedaRecusa.marcado, false, 'na recusa, a caixa de seleção tinha que voltar ao estado gravado');
  assert.deepEqual(x.quedaLeitor, { desabilitado: true, escritas: 0 });
});
