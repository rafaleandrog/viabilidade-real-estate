// demo/mock.ts
var SIGLAS = { loteamento: "LOT", incorporacao: "INC" };
function slug(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
var usuarios = [
  { id: 1, nome: "Voc\xEA (demo)", email: "voce@demo", tipo: "usuario_urbiverso", avatar_url: "" },
  { id: 2, nome: "Maria Diretoria", email: "maria@demo", tipo: "usuario_urbiverso", avatar_url: "" },
  { id: 3, nome: "Jo\xE3o Editor", email: "joao@demo", tipo: "usuario_urbiverso", avatar_url: "" }
];
var USUARIO_ATUAL = usuarios[0];
var seqId = 100;
var estudos = [];
var membros = [];
var imoveis = [];
var benchmarks = [];
var apeloStore = {};
var FATORES_DEMO = ["Localiza\xE7\xE3o", "Infraestrutura no Entorno", "Vetor de Crescimento", "Concorr\xEAncia", "Demanda Estrutural", "Seguran\xE7a Jur\xEDdica e Regulat\xF3ria"];
function apeloDemo(estudoId) {
  const fatores = FATORES_DEMO.map((nome, i) => {
    const notas = [4, 3, 5, 4].map((x2) => Math.max(1, Math.min(5, x2 - i % 2)));
    const media = Math.round(notas.reduce((s, x2) => s + x2, 0) / notas.length * 10) / 10;
    return {
      nome,
      nota_consolidada: media,
      justificativa_geral: `Avalia\xE7\xE3o do fator ${nome.toLowerCase()} com base nas fontes fornecidas (demo).`,
      perguntas: notas.map((n, j2) => ({ pergunta: `Pergunta-guia ${j2 + 1} de ${nome}`, nota: n, justificativa: "Justificativa sint\xE9tica (demo)." }))
    };
  });
  const todas = fatores.flatMap((f2) => f2.perguntas.map((p) => p.nota));
  const geral = Math.round(todas.reduce((s, x2) => s + x2, 0) / todas.length * 10) / 10;
  return {
    id: ++seqId,
    estudo_id: estudoId,
    score_geral: geral,
    resultado: {
      fatores,
      relatorio: {
        vantagens: ["Boa acessibilidade vi\xE1ria", "Vetor de crescimento favor\xE1vel"],
        desvantagens: ["Concorr\xEAncia relevante no entorno"],
        ganhos: ["Potencial de valoriza\xE7\xE3o no m\xE9dio prazo"],
        riscos: ["Depend\xEAncia de investimento p\xFAblico em infraestrutura"]
      }
    }
  };
}
function proximaSeq(tipo) {
  return estudos.filter((e) => e.tipo_empreendimento === tipo).length + 1;
}
function montarIdentificacao(nome, tipo, uf) {
  const sigla = SIGLAS[tipo] || tipo.slice(0, 3).toUpperCase();
  const seq = String(proximaSeq(tipo)).padStart(3, "0");
  return {
    sequencia: proximaSeq(tipo),
    nome_exibicao: [sigla, nome, uf.toUpperCase(), seq].filter(Boolean).join(" - "),
    id_legivel: [slug(sigla), slug(nome), slug(uf), seq].filter(Boolean).join("_")
  };
}
function novoEstudo(dados) {
  const id = ++seqId;
  const uf = dados.uf || "";
  const ident = montarIdentificacao(dados.nome, dados.tipo_empreendimento, uf);
  const e = {
    id,
    nome: dados.nome,
    tipo_empreendimento: dados.tipo_empreendimento,
    uf,
    nivel_analise: dados.nivel_analise || "preliminar",
    origem_terreno: dados.origem_terreno || "manual",
    status: "rascunho",
    autor_id: USUARIO_ATUAL.id,
    criado_em: (/* @__PURE__ */ new Date()).toISOString(),
    terreno_manual_nome: dados.terreno_manual_nome ?? null,
    terreno_manual_area: dados.terreno_manual_area ?? null,
    preco_venda_m2: dados.preco_venda_m2 ?? null,
    notas: dados.notas ?? null,
    // defaults de premissas (para a Proforma do demo mostrar números realistas)
    considerar_custo_terreno: true,
    custo_terreno_m2: 120,
    sistema_viario_pct: 25,
    app_pct: 5,
    area_media_lote_m2: 300,
    infra_modo: "pct_vgv",
    infra_pct: 30,
    projetos_modo: "pct_vgv",
    projetos_pct: 1.6,
    custo_construcao_m2: 4800,
    custo_decoracao_m2: 150,
    taxa_gestao_pct: 6,
    incorporacao_registro_pct: 0.25,
    manutencao_pct: 1,
    contingencias_pct: 0,
    imposto_percentual: 7,
    corretagem_percentual: 5,
    marketing_percentual: 1,
    marketing_global_pct: 1,
    gestao_indiretos_pct: 1.25,
    coef_aproveitamento_basico: 1,
    coef_aproveitamento_maximo: 3,
    area_pvt_r_fechada: dados.tipo_empreendimento === "incorporacao" ? 8e3 : 0,
    area_pvt_nr_fechada: dados.tipo_empreendimento === "incorporacao" ? 1200 : 0,
    area_comum_total: dados.tipo_empreendimento === "incorporacao" ? 3e3 : 0,
    num_unidades: dados.tipo_empreendimento === "incorporacao" ? 80 : 0,
    preco_venda_m2_residencial: dados.tipo_empreendimento === "incorporacao" ? 9500 : 0,
    preco_venda_m2_nao_residencial: dados.tipo_empreendimento === "incorporacao" ? 8e3 : 0,
    permuta_fisica_modo: "area_m2",
    ...ident
  };
  estudos.push(e);
  membros.push({ id: ++seqId, estudo_id: id, usuario_id: USUARIO_ATUAL.id, usuario_nome: USUARIO_ATUAL.nome, funcao: "editor" });
  return e;
}
var e1 = novoEstudo({ nome: "Residencial Aurora", tipo_empreendimento: "loteamento", uf: "DF", terreno_manual_nome: "Gleba Aurora", terreno_manual_area: 12e4, preco_venda_m2: 850 });
var e2 = novoEstudo({ nome: "P\xE1tio Urbit\xE1 1", tipo_empreendimento: "incorporacao", uf: "DF", terreno_manual_nome: "Lote Central", terreno_manual_area: 4200, preco_venda_m2: 9500 });
e2.status = "em_analise";
membros.push({ id: ++seqId, estudo_id: e2.id, usuario_id: 2, usuario_nome: "Maria Diretoria", funcao: "aprovador" });
function semearBenchmarks() {
  const comuns = [
    { campo: "resultado_final", valor: 25, regra_comparacao: "atingir_ou_superar" },
    { campo: "margem_bruta", valor: 30, regra_comparacao: "atingir_ou_superar" },
    { campo: "margem_liquida", valor: 20, regra_comparacao: "atingir_ou_superar" },
    { campo: "roi", valor: 15, regra_comparacao: "atingir_ou_superar" },
    { campo: "custo_obras_vgv", valor: 35, regra_comparacao: "nao_exceder" }
  ];
  let criados = 0;
  for (const tipo of ["loteamento", "incorporacao"]) {
    const base = [...comuns];
    if (tipo === "loteamento") base.push({ campo: "eficiencia_aproveitamento", valor: 40, regra_comparacao: "atingir_ou_superar" });
    for (const b of base) {
      if (benchmarks.some((x2) => x2.tipo_empreendimento === tipo && x2.campo === b.campo)) continue;
      benchmarks.push({ id: ++seqId, tipo_empreendimento: tipo, ...b, variacao_positiva_pct: 10, variacao_negativa_pct: 10 });
      criados++;
    }
  }
  return criados;
}
semearBenchmarks();
function permissao(estudo) {
  const m2 = membros.find((x2) => x2.estudo_id === estudo.id && x2.usuario_id === USUARIO_ATUAL.id);
  return {
    funcao: m2?.funcao || "aprovador",
    ehMembro: true,
    podeEditar: true,
    podeAprovar: true,
    podeSubmeter: estudo.status === "rascunho",
    podeEditarImoveis: estudo.status === "rascunho"
  };
}
function detalhe(estudo) {
  return {
    ...estudo,
    membros: membros.filter((m2) => m2.estudo_id === estudo.id),
    imoveis: imoveis.filter((i) => i.estudo_id === estudo.id),
    _permissao: permissao(estudo)
  };
}
async function api(url, opts) {
  const metodo = (opts?.method || "GET").toUpperCase();
  const body = opts?.body ? JSON.parse(opts.body) : {};
  const [caminho, query] = url.split("?");
  const q2 = new URLSearchParams(query || "");
  const seg = caminho.replace(/^\//, "").split("/").filter(Boolean);
  if (seg[0] === "shell") return { usuarios };
  const r = seg.slice(1);
  if (r[0] === "config") {
    return { parametros: { imposto_padrao_pct: 7, aliquota_ret_pct: 4, corretagem_padrao_pct: 5, marketing_padrao_pct: 1, gestao_indiretos_padrao_pct: 1.25, prazo_arquivamento_dias: 30 } };
  }
  if (r[0] === "estudos" && r[2] === "apelo-comercial") {
    const eid = Number(r[1]);
    apeloStore[eid] = apeloStore[eid] || { apelo: null, documentos: [] };
    const st2 = apeloStore[eid];
    if (r[3] === "documentos") {
      if (metodo === "POST") {
        const d = { id: ++seqId, tipo_dado: body.tipo_dado, texto_adicional: body.texto_adicional || null, documento: body.upload_id || null };
        st2.documentos.push(d);
        return d;
      }
      if (metodo === "DELETE") {
        st2.documentos = st2.documentos.filter((d) => d.id !== Number(r[4]));
        return { ok: true };
      }
    }
    if (metodo === "GET") return { apelo: st2.apelo, documentos: st2.documentos, fatores: [] };
    if (metodo === "POST") {
      st2.apelo = apeloDemo(eid);
      return st2.apelo;
    }
  }
  if (r[0] === "manutencao") return { ok: true, arquivados: 0, prazo_dias: 30 };
  if (r[0] === "nucleo") {
    return { dados: [], total: 0, disponivel: false, motivo: "Integra\xE7\xE3o com o N\xFAcleo indispon\xEDvel no demo. Use o modo manual." };
  }
  if (r[0] === "benchmarks") {
    if (r[1] === "semear" && metodo === "POST") return { ok: true, criados: semearBenchmarks() };
    if (!r[1] && metodo === "GET") {
      const tipo = q2.get("tipo_empreendimento");
      return { dados: benchmarks.filter((b) => !tipo || b.tipo_empreendimento === tipo), total: benchmarks.length };
    }
    if (!r[1] && metodo === "POST") {
      const b = { id: ++seqId, tipo_empreendimento: body.tipo_empreendimento, campo: body.campo, valor: body.valor ?? null, regra_comparacao: body.regra_comparacao || "atingir_ou_superar", variacao_positiva_pct: null, variacao_negativa_pct: null };
      benchmarks.push(b);
      return b;
    }
    if (r[1] && metodo === "PATCH") {
      const b = benchmarks.find((x2) => x2.id === Number(r[1]));
      if (b) Object.assign(b, body);
      return b || { erro: true };
    }
    if (r[1] && metodo === "DELETE") {
      const i = benchmarks.findIndex((x2) => x2.id === Number(r[1]));
      if (i >= 0) benchmarks.splice(i, 1);
      return { ok: true };
    }
  }
  if (r[0] === "estudos") {
    const id = Number(r[1]);
    if (!r[1]) {
      if (metodo === "GET") {
        const tipo = q2.get("tipo_empreendimento");
        const status = q2.get("status");
        const lista = estudos.filter((e) => (!tipo || e.tipo_empreendimento === tipo) && (!status || e.status === status)).map((e) => ({ ...e, _funcao: permissao(e).funcao })).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
        return { dados: lista, total: lista.length };
      }
      if (metodo === "POST") return novoEstudo(body);
    }
    const estudo = estudos.find((e) => e.id === id);
    if (!estudo) return { erro: true, mensagem: "Estudo n\xE3o encontrado" };
    if (r[2] === "status" && metodo === "POST") {
      estudo.status = body.status;
      return detalhe(estudo);
    }
    if (r[2] === "duplicar" && metodo === "POST") {
      const copia = novoEstudo({ ...estudo, nome: estudo.nome });
      return copia;
    }
    if (r[2] === "membros") {
      if (!r[3] && metodo === "GET") return { dados: membros.filter((m2) => m2.estudo_id === id) };
      if (!r[3] && metodo === "POST") {
        const u = usuarios.find((x2) => x2.id === Number(body.usuario_id));
        if (!membros.some((m2) => m2.estudo_id === id && m2.usuario_id === Number(body.usuario_id))) {
          membros.push({ id: ++seqId, estudo_id: id, usuario_id: Number(body.usuario_id), usuario_nome: u?.nome || "", funcao: body.funcao || "leitor" });
        }
        return { ok: true };
      }
      const uid = Number(r[3]);
      if (r[4] === "remover" && metodo === "PATCH") {
        const i = membros.findIndex((m2) => m2.estudo_id === id && m2.usuario_id === uid);
        if (i >= 0) membros.splice(i, 1);
        return { ok: true };
      }
      if (metodo === "PATCH") {
        const m2 = membros.find((x2) => x2.estudo_id === id && x2.usuario_id === uid);
        if (m2) m2.funcao = body.funcao;
        return { ok: true };
      }
    }
    if (r[2] === "imoveis") {
      if (metodo === "GET") return { dados: imoveis.filter((i) => i.estudo_id === id) };
      if (metodo === "POST") {
        const im = { id: ++seqId, estudo_id: id, imovel_nucleo_id: body.imovel_nucleo_id, tipo_imovel: body.tipo_imovel };
        imoveis.push(im);
        return im;
      }
      if (metodo === "DELETE") {
        const i = imoveis.findIndex((x2) => x2.id === Number(r[3]));
        if (i >= 0) imoveis.splice(i, 1);
        return { ok: true };
      }
    }
    if (metodo === "GET") return detalhe(estudo);
    if (metodo === "PATCH") {
      Object.assign(estudo, body);
      return detalhe(estudo);
    }
    if (metodo === "DELETE") {
      const i = estudos.findIndex((e) => e.id === id);
      if (i >= 0) estudos.splice(i, 1);
      return { ok: true };
    }
  }
  console.warn("[mock] rota n\xE3o tratada:", metodo, url);
  return { erro: true, mensagem: "Rota n\xE3o implementada no demo" };
}
function subRota() {
  const h2 = location.hash.replace(/^#/, "");
  return h2 || "/";
}
function toast(mensagem, tipo = "info") {
  const cores = { sucesso: "#13A98D", erro: "#D45A3A", alerta: "#F7A111", info: "#2AA9E0" };
  const el = document.createElement("div");
  el.textContent = mensagem;
  el.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0a0e1a;color:#fff;border:1px solid ${cores[tipo] || cores.info};border-left:4px solid ${cores[tipo] || cores.info};padding:10px 16px;border-radius:8px;z-index:1000;font-family:Inter,sans-serif;font-size:0.85rem;box-shadow:0 4px 16px rgba(0,0,0,0.4)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
var mock = {
  api,
  usuario: () => USUARIO_ATUAL,
  contexto: () => ({ nivel: "admin", roles: ["aprovador"] }),
  navegar: (rota) => {
    location.hash = rota;
  },
  notificar: (mensagem, tipo) => toast(mensagem, tipo || "info"),
  subRota,
  href: (sub) => `#${sub}`,
  navegarSub: (sub) => {
    location.hash = sub;
  },
  escutarRota: (cb) => {
    const h2 = () => cb(subRota());
    window.addEventListener("hashchange", h2);
    return () => window.removeEventListener("hashchange", h2);
  }
};
globalThis.urbiVerso = mock;

// frontend/index.js
var nr = Object.defineProperty;
var cr = Object.getOwnPropertyDescriptor;
var m = (o3, e, t, r) => {
  for (var a = r > 1 ? void 0 : r ? cr(e, t) : e, s = o3.length - 1, i; s >= 0; s--) (i = o3[s]) && (a = (r ? i(e, t, a) : i(a)) || a);
  return r && a && nr(e, t, a), a;
};
var dt = globalThis;
var ut = dt.ShadowRoot && (dt.ShadyCSS === void 0 || dt.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var wt = Symbol();
var ee = /* @__PURE__ */ new WeakMap();
var Q = class {
  constructor(e, t, r) {
    if (this._$cssResult$ = true, r !== wt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o, t = this.t;
    if (ut && e === void 0) {
      let r = t !== void 0 && t.length === 1;
      r && (e = ee.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), r && ee.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
var re = (o3) => new Q(typeof o3 == "string" ? o3 : o3 + "", void 0, wt);
var y = (o3, ...e) => {
  let t = o3.length === 1 ? o3[0] : e.reduce((r, a, s) => r + ((i) => {
    if (i._$cssResult$ === true) return i.cssText;
    if (typeof i == "number") return i;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + i + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(a) + o3[s + 1], o3[0]);
  return new Q(t, o3, wt);
};
var oe = (o3, e) => {
  if (ut) o3.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (let t of e) {
    let r = document.createElement("style"), a = dt.litNonce;
    a !== void 0 && r.setAttribute("nonce", a), r.textContent = t.cssText, o3.appendChild(r);
  }
};
var Ct = ut ? (o3) => o3 : (o3) => o3 instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (let r of e.cssRules) t += r.cssText;
  return re(t);
})(o3) : o3;
var { is: lr, defineProperty: dr, getOwnPropertyDescriptor: ur, getOwnPropertyNames: mr, getOwnPropertySymbols: pr, getPrototypeOf: hr } = Object;
var mt = globalThis;
var ae = mt.trustedTypes;
var vr = ae ? ae.emptyScript : "";
var gr = mt.reactiveElementPolyfillSupport;
var Y = (o3, e) => o3;
var tt = { toAttribute(o3, e) {
  switch (e) {
    case Boolean:
      o3 = o3 ? vr : null;
      break;
    case Object:
    case Array:
      o3 = o3 == null ? o3 : JSON.stringify(o3);
  }
  return o3;
}, fromAttribute(o3, e) {
  let t = o3;
  switch (e) {
    case Boolean:
      t = o3 !== null;
      break;
    case Number:
      t = o3 === null ? null : Number(o3);
      break;
    case Object:
    case Array:
      try {
        t = JSON.parse(o3);
      } catch {
        t = null;
      }
  }
  return t;
} };
var pt = (o3, e) => !lr(o3, e);
var se = { attribute: true, type: String, converter: tt, reflect: false, useDefault: false, hasChanged: pt };
Symbol.metadata ??= Symbol("metadata"), mt.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var N = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = se) {
    if (t.state && (t.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = true), this.elementProperties.set(e, t), !t.noAccessor) {
      let r = Symbol(), a = this.getPropertyDescriptor(e, r, t);
      a !== void 0 && dr(this.prototype, e, a);
    }
  }
  static getPropertyDescriptor(e, t, r) {
    let { get: a, set: s } = ur(this.prototype, e) ?? { get() {
      return this[t];
    }, set(i) {
      this[t] = i;
    } };
    return { get: a, set(i) {
      let n = a?.call(this);
      s?.call(this, i), this.requestUpdate(e, n, r);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? se;
  }
  static _$Ei() {
    if (this.hasOwnProperty(Y("elementProperties"))) return;
    let e = hr(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(Y("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(Y("properties"))) {
      let t = this.properties, r = [...mr(t), ...pr(t)];
      for (let a of r) this.createProperty(a, t[a]);
    }
    let e = this[Symbol.metadata];
    if (e !== null) {
      let t = litPropertyMetadata.get(e);
      if (t !== void 0) for (let [r, a] of t) this.elementProperties.set(r, a);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (let [t, r] of this.elementProperties) {
      let a = this._$Eu(t, r);
      a !== void 0 && this._$Eh.set(a, t);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    let t = [];
    if (Array.isArray(e)) {
      let r = new Set(e.flat(1 / 0).reverse());
      for (let a of r) t.unshift(Ct(a));
    } else e !== void 0 && t.push(Ct(e));
    return t;
  }
  static _$Eu(e, t) {
    let r = t.attribute;
    return r === false ? void 0 : typeof r == "string" ? r : typeof e == "string" ? e.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
  }
  addController(e) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
  }
  removeController(e) {
    this._$EO?.delete(e);
  }
  _$E_() {
    let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
    for (let r of t.keys()) this.hasOwnProperty(r) && (e.set(r, this[r]), delete this[r]);
    e.size > 0 && (this._$Ep = e);
  }
  createRenderRoot() {
    let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return oe(e, this.constructor.elementStyles), e;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((e) => e.hostConnected?.());
  }
  enableUpdating(e) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((e) => e.hostDisconnected?.());
  }
  attributeChangedCallback(e, t, r) {
    this._$AK(e, r);
  }
  _$ET(e, t) {
    let r = this.constructor.elementProperties.get(e), a = this.constructor._$Eu(e, r);
    if (a !== void 0 && r.reflect === true) {
      let s = (r.converter?.toAttribute !== void 0 ? r.converter : tt).toAttribute(t, r.type);
      this._$Em = e, s == null ? this.removeAttribute(a) : this.setAttribute(a, s), this._$Em = null;
    }
  }
  _$AK(e, t) {
    let r = this.constructor, a = r._$Eh.get(e);
    if (a !== void 0 && this._$Em !== a) {
      let s = r.getPropertyOptions(a), i = typeof s.converter == "function" ? { fromAttribute: s.converter } : s.converter?.fromAttribute !== void 0 ? s.converter : tt;
      this._$Em = a;
      let n = i.fromAttribute(t, s.type);
      this[a] = n ?? this._$Ej?.get(a) ?? n, this._$Em = null;
    }
  }
  requestUpdate(e, t, r, a = false, s) {
    if (e !== void 0) {
      let i = this.constructor;
      if (a === false && (s = this[e]), r ??= i.getPropertyOptions(e), !((r.hasChanged ?? pt)(s, t) || r.useDefault && r.reflect && s === this._$Ej?.get(e) && !this.hasAttribute(i._$Eu(e, r)))) return;
      this.C(e, t, r);
    }
    this.isUpdatePending === false && (this._$ES = this._$EP());
  }
  C(e, t, { useDefault: r, reflect: a, wrapped: s }, i) {
    r && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, i ?? t ?? this[e]), s !== true || i !== void 0) || (this._$AL.has(e) || (this.hasUpdated || r || (t = void 0), this._$AL.set(e, t)), a === true && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t) {
      Promise.reject(t);
    }
    let e = this.scheduleUpdate();
    return e != null && await e, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (let [a, s] of this._$Ep) this[a] = s;
        this._$Ep = void 0;
      }
      let r = this.constructor.elementProperties;
      if (r.size > 0) for (let [a, s] of r) {
        let { wrapped: i } = s, n = this[a];
        i !== true || this._$AL.has(a) || n === void 0 || this.C(a, void 0, s, n);
      }
    }
    let e = false, t = this._$AL;
    try {
      e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((r) => r.hostUpdate?.()), this.update(t)) : this._$EM();
    } catch (r) {
      throw e = false, this._$EM(), r;
    }
    e && this._$AE(t);
  }
  willUpdate(e) {
  }
  _$AE(e) {
    this._$EO?.forEach((t) => t.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(e)), this.updated(e);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(e) {
    return true;
  }
  update(e) {
    this._$Eq &&= this._$Eq.forEach((t) => this._$ET(t, this[t])), this._$EM();
  }
  updated(e) {
  }
  firstUpdated(e) {
  }
};
N.elementStyles = [], N.shadowRootOptions = { mode: "open" }, N[Y("elementProperties")] = /* @__PURE__ */ new Map(), N[Y("finalized")] = /* @__PURE__ */ new Map(), gr?.({ ReactiveElement: N }), (mt.reactiveElementVersions ??= []).push("2.1.2");
var Ot = globalThis;
var ie = (o3) => o3;
var ht = Ot.trustedTypes;
var ne = ht ? ht.createPolicy("lit-html", { createHTML: (o3) => o3 }) : void 0;
var pe = "$lit$";
var q = `lit$${Math.random().toFixed(9).slice(2)}$`;
var he = "?" + q;
var br = `<${he}>`;
var D = document;
var rt = () => D.createComment("");
var ot = (o3) => o3 === null || typeof o3 != "object" && typeof o3 != "function";
var Tt = Array.isArray;
var fr = (o3) => Tt(o3) || typeof o3?.[Symbol.iterator] == "function";
var Rt = `[ 	
\f\r]`;
var et = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var ce = /-->/g;
var le = />/g;
var F = RegExp(`>|${Rt}(?:([^\\s"'>=/]+)(${Rt}*=${Rt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var de = /'/g;
var ue = /"/g;
var ve = /^(?:script|style|textarea|title)$/i;
var Ft = (o3) => (e, ...t) => ({ _$litType$: o3, strings: e, values: t });
var c = Ft(1);
var Ut = Ft(2);
var Ir = Ft(3);
var j = Symbol.for("lit-noChange");
var h = Symbol.for("lit-nothing");
var me = /* @__PURE__ */ new WeakMap();
var U = D.createTreeWalker(D, 129);
function ge(o3, e) {
  if (!Tt(o3) || !o3.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return ne !== void 0 ? ne.createHTML(e) : e;
}
var _r = (o3, e) => {
  let t = o3.length - 1, r = [], a, s = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", i = et;
  for (let n = 0; n < t; n++) {
    let d = o3[n], u, b, p = -1, k = 0;
    for (; k < d.length && (i.lastIndex = k, b = i.exec(d), b !== null); ) k = i.lastIndex, i === et ? b[1] === "!--" ? i = ce : b[1] !== void 0 ? i = le : b[2] !== void 0 ? (ve.test(b[2]) && (a = RegExp("</" + b[2], "g")), i = F) : b[3] !== void 0 && (i = F) : i === F ? b[0] === ">" ? (i = a ?? et, p = -1) : b[1] === void 0 ? p = -2 : (p = i.lastIndex - b[2].length, u = b[1], i = b[3] === void 0 ? F : b[3] === '"' ? ue : de) : i === ue || i === de ? i = F : i === ce || i === le ? i = et : (i = F, a = void 0);
    let M = i === F && o3[n + 1].startsWith("/>") ? " " : "";
    s += i === et ? d + br : p >= 0 ? (r.push(u), d.slice(0, p) + pe + d.slice(p) + q + M) : d + q + (p === -2 ? n : M);
  }
  return [ge(o3, s + (o3[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), r];
};
var at = class o {
  constructor({ strings: e, _$litType$: t }, r) {
    let a;
    this.parts = [];
    let s = 0, i = 0, n = e.length - 1, d = this.parts, [u, b] = _r(e, t);
    if (this.el = o.createElement(u, r), U.currentNode = this.el.content, t === 2 || t === 3) {
      let p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (a = U.nextNode()) !== null && d.length < n; ) {
      if (a.nodeType === 1) {
        if (a.hasAttributes()) for (let p of a.getAttributeNames()) if (p.endsWith(pe)) {
          let k = b[i++], M = a.getAttribute(p).split(q), T = /([.?@])?(.*)/.exec(k);
          d.push({ type: 1, index: s, name: T[2], strings: M, ctor: T[1] === "." ? Lt : T[1] === "?" ? It : T[1] === "@" ? Nt : V }), a.removeAttribute(p);
        } else p.startsWith(q) && (d.push({ type: 6, index: s }), a.removeAttribute(p));
        if (ve.test(a.tagName)) {
          let p = a.textContent.split(q), k = p.length - 1;
          if (k > 0) {
            a.textContent = ht ? ht.emptyScript : "";
            for (let M = 0; M < k; M++) a.append(p[M], rt()), U.nextNode(), d.push({ type: 2, index: ++s });
            a.append(p[k], rt());
          }
        }
      } else if (a.nodeType === 8) if (a.data === he) d.push({ type: 2, index: s });
      else {
        let p = -1;
        for (; (p = a.data.indexOf(q, p + 1)) !== -1; ) d.push({ type: 7, index: s }), p += q.length - 1;
      }
      s++;
    }
  }
  static createElement(e, t) {
    let r = D.createElement("template");
    return r.innerHTML = e, r;
  }
};
function G(o3, e, t = o3, r) {
  if (e === j) return e;
  let a = r !== void 0 ? t._$Co?.[r] : t._$Cl, s = ot(e) ? void 0 : e._$litDirective$;
  return a?.constructor !== s && (a?._$AO?.(false), s === void 0 ? a = void 0 : (a = new s(o3), a._$AT(o3, t, r)), r !== void 0 ? (t._$Co ??= [])[r] = a : t._$Cl = a), a !== void 0 && (e = G(o3, a._$AS(o3, e.values), a, r)), e;
}
var Mt = class {
  constructor(e, t) {
    this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(e) {
    let { el: { content: t }, parts: r } = this._$AD, a = (e?.creationScope ?? D).importNode(t, true);
    U.currentNode = a;
    let s = U.nextNode(), i = 0, n = 0, d = r[0];
    for (; d !== void 0; ) {
      if (i === d.index) {
        let u;
        d.type === 2 ? u = new st(s, s.nextSibling, this, e) : d.type === 1 ? u = new d.ctor(s, d.name, d.strings, this, e) : d.type === 6 && (u = new qt(s, this, e)), this._$AV.push(u), d = r[++n];
      }
      i !== d?.index && (s = U.nextNode(), i++);
    }
    return U.currentNode = D, a;
  }
  p(e) {
    let t = 0;
    for (let r of this._$AV) r !== void 0 && (r.strings !== void 0 ? (r._$AI(e, r, t), t += r.strings.length - 2) : r._$AI(e[t])), t++;
  }
};
var st = class o2 {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, t, r, a) {
    this.type = 2, this._$AH = h, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = r, this.options = a, this._$Cv = a?.isConnected ?? true;
  }
  get parentNode() {
    let e = this._$AA.parentNode, t = this._$AM;
    return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(e, t = this) {
    e = G(this, e, t), ot(e) ? e === h || e == null || e === "" ? (this._$AH !== h && this._$AR(), this._$AH = h) : e !== this._$AH && e !== j && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : fr(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== h && ot(this._$AH) ? this._$AA.nextSibling.data = e : this.T(D.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    let { values: t, _$litType$: r } = e, a = typeof r == "number" ? this._$AC(e) : (r.el === void 0 && (r.el = at.createElement(ge(r.h, r.h[0]), this.options)), r);
    if (this._$AH?._$AD === a) this._$AH.p(t);
    else {
      let s = new Mt(a, this), i = s.u(this.options);
      s.p(t), this.T(i), this._$AH = s;
    }
  }
  _$AC(e) {
    let t = me.get(e.strings);
    return t === void 0 && me.set(e.strings, t = new at(e)), t;
  }
  k(e) {
    Tt(this._$AH) || (this._$AH = [], this._$AR());
    let t = this._$AH, r, a = 0;
    for (let s of e) a === t.length ? t.push(r = new o2(this.O(rt()), this.O(rt()), this, this.options)) : r = t[a], r._$AI(s), a++;
    a < t.length && (this._$AR(r && r._$AB.nextSibling, a), t.length = a);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    for (this._$AP?.(false, true, t); e !== this._$AB; ) {
      let r = ie(e).nextSibling;
      ie(e).remove(), e = r;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
};
var V = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, t, r, a, s) {
    this.type = 1, this._$AH = h, this._$AN = void 0, this.element = e, this.name = t, this._$AM = a, this.options = s, r.length > 2 || r[0] !== "" || r[1] !== "" ? (this._$AH = Array(r.length - 1).fill(new String()), this.strings = r) : this._$AH = h;
  }
  _$AI(e, t = this, r, a) {
    let s = this.strings, i = false;
    if (s === void 0) e = G(this, e, t, 0), i = !ot(e) || e !== this._$AH && e !== j, i && (this._$AH = e);
    else {
      let n = e, d, u;
      for (e = s[0], d = 0; d < s.length - 1; d++) u = G(this, n[r + d], t, d), u === j && (u = this._$AH[d]), i ||= !ot(u) || u !== this._$AH[d], u === h ? e = h : e !== h && (e += (u ?? "") + s[d + 1]), this._$AH[d] = u;
    }
    i && !a && this.j(e);
  }
  j(e) {
    e === h ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
};
var Lt = class extends V {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === h ? void 0 : e;
  }
};
var It = class extends V {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== h);
  }
};
var Nt = class extends V {
  constructor(e, t, r, a, s) {
    super(e, t, r, a, s), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = G(this, e, t, 0) ?? h) === j) return;
    let r = this._$AH, a = e === h && r !== h || e.capture !== r.capture || e.once !== r.once || e.passive !== r.passive, s = e !== h && (r === h || a);
    a && this.element.removeEventListener(this.name, this, r), s && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
};
var qt = class {
  constructor(e, t, r) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = r;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    G(this, e);
  }
};
var $r = Ot.litHtmlPolyfillSupport;
$r?.(at, st), (Ot.litHtmlVersions ??= []).push("3.3.3");
var be = (o3, e, t) => {
  let r = t?.renderBefore ?? e, a = r._$litPart$;
  if (a === void 0) {
    let s = t?.renderBefore ?? null;
    r._$litPart$ = a = new st(e.insertBefore(rt(), s), s, void 0, t ?? {});
  }
  return a._$AI(o3), a;
};
var Dt = globalThis;
var f = class extends N {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    let e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    let t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = be(t, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return j;
  }
};
f._$litElement$ = true, f.finalized = true, Dt.litElementHydrateSupport?.({ LitElement: f });
var xr = Dt.litElementPolyfillSupport;
xr?.({ LitElement: f });
(Dt.litElementVersions ??= []).push("4.2.2");
var E = (o3) => (e, t) => {
  t !== void 0 ? t.addInitializer(() => {
    customElements.define(o3, e);
  }) : customElements.define(o3, e);
};
var yr = { attribute: true, type: String, converter: tt, reflect: false, hasChanged: pt };
var Er = (o3 = yr, e, t) => {
  let { kind: r, metadata: a } = t, s = globalThis.litPropertyMetadata.get(a);
  if (s === void 0 && globalThis.litPropertyMetadata.set(a, s = /* @__PURE__ */ new Map()), r === "setter" && ((o3 = Object.create(o3)).wrapped = true), s.set(t.name, o3), r === "accessor") {
    let { name: i } = t;
    return { set(n) {
      let d = e.get.call(this);
      e.set.call(this, n), this.requestUpdate(i, d, o3, true, n);
    }, init(n) {
      return n !== void 0 && this.C(i, void 0, o3, n), n;
    } };
  }
  if (r === "setter") {
    let { name: i } = t;
    return function(n) {
      let d = this[i];
      e.call(this, n), this.requestUpdate(i, d, o3, true, n);
    };
  }
  throw Error("Unsupported decorator location: " + r);
};
function A(o3) {
  return (e, t) => typeof t == "object" ? Er(o3, e, t) : ((r, a, s) => {
    let i = a.hasOwnProperty(s);
    return a.constructor.createProperty(s, r), i ? Object.getOwnPropertyDescriptor(a, s) : void 0;
  })(o3, e, t);
}
function g(o3) {
  return A({ ...o3, state: true, attribute: false });
}
var J = { rascunho: "Rascunho", em_analise: "Em an\xE1lise", aprovado: "Aprovado", reprovado: "Reprovado", arquivado: "Arquivado" };
var W = { loteamento: "Loteamento", incorporacao: "Incorpora\xE7\xE3o" };
function fe(o3) {
  if (!o3) return "\u2014";
  let e = new Date(o3);
  return isNaN(e.getTime()) ? "\u2014" : e.toLocaleDateString("pt-BR");
}
var P = y`
  :host {
    display: block;
    color: var(--cor-texto, rgba(255, 255, 255, 0.85));
    font-family: 'Inter', system-ui, sans-serif;
  }
  h1, h2, h3 { color: var(--cor-texto, rgba(255, 255, 255, 0.92)); font-weight: 600; }
  a { color: var(--cor-primaria-solida, #2AA9E0); text-decoration: none; }
  .sec { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
  .vazio { text-align: center; padding: 40px; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }

  button {
    font-family: inherit; font-size: 0.85rem; cursor: pointer;
    border-radius: 6px; padding: 7px 14px; border: 1px solid transparent;
  }
  .btn-primario { background: var(--cor-primaria-solida, #2AA9E0); color: #06121c; font-weight: 600; }
  .btn-cta { background: var(--cor-cta, #F7A111); color: #1a1200; font-weight: 600; }
  .btn-sec {
    background: var(--cor-superficie, rgba(255,255,255,0.04));
    border-color: var(--cor-borda, rgba(255,255,255,0.14));
    color: var(--cor-texto, rgba(255,255,255,0.85));
  }
  .btn-perigo { background: transparent; border-color: var(--cor-erro, #D45A3A); color: var(--cor-erro, #D45A3A); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sm { padding: 4px 10px; font-size: 0.78rem; }

  .card {
    background: var(--cor-superficie, rgba(255,255,255,0.04));
    border: 1px solid var(--cor-borda, rgba(255,255,255,0.08));
    border-radius: 10px; padding: 16px;
  }

  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td {
    text-align: left; padding: 10px 12px;
    border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.08));
  }
  th { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; font-size: 0.75rem;
       text-transform: uppercase; letter-spacing: 0.04em; }
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: var(--cor-superficie, rgba(255,255,255,0.04)); }

  .badge {
    display: inline-block; font-size: 0.72rem; font-weight: 600;
    padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  }
  .badge.rascunho   { background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.7); }
  .badge.em_analise { background: rgba(42,169,224,0.16); color: #2AA9E0; }
  .badge.aprovado   { background: rgba(19,169,141,0.16); color: #13A98D; }
  .badge.reprovado  { background: rgba(212,90,58,0.16); color: #D45A3A; }
  .badge.arquivado  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }

  .campo { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .campo label { font-size: 0.8rem; color: var(--cor-texto-sec, rgba(255,255,255,0.55)); }
  input, select, textarea {
    font-family: inherit; font-size: 0.88rem; padding: 8px 10px; border-radius: 6px;
    background: var(--cor-fundo, #0D1B2A);
    border: 1px solid var(--cor-borda, rgba(255,255,255,0.14));
    color: var(--cor-texto, rgba(255,255,255,0.9));
  }
  .erro { color: var(--cor-erro, #D45A3A); font-size: 0.82rem; }

  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px;
  }
  .modal {
    background: var(--cor-topbar, #0a0e1a);
    border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    border-radius: 12px; padding: 22px; width: 100%; max-width: 460px;
    max-height: 90vh; overflow-y: auto;
  }
  .modal h3 { margin: 0 0 16px; font-size: 1.05rem; }
  .acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
`;
var x = (o3) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(o3 || 0);
var B = (o3, e = 0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: e }).format(o3 || 0);
var _ = (o3) => `${(o3 || 0).toFixed(1)}%`;
var v = (o3) => Number(o3) || 0;
function w(o3) {
  let e = o3.tipo_empreendimento === "loteamento", t = v(o3.terreno_manual_area), r = 0, a = 0, s = 0, i = 0, n = 0, d = v(o3.preco_venda_m2);
  if (e) {
    let X = v(o3.app_pct) + v(o3.faixas_nao_edificaveis_pct) + v(o3.sistema_viario_pct) + v(o3.elup_pct) + v(o3.epc_pct) + v(o3.epu_pct) + v(o3.areas_privativas_nao_vendaveis_pct);
    r = t * (1 - X / 100), a = r;
  } else {
    let X = v(o3.area_pvt_r_fechada), St = v(o3.area_pvt_nr_fechada), sr = v(o3.area_pvt_r_aberta), ir = v(o3.area_pvt_nr_aberta);
    a = X + St + sr + ir, s = a + v(o3.area_comum_total), r = X + St, i = X * v(o3.preco_venda_m2_residencial), n = St * v(o3.preco_venda_m2_nao_residencial);
  }
  let u = o3.permuta_fisica_modo === "pct_area_venda" ? r * v(o3.permuta_fisica_pct) / 100 : v(o3.permuta_fisica_area_m2), b = r - u;
  e && (i = b * d);
  let p = i + n, k = o3.sujeito_ret ? o3.aliquota_ret_pct ?? 4 : v(o3.imposto_percentual), M = p * k / 100, T = p * v(o3.corretagem_percentual) / 100, zt = p * v(o3.marketing_percentual) / 100, _t = i * v(o3.permuta_financeira_residencial_pct) / 100, $t = n * v(o3.permuta_financeira_nao_residencial_pct) / 100, xt = p - M - T - zt - _t - $t, Ht = o3.considerar_custo_terreno === false ? 0 : v(o3.custo_terreno_m2) * t, it = e ? o3.infra_modo === "valor_m2" ? v(o3.custo_infra_m2) * r : p * v(o3.infra_pct) / 100 : 0, nt = e ? 0 : v(o3.custo_construcao_m2) * a, ct = e ? 0 : v(o3.custo_decoracao_m2) * a, Ke = e ? it : nt + ct, yt = e ? 0 : Ke * v(o3.taxa_gestao_pct) / 100, Gt = o3.projetos_modo === "valor_fixo" ? v(o3.projetos_valor_fixo) : p * v(o3.projetos_pct) / 100, Vt = e ? 0 : v(o3.coef_aproveitamento_basico) > 0 ? v(o3.valor_venal_terreno_m2) / v(o3.coef_aproveitamento_basico) * t * (v(o3.coef_aproveitamento_maximo) - v(o3.coef_aproveitamento_basico)) * 0.2 : 0, Jt = e ? 0 : p * v(o3.incorporacao_registro_pct) / 100, Wt = p * v(o3.manutencao_pct) / 100, Zt = p * v(o3.contingencias_pct) / 100, Et = Ht + Gt + it + Vt + Jt + nt + yt + ct + Wt + Zt, Kt = p * v(o3.marketing_global_pct) / 100 + (e ? v(o3.stand_vendas_valor) : 0), Xt = p * v(o3.gestao_indiretos_pct) / 100, At = Kt + Xt, lt = xt - Et - At, Qt = lt + _t + $t, Xe = e ? d : r > 0 ? p / r : 0, Yt = u * Xe, Qe = Qt + Yt, Ye = p > 0 ? lt / p * 100 : 0, kt = Et + At, te = e ? it : nt + ct + yt, tr = p > 0 ? te / p * 100 : 0, er = p > 0 ? xt / p * 100 : 0, rr = kt > 0 ? lt / kt * 100 : 0, or = t > 0 ? r / t * 100 : 0, Pt = e ? v(o3.area_media_lote_m2) > 0 ? Math.floor(b / v(o3.area_media_lote_m2)) : 0 : v(o3.num_unidades), ar = e ? v(o3.area_media_lote_m2) * d : Pt > 0 ? p / Pt : 0;
  return { areaTerreno: t, areaVendavel: r, areaPermutaFisica: u, areaVendavelLiquida: b, areaPrivativa: a, areaConstruida: s, vgvResidencial: i, vgvNaoResidencial: n, vgv: p, imposto: M, corretagem: T, marketing: zt, permutaFinResidencial: _t, permutaFinNaoResidencial: $t, receitaLiquida: xt, custoTerreno: Ht, projetos: Gt, infraestrutura: it, outorga: Vt, incorporacaoRegistro: Jt, construcao: nt, gestaoConstrucao: yt, decoracao: ct, manutencao: Wt, contingencias: Zt, custoDiretoTotal: Et, marketingGlobal: Kt, gestaoIndiretos: Xt, custoIndiretoTotal: At, resultado: lt, resultadoComPermutasFin: Qt, resultadoComPermutasFisicas: Qe, valorPermutaFisica: Yt, margemLiquidaPct: Ye, investimentoTotal: kt, custoObras: te, custoObrasVgvPct: tr, margemBrutaPct: er, roiPct: rr, eficienciaPct: or, numUnidades: Pt, precoMedioUnidade: ar };
}
function _e(o3, e) {
  let t = o3.tipo_empreendimento === "loteamento", r = (n) => {
    let d = t ? { ...o3, preco_venda_m2: n } : { ...o3, preco_venda_m2_residencial: n, preco_venda_m2_nao_residencial: n };
    return w(d).margemLiquidaPct;
  }, a = 1e6;
  if (r(a) < e) return null;
  if (r(0.01) >= e) return 0;
  let s = 0, i = a;
  for (let n = 0; n < 60; n++) {
    let d = (s + i) / 2;
    r(d) >= e ? i = d : s = d;
  }
  return i;
}
var l = globalThis.urbiVerso;
var $ = "/viabilidade";
function $e(o3 = {}) {
  let e = new URLSearchParams();
  o3.tipo_empreendimento && e.set("tipo_empreendimento", o3.tipo_empreendimento), o3.status && e.set("status", o3.status);
  let t = e.toString() ? `?${e}` : "";
  return l.api(`${$}/estudos${t}`);
}
function xe(o3) {
  return l.api(`${$}/estudos`, { method: "POST", body: JSON.stringify(o3) });
}
function ye(o3) {
  return l.api(`${$}/estudos/${o3}`);
}
function Ee(o3, e) {
  return l.api(`${$}/estudos/${o3}`, { method: "PATCH", body: JSON.stringify(e) });
}
function Ae(o3) {
  return l.api(`${$}/estudos/${o3}`, { method: "DELETE" });
}
function ke(o3) {
  return l.api(`${$}/estudos/${o3}/duplicar`, { method: "POST" });
}
function Pe(o3, e) {
  return l.api(`${$}/estudos/${o3}/status`, { method: "POST", body: JSON.stringify({ status: e }) });
}
function gt(o3) {
  return l.api(`${$}/estudos/${o3}/membros`);
}
function Se(o3, e, t) {
  return l.api(`${$}/estudos/${o3}/membros`, { method: "POST", body: JSON.stringify({ usuario_id: e, funcao: t }) });
}
function we(o3, e, t) {
  return l.api(`${$}/estudos/${o3}/membros/${e}`, { method: "PATCH", body: JSON.stringify({ funcao: t }) });
}
function Ce(o3, e) {
  return l.api(`${$}/estudos/${o3}/membros/${e}/remover`, { method: "PATCH" });
}
function Z(o3) {
  let e = o3 ? `?tipo_empreendimento=${o3}` : "";
  return l.api(`${$}/benchmarks${e}`);
}
function Re(o3) {
  return l.api(`${$}/benchmarks`, { method: "POST", body: JSON.stringify(o3) });
}
function Me(o3, e) {
  return l.api(`${$}/benchmarks/${o3}`, { method: "PATCH", body: JSON.stringify(e) });
}
function Le(o3) {
  return l.api(`${$}/benchmarks/${o3}`, { method: "DELETE" });
}
function Ie() {
  return l.api(`${$}/benchmarks/semear`, { method: "POST" });
}
function bt() {
  return l.api(`${$}/config`);
}
function Ne(o3) {
  return l.api(`${$}/estudos/${o3}/apelo-comercial`);
}
async function qe(o3) {
  let e = new FormData();
  return e.append("file", o3), (await fetch("/api/dados/viabilidade/apelo_comercial_documentos/__upload?coluna=documento", { method: "POST", body: e, credentials: "same-origin" })).json();
}
function jt(o3, e) {
  return l.api(`${$}/estudos/${o3}/apelo-comercial/documentos`, { method: "POST", body: JSON.stringify(e) });
}
function Oe(o3, e) {
  return l.api(`${$}/estudos/${o3}/apelo-comercial/documentos/${e}`, { method: "DELETE" });
}
function Te(o3) {
  return l.api(`${$}/estudos/${o3}/apelo-comercial`, { method: "POST" });
}
async function Fe() {
  let o3 = await l.api("/shell/apps/viabilidade/roles/usuarios");
  return [...Array.isArray(o3) ? o3 : o3?.usuarios || []].sort((t, r) => (t.nome ?? "").localeCompare(r.nome ?? "", "pt-BR", { sensitivity: "base" }));
}
var S = class extends f {
  constructor() {
    super(...arguments);
    this.aba = "estudos";
    this.estudos = [];
    this.carregando = true;
    this.filtroTipo = "";
    this.filtroStatus = "";
    this.mostrarForm = false;
    this.form = {};
    this.salvando = false;
    this.formErro = "";
    this._abrirForm = () => {
      this.form = { nome: "", tipo_empreendimento: "loteamento", nivel_analise: "preliminar", origem_terreno: "manual", uf: "" }, this.formErro = "", this.mostrarForm = true;
    };
    this._salvar = async () => {
      if (!this.form.nome?.trim()) {
        this.formErro = "Informe o nome do estudo.";
        return;
      }
      this.salvando = true, this.formErro = "";
      try {
        let t = await xe({ nome: this.form.nome.trim(), tipo_empreendimento: this.form.tipo_empreendimento, nivel_analise: this.form.nivel_analise, origem_terreno: this.form.origem_terreno, uf: this.form.uf || null });
        if (t?.erro) {
          this.formErro = t.mensagem || "Erro ao criar estudo";
          return;
        }
        this.mostrarForm = false, l.notificar("Estudo criado (rascunho).", "sucesso"), t?.id && l.navegarSub(`/detalhe/${t.id}`);
      } catch (t) {
        this.formErro = t?.message || "Erro ao criar estudo";
      } finally {
        this.salvando = false;
      }
    };
  }
  connectedCallback() {
    super.connectedCallback(), this._carregar();
  }
  updated(t) {
    t.has("aba") && this.aba === "estudos" && this._carregar();
  }
  async _carregar() {
    this.carregando = true;
    try {
      let t = await $e({ tipo_empreendimento: this.filtroTipo || void 0, status: this.filtroStatus || void 0 });
      this.estudos = t?.dados || [];
    } catch (t) {
      console.error("Erro ao listar estudos:", t);
    }
    this.carregando = false;
  }
  render() {
    return c`
      <div class="topo">
        <h1>Estudos de Viabilidade</h1>
        ${this.aba === "estudos" ? c`<button class="btn-cta" @click=${this._abrirForm}>+ Criar estudo</button>` : h}
      </div>

      <div class="abas">
        <button class="aba ${this.aba === "estudos" ? "ativa" : ""}" @click=${() => l.navegarSub("/")}>Estudos</button>
        <button class="aba ${this.aba === "terrenos" ? "ativa" : ""}" @click=${() => l.navegarSub("/terrenos")}>Terrenos</button>
      </div>

      ${this.aba === "estudos" ? this._renderEstudos() : this._renderTerrenos()}
      ${this.mostrarForm ? this._renderForm() : h}
    `;
  }
  _renderEstudos() {
    return c`
      <div class="filtros">
        <select .value=${this.filtroTipo} @change=${(t) => {
      this.filtroTipo = t.target.value, this._carregar();
    }}>
          <option value="">Todos os tipos</option>
          <option value="loteamento">Loteamento</option>
          <option value="incorporacao">Incorporação</option>
        </select>
        <select .value=${this.filtroStatus} @change=${(t) => {
      this.filtroStatus = t.target.value, this._carregar();
    }}>
          <option value="">Todos os status</option>
          ${Object.entries(J).map(([t, r]) => c`<option value=${t}>${r}</option>`)}
        </select>
      </div>

      ${this.carregando ? c`<div class="vazio">Carregando…</div>` : this.estudos.length === 0 ? c`<div class="vazio">Nenhum estudo ainda. Clique em “Criar estudo”.</div>` : c`
            <div class="card" style="padding:0; overflow-x:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Estudo</th><th>Tipo</th><th class="num">VGV</th><th class="num">Resultado</th><th class="num">Margem</th><th>Status</th><th>Criado em</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  ${this.estudos.map((t) => {
      let r = w(t);
      return c`
                    <tr @click=${() => l.navegarSub(`/detalhe/${t.id}`)}>
                      <td>${t.nome_exibicao || t.nome}</td>
                      <td>${W[t.tipo_empreendimento] || t.tipo_empreendimento}</td>
                      <td class="num">${r.vgv > 0 ? x(r.vgv) : "\u2014"}</td>
                      <td class="num">${r.vgv > 0 ? x(r.resultado) : "\u2014"}</td>
                      <td class="num">${r.vgv > 0 ? _(r.margemLiquidaPct) : "\u2014"}</td>
                      <td><span class="badge ${t.status}">${J[t.status] || t.status}</span></td>
                      <td class="sec">${fe(t.criado_em)}</td>
                      <td>
                        <div class="acoes-linha" @click=${(a) => a.stopPropagation()}>
                          <button class="btn-sec btn-sm" @click=${() => this._duplicar(t.id)}>Duplicar</button>
                          <button class="btn-perigo btn-sm" @click=${() => this._remover(t)}>Remover</button>
                        </div>
                      </td>
                    </tr>
                  `;
    })}
                </tbody>
              </table>
            </div>
          `}
    `;
  }
  _renderTerrenos() {
    return c`
      <div class="card">
        <h3 style="margin-top:0">Terrenos (via Núcleo)</h3>
        <p class="sec">
          A integração com o Núcleo (glebas/lotes) ainda não está disponível nesta instância.
          Enquanto isso, cadastre o terreno diretamente no estudo pelo modo <strong>“Inserir novo”</strong> na criação.
        </p>
      </div>
    `;
  }
  _renderForm() {
    return c`
      <div class="modal-backdrop" @click=${(t) => {
      t.target === t.currentTarget && (this.mostrarForm = false);
    }}>
        <div class="modal">
          <h3>Novo estudo</h3>

          <div class="campo">
            <label>Nome do estudo *</label>
            <input type="text" placeholder="Ex: Pátio Urbitá 1"
              .value=${this.form.nome || ""}
              @input=${(t) => this.form = { ...this.form, nome: t.target.value }} />
          </div>

          <div class="campo">
            <label>Tipo de empreendimento *</label>
            <select .value=${this.form.tipo_empreendimento}
              @change=${(t) => this.form = { ...this.form, tipo_empreendimento: t.target.value }}>
              <option value="loteamento">Loteamento</option>
              <option value="incorporacao">Incorporação</option>
            </select>
          </div>

          <div class="campo">
            <label>Nível de análise</label>
            <select .value=${this.form.nivel_analise}
              @change=${(t) => this.form = { ...this.form, nivel_analise: t.target.value }}>
              <option value="preliminar">Estudo Preliminar</option>
              <option value="avancado" disabled>Projeto Avançado (v2 — indisponível)</option>
            </select>
          </div>

          <div class="campo">
            <label>Origem do terreno</label>
            <select .value=${this.form.origem_terreno}
              @change=${(t) => this.form = { ...this.form, origem_terreno: t.target.value }}>
              <option value="manual">Inserir novo (manual)</option>
              <option value="nucleo">Buscar terreno (Núcleo)</option>
            </select>
          </div>

          <div class="campo">
            <label>UF</label>
            <input type="text" maxlength="2" placeholder="DF" style="max-width:80px; text-transform:uppercase"
              .value=${this.form.uf || ""}
              @input=${(t) => this.form = { ...this.form, uf: t.target.value.toUpperCase() }} />
          </div>

          ${this.formErro ? c`<div class="erro">${this.formErro}</div>` : h}

          <div class="acoes">
            <button class="btn-sec" @click=${() => this.mostrarForm = false}>Cancelar</button>
            <button class="btn-cta" ?disabled=${this.salvando} @click=${this._salvar}>
              ${this.salvando ? "Criando\u2026" : "Criar estudo"}
            </button>
          </div>
        </div>
      </div>
    `;
  }
  async _duplicar(t) {
    try {
      let r = await ke(t);
      if (r?.erro) {
        l.notificar(r.mensagem || "Erro ao duplicar", "erro");
        return;
      }
      l.notificar("Estudo duplicado.", "sucesso"), r?.id && l.navegarSub(`/detalhe/${r.id}`);
    } catch (r) {
      l.notificar(r?.message || "Erro ao duplicar", "erro");
    }
  }
  async _remover(t) {
    if (confirm(`Remover o estudo "${t.nome_exibicao || t.nome}"?`)) try {
      let r = await Ae(t.id);
      if (r?.erro) {
        l.notificar(r.mensagem || "Erro ao remover", "erro");
        return;
      }
      l.notificar("Estudo removido.", "sucesso"), this._carregar();
    } catch (r) {
      l.notificar(r?.message || "Erro ao remover", "erro");
    }
  }
};
S.styles = [P, y`
    .topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .abas { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.08)); }
    .aba {
      padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; font-size: 0.9rem; cursor: pointer;
    }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-bottom-color: var(--cor-primaria-solida, #2AA9E0); }
    .filtros { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .acoes-linha { display: flex; gap: 6px; }
    th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
    :host { padding: 24px; }
  `], m([A({ type: String })], S.prototype, "aba", 2), m([g()], S.prototype, "estudos", 2), m([g()], S.prototype, "carregando", 2), m([g()], S.prototype, "filtroTipo", 2), m([g()], S.prototype, "filtroStatus", 2), m([g()], S.prototype, "mostrarForm", 2), m([g()], S.prototype, "form", 2), m([g()], S.prototype, "salvando", 2), m([g()], S.prototype, "formErro", 2), S = m([E("viab-tela-dashboard")], S);
var Ue = [{ k: "custo_terreno_m2", label: "Custo do terreno", t: "num", sufixo: "R$/m\xB2" }, { k: "custo_infra_m2", label: "Infraestrutura (R$/m\xB2)", t: "num", sufixo: "R$/m\xB2", so: "loteamento" }, { k: "infra_pct", label: "Infraestrutura (% VGV)", t: "num", sufixo: "%", so: "loteamento" }, { k: "custo_construcao_m2", label: "Constru\xE7\xE3o", t: "num", sufixo: "R$/m\xB2", so: "incorporacao" }, { k: "custo_decoracao_m2", label: "Decora\xE7\xE3o", t: "num", sufixo: "R$/m\xB2", so: "incorporacao" }, { k: "taxa_gestao_pct", label: "Gest\xE3o da constru\xE7\xE3o", t: "num", sufixo: "%", so: "incorporacao" }, { k: "incorporacao_registro_pct", label: "Incorpora\xE7\xE3o e registro", t: "num", sufixo: "% VGV", so: "incorporacao" }, { k: "valor_venal_terreno_m2", label: "Valor venal do terreno (outorga)", t: "num", sufixo: "R$/m\xB2", so: "incorporacao" }, { k: "projetos_pct", label: "Projetos", t: "num", sufixo: "% VGV" }, { k: "manutencao_pct", label: "Manuten\xE7\xE3o p\xF3s-obra", t: "num", sufixo: "% VGV" }, { k: "contingencias_pct", label: "Conting\xEAncias", t: "num", sufixo: "% VGV" }, { k: "stand_vendas_valor", label: "Stand de vendas", t: "num", sufixo: "R$", so: "loteamento" }, { k: "marketing_global_pct", label: "Marketing global / estrutura", t: "num", sufixo: "% VGV" }, { k: "gestao_indiretos_pct", label: "Gest\xE3o e indiretos", t: "num", sufixo: "% VGV" }];
var De = [{ k: "imposto_percentual", label: "Imposto (se n\xE3o RET)", t: "num", sufixo: "%" }, { k: "corretagem_percentual", label: "Corretagem", t: "num", sufixo: "%" }, { k: "marketing_percentual", label: "Marketing", t: "num", sufixo: "%" }, { k: "permuta_financeira_residencial_pct", label: "Permuta financeira residencial", t: "num", sufixo: "%" }, { k: "permuta_financeira_nao_residencial_pct", label: "Permuta financeira n\xE3o residencial", t: "num", sufixo: "%" }];
var je = [{ k: "app_pct", label: "APP", t: "num", sufixo: "% gleba" }, { k: "faixas_nao_edificaveis_pct", label: "Faixas n\xE3o edific\xE1veis", t: "num", sufixo: "% gleba" }, { k: "sistema_viario_pct", label: "Sistema vi\xE1rio", t: "num", sufixo: "% gleba" }, { k: "elup_pct", label: "ELUP", t: "num", sufixo: "% gleba" }, { k: "epc_pct", label: "EPC", t: "num", sufixo: "% gleba" }, { k: "epu_pct", label: "EPU", t: "num", sufixo: "% gleba" }, { k: "areas_privativas_nao_vendaveis_pct", label: "Priv. n\xE3o vend\xE1veis", t: "num", sufixo: "% gleba" }, { k: "area_media_lote_m2", label: "\xC1rea m\xE9dia do lote", t: "num", sufixo: "m\xB2" }, { k: "preco_venda_m2", label: "Pre\xE7o de venda", t: "num", sufixo: "R$/m\xB2" }];
var Be = [{ k: "coef_aproveitamento_basico", label: "Coef. aproveitamento b\xE1sico", t: "num" }, { k: "coef_aproveitamento_maximo", label: "Coef. aproveitamento m\xE1ximo", t: "num" }, { k: "area_pvt_r_fechada", label: "\xC1rea PVT R Fechada", t: "num", sufixo: "m\xB2" }, { k: "area_pvt_nr_fechada", label: "\xC1rea PVT NR Fechada", t: "num", sufixo: "m\xB2" }, { k: "area_pvt_r_aberta", label: "\xC1rea PVT R Aberta", t: "num", sufixo: "m\xB2" }, { k: "area_pvt_nr_aberta", label: "\xC1rea PVT NR Aberta", t: "num", sufixo: "m\xB2" }, { k: "area_comum_total", label: "\xC1rea comum total", t: "num", sufixo: "m\xB2" }, { k: "num_unidades", label: "N\xBA de unidades", t: "num" }, { k: "preco_venda_m2_residencial", label: "Pre\xE7o venda residencial", t: "num", sufixo: "R$/m\xB2" }, { k: "preco_venda_m2_nao_residencial", label: "Pre\xE7o venda n\xE3o residencial", t: "num", sufixo: "R$/m\xB2" }];
var Ar = new Set([...Ue, ...De, ...je, ...Be, { k: "permuta_fisica_area_m2" }, { k: "permuta_fisica_pct" }, { k: "terreno_manual_area" }].filter((o3) => o3.t === "num" || ["permuta_fisica_area_m2", "permuta_fisica_pct", "terreno_manual_area"].includes(o3.k)).map((o3) => o3.k));
var Bt = (o3) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(o3 || 0);
var z = (o3, e = 0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: e }).format(o3 || 0);
var ft = (o3) => `${(o3 || 0).toFixed(1)}%`;
var L = class extends f {
  constructor() {
    super(...arguments);
    this.estudo = null;
    this.editavel = false;
    this.form = {};
    this.salvando = false;
    this.benchmarks = [];
    this.aliquotaRet = 4;
    this._salvar = async () => {
      this.salvando = true;
      try {
        let t = {};
        for (let [a, s] of Object.entries(this.form)) ["id", "id_legivel", "nome_exibicao", "sequencia", "status", "autor_id", "criado_em", "atualizado_em", "membros", "imoveis", "_permissao", "_funcao", "autor_nome", "autor_avatar_url"].includes(a) || (Ar.has(a) ? t[a] = s === "" || s == null ? null : Number(s) : t[a] = s);
        let r = await Ee(this.estudo.id, t);
        if (r?.erro) {
          l.notificar(r.mensagem || "Erro ao salvar", "erro");
          return;
        }
        l.notificar("Premissas salvas.", "sucesso");
      } catch (t) {
        l.notificar(t?.message || "Erro ao salvar", "erro");
      } finally {
        this.salvando = false;
      }
    };
  }
  connectedCallback() {
    super.connectedCallback(), this._init();
  }
  updated(t) {
    t.has("estudo") && this._init();
  }
  async _init() {
    if (this.estudo) {
      this.form = { ...this.estudo };
      try {
        let [t, r] = await Promise.all([Z(this.estudo.tipo_empreendimento), bt()]);
        this.benchmarks = t?.dados || [], this.aliquotaRet = Number(r?.parametros?.aliquota_ret_pct) || 4;
      } catch (t) {
        console.error(t);
      }
    }
  }
  _entradaProforma() {
    return { ...this.form, aliquota_ret_pct: this.aliquotaRet };
  }
  _set(t, r) {
    this.form = { ...this.form, [t]: r };
  }
  render() {
    if (!this.estudo) return h;
    let t = this.estudo.tipo_empreendimento === "loteamento", r = t ? je : Be, a = Ue.filter((i) => !i.so || i.so === this.estudo.tipo_empreendimento), s = !this.editavel;
    return c`
      <div class="card">
        <h3 style="margin-top:0">Premissas</h3>

        <div class="secao">
          <h4>Terreno</h4>
          ${this.estudo.origem_terreno === "nucleo" ? c`<p class="sec">Origem: Núcleo (área em modo leitura — indisponível nesta instância).</p>` : c`<div class="grid">
                ${this._input({ k: "terreno_manual_nome", label: "Nome do terreno", t: "txt" }, s)}
                ${this._input({ k: "terreno_manual_area", label: "\xC1rea do terreno", t: "num", sufixo: "m\xB2" }, s)}
              </div>`}
        </div>

        <div class="secao">
          <h4>Produto e áreas</h4>
          <div class="grid">${r.map((i) => this._input(i, s))}</div>
        </div>

        <div class="secao">
          <h4>Custos</h4>
          <div class="check">
            <input type="checkbox" ?disabled=${s} .checked=${this.form.considerar_custo_terreno !== false}
              @change=${(i) => this._set("considerar_custo_terreno", i.target.checked)} />
            <label>Considerar custo de aquisição do terreno</label>
          </div>
          ${t ? this._toggle("infra_modo", [{ v: "pct_vgv", l: "% VGV" }, { v: "valor_m2", l: "R$/m\xB2" }], "Infraestrutura", s) : h}
          ${this._toggle("projetos_modo", [{ v: "pct_vgv", l: "% VGV" }, { v: "valor_fixo", l: "R$ fixo" }], "Projetos", s)}
          <div class="grid">${a.map((i) => this._input(i, s))}</div>
        </div>

        <div class="secao">
          <h4>Impostos e deduções</h4>
          <div class="check">
            <input type="checkbox" ?disabled=${s} .checked=${!!this.form.sujeito_ret}
              @change=${(i) => this._set("sujeito_ret", i.target.checked)} />
            <label>Sujeito a RET (alíquota fixa ${this.aliquotaRet}%)</label>
          </div>
          <div class="grid">${De.map((i) => this._input(i, s || i.k === "imposto_percentual" && !!this.form.sujeito_ret))}</div>
        </div>

        <div class="secao">
          <h4>Permuta física</h4>
          ${this._toggle("permuta_fisica_modo", [{ v: "area_m2", l: "m\xB2" }, { v: "pct_area_venda", l: "% \xE1rea venda" }], "Modo", s)}
          <div class="grid">
            ${this._input({ k: "permuta_fisica_area_m2", label: "Permuta f\xEDsica (m\xB2)", t: "num", sufixo: "m\xB2" }, s || this.form.permuta_fisica_modo === "pct_area_venda")}
            ${this._input({ k: "permuta_fisica_pct", label: "Permuta f\xEDsica (% \xE1rea venda)", t: "num", sufixo: "%" }, s || this.form.permuta_fisica_modo !== "pct_area_venda")}
          </div>
        </div>

        ${this.editavel ? c`<div class="acoes">
          <button class="btn-cta" ?disabled=${this.salvando} @click=${this._salvar}>${this.salvando ? "Salvando\u2026" : "Salvar premissas"}</button>
        </div>` : c`<p class="sec">Somente leitura neste status/função.</p>`}
      </div>

      ${this._renderResumo(t)}
    `;
  }
  _input(t, r) {
    return t.t === "txt" ? c`<div class="campo campo-in">
        <label>${t.label}</label>
        <input type="text" ?disabled=${r} .value=${String(this.form[t.k] ?? "")}
          @input=${(a) => this._set(t.k, a.target.value)} />
      </div>` : c`<div class="campo campo-in">
      <label>${t.label}</label>
      <input type="number" ?disabled=${r} .value=${String(this.form[t.k] ?? "")}
        @input=${(a) => this._set(t.k, a.target.value)} />
      ${t.sufixo ? c`<span class="suf">${t.sufixo}</span>` : h}
    </div>`;
  }
  _toggle(t, r, a, s) {
    let i = this.form[t] ?? r[0].v;
    return c`<div class="campo">
      <label>${a}</label>
      <div class="toggle">
        ${r.map((n) => c`<button class=${i === n.v ? "on" : ""} ?disabled=${s} @click=${() => this._set(t, n.v)}>${n.l}</button>`)}
      </div>
    </div>`;
  }
  _benchmark(t) {
    return this.benchmarks.find((r) => r.campo === t);
  }
  _renderResumo(t) {
    let r = w(this._entradaProforma()), a = [];
    if (t) {
      let n = this._benchmark("eficiencia_aproveitamento");
      a.push({ rot: "\xC1rea da gleba", val: `${z(r.areaTerreno)} m\xB2` }, { rot: "\xC1rea vend\xE1vel", val: `${z(r.areaVendavel)} m\xB2` }, { rot: "Vend\xE1vel / gleba", val: ft(r.eficienciaPct), bm: n ? { ok: r.eficienciaPct >= Number(n.valor) } : void 0 }, { rot: "VGV", val: Bt(r.vgv) }, { rot: "N\xBA de lotes", val: z(r.numUnidades) }, { rot: "Margem l\xEDquida", val: ft(r.margemLiquidaPct) });
    } else {
      let n = this._benchmark("custo_obras_vgv"), d = this._benchmark("margem_liquida");
      a.push({ rot: "\xC1rea privativa total", val: `${z(r.areaPrivativa)} m\xB2` }, { rot: "\xC1rea constru\xEDda", val: `${z(r.areaConstruida)} m\xB2` }, { rot: "N\xBA de unidades", val: z(r.numUnidades) }, { rot: "Pre\xE7o m\xE9dio/unid.", val: Bt(r.precoMedioUnidade) }, { rot: "Custo obras / VGV", val: ft(r.custoObrasVgvPct), bm: n ? { ok: r.custoObrasVgvPct <= Number(n.valor) } : void 0 }, { rot: "Margem l\xEDquida", val: ft(r.margemLiquidaPct), bm: d ? { ok: r.margemLiquidaPct >= Number(d.valor) } : void 0 });
    }
    let s = this._benchmark("resultado_final"), i = null;
    return s && Number(s.valor) > 0 && (i = _e(this._entradaProforma(), Number(s.valor))), c`
      <div class="card" style="margin-top:16px">
        <h3 style="margin-top:0">Resumo</h3>
        <div class="kpis">
          ${a.map((n) => c`
            <div class="kpi ${n.bm ? n.bm.ok ? "ok" : "ruim" : ""}">
              <div class="rot">${n.rot}</div>
              <div class="val">${n.val}</div>
            </div>
          `)}
        </div>
        ${s ? c`
          <div class="preco-sugerido">
            Preço sugerido/m² para atingir o piso de resultado final (${z(Number(s.valor))}%):
            <strong>${i !== null ? Bt(i) + "/m\xB2" : "inating\xEDvel com as premissas atuais"}</strong>
          </div>
        ` : c`<p class="sec" style="margin-top:12px">Defina o benchmark “resultado_final” para calcular o preço sugerido/m².</p>`}
      </div>
    `;
  }
};
L.styles = [P, y`
    :host { display: block; }
    .secao { margin-bottom: 18px; }
    .secao h4 { margin: 0 0 10px; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .campo-in { position: relative; }
    .campo-in .suf { position: absolute; right: 10px; top: 30px; font-size: 0.7rem; color: var(--cor-texto-sec, rgba(255,255,255,0.4)); pointer-events: none; }
    .toggle { display: inline-flex; border: 1px solid var(--cor-borda, rgba(255,255,255,0.14)); border-radius: 6px; overflow: hidden; }
    .toggle button { border: none; border-radius: 0; background: none; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); padding: 5px 10px; }
    .toggle button.on { background: var(--cor-primaria-solida, #2AA9E0); color: #06121c; font-weight: 600; }
    .check { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 6px; }
    .kpi { background: var(--cor-fundo, #0D1B2A); border: 1px solid var(--cor-borda, rgba(255,255,255,0.1)); border-radius: 8px; padding: 12px; }
    .kpi .rot { font-size: 0.7rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase; letter-spacing: 0.03em; }
    .kpi .val { font-size: 1.15rem; font-weight: 700; margin-top: 4px; }
    .kpi.ok .val { color: var(--cor-sucesso, #13A98D); }
    .kpi.ruim .val { color: var(--cor-erro, #D45A3A); }
    .preco-sugerido { margin-top: 12px; padding: 12px 14px; border-radius: 8px; background: rgba(247,161,17,0.10); border: 1px solid rgba(247,161,17,0.3); font-size: 0.9rem; }
    .preco-sugerido strong { color: var(--cor-cta, #F7A111); }
  `], m([A({ attribute: false })], L.prototype, "estudo", 2), m([A({ type: Boolean })], L.prototype, "editavel", 2), m([g()], L.prototype, "form", 2), m([g()], L.prototype, "salvando", 2), m([g()], L.prototype, "benchmarks", 2), m([g()], L.prototype, "aliquotaRet", 2), L = m([E("viab-tela-premissas")], L);
var kr = (o3) => o3.toFixed(2).replace(".", ",");
function Pr(o3, e, t) {
  let r = new Blob(["\uFEFF" + e], { type: t }), a = URL.createObjectURL(r), s = document.createElement("a");
  s.href = a, s.download = o3, document.body.appendChild(s), s.click(), s.remove(), setTimeout(() => URL.revokeObjectURL(a), 1e3);
}
function ze(o3, e) {
  return [{ l: "Receita bruta (VGV)", v: o3.vgv }, { l: "(-) Imposto", v: o3.imposto }, { l: "(-) Corretagem", v: o3.corretagem }, { l: "(-) Marketing", v: o3.marketing }, { l: "(-) Permuta financeira residencial", v: o3.permutaFinResidencial }, { l: "(-) Permuta financeira n\xE3o residencial", v: o3.permutaFinNaoResidencial }, { l: "= Receita l\xEDquida", v: o3.receitaLiquida }, { l: "(-) Terreno", v: o3.custoTerreno }, { l: "(-) Projetos e aprova\xE7\xE3o", v: o3.projetos }, { l: "(-) Infraestrutura", v: o3.infraestrutura, soLot: true }, { l: "(-) Outorga", v: o3.outorga, soInc: true }, { l: "(-) Incorpora\xE7\xE3o e registro", v: o3.incorporacaoRegistro, soInc: true }, { l: "(-) Constru\xE7\xE3o", v: o3.construcao, soInc: true }, { l: "(-) Gest\xE3o da constru\xE7\xE3o", v: o3.gestaoConstrucao, soInc: true }, { l: "(-) Decora\xE7\xE3o", v: o3.decoracao, soInc: true }, { l: "(-) Manuten\xE7\xE3o p\xF3s-obra", v: o3.manutencao }, { l: "(-) Conting\xEAncias", v: o3.contingencias }, { l: "= Custo direto total", v: o3.custoDiretoTotal }, { l: "(-) Marketing global e estrutura", v: o3.marketingGlobal }, { l: "(-) Gest\xE3o e outros indiretos", v: o3.gestaoIndiretos }, { l: "= Custo indireto total", v: o3.custoIndiretoTotal }, { l: "= Resultado", v: o3.resultado }, { l: "Resultado + permutas financeiras", v: o3.resultadoComPermutasFin }, { l: "Resultado + permutas (com f\xEDsicas)", v: o3.resultadoComPermutasFisicas }].filter((r) => !(r.soLot && !e) && !(r.soInc && e));
}
function He(o3, e, t) {
  let r = ze(e, t), a = [];
  a.push("Estudo;" + (o3.nome_exibicao || o3.nome)), a.push("Tipo;" + o3.tipo_empreendimento), a.push(""), a.push("Linha;R$;% VGV");
  for (let i of r) {
    let n = e.vgv > 0 ? (Math.abs(i.v) / e.vgv * 100).toFixed(1) : "";
    a.push(`${i.l};${kr(i.v)};${n}`);
  }
  a.push(""), a.push(`Margem l\xEDquida (%);${e.margemLiquidaPct.toFixed(1)}`);
  let s = (o3.id_legivel || "estudo") + "_proforma.csv";
  Pr(s, a.join(`
`), "text/csv;charset=utf-8");
}
function Ge(o3, e, t) {
  let a = ze(e, t).map((d) => {
    let u = d.l.startsWith("="), b = e.vgv > 0 ? _(Math.abs(d.v) / e.vgv * 100) : "\u2014";
    return `<tr class="${u ? "sub" : ""}"><td>${d.l}</td><td class="v">${x(d.v)}</td><td class="v">${b}</td></tr>`;
  }).join(""), s = t ? [["\xC1rea vend\xE1vel", `${B(e.areaVendavel)} m\xB2`], ["VGV", x(e.vgv)], ["Efici\xEAncia", _(e.eficienciaPct)], ["Margem l\xEDquida", _(e.margemLiquidaPct)]] : [["\xC1rea privativa", `${B(e.areaPrivativa)} m\xB2`], ["VGV", x(e.vgv)], ["Custo obras/VGV", _(e.custoObrasVgvPct)], ["Margem l\xEDquida", _(e.margemLiquidaPct)]], i = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${o3.nome_exibicao || o3.nome}</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; color: #111; margin: 32px; }
    h1 { font-size: 18px; margin: 0 0 2px; } .sub-h { color: #666; font-size: 12px; margin-bottom: 18px; }
    .kpis { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 8px 12px; }
    .kpi .r { font-size: 10px; color: #666; text-transform: uppercase; } .kpi .v { font-size: 15px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; } td.v { text-align: right; font-variant-numeric: tabular-nums; }
    tr.sub td { font-weight: 700; border-top: 1px solid #bbb; }
    @media print { button { display: none; } }
  </style></head><body>
    <h1>${o3.nome_exibicao || o3.nome}</h1>
    <div class="sub-h">${o3.tipo_empreendimento} \xB7 ${o3.status} \xB7 Estudo de Viabilidade \u2014 UrbiVerso</div>
    <div class="kpis">${s.map(([d, u]) => `<div class="kpi"><div class="r">${d}</div><div class="v">${u}</div></div>`).join("")}</div>
    <table><thead><tr><td>Linha</td><td class="v">R$</td><td class="v">% VGV</td></tr></thead>
    <tbody>${a}<tr class="sub"><td>Margem l\xEDquida</td><td class="v">${_(e.margemLiquidaPct)}</td><td class="v"></td></tr></tbody></table>
    <button onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir / Salvar PDF</button>
  </body></html>`, n = window.open("", "_blank");
  return n ? (n.document.write(i), n.document.close(), setTimeout(() => n.print(), 400), true) : false;
}
var I = class extends f {
  constructor() {
    super(...arguments);
    this.estudo = null;
    this.benchmarks = [];
    this.aliquotaRet = 4;
    this.cenarios = [];
    this.mostrarSens = false;
    this.varSens = "preco";
  }
  connectedCallback() {
    super.connectedCallback(), this._init();
  }
  updated(t) {
    t.has("estudo") && this._init();
  }
  async _init() {
    if (this.estudo) try {
      let [t, r] = await Promise.all([Z(this.estudo.tipo_empreendimento), bt()]);
      this.benchmarks = t?.dados || [], this.aliquotaRet = Number(r?.parametros?.aliquota_ret_pct) || 4;
    } catch (t) {
      console.error(t);
    }
  }
  _entrada(t = {}) {
    return { ...this.estudo, aliquota_ret_pct: this.aliquotaRet, ...t };
  }
  _bm(t) {
    return this.benchmarks.find((r) => r.campo === t);
  }
  render() {
    if (!this.estudo) return h;
    let t = this.estudo.tipo_empreendimento === "loteamento", r = w(this._entrada());
    return c`
      ${this._renderKpis(r, t)}
      <div class="card">
        <h3 style="margin-top:0">Proforma</h3>
        ${this._renderTabela(r, t)}
        <div class="barra-acoes">
          <button class="btn-sec btn-sm" @click=${() => this._salvarCenario(r)}>Salvar cenário</button>
          ${this.cenarios.length > 0 ? c`<button class="btn-sec btn-sm" @click=${() => this.cenarios = []}>Limpar cenários</button>` : h}
          <button class="btn-sec btn-sm" @click=${() => this.mostrarSens = !this.mostrarSens}>${this.mostrarSens ? "Ocultar" : "Mostrar"} sensibilidade</button>
          <button class="btn-sec btn-sm" @click=${() => this._exportar("excel")}>Exportar Excel</button>
          <button class="btn-sec btn-sm" @click=${() => this._exportar("pdf")}>Exportar PDF</button>
        </div>
      </div>
      ${this.cenarios.length > 0 ? this._renderComparacao() : h}
      ${this.mostrarSens ? this._renderSensibilidade(t) : h}
    `;
  }
  _renderKpis(t, r) {
    let a = this._bm("custo_obras_vgv"), s = this._bm("margem_liquida"), i = t.areaPermutaFisica > 0 || t.permutaFinResidencial > 0 || t.permutaFinNaoResidencial > 0, n = [{ rot: "\xC1rea vend\xE1vel", val: `${B(t.areaVendavel)} m\xB2` }, { rot: "Pre\xE7o m\xE9dio/unid.", val: x(t.precoMedioUnidade) }, { rot: "N\xBA de unidades", val: B(t.numUnidades) }];
    return i && n.push({ rot: "\xC1rea permutada", val: `${B(t.areaPermutaFisica)} m\xB2` }), n.push({ rot: "Custo obras / VGV", val: _(t.custoObrasVgvPct), ok: a ? t.custoObrasVgvPct <= Number(a.valor) : void 0 }), n.push({ rot: "Margem l\xEDquida", val: _(t.margemLiquidaPct), ok: s ? t.margemLiquidaPct >= Number(s.valor) : void 0 }), c`<div class="kpis">
      ${n.map((d) => c`<div class="kpi ${d.ok === void 0 ? "" : d.ok ? "ok" : "ruim"}">
        <div class="rot">${d.rot}</div><div class="val">${d.val}</div></div>`)}
    </div>`;
  }
  _linhas(t) {
    return [{ l: "Receita bruta (VGV)", v: t.vgv, cls: "sub" }, { l: "(-) Imposto", v: t.imposto }, { l: "(-) Corretagem", v: t.corretagem }, { l: "(-) Marketing", v: t.marketing }, { l: "(-) Permuta financeira residencial", v: t.permutaFinResidencial, ocultarSeZero: true }, { l: "(-) Permuta financeira n\xE3o residencial", v: t.permutaFinNaoResidencial, ocultarSeZero: true }, { l: "= Receita l\xEDquida", v: t.receitaLiquida, cls: "sub" }, { l: "(-) Terreno", v: t.custoTerreno }, { l: "(-) Projetos e aprova\xE7\xE3o", v: t.projetos }, { l: "(-) Infraestrutura", v: t.infraestrutura, soLot: true }, { l: "(-) Outorga", v: t.outorga, soInc: true }, { l: "(-) Incorpora\xE7\xE3o e registro", v: t.incorporacaoRegistro, soInc: true }, { l: "(-) Constru\xE7\xE3o", v: t.construcao, soInc: true }, { l: "(-) Gest\xE3o da constru\xE7\xE3o", v: t.gestaoConstrucao, soInc: true }, { l: "(-) Decora\xE7\xE3o", v: t.decoracao, soInc: true }, { l: "(-) Manuten\xE7\xE3o p\xF3s-obra", v: t.manutencao }, { l: "(-) Conting\xEAncias", v: t.contingencias, ocultarSeZero: true }, { l: "= Custo direto total", v: t.custoDiretoTotal, cls: "sub" }, { l: "(-) Marketing global e estrutura", v: t.marketingGlobal }, { l: "(-) Gest\xE3o e outros indiretos", v: t.gestaoIndiretos }, { l: "= Custo indireto total", v: t.custoIndiretoTotal, cls: "sub" }, { l: "= Resultado", v: t.resultado, cls: "res" }, { l: "Resultado + permutas financeiras", v: t.resultadoComPermutasFin, ocultarSeZero: true }, { l: "Resultado + permutas (com f\xEDsicas)", v: t.resultadoComPermutasFisicas, ocultarSeZero: true }];
  }
  _renderTabela(t, r) {
    let a = this._linhas(t).filter((s) => !(s.soLot && !r) && !(s.soInc && r) && !(s.ocultarSeZero && Math.abs(s.v) < 5e-3));
    return c`
      <div style="overflow-x:auto">
        <table class="pf">
          <thead><tr><td>Linha</td><td class="v">R$</td><td class="v">% VGV</td></tr></thead>
          <tbody>
            ${a.map((s) => {
      let i = s.cls === "res" && s.v < 0;
      return c`<tr class="${s.cls || ""} ${i ? "neg" : ""}">
                <td>${s.l}</td>
                <td class="v">${x(s.v)}</td>
                <td class="v">${t.vgv > 0 ? _(Math.abs(s.v) / t.vgv * 100) : "\u2014"}</td>
              </tr>`;
    })}
            <tr class="res ${t.margemLiquidaPct < 0 ? "neg" : ""}">
              <td>Margem líquida</td><td class="v">${_(t.margemLiquidaPct)}</td><td class="v"></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }
  _salvarCenario(t) {
    let r = `Cen\xE1rio ${this.cenarios.length + 1}`, a = [...this.cenarios, { nome: r, p: t }];
    this.cenarios = a.slice(-2), l.notificar(`${r} salvo (transiente).`, "sucesso");
  }
  _renderComparacao() {
    if (this.cenarios.length < 2) return c`<div class="card" style="margin-top:16px"><p class="sec">1 cenário salvo. Ajuste as premissas e salve um segundo para comparar.</p></div>`;
    let [t, r] = this.cenarios, a = [{ l: "VGV", f: (s) => s.vgv }, { l: "Receita l\xEDquida", f: (s) => s.receitaLiquida }, { l: "Custo total", f: (s) => s.custoDiretoTotal + s.custoIndiretoTotal }, { l: "Resultado", f: (s) => s.resultado }, { l: "Margem l\xEDquida", f: (s) => s.margemLiquidaPct, pct: true }];
    return c`<div class="card comp" style="margin-top:16px">
      <h3 style="margin-top:0">Comparação de cenários</h3>
      <div style="overflow-x:auto"><table class="pf">
        <thead><tr><td>Métrica</td><td class="v">${t.nome}</td><td class="v">${r.nome}</td><td class="v">Δ%</td></tr></thead>
        <tbody>
          ${a.map((s) => {
      let i = s.f(t.p), n = s.f(r.p), d = i !== 0 ? (n - i) / Math.abs(i) * 100 : 0;
      return c`<tr>
              <td>${s.l}</td>
              <td class="v">${s.pct ? _(i) : x(i)}</td>
              <td class="v">${s.pct ? _(n) : x(n)}</td>
              <td class="v delta ${d >= 0 ? "pos" : "neg"}">${d >= 0 ? "+" : ""}${d.toFixed(1)}%</td>
            </tr>`;
    })}
        </tbody>
      </table></div>
    </div>`;
  }
  _variaveis(t) {
    return [{ v: "preco", l: t ? "Pre\xE7o/m\xB2 de venda" : "Pre\xE7o/m\xB2 (res + n\xE3o res)" }, { v: "permuta_fisica", l: "Permuta f\xEDsica" }, { v: "permuta_financeira", l: "Permuta financeira" }, t ? { v: "custo_infra", l: "Custo de infraestrutura" } : { v: "custo_obras", l: "Custo de obras" }];
  }
  _aplicarFator(t) {
    let r = this.estudo, a = (s) => (Number(s) || 0) * t;
    switch (this.varSens) {
      case "preco":
        return this._entrada({ preco_venda_m2: a(r.preco_venda_m2), preco_venda_m2_residencial: a(r.preco_venda_m2_residencial), preco_venda_m2_nao_residencial: a(r.preco_venda_m2_nao_residencial) });
      case "permuta_fisica":
        return this._entrada({ permuta_fisica_area_m2: a(r.permuta_fisica_area_m2), permuta_fisica_pct: a(r.permuta_fisica_pct) });
      case "permuta_financeira":
        return this._entrada({ permuta_financeira_residencial_pct: a(r.permuta_financeira_residencial_pct), permuta_financeira_nao_residencial_pct: a(r.permuta_financeira_nao_residencial_pct) });
      case "custo_infra":
        return this._entrada({ custo_infra_m2: a(r.custo_infra_m2), infra_pct: a(r.infra_pct) });
      case "custo_obras":
        return this._entrada({ custo_construcao_m2: a(r.custo_construcao_m2) });
    }
  }
  _renderSensibilidade(t) {
    let r = Number(this.estudo.sensibilidade_variacao_positiva_pct) || 10, a = Number(this.estudo.sensibilidade_variacao_negativa_pct) || 10, s = w(this._aplicarFator(1 - a / 100)), i = w(this._aplicarFator(1)), n = w(this._aplicarFator(1 + r / 100)), d = [{ l: "VGV", f: (u) => u.vgv }, { l: "Receita l\xEDquida", f: (u) => u.receitaLiquida }, { l: "Custo direto total", f: (u) => u.custoDiretoTotal }, { l: "Resultado", f: (u) => u.resultado }, { l: "Margem l\xEDquida", f: (u) => u.margemLiquidaPct, pct: true }];
    return c`<div class="card" style="margin-top:16px">
      <h3 style="margin-top:0">Análise de sensibilidade</h3>
      <div class="campo" style="max-width:320px">
        <label>Variável estressada (−${a}% / +${r}%)</label>
        <select .value=${this.varSens} @change=${(u) => this.varSens = u.target.value}>
          ${this._variaveis(t).map((u) => c`<option value=${u.v} ?selected=${u.v === this.varSens}>${u.l}</option>`)}
        </select>
      </div>
      <div style="overflow-x:auto"><table class="pf">
        <thead><tr><td>Linha</td><td class="v">Bear</td><td class="v">Base</td><td class="v">Bull</td></tr></thead>
        <tbody>
          ${d.map((u) => c`<tr>
            <td>${u.l}</td>
            <td class="v">${u.pct ? _(u.f(s)) : x(u.f(s))}</td>
            <td class="v">${u.pct ? _(u.f(i)) : x(u.f(i))}</td>
            <td class="v">${u.pct ? _(u.f(n)) : x(u.f(n))}</td>
          </tr>`)}
        </tbody>
      </table></div>
    </div>`;
  }
  _exportar(t) {
    let r = this.estudo.tipo_empreendimento === "loteamento", a = w(this._entrada());
    t === "excel" ? He(this.estudo, a, r) : Ge(this.estudo, a, r) || l.notificar("Permita pop-ups para exportar em PDF.", "alerta");
  }
};
I.styles = [P, y`
    :host { display: block; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpi { background: var(--cor-fundo, #0D1B2A); border: 1px solid var(--cor-borda, rgba(255,255,255,0.1)); border-radius: 8px; padding: 12px; }
    .kpi .rot { font-size: 0.7rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase; }
    .kpi .val { font-size: 1.1rem; font-weight: 700; margin-top: 4px; }
    .kpi.ok .val { color: var(--cor-sucesso, #13A98D); }
    .kpi.ruim .val { color: var(--cor-erro, #D45A3A); }
    table.pf { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
    table.pf td { padding: 6px 10px; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.06)); }
    table.pf td.v { text-align: right; font-variant-numeric: tabular-nums; }
    tr.sub td { font-weight: 700; border-top: 1px solid var(--cor-borda, rgba(255,255,255,0.15)); }
    tr.res td { font-weight: 700; color: var(--cor-primaria-solida, #2AA9E0); border-top: 2px solid var(--cor-primaria-solida, #2AA9E0); }
    tr.res.neg td { color: var(--cor-erro, #D45A3A); border-top-color: var(--cor-erro, #D45A3A); }
    .barra-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0; }
    .comp td.delta.pos { color: var(--cor-sucesso, #13A98D); }
    .comp td.delta.neg { color: var(--cor-erro, #D45A3A); }
    .disabled-note { opacity: 0.6; font-size: 0.8rem; }
  `], m([A({ attribute: false })], I.prototype, "estudo", 2), m([g()], I.prototype, "benchmarks", 2), m([g()], I.prototype, "aliquotaRet", 2), m([g()], I.prototype, "cenarios", 2), m([g()], I.prototype, "mostrarSens", 2), m([g()], I.prototype, "varSens", 2), I = m([E("viab-tela-proforma")], I);
var Ve = ["#2AA9E0", "#F7A111", "#13A98D", "#D45A3A", "#8E7CC3", "#5AA469", "#E0679B", "#C9A227", "#4A90D9", "#6FB3A0"];
function Je(o3, e, t, r) {
  return { x: o3 + t * Math.cos(r), y: e + t * Math.sin(r) };
}
function Sr(o3, e, t, r, a) {
  let s = Je(o3, e, t, r), i = Je(o3, e, t, a), n = a - r > Math.PI ? 1 : 0;
  return `M${o3},${e} L${s.x.toFixed(2)},${s.y.toFixed(2)} A${t},${t} 0 ${n} 1 ${i.x.toFixed(2)},${i.y.toFixed(2)} Z`;
}
var H = class extends f {
  constructor() {
    super(...arguments);
    this.estudo = null;
    this.excluirTerreno = false;
  }
  render() {
    if (!this.estudo) return h;
    let t = w({ ...this.estudo });
    return c`
      <div class="graficos">
        <div class="card">
          <h3 style="margin-top:0">Composição dos custos</h3>
          <div class="check">
            <input type="checkbox" .checked=${this.excluirTerreno} @change=${(r) => this.excluirTerreno = r.target.checked} />
            <label>Excluir custo de aquisição do terreno</label>
          </div>
          ${this._renderPizza(t)}
        </div>
        <div class="card">
          <h3 style="margin-top:0">Receita × Custos</h3>
          ${this._renderBarras(t)}
        </div>
      </div>
    `;
  }
  _custos(t) {
    return [{ l: "Terreno", v: t.custoTerreno, terreno: true }, { l: "Infraestrutura", v: t.infraestrutura }, { l: "Constru\xE7\xE3o", v: t.construcao }, { l: "Decora\xE7\xE3o", v: t.decoracao }, { l: "Gest\xE3o da constru\xE7\xE3o", v: t.gestaoConstrucao }, { l: "Projetos", v: t.projetos }, { l: "Outorga", v: t.outorga }, { l: "Incorpora\xE7\xE3o e registro", v: t.incorporacaoRegistro }, { l: "Manuten\xE7\xE3o", v: t.manutencao }, { l: "Conting\xEAncias", v: t.contingencias }, { l: "Marketing global", v: t.marketingGlobal }, { l: "Gest\xE3o e indiretos", v: t.gestaoIndiretos }].filter((a) => a.v > 5e-3 && !(a.terreno && this.excluirTerreno));
  }
  _renderPizza(t) {
    let r = this._custos(t), a = r.reduce((n, d) => n + d.v, 0);
    if (a <= 0) return c`<p class="sec">Sem custos para exibir.</p>`;
    let s = -Math.PI / 2, i = r.map((n, d) => {
      let u = n.v / a, b = s, p = s + u * 2 * Math.PI;
      return s = p, { path: Sr(100, 100, 90, b, p), cor: Ve[d % Ve.length], ...n, frac: u };
    });
    return c`
      <svg viewBox="0 0 200 200" role="img" aria-label="Composição dos custos">
        ${i.map((n) => Ut`<path d=${n.path} fill=${n.cor}><title>${n.l}: ${x(n.v)}</title></path>`)}
      </svg>
      <div class="legenda">
        ${i.map((n) => c`<div class="item">
          <span class="cor" style="background:${n.cor}"></span>
          <span>${n.l}</span>
          <span class="val">${x(n.v)} · ${_(n.frac * 100)}</span>
        </div>`)}
      </div>`;
  }
  _renderBarras(t) {
    let r = t.vgv, a = t.custoDiretoTotal + t.custoIndiretoTotal, s = Math.max(r, a, 1), i = (d) => Math.round(d / s * 160), n = (d, u, b, p) => {
      let k = i(u);
      return Ut`
        <rect x=${d} y=${180 - k} width="70" height=${k} rx="4" fill=${b}></rect>
        <text x=${d + 35} y=${180 - k - 6} text-anchor="middle" font-size="9" fill="currentColor">${x(u)}</text>
        <text x=${d + 35} y="196" text-anchor="middle" font-size="10" fill="currentColor">${p}</text>`;
    };
    return c`
      <svg viewBox="0 0 240 210" role="img" aria-label="Receita versus Custos">
        <line x1="20" y1="180" x2="230" y2="180" stroke="currentColor" stroke-opacity="0.2"></line>
        ${n(45, r, "#13A98D", "Receita")}
        ${n(140, a, "#D45A3A", "Custos")}
      </svg>
      <div class="barras-legenda">
        <span>Resultado: <strong>${x(r - a)}</strong></span>
      </div>`;
  }
};
H.styles = [P, y`
    :host { display: block; }
    .graficos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .legenda { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; font-size: 0.82rem; }
    .legenda .item { display: flex; align-items: center; gap: 8px; }
    .legenda .cor { width: 12px; height: 12px; border-radius: 3px; flex: none; }
    .legenda .val { margin-left: auto; color: var(--cor-texto-sec, rgba(255,255,255,0.6)); font-variant-numeric: tabular-nums; }
    .check { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 0.85rem; }
    svg { max-width: 100%; height: auto; }
    .barras-legenda { display: flex; gap: 16px; justify-content: center; margin-top: 8px; font-size: 0.82rem; }
  `], m([A({ attribute: false })], H.prototype, "estudo", 2), m([g()], H.prototype, "excluirTerreno", 2), H = m([E("viab-tela-graficos")], H);
var C = class extends f {
  constructor() {
    super(...arguments);
    this.estudo = null;
    this.editavel = false;
    this.apelo = null;
    this.documentos = [];
    this.carregando = true;
    this.analisando = false;
    this.tipoDado = "anuncios";
    this.textoAdicional = "";
  }
  connectedCallback() {
    super.connectedCallback(), this._carregar();
  }
  updated(t) {
    t.has("estudo") && this._carregar();
  }
  async _carregar() {
    if (this.estudo) {
      this.carregando = true;
      try {
        let t = await Ne(this.estudo.id);
        this.apelo = t?.apelo || null, this.documentos = t?.documentos || [];
      } catch (t) {
        console.error(t);
      }
      this.carregando = false;
    }
  }
  render() {
    if (!this.estudo) return h;
    if (this.carregando) return c`<div class="card"><p class="sec">Carregando…</p></div>`;
    let t = this.apelo?.resultado;
    return c`
      <div class="card">
        <h3 style="margin-top:0">Apelo Comercial do Imóvel (IA)</h3>
        <p class="sec">Avaliação qualitativa em 6 fatores a partir de documentos e dados de mercado. Anexe arquivos (PDF/Word/Excel) e/ou texto e dispare a análise.</p>

        <h4>Fontes anexadas</h4>
        ${this.documentos.length === 0 ? c`<p class="sec">Nenhuma fonte anexada.</p>` : h}
        ${this.documentos.map((r) => c`
          <div class="doc">
            <span>${r.tipo_dado || "fonte"} ${r.texto_adicional ? "\xB7 texto" : ""} ${r.documento ? "\xB7 arquivo" : ""}</span>
            ${this.editavel ? c`<button class="btn-perigo btn-sm" @click=${() => this._remover(r.id)}>×</button>` : h}
          </div>`)}

        ${this.editavel ? c`
          <div class="upload-form">
            <select .value=${this.tipoDado} @change=${(r) => this.tipoDado = r.target.value}>
              <option value="anuncios">Anúncios</option>
              <option value="populacao">População</option>
              <option value="mercado">Mercado</option>
              <option value="outro">Outro</option>
            </select>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" @change=${this._arquivo} />
            <textarea rows="3" placeholder="Texto adicional (ex.: população do município/bairro)"
              .value=${this.textoAdicional}
              @input=${(r) => this.textoAdicional = r.target.value}></textarea>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
              <button class="btn-sec btn-sm" @click=${this._anexarTexto} ?disabled=${!this.textoAdicional.trim()}>Anexar texto</button>
              <button class="btn-cta btn-sm" @click=${this._analisar} ?disabled=${this.analisando || this.documentos.length === 0}>
                ${this.analisando ? "Analisando\u2026" : "Analisar com IA"}
              </button>
            </div>
          </div>` : h}
      </div>

      ${t ? this._renderResultado(t) : c`<div class="card" style="margin-top:16px"><p class="sec">Nenhuma análise ainda.</p></div>`}
    `;
  }
  _renderResultado(t) {
    return c`
      <div class="card" style="margin-top:16px">
        <h3 style="margin-top:0">Resultado</h3>
        <div class="scores">
          <div class="score geral"><div class="rot">Score geral</div><div class="val">${this.apelo?.score_geral ?? "\u2014"}</div></div>
          ${(t.fatores || []).map((r) => c`
            <div class="score"><div class="rot">${r.nome}</div><div class="val">${r.nota_consolidada ?? "\u2014"}</div></div>`)}
        </div>

        ${(t.fatores || []).map((r) => c`
          <div class="fator">
            <h4><span>${r.nome}</span><span class="nota">${r.nota_consolidada ?? "\u2014"}/5</span></h4>
            ${(r.perguntas || []).map((a) => c`
              <div class="perg"><span class="nota">${a.nota ?? "\u2014"}</span> — ${a.pergunta}<br /><span class="sec">${a.justificativa}</span></div>`)}
            ${r.justificativa_geral ? c`<p class="sec">${r.justificativa_geral}</p>` : h}
          </div>`)}

        ${t.relatorio ? c`
          <div class="rel">
            ${this._lista("Vantagens", t.relatorio.vantagens)}
            ${this._lista("Desvantagens", t.relatorio.desvantagens)}
            ${this._lista("Ganhos", t.relatorio.ganhos)}
            ${this._lista("Riscos", t.relatorio.riscos)}
          </div>` : h}
      </div>
    `;
  }
  _lista(t, r) {
    return c`<div><strong>${t}</strong><ul>${(r || []).map((a) => c`<li>${a}</li>`)}</ul></div>`;
  }
  async _arquivo(t) {
    let r = t.target.files?.[0];
    if (r) try {
      let a = await qe(r);
      if (!a?.upload_id) {
        l.notificar("Falha no upload", "erro");
        return;
      }
      await jt(this.estudo.id, { upload_id: a.upload_id, tipo_dado: this.tipoDado }), l.notificar("Documento anexado.", "sucesso"), this._carregar();
    } catch (a) {
      l.notificar(a?.message || "Erro no upload", "erro");
    }
  }
  async _anexarTexto() {
    try {
      await jt(this.estudo.id, { tipo_dado: this.tipoDado, texto_adicional: this.textoAdicional.trim() }), this.textoAdicional = "", l.notificar("Texto anexado.", "sucesso"), this._carregar();
    } catch (t) {
      l.notificar(t?.message || "Erro", "erro");
    }
  }
  async _remover(t) {
    try {
      await Oe(this.estudo.id, t), this._carregar();
    } catch (r) {
      l.notificar(r?.message || "Erro", "erro");
    }
  }
  async _analisar() {
    this.analisando = true;
    try {
      let t = await Te(this.estudo.id);
      if (t?.erro) {
        l.notificar(t.mensagem || "Erro na an\xE1lise", "erro");
        return;
      }
      this.apelo = t, l.notificar("An\xE1lise conclu\xEDda.", "sucesso");
    } catch (t) {
      l.notificar(t?.message || "Erro na an\xE1lise", "erro");
    } finally {
      this.analisando = false;
    }
  }
};
C.styles = [P, y`
    :host { display: block; }
    .doc { display: flex; align-items: center; gap: 8px; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.06)); }
    .scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 10px 0; }
    .score { background: var(--cor-fundo, #0D1B2A); border: 1px solid var(--cor-borda, rgba(255,255,255,0.1)); border-radius: 8px; padding: 10px; }
    .score .rot { font-size: 0.68rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase; }
    .score .val { font-size: 1.3rem; font-weight: 700; }
    .score.geral { border-color: var(--cor-cta, #F7A111); }
    .fator { border: 1px solid var(--cor-borda, rgba(255,255,255,0.1)); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .fator h4 { margin: 0 0 8px; display: flex; justify-content: space-between; }
    .perg { font-size: 0.82rem; margin: 6px 0; }
    .perg .nota { font-weight: 700; color: var(--cor-primaria-solida, #2AA9E0); }
    .rel { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .rel ul { margin: 4px 0; padding-left: 18px; font-size: 0.84rem; }
    .upload-form { display: grid; gap: 8px; margin-top: 10px; }
  `], m([A({ attribute: false })], C.prototype, "estudo", 2), m([A({ type: Boolean })], C.prototype, "editavel", 2), m([g()], C.prototype, "apelo", 2), m([g()], C.prototype, "documentos", 2), m([g()], C.prototype, "carregando", 2), m([g()], C.prototype, "analisando", 2), m([g()], C.prototype, "tipoDado", 2), m([g()], C.prototype, "textoAdicional", 2), C = m([E("viab-tela-apelo")], C);
var We = ["leitor", "editor", "aprovador"];
var R = class extends f {
  constructor() {
    super(...arguments);
    this.estudoId = 0;
    this.estudo = null;
    this.carregando = true;
    this.aba = "premissas";
    this.membros = [];
    this.usuarios = [];
    this.mostrarMembros = false;
  }
  connectedCallback() {
    super.connectedCallback(), this._carregar();
  }
  updated(t) {
    t.has("estudoId") && this._carregar();
  }
  async _carregar() {
    if (this.estudoId) {
      this.carregando = true;
      try {
        let t = await ye(this.estudoId);
        t?.erro ? (l.notificar(t.mensagem || "Sem acesso", "erro"), this.estudo = null) : (this.estudo = t, this.membros = t.membros || []);
      } catch (t) {
        console.error("Erro ao carregar estudo:", t);
      }
      this.carregando = false;
    }
  }
  render() {
    if (this.carregando) return c`<div class="placeholder">Carregando…</div>`;
    if (!this.estudo) return c`
      <button class="voltar" @click=${() => l.navegarSub("/")}>← Voltar</button>
      <div class="placeholder">Estudo não encontrado ou sem acesso.</div>`;
    let t = this.estudo._permissao || {}, r = this.estudo.status;
    return c`
      <button class="voltar" @click=${() => l.navegarSub("/")}>← Voltar aos estudos</button>
      <div class="cabecalho">
        <div>
          <h1>${this.estudo.nome_exibicao || this.estudo.nome}</h1>
          <div class="meta">
            <span class="badge ${r}">${J[r] || r}</span>
            <span class="sec">${W[this.estudo.tipo_empreendimento] || this.estudo.tipo_empreendimento}</span>
            ${t.funcao ? c`<span class="sec">· sua função: ${t.funcao}</span>` : h}
          </div>
        </div>
        <div class="acoes-status">${this._renderAcoesStatus(t, r)}</div>
      </div>

      <div class="abas">
        ${["premissas", "proforma", "graficos", "apelo"].map((a) => c`
          <button class="aba ${this.aba === a ? "ativa" : ""}" @click=${() => this.aba = a}>
            ${a === "premissas" ? "Premissas" : a === "proforma" ? "Proforma" : a === "graficos" ? "Gr\xE1ficos" : "Apelo Comercial"}
          </button>
        `)}
      </div>

      <div ?hidden=${this.aba !== "premissas"}>${this._renderPremissas(t)}</div>
      <div ?hidden=${this.aba !== "proforma"}>
        <viab-tela-proforma .estudo=${this.estudo}></viab-tela-proforma>
      </div>
      <div ?hidden=${this.aba !== "graficos"}>
        <viab-tela-graficos .estudo=${this.estudo}></viab-tela-graficos>
      </div>
      <div ?hidden=${this.aba !== "apelo"}>
        <viab-tela-apelo .estudo=${this.estudo} .editavel=${(this.estudo._permissao || {}).podeEditar}></viab-tela-apelo>
      </div>
    `;
  }
  _renderAcoesStatus(t, r) {
    let a = [];
    return t.podeEditar && r === "rascunho" && a.push(c`<button class="btn-primario btn-sm" @click=${() => this._status("em_analise")}>Submeter para análise</button>`), t.podeAprovar && r === "em_analise" && (a.push(c`<button class="btn-primario btn-sm" @click=${() => this._status("aprovado")}>Aprovar</button>`), a.push(c`<button class="btn-perigo btn-sm" @click=${() => this._status("reprovado")}>Reprovar</button>`), a.push(c`<button class="btn-sec btn-sm" @click=${() => this._status("rascunho")}>Devolver ao rascunho</button>`)), t.podeAprovar && r === "arquivado" && a.push(c`<button class="btn-sec btn-sm" @click=${() => this._status("rascunho")}>Reabrir</button>`), a.push(c`<button class="btn-sec btn-sm" @click=${() => {
      this.mostrarMembros = !this.mostrarMembros, this.mostrarMembros && this._carregarUsuarios();
    }}>Membros</button>`), a;
  }
  _renderPremissas(t) {
    let r = t.podeEditar && this.estudo.status !== "aprovado" && this.estudo.status !== "reprovado";
    return c`
      ${this.mostrarMembros ? this._renderMembros(t) : h}
      <viab-tela-premissas .estudo=${this.estudo} .editavel=${r}></viab-tela-premissas>
    `;
  }
  _renderMembros(t) {
    let r = t.podeEditar;
    return c`
      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-top:0">Membros do estudo</h3>
        <div class="membros-lista">
          ${this.membros.length === 0 ? c`<span class="sec">Nenhum membro.</span>` : h}
          ${this.membros.map((a) => c`
            <div class="membro">
              <span>${a.usuario_nome || `Usu\xE1rio ${a.usuario_id}`}</span>
              <div style="display:flex; gap:6px; align-items:center">
                ${r ? c`
                  <select .value=${a.funcao} @change=${(s) => this._alterarFuncao(a.usuario_id, s.target.value)}>
                    ${We.map((s) => c`<option value=${s} ?selected=${s === a.funcao}>${s}</option>`)}
                  </select>
                  <button class="btn-perigo btn-sm" @click=${() => this._removerMembro(a.usuario_id)}>Remover</button>
                ` : c`<span class="badge rascunho">${a.funcao}</span>`}
              </div>
            </div>
          `)}
        </div>
        ${r ? c`
          <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
            <select id="sel-usuario">
              <option value="">Selecionar usuário…</option>
              ${this.usuarios.map((a) => c`<option value=${a.id}>${a.nome}</option>`)}
            </select>
            <select id="sel-funcao">
              ${We.map((a) => c`<option value=${a}>${a}</option>`)}
            </select>
            <button class="btn-sec btn-sm" @click=${this._adicionarMembro}>Adicionar</button>
          </div>` : h}
      </div>
    `;
  }
  async _carregarUsuarios() {
    if (!(this.usuarios.length > 0)) try {
      this.usuarios = await Fe();
    } catch (t) {
      console.error(t);
    }
  }
  async _status(t) {
    if (!((t === "aprovado" || t === "reprovado") && !confirm(`Confirma ${{ aprovado: "aprovar", reprovado: "reprovar", rascunho: "devolver ao rascunho", em_analise: "submeter" }[t]} este estudo?`))) try {
      let a = await Pe(this.estudoId, t);
      if (a?.erro) {
        l.notificar(a.mensagem || "Transi\xE7\xE3o n\xE3o permitida", "erro");
        return;
      }
      l.notificar(`Status alterado para ${J[t] || t}.`, "sucesso"), this._carregar();
    } catch (a) {
      l.notificar(a?.message || "Erro na transi\xE7\xE3o", "erro");
    }
  }
  async _adicionarMembro() {
    let t = this.renderRoot.querySelector("#sel-usuario"), r = this.renderRoot.querySelector("#sel-funcao"), a = parseInt(t?.value || ""), s = r?.value || "leitor";
    if (!a) {
      l.notificar("Selecione um usu\xE1rio.", "alerta");
      return;
    }
    try {
      let i = await Se(this.estudoId, a, s);
      if (i?.erro) {
        l.notificar(i.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await gt(this.estudoId))?.dados || this.membros, l.notificar("Membro adicionado.", "sucesso");
    } catch (i) {
      l.notificar(i?.message || "Erro", "erro");
    }
  }
  async _alterarFuncao(t, r) {
    try {
      let a = await we(this.estudoId, t, r);
      if (a?.erro) {
        l.notificar(a.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await gt(this.estudoId))?.dados || this.membros;
    } catch (a) {
      l.notificar(a?.message || "Erro", "erro");
    }
  }
  async _removerMembro(t) {
    try {
      let r = await Ce(this.estudoId, t);
      if (r?.erro) {
        l.notificar(r.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await gt(this.estudoId))?.dados || this.membros;
    } catch (r) {
      l.notificar(r?.message || "Erro", "erro");
    }
  }
};
R.styles = [P, y`
    :host { padding: 24px; }
    .voltar { background: none; border: none; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); cursor: pointer; padding: 0; margin-bottom: 12px; }
    .cabecalho { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .cabecalho h1 { margin: 0; font-size: 1.4rem; }
    .meta { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
    .acoes-status { display: flex; gap: 8px; flex-wrap: wrap; }
    .abas { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.08)); }
    .aba { padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent;
           color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; font-size: 0.9rem; cursor: pointer; }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-bottom-color: var(--cor-primaria-solida, #2AA9E0); }
    .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
    .membros-lista { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .membro { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
    .placeholder { padding: 40px; text-align: center; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
  `], m([A({ type: Number })], R.prototype, "estudoId", 2), m([g()], R.prototype, "estudo", 2), m([g()], R.prototype, "carregando", 2), m([g()], R.prototype, "aba", 2), m([g()], R.prototype, "membros", 2), m([g()], R.prototype, "usuarios", 2), m([g()], R.prototype, "mostrarMembros", 2), R = m([E("viab-tela-estudo")], R);
var O = class extends f {
  constructor() {
    super(...arguments);
    this.tipo = "loteamento";
    this.itens = [];
    this.carregando = true;
  }
  connectedCallback() {
    super.connectedCallback(), this._carregar();
  }
  async _carregar() {
    this.carregando = true;
    try {
      let t = await Z(this.tipo);
      this.itens = t?.dados || [];
    } catch (t) {
      console.error(t);
    }
    this.carregando = false;
  }
  render() {
    return c`
      <div class="topo">
        <h2 style="margin:0">Benchmarks</h2>
        <button class="btn-sec btn-sm" @click=${this._semear}>Criar indicadores padrão</button>
      </div>
      <p class="sec">Valores de referência e faixas de sensibilidade por tipo de empreendimento. Edição restrita a administradores.</p>

      <div class="abas">
        ${["loteamento", "incorporacao"].map((t) => c`
          <button class="aba ${this.tipo === t ? "ativa" : ""}" @click=${() => {
      this.tipo = t, this._carregar();
    }}>${W[t]}</button>
        `)}
      </div>

      ${this.carregando ? c`<div class="vazio">Carregando…</div>` : c`
          <div class="card" style="padding:0; overflow-x:auto;">
            <table>
              <thead><tr><th>Indicador</th><th>Valor</th><th>Regra</th><th>Var + (%)</th><th>Var − (%)</th><th></th></tr></thead>
              <tbody>
                ${this.itens.length === 0 ? c`<tr><td colspan="6" class="sec" style="text-align:center; padding:24px">Nenhum benchmark. Clique em “Criar indicadores padrão”.</td></tr>` : h}
                ${this.itens.map((t) => c`
                  <tr>
                    <td>${t.campo}</td>
                    <td class="num"><input type="number" .value=${String(t.valor ?? "")}
                      @change=${(r) => this._patch(t.id, { valor: this._num(r.target.value) })} /></td>
                    <td>
                      <select @change=${(r) => this._patch(t.id, { regra_comparacao: r.target.value })}>
                        <option value="atingir_ou_superar" ?selected=${t.regra_comparacao === "atingir_ou_superar"}>atingir ou superar</option>
                        <option value="nao_exceder" ?selected=${t.regra_comparacao === "nao_exceder"}>não exceder</option>
                      </select>
                    </td>
                    <td class="num"><input type="number" .value=${String(t.variacao_positiva_pct ?? "")}
                      @change=${(r) => this._patch(t.id, { variacao_positiva_pct: this._num(r.target.value) })} /></td>
                    <td class="num"><input type="number" .value=${String(t.variacao_negativa_pct ?? "")}
                      @change=${(r) => this._patch(t.id, { variacao_negativa_pct: this._num(r.target.value) })} /></td>
                    <td><button class="btn-perigo btn-sm" @click=${() => this._remover(t.id)}>×</button></td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px"><button class="btn-sec btn-sm" @click=${this._novo}>+ Novo indicador</button></div>
        `}
    `;
  }
  _num(t) {
    return t === "" ? null : Number(t);
  }
  async _patch(t, r) {
    try {
      let a = await Me(t, r);
      if (a?.erro) {
        l.notificar(a.mensagem || "Erro ao salvar", "erro");
        return;
      }
    } catch (a) {
      l.notificar(a?.message || "Erro", "erro");
    }
  }
  async _remover(t) {
    if (confirm("Remover este benchmark?")) try {
      let r = await Le(t);
      if (r?.erro) {
        l.notificar(r.mensagem || "Erro", "erro");
        return;
      }
      this._carregar();
    } catch (r) {
      l.notificar(r?.message || "Erro", "erro");
    }
  }
  async _novo() {
    let t = prompt("Identificador do indicador (ex: resultado_final):");
    if (t?.trim()) try {
      let r = await Re({ tipo_empreendimento: this.tipo, campo: t.trim(), regra_comparacao: "atingir_ou_superar" });
      if (r?.erro) {
        l.notificar(r.mensagem || "Erro", "erro");
        return;
      }
      this._carregar();
    } catch (r) {
      l.notificar(r?.message || "Erro", "erro");
    }
  }
  async _semear() {
    try {
      let t = await Ie();
      if (t?.erro) {
        l.notificar(t.mensagem || "Erro", "erro");
        return;
      }
      l.notificar(`${t.criados ?? 0} indicador(es) criado(s).`, "sucesso"), this._carregar();
    } catch (t) {
      l.notificar(t?.message || "Erro", "erro");
    }
  }
};
O.styles = [P, y`
    :host { padding: 16px; }
    .abas { display: flex; gap: 4px; margin-bottom: 16px; }
    .aba { padding: 8px 14px; background: none; border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
           border-radius: 6px; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; cursor: pointer; }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-color: var(--cor-primaria-solida, #2AA9E0); }
    .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    td input, td select { width: 100%; box-sizing: border-box; }
    td.num input { max-width: 90px; }
  `], m([g()], O.prototype, "tipo", 2), m([g()], O.prototype, "itens", 2), m([g()], O.prototype, "carregando", 2), O = m([E("viabilidade-config-benchmarks")], O);
function Ze(o3) {
  let e = (o3 || "").replace(/^\//, "").split("/").filter(Boolean);
  if (e[0] === "detalhe" && e[1]) {
    let t = parseInt(e[1]);
    if (!isNaN(t)) return { tela: "estudo", estudoId: t };
  }
  return e[0] === "terrenos" ? { tela: "dashboard", aba: "terrenos" } : { tela: "dashboard", aba: "estudos" };
}
var K = class extends f {
  constructor() {
    super(...arguments);
    this.rota = { tela: "dashboard", aba: "estudos" };
  }
  connectedCallback() {
    super.connectedCallback(), this.rota = Ze(l.subRota()), this._cleanupRota = l.escutarRota((t) => {
      this.rota = Ze(t);
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._cleanupRota?.();
  }
  render() {
    return this.rota.tela === "estudo" ? c`<viab-tela-estudo .estudoId=${this.rota.estudoId || 0}></viab-tela-estudo>` : c`<viab-tela-dashboard .aba=${this.rota.aba || "estudos"}></viab-tela-dashboard>`;
  }
};
K.styles = y`
    :host {
      display: block;
      min-height: 100%;
      background: var(--cor-fundo, #0D1B2A);
      color: var(--cor-texto, rgba(255, 255, 255, 0.85));
    }
  `, m([g()], K.prototype, "rota", 2), K = m([E("app-viabilidade")], K);

// demo/demo.ts
var root = document.getElementById("root");
function mostrar(view) {
  if (!root) return;
  root.innerHTML = "";
  root.appendChild(document.createElement(view === "config" ? "viabilidade-config-benchmarks" : "app-viabilidade"));
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle("ativa", b.dataset.view === view);
  });
}
document.querySelectorAll("[data-view]").forEach((b) => {
  b.addEventListener("click", () => mostrar(b.dataset.view || "app"));
});
mostrar("app");
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/lit-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-element/lit-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/custom-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/property.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/state.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/event-options.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/base.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-all.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-async.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-nodes.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
