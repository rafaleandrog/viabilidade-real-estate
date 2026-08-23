// Tipos de `scripts/render-check.mjs`, para os testes de `frontend/render/`.
//
// O harness é `.mjs` de propósito: ele é código de NODE (servidor http,
// esbuild, Playwright), não do bundle do app, e não tem lugar em `frontend/`.
// Sem este arquivo o `tsc --strict` do `validar-frontend.sh` reprova o import
// com TS7016 — `any` implícito num módulo JS sem declaração.

export interface AchadoTransbordo { onde: string; scrollWidth: number; clientWidth: number }
export interface AchadoSobreposicao { a: string; b: string; px: number; py: number }
export interface AchadoInvisivel { onde: string; cor: string; fundo: string }

export interface MedidaDeLargura {
  overflowDocumento: { scrollWidth: number; clientWidth: number } | null;
  transbordoDeCaixa: AchadoTransbordo[];
  transbordoDeTexto: AchadoTransbordo[];
  corte: AchadoTransbordo[];
  sobreposicao: AchadoSobreposicao[];
  fingerprint: { largura: number; familia: string };
}

export interface MedidaDeVariante {
  tokensCitados: number;
  naoResolvem: string[];
  invisiveis: AchadoInvisivel[];
}

export interface PropDoEspelho {
  tag: string;
  prop: string;
  /** `null` para prop `so_propriedade` — o Lit a entrega por binding, sem atributo. */
  atributo: string | null;
  reproduzida: boolean;
}

export interface Montagem {
  nos: number;
  nosVisiveis: number;
  areaVisivel: number;
  largura: number;
  assentou: boolean;
  faltando: { seletor: string; minimo: number; achou: number; ocultos: number }[];
  /** Tags `urbi-*` presentes na árvore que não existem no espelho — logo, sem stub. */
  semStub: string[];
  /** Props não reproduzidas pelo stub e em uso num nó visível — união das larguras. */
  naoReproduzidas: string[];
  /** Dessas, as que o caso não declarou em `aceitaNaoReproduzido`. */
  naoDeclaradas: string[];
  /** O sentido oposto: declaradas e sem uso. */
  declaracoesOciosas: string[];
}

export interface Achados {
  caso: string;
  nVariantes: number;
  navegador: string;
  avisos: string[];
  montagem: Montagem | null;
  fingerprint: { largura: number; familia: string } | null;
  erroConsole: string[];
  larguras: Record<string, MedidaDeLargura>;
  variantes: Record<string, MedidaDeVariante>;
}

export function verificarRender(opcoes: {
  caso: string;
  larguras?: number[];
  altura?: number;
}): Promise<Achados>;

export function harnessDisponivel(): Promise<{ ok: boolean; motivo?: string }>;

export function descrever(achados: Achados, teto?: number): string[];

export function inventarioDeReproducao(): PropDoEspelho[];
