import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marcos, resolverColisoesRotulos, type RotuloTopo } from './fluxo-graficos.js';
import type { EventoCrono } from './fluxo-shared.js';

// #582: rótulos de marco (Lançamento, Início/Fim Obra) se sobrepunham quando
// caíam a poucos meses um do outro — `graficoFluxoAcumulado` não tinha
// nenhuma detecção de colisão, e `graficoFluxoMensal` só alternava por
// paridade de índice (`(idx % 2) * 10`), que não resolve três marcos
// próximos. Este arquivo testa a função PURA de escalonamento; a prova de
// que ela está de fato LIGADA aos dois gráficos é o caso de render
// `frontend/render/casos/marcos-fluxo-colados.ts` — função pura testada aqui
// não prova fiação (ver CLAUDE.md § "cinco classes de defeito").

const rot = (x: number, y: number, texto: string, cor = '#000'): RotuloTopo => ({ x, y, texto, cor });

test('resolverColisoesRotulos: rótulos distantes no eixo X mantêm o y preferido', () => {
  const entrada = [rot(0, 34, 'Lançamento'), rot(500, 34, 'Início Obra')];
  const saida = resolverColisoesRotulos(entrada);
  assert.equal(saida.length, 2);
  for (const r of saida) assert.equal(r.y, 34, `${r.texto} não devia escalonar (x bem separado)`);
});

test('resolverColisoesRotulos: dois rótulos no MESMO x escalonam — o segundo desce uma linha', () => {
  const entrada = [rot(100, 34, 'Lançamento'), rot(100, 34, 'Início Obra')];
  const saida = resolverColisoesRotulos(entrada);
  const ys = saida.map((r) => r.y).sort((a, b) => a - b);
  assert.equal(ys[0], 34, 'o primeiro mantém a linha preferida');
  assert.ok(ys[1] > ys[0], 'o segundo desce pelo menos uma linha');
  assert.ok(ys[1] - ys[0] >= 9, `passo escalonado pequeno demais: ${ys[1] - ys[0]}px`);
});

test('resolverColisoesRotulos: TRÊS rótulos no mesmo mês (extremo do critério #582.2) — cada um numa linha própria', () => {
  // Reproduz Lançamento + Início Obra + Fim Obra colados no mesmo x, como
  // `marcos()` devolve quando `obra.duracao_meses === 1` e
  // `obra.inicio_mes === lancamento.inicio_mes`.
  const entrada = [rot(200, 34, 'Lançamento'), rot(200, 34, 'Início Obra'), rot(200, 34, 'Fim Obra')];
  const saida = resolverColisoesRotulos(entrada);
  const ys = saida.map((r) => r.y).sort((a, b) => a - b);
  assert.equal(new Set(ys).size, 3, `os três deviam ficar em linhas distintas: ${ys.join(', ')}`);
  // Nenhum par de caixas estimadas (mesma largura de texto, mesmo x) pode
  // ficar mais perto que o passo mínimo — senão a colisão real persistiria.
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 9, `linhas ${i - 1}/${i} próximas demais`);
});

test('resolverColisoesRotulos: marco, Payback e Exposição Máx. no mesmo x colidem entre FAMÍLIAS, não só entre marcos', () => {
  // Reproduz o caso do critério #582.1: o rótulo de um marco não pode colidir
  // "nem com o de Payback, nem com o de Exposição Máx." — as três famílias
  // entram no MESMO pool em `graficoFluxoAcumulado`.
  const entrada = [
    rot(80, 34, 'Lançamento', 'var(--cor-texto-sec)'),
    rot(80, 46, 'Payback: mar/28 · M+14', 'var(--cor-sucesso)'),
    rot(83, 40, 'Exposição Máx.: R$ 1,2M', 'var(--cor-erro)'),
  ];
  const saida = resolverColisoesRotulos(entrada);
  for (let i = 0; i < saida.length; i++) {
    for (let j = i + 1; j < saida.length; j++) {
      const a = saida[i]; const b = saida[j];
      const larguraA = a.texto.length * 5.4; const larguraB = b.texto.length * 5.4;
      const sobrepoeX = a.x < b.x + larguraB && b.x < a.x + larguraA;
      const sobrepoeY = (a.y - 9) < b.y && (b.y - 9) < a.y;
      assert.ok(!(sobrepoeX && sobrepoeY), `"${a.texto}" colide com "${b.texto}" (y=${a.y} vs y=${b.y})`);
    }
  }
});

test('resolverColisoesRotulos: determinístico — mesma entrada, qualquer ordem, mesmo resultado (por texto)', () => {
  const a = [rot(200, 34, 'Lançamento'), rot(200, 34, 'Início Obra'), rot(200, 34, 'Fim Obra')];
  const b = [rot(200, 34, 'Fim Obra'), rot(200, 34, 'Lançamento'), rot(200, 34, 'Início Obra')];
  const porTexto = (saida: RotuloTopo[]) => Object.fromEntries(saida.map((r) => [r.texto, r.y]));
  assert.deepEqual(porTexto(resolverColisoesRotulos(a)), porTexto(resolverColisoesRotulos(b)));
});

test('resolverColisoesRotulos: não muta o array nem os itens de entrada', () => {
  const item = rot(50, 34, 'Lançamento');
  const entrada = [item, rot(50, 34, 'Início Obra')];
  const congelada = JSON.parse(JSON.stringify(entrada));
  resolverColisoesRotulos(entrada);
  assert.deepEqual(entrada, congelada);
});

// ── paridade Loteamento × Incorporação (#582 critério 6) ───────────────────
// `marcos()` lê `EventoCrono` — `{ evento, inicio_mes, duracao_meses }` — sem
// nenhum campo ou ramo de `tipo_empreendimento`. O cronograma do Avançado tem
// o MESMO formato nos dois padrões (a mesma tabela `avancado_fases`), então
// não há como o defeito ou o conserto divergirem entre eles; os dois casos
// abaixo fixam isso com um cronograma de cada padrão.

test('marcos(): cronograma típico de INCORPORAÇÃO — Lançamento e Início Obra a 2 meses (critério #582.1)', () => {
  const crono: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 4, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 6, duracao_meses: 20 },
  ];
  const m = marcos(crono);
  assert.deepEqual(m.map((x) => x.rotulo), ['Lançamento', 'Início Obra', 'Fim Obra']);
  assert.equal(m[0].mes, 4);
  assert.equal(m[1].mes, 6);
  assert.ok(m[1].mes - m[0].mes <= 2, 'fixture precisa reproduzir o caso do critério de aceite (≤2 meses)');
});

test('marcos(): cronograma típico de LOTEAMENTO — os três marcos no mesmo mês (critério #582.2, o extremo)', () => {
  // Loteamento usa o mesmo `EventoCrono` de infraestrutura/obra do padrão de
  // Incorporação — só os RÓTULOS de negócio (custos) divergem entre os dois
  // padrões, não o cronograma. `duracao_meses: 1` faz Início Obra == Fim Obra.
  const crono: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 10, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 10, duracao_meses: 1 },
  ];
  const m = marcos(crono);
  assert.equal(m.length, 3);
  assert.ok(m.every((x) => x.mes === 10), 'os três marcos devem coincidir no mesmo mês');
});
