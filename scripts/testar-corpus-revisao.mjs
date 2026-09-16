#!/usr/bin/env node
// Bateria do corpo de conhecimento das lentes: o que o briefing promete carregar tem que
// existir, estar carimbado, e estar de fato citado no briefing.
//
// Por que existe: o acúmulo de conhecimento entre revisões não tem sintoma quando falha. Uma
// lente que não recebeu o corpo revisa exatamente como antes — devolve achados plausíveis, o
// relatório sai limpo, e a única diferença é que os falsos positivos já derrubados voltam. Não
// há teste vermelho, não há erro; só custo que ninguém atribui à causa.
//
// As guardas são independentes de propósito, e cada uma fecha um jeito diferente de o canal
// morrer em silêncio:
//   1. marcador dessincronizado → alguém editou o corpo e não re-carimbou, e a lente declararia
//      um `CORPUS:` que não corresponde ao que leu;
//   2. briefing que deixou de citar um dos arquivos → o corpo existe e não viaja;
//   3. entrada de `retirados.md` sem os quatro campos → o registro existe e não serve, porque
//      sem evidência a lente não tem como decidir se o mundo mudou.
//
// Roda com: node scripts/testar-corpus-revisao.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARQUIVOS, canonico, conferir } from './carimbar-corpus-revisao.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// O briefing nomeia a cópia da BASE (`$OUT/corpus/…`), nunca a da árvore — a da árvore é o head
// sob revisão, e mandá-la ser lida COMO INSTRUÇÃO deixaria um PR ditar como a revisão dele é
// feita. Achado P1 do App do Codex sobre este PR; a extração está em `.claude/motor-revisao.md`,
// seção da árvore. Estes são os caminhos que as guardas do briefing exigem.
const NA_BASE = ARQUIVOS.map((a) => `$OUT/corpus/${a.replace('.claude/revisao/', '')}`);
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

let falhas = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const falha = (m, d) => { console.error(`  FALHA ${m} — ${d}`); falhas += 1; };

// ── 1. O marcador corresponde ao conteúdo ────────────────────────────────────
try {
  const { marcador, divergentes } = conferir(raiz);
  if (divergentes.length === 0) ok(`marcador ${marcador} bate com o conteúdo dos ${ARQUIVOS.length} arquivos`);
  else falha('marcador', `desincronizado em ${divergentes.join(', ')} — rode node scripts/carimbar-corpus-revisao.mjs`);
} catch (e) {
  falha('marcador', e.message);
}

// ── 2. O briefing cita os dois arquivos, e o contrato de saída pede o marcador ─
// O motor é a fonte única do briefing. Citar por caminho literal é o que amarra: se alguém
// renomear um arquivo do corpo sem mexer no motor, o corpo para de viajar e nada mais avisa.
const motor = ler('.claude/motor-revisao.md');
// ⚠️ A pergunta não é "o caminho aparece no arquivo", nem "aparece na seção do briefing" — é
// "a ORDEM DE LEITURA nomeia este caminho". As duas primeiras formulações ficaram VERDES sob a
// mutação que troca o caminho na ordem de leitura, e o recorte por item é a terceira.
//
// ⚠️ O PORQUÊ das duas primeiras falharem não é reproduzível a partir deste commit — o layout do
// motor mudou no mesmo PR — e por isso não está escrito como se fosse. O que sustenta a guarda é
// o que ela FAZ, aqui embaixo: recortar o item da ordem de leitura e exigir os dois caminhos
// dentro dele. Quem quiser a prova roda a mutação (trocar um dos caminhos no item) e confirma que
// esta bateria fica vermelha. Explicação histórica que o artefato não sustenta é a classe do § 5
// de `.claude/revisao/aprendizados.md`, e foi uma lente que apontou esta aqui.
const ANCORA = '- **O corpo de conhecimento das lentes';
const iItem = motor.indexOf(ANCORA);
assert.notEqual(
  iItem, -1,
  `o item do briefing que manda ler o corpo sumiu (âncora ${JSON.stringify(ANCORA)}) — ` +
    'sem ele a lente não recebe ordem nenhuma, e esta bateria não teria o que conferir',
);
// O fim do item é o PRÓXIMO item da lista, qualquer que seja a forma dele. Procurar por
// `\n- **` (só itens em negrito) fazia a fatia atravessar o item seguinte, que começa com
// `- Para`, e engolir a nota vizinha sobre o `AGENTS.md` — que cita os mesmos caminhos. Era
// por isso que a mutação da ordem continuava verde: a fatia media prosa demais.
const restante = motor.slice(iItem + ANCORA.length);
const mFim = /^- /m.exec(restante);
const ordem = ANCORA + (mFim ? restante.slice(0, mFim.index) : restante);
for (const a of NA_BASE) {
  if (ordem.includes(a)) ok(`a ordem de leitura do briefing nomeia ${a}`);
  else falha('briefing', `${a} não está na ORDEM DE LEITURA do briefing — o corpo existe e não viaja`);
}
// ⚠️ E alguém tem que CRIAR `$OUT/corpus/`. Briefing que aponta para arquivo que nenhum passo
// escreve manda a lente ler o que não existe — e a lente volta sem corpo, que é indistinguível de
// "leu e nada se aplicava". É o mesmo modo de falha que o `DIFF.patch` já tinha. A extração mora
// na seção da árvore do motor, e sai da BASE.
// As duas metades da extração, e as duas precisam existir: a FONTE é `$BASE:.claude/revisao/`
// (nunca o head) e o DESTINO é `$OUT/corpus/`, que é para onde o briefing aponta. Citar uma sem a
// outra deixaria passar a extração que lê do lugar certo e escreve no errado, ou o contrário.
const temFonte = /\$BASE:\.claude\/revisao\//.test(motor);
const temDestino = /> "\$OUT\/corpus\//.test(motor);
if (temFonte && temDestino) {
  ok('o motor EXTRAI o corpo de $BASE para $OUT/corpus/ (o briefing não aponta para o vazio)');
} else {
  falha('briefing', `a extração do corpo está incompleta no motor (fonte $BASE: ${temFonte}, destino $OUT/corpus/: ${temDestino}) — a lente leria arquivo inexistente, ou leria do head`);
}
if (/antes de abrir o diff/i.test(ordem)) ok('a ordem põe o corpo ANTES do diff');
else falha('briefing', 'a ordem não diz que o corpo é lido ANTES do diff — a precedência é o que o faz servir');
// ⚠️ Escopado ao briefing COMPARTILHADO, não ao arquivo inteiro. A primeira versão casava
// `CORPUS:` em qualquer lugar do motor — e passava verde com o campo existindo só no template do
// Kimi, enquanto a lente Codex nunca recebia nem a ordem nem o campo. Achado do App do Codex: a
// guarda media "o documento menciona CORPUS:" quando a pergunta é "TODA lente recebe a exigência".
// O lugar certo da exigência é o bloco `COMUM`, que os dois motores usam.
// ⚠️ Aspas DUPLAS, e a bateria EXIGE isso. Com aspas simples o `$OUT` do COMUM fica literal, e
// interpolar `${COMUM}` depois, dentro de outra string, não reexpande o que está embutido — nem o
// `OUT` é exportado para o filho. A lente Codex recebia `$OUT/corpus/aprendizados.md` como texto
// cru, um caminho que ela não resolve, e voltava sem corpo; só o prompt direto do Kimi, que traz
// os caminhos no próprio texto, funcionava. A guarda mora aqui porque o sintoma é invisível: o
// briefing "menciona" o corpo, a lente não acha o arquivo, e o relatório sai igual. Achado P2 do
// App do Codex.
assert.equal(
  motor.includes("COMUM='"), false,
  'o bloco COMUM está entre aspas SIMPLES: o `$OUT` não expande, e a lente Codex receberia o ' +
    'caminho do corpo como texto cru. Use aspas duplas, e defina o COMUM depois de `OUT`.',
);
const iComum = motor.indexOf('COMUM="');
assert.notEqual(
  iComum, -1,
  'não achei `COMUM="` no motor. Outras formas que expandem o `$OUT` (heredoc sem aspas no\n' +
    'delimitador, concatenação) seriam corretas em bash, mas esta bateria mede a forma literal — ' +
    'então o motor fica nela, e mudar a forma é mudar esta guarda junto.',
);
const comum = motor.slice(iComum, motor.indexOf('"', iComum + 8) + 1);
if (/CORPUS:/.test(comum)) ok('o briefing COMUM (os dois motores) exige a linha CORPUS:');
else falha('contrato', 'o bloco COMUM não exige CORPUS: — a lente Codex sairia sem confirmação de corpo');
// ⚠️ Pelo caminho INTEIRO, e não pelo basename. A primeira versão fazia
// `comum.includes(a.replace('.claude/revisao/', ''))` — e aí a mutação que troca, dentro do
// COMUM, `.claude/revisao/aprendizados.md` por `.claude/aprendizados.md` passava VERDE: a
// lente receberia ordem de ler um arquivo que não existe, a ordem morreria em silêncio, e a
// mensagem desta guarda continuaria prometendo que o COMUM "nomeia" o caminho certo. A guarda
// vizinha, da ordem de leitura, não cobre isso: ela mede outro trecho do motor, que a mutação
// não toca. Predicado e mensagem tinham divergido — a classe do § 5 dos aprendizados. Achado
// de lente.
for (const a of NA_BASE) {
  if (comum.includes(a)) ok(`o briefing COMUM nomeia ${a}`);
  else falha('contrato', `o bloco COMUM não nomeia ${a} — só o template de um dos motores carregaria a ordem`);
}
// ⚠️ E o briefing tem que DIZER que a cópia da árvore não é para ser lida. Nomear a da base não
// basta: toda lente enxerga `.claude/revisao/` — é a árvore revisada —, e sem a proibição escrita
// ela pode ir ler a de lá por conta própria, com o head voltando a ditar a própria revisão.
// Achado P1 do App do Codex.
//
// ⚠️ Conferida no bloco COMUM, não no documento inteiro. Medir o arquivo todo deixava a frase
// viver na PROSA — que não viaja ao motor — enquanto sumia do briefing que chega à lente. É a
// mesma lição que a guarda do `CORPUS:` logo abaixo já tinha aprendido, e que esta não aplicou de
// primeira. Achado de lente.
if (/\.claude\/revisao\/ da árvore/.test(comum)) {
  ok('o briefing COMUM proíbe explicitamente ler o corpo da ÁRVORE (o head sob revisão)');
} else {
  falha('briefing', 'o bloco COMUM não proíbe ler `.claude/revisao/` da árvore — o head voltaria a ditar a própria revisão');
}
// ⚠️ E o bloco COMUM só vale se ele for INTERPOLADO nos prompts. Tudo acima mede o CONTEÚDO da
// string; nada media a FIAÇÃO — apagar `${COMUM}` do fim do prompt das duas funções de despacho
// deixava esta bateria inteira verde, com nenhuma lente recebendo nem a ordem nem o campo. É a
// classe de defeito nº 1 deste repositório (`.claude/revisao/aprendizados.md` § 3) dentro da
// própria guarda que existe para o corpo viajar, e é a mesma asserção que
// `scripts/testar-colheita-motor.mjs` já faz do outro lado, para o campo `motor=`. Achado de lente.
// ⚠️ O recorte NÃO é por regex sobre o documento inteiro, e essa foi a segunda inversão desta
// bateria. As duas versões anteriores eram recortes com `matchAll` e uma classe de nome
// (`lente|lente_kimi`, depois `[a-z_]+`) casando de forma preguiçosa até o `echo` — e três lentes
// independentes acharam três frestas distintas nessa mesma forma: a fatia preguiçosa ATRAVESSA
// funções (uma auxiliar declarada antes engole a função de despacho seguinte, que nunca é
// medida, e o `>= 2` continua satisfeito); `[a-z_]+` não casa dígito nem maiúscula, então uma
// `lente_v2()` escapava calada; e a fatia parava no PRIMEIRO `echo`, deixando de fora o resto do
// corpo. O `CLAUDE.md` (armadilha 14) diz o que fazer na segunda entrada da mesma classe: parar
// de somar guarda e **inverter**. Aqui isso quer dizer delimitar a função pelo que a delimita de
// verdade em bash — o `}` na coluna zero — em vez de por quanto o regex resolve andar.
//
// Com o corpo INTEIRO em mãos, "é função de despacho" volta a ser a propriedade estrutural que o
// texto promete: o corpo grava a linha do `execucao.txt`. Nome nenhum entra no predicado.
//
// ⚠️ E o parse roda SÓ dentro de bloco ```bash, pulando corpo de heredoc. Isto não é zelo: o
// motor é markdown, e a primeira versão varria o arquivo inteiro como se fosse bash. Uma linha na
// coluna zero que casasse `nome() {` — um exemplo em prosa, um `function x() {` dentro de outro
// fence, o corpo YAML de um heredoc como o do perfil da lente — abria uma função FANTASMA que
// engolia tudo até o próximo `}` de coluna zero, absorvendo o corpo real de `lente()`. E como o
// corpo engolido ainda contém o `echo` e o `${COMUM}`, as duas asserções ficavam VERDES, com o
// `ok()` atribuído ao nome fantasma: falha aberta na guarda que existe para não falhar aberta.
// Achado de lente.
function funcoesDoBash(texto) {
  const linhas = texto.split('\n');
  const achadas = [];
  let atual = null;
  let emBash = false;
  let fimHeredoc = null;
  let heredocTab = false;
  linhas.forEach((linha, i) => {
    // ⚠️ Heredoc ANTES de fence, e a ordem é o ponto. Testar o fence primeiro fazia uma linha
    // ``` DENTRO do corpo de um heredoc ser lida como fence de verdade, zerando o estado — e o
    // comentário abaixo promete que "nada ali abre ou fecha função". O motor tem heredoc com
    // conteúdo markdown (o perfil da lente), que é exatamente onde um fence pode aparecer.
    //
    // ⚠️ E o fecho segue a regra do bash, não um `trim()`. Aparar as duas pontas casava ALÉM do
    // que o bash casa: uma linha de corpo `"  EOF"` (espaços) não fecha heredoc nenhum de
    // verdade, mas fechava o do parser — e as linhas seguintes do corpo viravam "código", onde um
    // `nome() {` abre a função fantasma que engole a de despacho real. O laço fechado NÃO pega
    // esse caso, porque a marca fica dentro do corpo do fantasma e as contagens concordam. Só
    // `<<-` permite indentação, e só por TAB. Achado de lente.
    if (fimHeredoc !== null) {
      const fecha = heredocTab ? linha.replace(/^\t+/, '') : linha;
      if (fecha === fimHeredoc) fimHeredoc = null;
      return;
    }
    if (/^```/.test(linha)) { emBash = /^```bash\b/.test(linha); atual = null; return; }
    if (!emBash) return;
    // Corpo de heredoc é DADO, não código: nada ali abre ou fecha função.
    const h = /<<(-?)\s*'?"?([A-Za-z_][A-Za-z0-9_]*)'?"?\s*$/.exec(linha);
    if (h) { heredocTab = h[1] === '-'; fimHeredoc = h[2]; return; }
    if (atual === null) {
      // `nome() {` ou `function nome {` — as duas formas que o bash aceita, na coluna zero.
      const m = /^(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\))?\s*\{/.exec(linha);
      if (m) atual = { nome: m[1], corpo: [], linhas: [] };
      return;
    }
    if (/^\}/.test(linha)) { achadas.push({ ...atual, corpo: atual.corpo.join('\n') }); atual = null; return; }
    atual.corpo.push(linha);
    atual.linhas.push(i);
  });
  return achadas;
}

// As LINHAS do documento que trazem a marca do despacho, sem depender de fence nem de função —
// é essa independência que faz o laço fechado valer alguma coisa.
funcoesDoBash.linhasComMarca = (texto, marca) =>
  texto.split('\n').flatMap((l, i) => (l.replace(/(^|\s)#.*$/, '').includes(marca) ? [i] : []));

const semComentario = (txt) => txt.split('\n').map((l) => l.replace(/(^|\s)#.*$/, '')).join('\n');

const MARCA_DESPACHO = 'echo "$id exit=$rc';
const despachos = funcoesDoBash(motor).filter((f) => semComentario(f.corpo).includes(MARCA_DESPACHO));
assert.ok(
  despachos.length >= 2,
  'não achei as funções de despacho do motor (as cujo corpo grava a linha do `execucao.txt`) — ' +
    'sem elas esta guarda não tem o que medir, e o COMUM poderia deixar de viajar sem nada ficar vermelho',
);
// ⚠️ LAÇO FECHADO, e é ele que faz esta guarda não depender de um número. Antes, o que segurava
// toda falha do parser era o `>= 2` casar com o documento ter hoje exatamente duas funções de
// despacho — propriedade do TEXTO, não da guarda: bastava um terceiro fence ganhar a marca para
// qualquer queda do parser virar falha ABERTA, com a contagem satisfeita e uma função real sem
// ser medida.
//
// ⚠️ E a forma do laço é INCLUSÃO, não igualdade de contagens. Comparar dois números falhava nos
// dois sentidos: uma função que citasse a marca duas vezes (o `echo` real mais uma mensagem de
// erro que a reproduzisse) reprovava sem defeito — as unidades eram função de um lado e linha do
// outro —, e uma função perdida pelo parser somada a uma ocorrência espúria em prosa se
// CANCELAVA, deixando verde exatamente o caso a pegar. Perguntar se toda linha com a marca está
// DENTRO de um corpo reconhecido não tem nenhum dos dois problemas, e é a pergunta que interessa.
// Achados de lente.
const dentroDeDespacho = new Set(despachos.flatMap((f) => f.linhas));
const orfas = funcoesDoBash.linhasComMarca(motor, MARCA_DESPACHO).filter((n) => !dentroDeDespacho.has(n));
assert.equal(
  orfas.length, 0,
  `a marca ${JSON.stringify(MARCA_DESPACHO)} aparece em linha(s) do motor que o parser NÃO reconheceu ` +
    `como corpo de função de despacho: ${orfas.map((n) => n + 1).join(', ')}. Ou é função de despacho que o ` +
    'parser perdeu — e função perdida não é medida por guarda nenhuma abaixo —, ou é a marca citada solta, ' +
    'que não deveria existir: ela é o gravador do `execucao.txt`.',
);
// ⚠️ A checagem é sobre o ARGUMENTO DO PROMPT, e chegar aqui levou três formas. `includes` no
// corpo inteiro aceitava qualquer referência executável (`local diagnostico="${COMUM}"` para log);
// restringir à REGIÃO da invocação — de `timeout … codex|kimi` até o redirecionamento — ainda
// aceitava uma atribuição de prefixo na própria linha do comando (`DIAGNOSTICO="${COMUM}" timeout
// 900 codex …`). O que interessa é uma coisa só: o texto que o motor recebe COMO PROMPT. Achados
// do App do Codex, três rodadas sobre esta guarda.
//
// O prompt é o argumento entre aspas duplas que começa depois de `-p ` (Kimi) ou depois do tier do
// `review -m <tier> ` (Codex), e vai até a aspa que o fecha. Fatiar por aí é o que separa "o corpo
// menciona" de "a lente recebe".
const promptDaInvocacao = (corpo) => {
  const txt = semComentario(corpo);
  // ⚠️ A âncora do prompt é procurada DEPOIS do comando do motor, não no corpo inteiro. Soltar a
  // busca fazia o primeiro `-p "` da função virar "o prompt" — um `echo 'uso: kimi -p "…"'` ou um
  // log antes do `timeout` bastava para a guarda medir outro texto. É a fragilidade de procurar a
  // string solta, que esta mesma guarda levou três formas para largar. Achado de lente.
  const cmd = /timeout\s+\d+\s+(?:codex|kimi)\b/.exec(txt);
  if (!cmd) return null;
  const depois = txt.slice(cmd.index);
  const m = /(?:-p|review --json -m\s+\S+)\s+"/.exec(depois);
  if (!m) return null;
  const ini = m.index + m[0].length;
  // Até a primeira aspa dupla NÃO escapada. ⚠️ Contando as barras invertidas CONSECUTIVAS antes
  // dela, e não olhando só a anterior: em `\\"` a barra é literal e a aspa FECHA a string, mas o
  // teste de um caractere lia isso como aspa escapada e saltava o terminador de verdade —
  // capturando além do prompt, onde um `${COMUM}` posterior daria verde falso. Número ÍMPAR de
  // barras escapa a aspa; par, não. Achado de lente.
  let i = ini;
  while (i < depois.length) {
    if (depois[i] === '"') {
      let barras = 0;
      while (depois[i - 1 - barras] === '\\') barras += 1;
      if (barras % 2 === 0) break;
    }
    i += 1;
  }
  return i >= depois.length ? null : depois.slice(ini, i);
};
for (const f of despachos) {
  const prompt = promptDaInvocacao(f.corpo);
  if (prompt === null) {
    falha('fiação', `não achei o argumento do prompt em \`${f.nome}()\` (o texto entre aspas depois de \`-p\` ou do tier do \`review\`) — sem ele não dá para medir se o corpo chega à lente`);
  } else if (prompt.includes('${COMUM}')) {
    ok(`o PROMPT de \`${f.nome}()\` carrega \${COMUM}`);
  } else {
    falha('fiação', `o prompt de \`${f.nome}()\` não carrega \${COMUM} — o bloco pode estar no corpo, numa atribuição ou num log, e não chegar à lente`);
  }
}

// ── 2a. Os templates de saída mandam declarar o marcador da cópia da BASE ───
// O contrato do fallback NATIVO já ficou para trás uma vez, ainda mandando declarar o marcador
// lido em `.claude/revisao/*.md` — o head — depois que a extração da base entrou, o que reabria o
// vetor de injeção no motor que entra quando os dois externos caem. Por isso a guarda percorre
// TODOS os blocos de contrato, e não "algum". A prova de que ela pega é a mutação: trocar o
// caminho num dos blocos, ou apagar o bloco, deixa esta bateria vermelha.
// ⚠️ A unidade é o BLOCO de contrato de saída (o que abre com `LENTE: <id>`), não a linha
// `CORPUS:`. Contar linhas `CORPUS:` e exigir `> 0` não percebia template APAGADO — sumir com o
// contrato do motor nativo inteiro deixava a bateria verde com os restantes, que é exatamente o
// modo de falha que esta guarda existe para pegar: um motor sem a exigência, invisível. Achado
// de lente.
const blocos = motor.split('\n').flatMap((l, i) => (/^\s*LENTE: <id>/.test(l) ? [i] : []));
assert.ok(
  blocos.length >= 2,
  `achei ${blocos.length} bloco(s) de contrato de saída (\`LENTE: <id>\`) no motor; são pelo menos ` +
    'dois — o do Kimi e o do fallback nativo. Bloco a menos é um motor que deixou de exigir o ' +
    'corpo, e some sem nada ficar vermelho.',
);
const linhas = motor.split('\n');
const templates = [];
for (const b of blocos) {
  // O bloco vai até a linha em branco que o fecha; a `CORPUS:` mora dentro dele.
  const corpo = [];
  for (let i = b; i < linhas.length && linhas[i].trim() !== ''; i += 1) corpo.push(linhas[i]);
  const corpus = corpo.find((l) => /^\s*CORPUS:/.test(l));
  if (corpus === undefined) falha('contrato', `o bloco de contrato da linha ${b + 1} não tem CORPUS: — "não li" ficaria indistinguível de "li"`);
  else templates.push(corpus);
}
if (templates.length === blocos.length) ok(`os ${blocos.length} blocos de contrato de saída trazem a linha CORPUS:`);
for (const t of templates) {
  const nome = t.trim().slice(0, 34);
  if (t.includes('$OUT/corpus/')) ok(`o template "${nome}…" manda declarar o marcador da cópia da BASE`);
  else falha('contrato', `o template "${nome}…" não aponta para $OUT/corpus/ — apontando para a árvore, o head volta a ditar a própria revisão`);
}

// ── 2b. A metade do mecanismo que vive na SKILL também é medida ─────────────
// ⚠️ A bateria lia SÓ o motor, e metade do canal mora na skill: a nota que obriga a registrar a
// lente sem `CORPUS:`, e o passo que manda o achado retirado para `retirados.md`. Apagar
// qualquer um dos dois deixava CI, preflight e esta bateria inteiramente verdes — o mesmo
// "guarda apagada não fica vermelha" que este PR documentou para o motor, reaparecendo um
// arquivo ao lado, e que só não foi pago porque uma lente o viu. A conferência do marcador em si
// continua sendo humana, e isso é declarado; o que não pode é o texto que a torna obrigatória
// sumir sem sintoma. Achado de lente.
const skill = ler('.claude/skills/revisar-pr-apps/SKILL.md');
const NA_SKILL = [
  // ⚠️ A âncora é o MANDATO inteiro, não a expressão `marcador divergente` solta: a ressalva
  // contrafactual logo abaixo, no mesmo arquivo, também a contém — então apagar a frase que
  // OBRIGA o registro deixava a guarda verde pela menção vizinha. Mesma cegueira compartilhada
  // que já apareceu duas vezes neste PR. Achado do App do Codex.
  ['a nota da lente sem CORPUS: no quadro de execução', /com marcador divergente do vigente, aparece com essa\s+nota/],
  ['o marcador lido da cópia da BASE, não do head', /\$OUT\/corpus\/aprendizados\.md/],
  ['a ressalva de que `--conferir` mede o HEAD', /--conferir/],
  ['o passo de registrar o achado retirado', /retirados\.md/],
];
for (const [oque, re] of NA_SKILL) {
  if (re.test(skill)) ok(`a SKILL mantém ${oque}`);
  else falha('skill', `a SKILL perdeu ${oque} — metade do canal do corpo mora lá, e apagá-la não deixava nada vermelho`);
}

// ── 2c. O reparo CONVERGE, a partir de qualquer estado do marcador ───────────
// `canonico()` é o predicado único dos dois modos do carimbador (conferir e escrever), então é
// aqui que se prova que o reparo é reparo. O estado que motivou isto é o DUPLICADO: com o
// predicado antigo ("o marcador certo aparece em algum lugar"), o `--conferir` dizia ok e a
// escrita saía pelo atalho do "nada a fazer" — o arquivo ficava com dois marcadores
// contraditórios para sempre, e nada ficava vermelho. Achado do App do Codex.
{
  const controle = ler(ARQUIVOS[0]);
  const m = 'v0-teste0000';
  const alvo = canonico(controle, m);
  const linhas = controle.split('\n');
  const semLinha = controle.replace(/^<!-- corpus=.* -->\n/m, '');
  const estados = {
    'duplicado (o obsoleto DEPOIS do certo)': [...linhas.slice(0, 2), '<!-- corpus=v99-obsoleto -->', ...linhas.slice(2)].join('\n'),
    'duplicado (o obsoleto ANTES do certo)': [linhas[0], '<!-- corpus=v99-obsoleto -->', ...linhas.slice(1)].join('\n'),
    ausente: semLinha,
    desatualizado: controle.replace(/^<!-- corpus=.* -->$/m, '<!-- corpus=v1-00000000 -->'),
  };
  // Estados degenerados: não são o formato destes dois arquivos hoje, e é por isso que estão
  // aqui. O predicado antigo (`replace(/^(.*\n)/, …)`) virava NO-OP em todos os três — devolvia
  // o texto sem marcador nenhum —, e no-op é justamente o modo de falha que este bloco existe
  // para pegar: a escrita dizia ok sem gravar, e o arquivo que era só o marcador sem quebra final
  // saía VAZIO. Achado de lente.
  const degenerados = {
    'uma linha só, sem quebra final': '# Aprendizados',
    'sem quebra final, com marcador': '# Aprendizados\n<!-- corpus=v9-aaaaaaaa -->',
    vazio: '',
  };
  for (const [nome, estado] of Object.entries(degenerados)) {
    const reparado = canonico(estado, m);
    const marcadores = (reparado.match(/^<!-- corpus=.* -->$/gm) ?? []).length;
    if (marcadores !== 1) falha(`reparo: ${nome}`, `o canônico saiu com ${marcadores} marcador(es), não 1 — o reparo virou no-op`);
    else if (canonico(reparado, m) !== reparado) falha(`reparo: ${nome}`, 'reparar duas vezes dá resultados diferentes');
    else ok(`reparo converge a partir de: ${nome}`);
  }
  for (const [nome, estado] of Object.entries(estados)) {
    const reparado = canonico(estado, m);
    const marcadores = (reparado.match(/^<!-- corpus=.* -->$/gm) ?? []).length;
    if (estado === reparado) {
      falha(`reparo: ${nome}`, 'o estado defeituoso já é o canônico — a conferência não o acusaria, e a escrita não o consertaria');
    } else if (reparado !== alvo) {
      falha(`reparo: ${nome}`, 'reparar não levou ao mesmo arquivo que o controle leva');
    } else if (marcadores !== 1) {
      falha(`reparo: ${nome}`, `sobraram ${marcadores} marcador(es); o canônico tem exatamente 1`);
    } else {
      ok(`reparo converge a partir de: ${nome}`);
    }
  }
  if (canonico(alvo, m) === alvo) ok('o reparo é idempotente (reparar o canônico não o muda)');
  else falha('reparo', 'aplicar o reparo ao arquivo já canônico o altera — o carimbador nunca estabilizaria');
}

// ── 2d. O parser segue a regra do bash, e isso é medido, não afirmado ────────
// A regra do fecho de heredoc é a única coisa entre o parse correto e a função FANTASMA que
// engole a de despacho real. E ela não é observável a partir do motor de hoje — as duas regras
// dão o mesmo veredito nele —, então a prova tem de ser sobre a função, com um documento
// construído. Sem este caso, trocar a regra de volta por um `trim()` não deixaria nada vermelho.
{
  const doc = [
    '```bash',
    "cat > x <<'FIM'",
    'linha de dados',
    '  FIM',          // indentado: NÃO fecha um heredoc de `<<` no bash
    'fantasma() {',   // portanto isto ainda é DADO, não abertura de função
    'FIM',            // aqui sim
    'despacho() {',
    '  echo "$id exit=$rc motor=x" >> "$OUT/execucao.txt"',
    '}',
    '```',
  ].join('\n');
  const achadas = funcoesDoBash(doc);
  const nomes = achadas.map((f) => f.nome);
  if (nomes.length === 1 && nomes[0] === 'despacho') {
    ok('o parser segue a regra do bash no fecho de heredoc (linha indentada não fecha `<<`)');
  } else {
    falha('parser', `com heredoc "fechado" por linha indentada, o parser achou [${nomes.join(', ')}] em vez de [despacho] — ` +
      'a função fantasma engole a de despacho real, e o `ok()` sai atribuído ao nome errado');
  }
  // E o `<<-`, que o bash DEIXA indentar por TAB — o outro lado da mesma regra.
  const comTab = ['```bash', 'cat > x <<-FIM', 'dados', '\tFIM', 'despacho() {', '  algo', '}', '```'].join('\n');
  if (funcoesDoBash(comTab).map((f) => f.nome).join(',') === 'despacho') ok('o parser honra o `<<-`, que o bash deixa fechar com TAB');
  else falha('parser', 'com `<<-` e fecho indentado por TAB o parser não reencontrou o código — o heredoc engoliu o resto do bloco');
}

// ── 3. Toda entrada de `retirados.md` tem os quatro campos ───────────────────
const CAMPOS = ['**Afirmação:**', '**Por que é falsa:**', '**Evidência:**', '**Data:**'];
const retirados = ler('.claude/revisao/retirados.md');
// O cabeçalho do arquivo traz um MOLDE dentro de bloco de código, com os mesmos `###` e campos.
// Contá-lo como entrada faria a bateria medir o próprio exemplo; o corte é o `---` que separa
// a explicação das entradas de verdade.
const divisorias = (retirados.match(/\n---\n/g) ?? []).length;
assert.notEqual(divisorias, 0, 'retirados.md perdeu a divisória `---` entre a explicação e as entradas');
// ⚠️ UMA divisória, e a unicidade é o que sustenta o corte — nos DOIS scripts, que usam
// `indexOf` e portanto pegam a primeira. Com uma divisória a mais no cabeçalho, o `### ` do
// MOLDE volta para dentro do recorte: o carimbador o conta como entrada e esta bateria NÃO
// reprova, porque o molde tem os quatro campos. Os dois passariam a concordar no número
// errado — exatamente o descompasso que o corte existe para eliminar. Achado de lente.
assert.equal(
  divisorias, 1,
  `retirados.md tem ${divisorias} divisórias \`---\`; o corte dos dois scripts é por indexOf e ` +
    'pressupõe UMA. Com mais de uma, o molde do cabeçalho volta a contar como entrada e nada fica vermelho.',
);
const corte = retirados.indexOf('\n---\n');
const entradas = retirados.slice(corte).split(/^### /m).slice(1);
assert.ok(entradas.length > 0, 'retirados.md não tem nenhuma entrada — o registro nasceu vazio');
for (const entrada of entradas) {
  const titulo = entrada.split('\n')[0].trim();
  const faltando = CAMPOS.filter((c) => !entrada.includes(c));
  if (faltando.length === 0) ok(`retirado: "${titulo.slice(0, 48)}" com os 4 campos`);
  else falha(`retirado: "${titulo.slice(0, 48)}"`, `faltam ${faltando.join(', ')}`);
}

// ── 4. O corpo não é decorativo: ele precisa dizer o que PROCURAR ────────────
// Guarda barata contra o modo de falha mais provável do arquivo: virar prosa histórica. Se
// nenhuma seção diz "o que procurar", o corpo deixou de ser instrução para a lente.
const aprendizados = ler('.claude/revisao/aprendizados.md');
if (/o que procurar/i.test(aprendizados)) ok('os aprendizados dizem o que PROCURAR, não só o que aconteceu');
else falha('aprendizados', 'nenhuma seção diz "o que procurar" — o corpo virou história, e a lente não age sobre história');

console.log();
if (falhas === 0) { console.log('ok: o corpo de conhecimento das lentes passou em todas as guardas.'); process.exit(0); }
console.error(`FALHOU: ${falhas} caso(s).`);
process.exit(1);
