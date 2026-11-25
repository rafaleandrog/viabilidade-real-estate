import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FONTE = readFileSync(new URL('./tela-fluxo-receitas.ts', import.meta.url), 'utf8');

// Todo <urbi-botao> só de ícone (slot vazio) precisa de .ariaLabel por property:
// o title não nomeia o <button> do shadow DOM, e o leitor de tela anuncia um botão sem nome.
test('#908: todo urbi-botao só-ícone de tela-fluxo-receitas declara .ariaLabel — por CONTAGEM EXATA', () => {
  const trechos = FONTE.split('<urbi-botao').slice(1)
    .map((t) => t.slice(0, t.indexOf('</urbi-botao>') + '</urbi-botao>'.length));
  // slot vazio: a tag de abertura fecha em `}>` ou `">` colado ao </urbi-botao> (o `=>` de arrow não conta)
  const soIcone = trechos.filter((t) => /[}"']\s*>\s*<\/urbi-botao>$/.test(t));
  const comAriaLabel = soIcone.filter((t) => t.includes('.ariaLabel=${')).length;
  assert.equal(soIcone.length, 4, 'esperava 4 botões só-ícone (fase, tipologia, entrada, parcelamento) — mudou?');
  assert.equal(
    comAriaLabel, soIcone.length,
    `${soIcone.length} <urbi-botao> só-ícone, mas só ${comAriaLabel} com .ariaLabel`,
  );
});
