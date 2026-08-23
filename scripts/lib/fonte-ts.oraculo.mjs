// ORÁCULO DE REFERÊNCIA — classifica cada offset usando o scanner do PRÓPRIO
// compilador TypeScript, em vez de um lexer artesanal.
//
// ⚠️ SÓ A BATERIA IMPORTA ESTE ARQUIVO. Nenhum guard pode importá-lo: eles rodam
// com `node` puro, sem `node_modules`, e é isso que os deixa rodar no
// `pr-guards.yml`, que não faz install nenhum. Aqui o `typescript` é dependência
// legítima — é o mesmo pacote que o typecheck usa.
//
// POR QUE UM ORÁCULO, E NÃO SÓ CASOS ESCRITOS À MÃO
//
// `fonte-ts.mjs` é um lexer artesanal, e lexer artesanal errado é exatamente o
// defeito que este PR existe para consertar. Uma bateria de casos prova o que
// alguém LEMBROU de testar, e o buraco sempre foi o que ninguém lembrou. O
// scanner do próprio compilador dá um teste DIFERENCIAL: propriedade em vez de
// caso — para todo arquivo do `frontend/`, as duas classificações têm que
// concordar, inclusive em construções que ninguém listou.
//
// ⚠️ Mas o `frontend/` é um corpus de SORTE: ele só cobre o que o app por acaso
// escreveu. Por isso o diferencial roda também sobre um corpus sintético — sem
// ele, o defeito da crase antes da divisão passaria, porque nenhum arquivo real
// tem `` `abc` / 2 ``.
//
// ⚠️ ARMADILHA: `ts.SyntaxKind[k]` NÃO é um nome confiável. Vários valores têm
// apelido `First*`/`Last*` registrado no mesmo número, e o lookup reverso
// devolve o apelido: um comentário de linha aparece como `FirstTriviaToken`, e
// um template sem substituição como `FirstTemplateToken`. Comparar por NOME
// perde os dois em silêncio — foi o que aconteceu na primeira versão deste
// arquivo. Compare por NÚMERO.
import ts from 'typescript';

const K = ts.SyntaxKind;
const COMENTARIO = new Set([K.SingleLineCommentTrivia, K.MultiLineCommentTrivia]);
const TEXTO = new Set([
  K.StringLiteral,
  K.NoSubstitutionTemplateLiteral,
  K.TemplateHead,
  K.TemplateMiddle,
  K.TemplateTail,
]);

/**
 * 0 = código · 1 = comentário · 2 = string/texto de template · 3 = regex
 *
 * A classe 3 quase nunca sai daqui, de propósito — ver a terceira armadilha
 * abaixo. O oráculo é autoridade sobre COMENTÁRIO e TEXTO, que é exatamente onde
 * moravam os dez defeitos; sobre `/` ele não é autoridade nenhuma.
 */
export function classificar(txt, inicioDeRegex = new Set()) {
  const mapa = new Uint8Array(txt.length);
  // Dicas que o scanner RECUSOU: dissemos "regex comeca aqui" e o compilador
  // discordou. Cada uma e um erro nosso, e o diferencial reprova por elas — e o
  // que faz a dica NAO ser passe livre.
  const recusadas = [];
  const usadas = new Set();
  const sc = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, txt);
  const marcar = (ini, fim, v) => {
    for (let i = ini; i < fim && i < txt.length; i++) mapa[i] = v;
  };
  // ⚠️ SEGUNDA ARMADILHA, achada rodando isto contra o `frontend/` real: em
  // varredura crua o scanner devolve `CloseBraceToken` para o `}` que fecha um
  // `${…}` — ele NAO sabe sozinho que ali continua um template. Sem o
  // `reScanTemplateToken`, todo o texto depois da primeira interpolacao vira
  // "codigo", e o oraculo passa a discordar de 55 dos 66 arquivos, acusando o
  // lexer de errar onde quem errava era o oraculo. A pilha guarda, por template
  // aberto, a profundidade de chaves da expressao corrente.
  const pilha = [];
  let k;
  while ((k = sc.scan()) !== K.EndOfFileToken) {
    if (sc.getTextPos() <= sc.getTokenPos()) break;

    if (k === K.TemplateHead) {
      pilha.push(0);
      marcar(sc.getTokenPos(), sc.getTextPos(), 2);
      continue;
    }
    if (k === K.OpenBraceToken && pilha.length) { pilha[pilha.length - 1]++; continue; }
    if (k === K.CloseBraceToken && pilha.length) {
      if (pilha[pilha.length - 1] > 0) { pilha[pilha.length - 1]--; continue; }
      const cont = sc.reScanTemplateToken(false);
      marcar(sc.getTokenPos(), sc.getTextPos(), 2);
      if (cont === K.TemplateTail) pilha.pop();
      else if (cont !== K.TemplateMiddle) pilha.pop();  // template malformado
      continue;
    }

    if (COMENTARIO.has(k)) marcar(sc.getTokenPos(), sc.getTextPos(), 1);
    else if (TEXTO.has(k)) marcar(sc.getTokenPos(), sc.getTextPos(), 2);
    else if (k === K.RegularExpressionLiteral) marcar(sc.getTokenPos(), sc.getTextPos(), 3);
    else if ((k === K.SlashToken || k === K.SlashEqualsToken) && inicioDeRegex.has(sc.getTokenPos())) {
      // A ÚNICA dica que o oráculo aceita de fora, e ela é obrigatória: sem
      // rescanear, `/^\//` faz o scanner ver `//` e engolir o resto da linha
      // como comentário — o oráculo desincroniza e passa a acusar tudo depois
      // dali. Aceitar a dica NÃO é passe livre: se o lexer inventasse uma regex
      // onde não há, o oráculo desincronizaria e o teste estouraria adiante.
      usadas.add(sc.getTokenPos());
      if (sc.reScanSlashToken() === K.RegularExpressionLiteral) {
        marcar(sc.getTokenPos(), sc.getTextPos(), 3);
      } else {
        recusadas.push(sc.getTokenPos());
      }
    }
    // ⚠️ TERCEIRA ARMADILHA, e esta limita o oráculo. Não dá para chamar
    // `reScanSlashToken()` em toda `/`: ele reinterpreta o token como regex SEM
    // olhar contexto, então `13_000_000 / 900` e `vgv / area` viravam regex e o
    // oráculo acusava 33 dos 66 arquivos — errando ele, não o lexer. Distinguir
    // regex de divisão exige posição de expressão, que é informação do PARSER, e
    // um scanner não tem. Logo o oráculo NÃO opina sobre `/`: esse eixo continua
    // coberto só pelos casos escritos à mão, e o lexer erra de propósito para o
    // lado da divisão, que é o lado seguro (ver `podeSerRegex`).
  }
  // Dica que o scanner nunca chegou a ver e tao ruim quanto recusada: significa
  // que o offset nem era comeco de token — o lexer inventou uma regex no meio de
  // outra coisa.
  for (const off of inicioDeRegex) if (!usadas.has(off)) recusadas.push(off);
  return { mapa, recusadas: recusadas.sort((a, b) => a - b) };
}
