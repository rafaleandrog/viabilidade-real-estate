// demo/mock.ts
var SIGLAS = { loteamento: "LOT", incorporacao: "INC" };
function slug(s3) {
  return s3.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
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
    custo_construcao_m2: 4800,
    notas: dados.notas ?? null,
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
    for (const b2 of base) {
      if (benchmarks.some((x) => x.tipo_empreendimento === tipo && x.campo === b2.campo)) continue;
      benchmarks.push({ id: ++seqId, tipo_empreendimento: tipo, ...b2, variacao_positiva_pct: 10, variacao_negativa_pct: 10 });
      criados++;
    }
  }
  return criados;
}
semearBenchmarks();
function permissao(estudo) {
  const m = membros.find((x) => x.estudo_id === estudo.id && x.usuario_id === USUARIO_ATUAL.id);
  return {
    funcao: m?.funcao || "aprovador",
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
    membros: membros.filter((m) => m.estudo_id === estudo.id),
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
  if (r[0] === "nucleo") {
    return { dados: [], total: 0, disponivel: false, motivo: "Integra\xE7\xE3o com o N\xFAcleo indispon\xEDvel no demo. Use o modo manual." };
  }
  if (r[0] === "benchmarks") {
    if (r[1] === "semear" && metodo === "POST") return { ok: true, criados: semearBenchmarks() };
    if (!r[1] && metodo === "GET") {
      const tipo = q2.get("tipo_empreendimento");
      return { dados: benchmarks.filter((b2) => !tipo || b2.tipo_empreendimento === tipo), total: benchmarks.length };
    }
    if (!r[1] && metodo === "POST") {
      const b2 = { id: ++seqId, tipo_empreendimento: body.tipo_empreendimento, campo: body.campo, valor: body.valor ?? null, regra_comparacao: body.regra_comparacao || "atingir_ou_superar", variacao_positiva_pct: null, variacao_negativa_pct: null };
      benchmarks.push(b2);
      return b2;
    }
    if (r[1] && metodo === "PATCH") {
      const b2 = benchmarks.find((x) => x.id === Number(r[1]));
      if (b2) Object.assign(b2, body);
      return b2 || { erro: true };
    }
    if (r[1] && metodo === "DELETE") {
      const i = benchmarks.findIndex((x) => x.id === Number(r[1]));
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
        const lista = estudos.filter((e) => (!tipo || e.tipo_empreendimento === tipo) && (!status || e.status === status)).map((e) => ({ ...e, _funcao: permissao(e).funcao })).sort((a, b2) => b2.criado_em.localeCompare(a.criado_em));
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
      if (!r[3] && metodo === "GET") return { dados: membros.filter((m) => m.estudo_id === id) };
      if (!r[3] && metodo === "POST") {
        const u = usuarios.find((x) => x.id === Number(body.usuario_id));
        if (!membros.some((m) => m.estudo_id === id && m.usuario_id === Number(body.usuario_id))) {
          membros.push({ id: ++seqId, estudo_id: id, usuario_id: Number(body.usuario_id), usuario_nome: u?.nome || "", funcao: body.funcao || "leitor" });
        }
        return { ok: true };
      }
      const uid = Number(r[3]);
      if (r[4] === "remover" && metodo === "PATCH") {
        const i = membros.findIndex((m) => m.estudo_id === id && m.usuario_id === uid);
        if (i >= 0) membros.splice(i, 1);
        return { ok: true };
      }
      if (metodo === "PATCH") {
        const m = membros.find((x) => x.estudo_id === id && x.usuario_id === uid);
        if (m) m.funcao = body.funcao;
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
        const i = imoveis.findIndex((x) => x.id === Number(r[3]));
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
var Qt = Object.defineProperty;
var Xt = Object.getOwnPropertyDescriptor;
var p = (s3, e, t, r) => {
  for (var o = r > 1 ? void 0 : r ? Xt(e, t) : e, a = s3.length - 1, i; a >= 0; a--) (i = s3[a]) && (o = (r ? i(e, t, o) : i(o)) || o);
  return r && o && Qt(e, t, o), o;
};
var K = globalThis;
var Z = K.ShadowRoot && (K.ShadyCSS === void 0 || K.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var et = Symbol();
var ht = /* @__PURE__ */ new WeakMap();
var z = class {
  constructor(e, t, r) {
    if (this._$cssResult$ = true, r !== et) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o, t = this.t;
    if (Z && e === void 0) {
      let r = t !== void 0 && t.length === 1;
      r && (e = ht.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), r && ht.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
var ft = (s3) => new z(typeof s3 == "string" ? s3 : s3 + "", void 0, et);
var y = (s3, ...e) => {
  let t = s3.length === 1 ? s3[0] : e.reduce((r, o, a) => r + ((i) => {
    if (i._$cssResult$ === true) return i.cssText;
    if (typeof i == "number") return i;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + i + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(o) + s3[a + 1], s3[0]);
  return new z(t, s3, et);
};
var vt = (s3, e) => {
  if (Z) s3.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (let t of e) {
    let r = document.createElement("style"), o = K.litNonce;
    o !== void 0 && r.setAttribute("nonce", o), r.textContent = t.cssText, s3.appendChild(r);
  }
};
var rt = Z ? (s3) => s3 : (s3) => s3 instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (let r of e.cssRules) t += r.cssText;
  return ft(t);
})(s3) : s3;
var { is: Yt, defineProperty: Vt, getOwnPropertyDescriptor: te, getOwnPropertyNames: ee, getOwnPropertySymbols: re, getPrototypeOf: oe } = Object;
var Q = globalThis;
var gt = Q.trustedTypes;
var se = gt ? gt.emptyScript : "";
var ae = Q.reactiveElementPolyfillSupport;
var B = (s3, e) => s3;
var q = { toAttribute(s3, e) {
  switch (e) {
    case Boolean:
      s3 = s3 ? se : null;
      break;
    case Object:
    case Array:
      s3 = s3 == null ? s3 : JSON.stringify(s3);
  }
  return s3;
}, fromAttribute(s3, e) {
  let t = s3;
  switch (e) {
    case Boolean:
      t = s3 !== null;
      break;
    case Number:
      t = s3 === null ? null : Number(s3);
      break;
    case Object:
    case Array:
      try {
        t = JSON.parse(s3);
      } catch {
        t = null;
      }
  }
  return t;
} };
var X = (s3, e) => !Yt(s3, e);
var bt = { attribute: true, type: String, converter: q, reflect: false, useDefault: false, hasChanged: X };
Symbol.metadata ??= Symbol("metadata"), Q.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var E = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = bt) {
    if (t.state && (t.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = true), this.elementProperties.set(e, t), !t.noAccessor) {
      let r = Symbol(), o = this.getPropertyDescriptor(e, r, t);
      o !== void 0 && Vt(this.prototype, e, o);
    }
  }
  static getPropertyDescriptor(e, t, r) {
    let { get: o, set: a } = te(this.prototype, e) ?? { get() {
      return this[t];
    }, set(i) {
      this[t] = i;
    } };
    return { get: o, set(i) {
      let u = o?.call(this);
      a?.call(this, i), this.requestUpdate(e, u, r);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? bt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(B("elementProperties"))) return;
    let e = oe(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(B("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(B("properties"))) {
      let t = this.properties, r = [...ee(t), ...re(t)];
      for (let o of r) this.createProperty(o, t[o]);
    }
    let e = this[Symbol.metadata];
    if (e !== null) {
      let t = litPropertyMetadata.get(e);
      if (t !== void 0) for (let [r, o] of t) this.elementProperties.set(r, o);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (let [t, r] of this.elementProperties) {
      let o = this._$Eu(t, r);
      o !== void 0 && this._$Eh.set(o, t);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    let t = [];
    if (Array.isArray(e)) {
      let r = new Set(e.flat(1 / 0).reverse());
      for (let o of r) t.unshift(rt(o));
    } else e !== void 0 && t.push(rt(e));
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
    return vt(e, this.constructor.elementStyles), e;
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
    let r = this.constructor.elementProperties.get(e), o = this.constructor._$Eu(e, r);
    if (o !== void 0 && r.reflect === true) {
      let a = (r.converter?.toAttribute !== void 0 ? r.converter : q).toAttribute(t, r.type);
      this._$Em = e, a == null ? this.removeAttribute(o) : this.setAttribute(o, a), this._$Em = null;
    }
  }
  _$AK(e, t) {
    let r = this.constructor, o = r._$Eh.get(e);
    if (o !== void 0 && this._$Em !== o) {
      let a = r.getPropertyOptions(o), i = typeof a.converter == "function" ? { fromAttribute: a.converter } : a.converter?.fromAttribute !== void 0 ? a.converter : q;
      this._$Em = o;
      let u = i.fromAttribute(t, a.type);
      this[o] = u ?? this._$Ej?.get(o) ?? u, this._$Em = null;
    }
  }
  requestUpdate(e, t, r, o = false, a) {
    if (e !== void 0) {
      let i = this.constructor;
      if (o === false && (a = this[e]), r ??= i.getPropertyOptions(e), !((r.hasChanged ?? X)(a, t) || r.useDefault && r.reflect && a === this._$Ej?.get(e) && !this.hasAttribute(i._$Eu(e, r)))) return;
      this.C(e, t, r);
    }
    this.isUpdatePending === false && (this._$ES = this._$EP());
  }
  C(e, t, { useDefault: r, reflect: o, wrapped: a }, i) {
    r && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, i ?? t ?? this[e]), a !== true || i !== void 0) || (this._$AL.has(e) || (this.hasUpdated || r || (t = void 0), this._$AL.set(e, t)), o === true && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
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
        for (let [o, a] of this._$Ep) this[o] = a;
        this._$Ep = void 0;
      }
      let r = this.constructor.elementProperties;
      if (r.size > 0) for (let [o, a] of r) {
        let { wrapped: i } = a, u = this[o];
        i !== true || this._$AL.has(o) || u === void 0 || this.C(o, void 0, a, u);
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
E.elementStyles = [], E.shadowRootOptions = { mode: "open" }, E[B("elementProperties")] = /* @__PURE__ */ new Map(), E[B("finalized")] = /* @__PURE__ */ new Map(), ae?.({ ReactiveElement: E }), (Q.reactiveElementVersions ??= []).push("2.1.2");
var lt = globalThis;
var $t = (s3) => s3;
var Y = lt.trustedTypes;
var _t = Y ? Y.createPolicy("lit-html", { createHTML: (s3) => s3 }) : void 0;
var wt = "$lit$";
var S = `lit$${Math.random().toFixed(9).slice(2)}$`;
var Pt = "?" + S;
var ie = `<${Pt}>`;
var M = document;
var D = () => M.createComment("");
var F = (s3) => s3 === null || typeof s3 != "object" && typeof s3 != "function";
var dt = Array.isArray;
var ne = (s3) => dt(s3) || typeof s3?.[Symbol.iterator] == "function";
var ot = `[ 	
\f\r]`;
var j = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var yt = /-->/g;
var xt = />/g;
var C = RegExp(`>|${ot}(?:([^\\s"'>=/]+)(${ot}*=${ot}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var Et = /'/g;
var At = /"/g;
var Ct = /^(?:script|style|textarea|title)$/i;
var pt = (s3) => (e, ...t) => ({ _$litType$: s3, strings: e, values: t });
var c = pt(1);
var be = pt(2);
var $e = pt(3);
var R = Symbol.for("lit-noChange");
var d = Symbol.for("lit-nothing");
var St = /* @__PURE__ */ new WeakMap();
var k = M.createTreeWalker(M, 129);
function kt(s3, e) {
  if (!dt(s3) || !s3.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return _t !== void 0 ? _t.createHTML(e) : e;
}
var ce = (s3, e) => {
  let t = s3.length - 1, r = [], o, a = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", i = j;
  for (let u = 0; u < t; u++) {
    let l = s3[u], f, v, m = -1, x = 0;
    for (; x < l.length && (i.lastIndex = x, v = i.exec(l), v !== null); ) x = i.lastIndex, i === j ? v[1] === "!--" ? i = yt : v[1] !== void 0 ? i = xt : v[2] !== void 0 ? (Ct.test(v[2]) && (o = RegExp("</" + v[2], "g")), i = C) : v[3] !== void 0 && (i = C) : i === C ? v[0] === ">" ? (i = o ?? j, m = -1) : v[1] === void 0 ? m = -2 : (m = i.lastIndex - v[2].length, f = v[1], i = v[3] === void 0 ? C : v[3] === '"' ? At : Et) : i === At || i === Et ? i = C : i === yt || i === xt ? i = j : (i = C, o = void 0);
    let A = i === C && s3[u + 1].startsWith("/>") ? " " : "";
    a += i === j ? l + ie : m >= 0 ? (r.push(f), l.slice(0, m) + wt + l.slice(m) + S + A) : l + S + (m === -2 ? u : A);
  }
  return [kt(s3, a + (s3[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), r];
};
var J = class s {
  constructor({ strings: e, _$litType$: t }, r) {
    let o;
    this.parts = [];
    let a = 0, i = 0, u = e.length - 1, l = this.parts, [f, v] = ce(e, t);
    if (this.el = s.createElement(f, r), k.currentNode = this.el.content, t === 2 || t === 3) {
      let m = this.el.content.firstChild;
      m.replaceWith(...m.childNodes);
    }
    for (; (o = k.nextNode()) !== null && l.length < u; ) {
      if (o.nodeType === 1) {
        if (o.hasAttributes()) for (let m of o.getAttributeNames()) if (m.endsWith(wt)) {
          let x = v[i++], A = o.getAttribute(m).split(S), G = /([.?@])?(.*)/.exec(x);
          l.push({ type: 1, index: a, name: G[2], strings: A, ctor: G[1] === "." ? at : G[1] === "?" ? it : G[1] === "@" ? nt : T }), o.removeAttribute(m);
        } else m.startsWith(S) && (l.push({ type: 6, index: a }), o.removeAttribute(m));
        if (Ct.test(o.tagName)) {
          let m = o.textContent.split(S), x = m.length - 1;
          if (x > 0) {
            o.textContent = Y ? Y.emptyScript : "";
            for (let A = 0; A < x; A++) o.append(m[A], D()), k.nextNode(), l.push({ type: 2, index: ++a });
            o.append(m[x], D());
          }
        }
      } else if (o.nodeType === 8) if (o.data === Pt) l.push({ type: 2, index: a });
      else {
        let m = -1;
        for (; (m = o.data.indexOf(S, m + 1)) !== -1; ) l.push({ type: 7, index: a }), m += S.length - 1;
      }
      a++;
    }
  }
  static createElement(e, t) {
    let r = M.createElement("template");
    return r.innerHTML = e, r;
  }
};
function O(s3, e, t = s3, r) {
  if (e === R) return e;
  let o = r !== void 0 ? t._$Co?.[r] : t._$Cl, a = F(e) ? void 0 : e._$litDirective$;
  return o?.constructor !== a && (o?._$AO?.(false), a === void 0 ? o = void 0 : (o = new a(s3), o._$AT(s3, t, r)), r !== void 0 ? (t._$Co ??= [])[r] = o : t._$Cl = o), o !== void 0 && (e = O(s3, o._$AS(s3, e.values), o, r)), e;
}
var st = class {
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
    let { el: { content: t }, parts: r } = this._$AD, o = (e?.creationScope ?? M).importNode(t, true);
    k.currentNode = o;
    let a = k.nextNode(), i = 0, u = 0, l = r[0];
    for (; l !== void 0; ) {
      if (i === l.index) {
        let f;
        l.type === 2 ? f = new W(a, a.nextSibling, this, e) : l.type === 1 ? f = new l.ctor(a, l.name, l.strings, this, e) : l.type === 6 && (f = new ct(a, this, e)), this._$AV.push(f), l = r[++u];
      }
      i !== l?.index && (a = k.nextNode(), i++);
    }
    return k.currentNode = M, o;
  }
  p(e) {
    let t = 0;
    for (let r of this._$AV) r !== void 0 && (r.strings !== void 0 ? (r._$AI(e, r, t), t += r.strings.length - 2) : r._$AI(e[t])), t++;
  }
};
var W = class s2 {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, t, r, o) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = r, this.options = o, this._$Cv = o?.isConnected ?? true;
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
    e = O(this, e, t), F(e) ? e === d || e == null || e === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : e !== this._$AH && e !== R && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : ne(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== d && F(this._$AH) ? this._$AA.nextSibling.data = e : this.T(M.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    let { values: t, _$litType$: r } = e, o = typeof r == "number" ? this._$AC(e) : (r.el === void 0 && (r.el = J.createElement(kt(r.h, r.h[0]), this.options)), r);
    if (this._$AH?._$AD === o) this._$AH.p(t);
    else {
      let a = new st(o, this), i = a.u(this.options);
      a.p(t), this.T(i), this._$AH = a;
    }
  }
  _$AC(e) {
    let t = St.get(e.strings);
    return t === void 0 && St.set(e.strings, t = new J(e)), t;
  }
  k(e) {
    dt(this._$AH) || (this._$AH = [], this._$AR());
    let t = this._$AH, r, o = 0;
    for (let a of e) o === t.length ? t.push(r = new s2(this.O(D()), this.O(D()), this, this.options)) : r = t[o], r._$AI(a), o++;
    o < t.length && (this._$AR(r && r._$AB.nextSibling, o), t.length = o);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    for (this._$AP?.(false, true, t); e !== this._$AB; ) {
      let r = $t(e).nextSibling;
      $t(e).remove(), e = r;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
};
var T = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, t, r, o, a) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = e, this.name = t, this._$AM = o, this.options = a, r.length > 2 || r[0] !== "" || r[1] !== "" ? (this._$AH = Array(r.length - 1).fill(new String()), this.strings = r) : this._$AH = d;
  }
  _$AI(e, t = this, r, o) {
    let a = this.strings, i = false;
    if (a === void 0) e = O(this, e, t, 0), i = !F(e) || e !== this._$AH && e !== R, i && (this._$AH = e);
    else {
      let u = e, l, f;
      for (e = a[0], l = 0; l < a.length - 1; l++) f = O(this, u[r + l], t, l), f === R && (f = this._$AH[l]), i ||= !F(f) || f !== this._$AH[l], f === d ? e = d : e !== d && (e += (f ?? "") + a[l + 1]), this._$AH[l] = f;
    }
    i && !o && this.j(e);
  }
  j(e) {
    e === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
};
var at = class extends T {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === d ? void 0 : e;
  }
};
var it = class extends T {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== d);
  }
};
var nt = class extends T {
  constructor(e, t, r, o, a) {
    super(e, t, r, o, a), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = O(this, e, t, 0) ?? d) === R) return;
    let r = this._$AH, o = e === d && r !== d || e.capture !== r.capture || e.once !== r.once || e.passive !== r.passive, a = e !== d && (r === d || o);
    o && this.element.removeEventListener(this.name, this, r), a && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
};
var ct = class {
  constructor(e, t, r) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = r;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    O(this, e);
  }
};
var le = lt.litHtmlPolyfillSupport;
le?.(J, W), (lt.litHtmlVersions ??= []).push("3.3.3");
var Mt = (s3, e, t) => {
  let r = t?.renderBefore ?? e, o = r._$litPart$;
  if (o === void 0) {
    let a = t?.renderBefore ?? null;
    r._$litPart$ = o = new W(e.insertBefore(D(), a), a, void 0, t ?? {});
  }
  return o._$AI(s3), o;
};
var ut = globalThis;
var b = class extends E {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    let e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    let t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Mt(t, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return R;
  }
};
b._$litElement$ = true, b.finalized = true, ut.litElementHydrateSupport?.({ LitElement: b });
var de = ut.litElementPolyfillSupport;
de?.({ LitElement: b });
(ut.litElementVersions ??= []).push("4.2.2");
var w = (s3) => (e, t) => {
  t !== void 0 ? t.addInitializer(() => {
    customElements.define(s3, e);
  }) : customElements.define(s3, e);
};
var pe = { attribute: true, type: String, converter: q, reflect: false, hasChanged: X };
var ue = (s3 = pe, e, t) => {
  let { kind: r, metadata: o } = t, a = globalThis.litPropertyMetadata.get(o);
  if (a === void 0 && globalThis.litPropertyMetadata.set(o, a = /* @__PURE__ */ new Map()), r === "setter" && ((s3 = Object.create(s3)).wrapped = true), a.set(t.name, s3), r === "accessor") {
    let { name: i } = t;
    return { set(u) {
      let l = e.get.call(this);
      e.set.call(this, u), this.requestUpdate(i, l, s3, true, u);
    }, init(u) {
      return u !== void 0 && this.C(i, void 0, s3, u), u;
    } };
  }
  if (r === "setter") {
    let { name: i } = t;
    return function(u) {
      let l = this[i];
      e.call(this, u), this.requestUpdate(i, l, s3, true, u);
    };
  }
  throw Error("Unsupported decorator location: " + r);
};
function N(s3) {
  return (e, t) => typeof t == "object" ? ue(s3, e, t) : ((r, o, a) => {
    let i = o.hasOwnProperty(a);
    return o.constructor.createProperty(a, r), i ? Object.getOwnPropertyDescriptor(o, a) : void 0;
  })(s3, e, t);
}
function h(s3) {
  return N({ ...s3, state: true, attribute: false });
}
var U = { rascunho: "Rascunho", em_analise: "Em an\xE1lise", aprovado: "Aprovado", reprovado: "Reprovado", arquivado: "Arquivado" };
var L = { loteamento: "Loteamento", incorporacao: "Incorpora\xE7\xE3o" };
function Rt(s3) {
  if (!s3) return "\u2014";
  let e = new Date(s3);
  return isNaN(e.getTime()) ? "\u2014" : e.toLocaleDateString("pt-BR");
}
var I = y`
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
var n = globalThis.urbiVerso;
var g = "/viabilidade";
function Ot(s3 = {}) {
  let e = new URLSearchParams();
  s3.tipo_empreendimento && e.set("tipo_empreendimento", s3.tipo_empreendimento), s3.status && e.set("status", s3.status);
  let t = e.toString() ? `?${e}` : "";
  return n.api(`${g}/estudos${t}`);
}
function Tt(s3) {
  return n.api(`${g}/estudos`, { method: "POST", body: JSON.stringify(s3) });
}
function Nt(s3) {
  return n.api(`${g}/estudos/${s3}`);
}
function Ut(s3, e) {
  return n.api(`${g}/estudos/${s3}`, { method: "PATCH", body: JSON.stringify(e) });
}
function Lt(s3) {
  return n.api(`${g}/estudos/${s3}`, { method: "DELETE" });
}
function It(s3) {
  return n.api(`${g}/estudos/${s3}/duplicar`, { method: "POST" });
}
function Ht(s3, e) {
  return n.api(`${g}/estudos/${s3}/status`, { method: "POST", body: JSON.stringify({ status: e }) });
}
function tt(s3) {
  return n.api(`${g}/estudos/${s3}/membros`);
}
function zt(s3, e, t) {
  return n.api(`${g}/estudos/${s3}/membros`, { method: "POST", body: JSON.stringify({ usuario_id: e, funcao: t }) });
}
function Bt(s3, e, t) {
  return n.api(`${g}/estudos/${s3}/membros/${e}`, { method: "PATCH", body: JSON.stringify({ funcao: t }) });
}
function qt(s3, e) {
  return n.api(`${g}/estudos/${s3}/membros/${e}/remover`, { method: "PATCH" });
}
function jt(s3) {
  let e = s3 ? `?tipo_empreendimento=${s3}` : "";
  return n.api(`${g}/benchmarks${e}`);
}
function Dt(s3) {
  return n.api(`${g}/benchmarks`, { method: "POST", body: JSON.stringify(s3) });
}
function Ft(s3, e) {
  return n.api(`${g}/benchmarks/${s3}`, { method: "PATCH", body: JSON.stringify(e) });
}
function Jt(s3) {
  return n.api(`${g}/benchmarks/${s3}`, { method: "DELETE" });
}
function Wt() {
  return n.api(`${g}/benchmarks/semear`, { method: "POST" });
}
async function Gt() {
  let s3 = await n.api("/shell/apps/viabilidade/roles/usuarios");
  return [...Array.isArray(s3) ? s3 : s3?.usuarios || []].sort((t, r) => (t.nome ?? "").localeCompare(r.nome ?? "", "pt-BR", { sensitivity: "base" }));
}
var $ = class extends b {
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
        let t = await Tt({ nome: this.form.nome.trim(), tipo_empreendimento: this.form.tipo_empreendimento, nivel_analise: this.form.nivel_analise, origem_terreno: this.form.origem_terreno, uf: this.form.uf || null });
        if (t?.erro) {
          this.formErro = t.mensagem || "Erro ao criar estudo";
          return;
        }
        this.mostrarForm = false, n.notificar("Estudo criado (rascunho).", "sucesso"), t?.id && n.navegarSub(`/detalhe/${t.id}`);
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
      let t = await Ot({ tipo_empreendimento: this.filtroTipo || void 0, status: this.filtroStatus || void 0 });
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
        ${this.aba === "estudos" ? c`<button class="btn-cta" @click=${this._abrirForm}>+ Criar estudo</button>` : d}
      </div>

      <div class="abas">
        <button class="aba ${this.aba === "estudos" ? "ativa" : ""}" @click=${() => n.navegarSub("/")}>Estudos</button>
        <button class="aba ${this.aba === "terrenos" ? "ativa" : ""}" @click=${() => n.navegarSub("/terrenos")}>Terrenos</button>
      </div>

      ${this.aba === "estudos" ? this._renderEstudos() : this._renderTerrenos()}
      ${this.mostrarForm ? this._renderForm() : d}
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
          ${Object.entries(U).map(([t, r]) => c`<option value=${t}>${r}</option>`)}
        </select>
      </div>

      ${this.carregando ? c`<div class="vazio">Carregando…</div>` : this.estudos.length === 0 ? c`<div class="vazio">Nenhum estudo ainda. Clique em “Criar estudo”.</div>` : c`
            <div class="card" style="padding:0; overflow-x:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Estudo</th><th>Tipo</th><th>Status</th><th>Criado em</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  ${this.estudos.map((t) => c`
                    <tr @click=${() => n.navegarSub(`/detalhe/${t.id}`)}>
                      <td>${t.nome_exibicao || t.nome}</td>
                      <td>${L[t.tipo_empreendimento] || t.tipo_empreendimento}</td>
                      <td><span class="badge ${t.status}">${U[t.status] || t.status}</span></td>
                      <td class="sec">${Rt(t.criado_em)}</td>
                      <td>
                        <div class="acoes-linha" @click=${(r) => r.stopPropagation()}>
                          <button class="btn-sec btn-sm" @click=${() => this._duplicar(t.id)}>Duplicar</button>
                          <button class="btn-perigo btn-sm" @click=${() => this._remover(t)}>Remover</button>
                        </div>
                      </td>
                    </tr>
                  `)}
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

          ${this.formErro ? c`<div class="erro">${this.formErro}</div>` : d}

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
      let r = await It(t);
      if (r?.erro) {
        n.notificar(r.mensagem || "Erro ao duplicar", "erro");
        return;
      }
      n.notificar("Estudo duplicado.", "sucesso"), r?.id && n.navegarSub(`/detalhe/${r.id}`);
    } catch (r) {
      n.notificar(r?.message || "Erro ao duplicar", "erro");
    }
  }
  async _remover(t) {
    if (confirm(`Remover o estudo "${t.nome_exibicao || t.nome}"?`)) try {
      let r = await Lt(t.id);
      if (r?.erro) {
        n.notificar(r.mensagem || "Erro ao remover", "erro");
        return;
      }
      n.notificar("Estudo removido.", "sucesso"), this._carregar();
    } catch (r) {
      n.notificar(r?.message || "Erro ao remover", "erro");
    }
  }
};
$.styles = [I, y`
    .topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .abas { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.08)); }
    .aba {
      padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; font-size: 0.9rem; cursor: pointer;
    }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-bottom-color: var(--cor-primaria-solida, #2AA9E0); }
    .filtros { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .acoes-linha { display: flex; gap: 6px; }
    :host { padding: 24px; }
  `], p([N({ type: String })], $.prototype, "aba", 2), p([h()], $.prototype, "estudos", 2), p([h()], $.prototype, "carregando", 2), p([h()], $.prototype, "filtroTipo", 2), p([h()], $.prototype, "filtroStatus", 2), p([h()], $.prototype, "mostrarForm", 2), p([h()], $.prototype, "form", 2), p([h()], $.prototype, "salvando", 2), p([h()], $.prototype, "formErro", 2), $ = p([w("viab-tela-dashboard")], $);
var Kt = ["leitor", "editor", "aprovador"];
var mt = [{ campo: "terreno_manual_nome", label: "Nome do terreno (manual)", tipo: "texto" }, { campo: "terreno_manual_area", label: "\xC1rea do terreno (m\xB2)", tipo: "numero" }, { campo: "preco_venda_m2", label: "Pre\xE7o de venda (R$/m\xB2)", tipo: "numero" }, { campo: "custo_construcao_m2", label: "Custo de constru\xE7\xE3o (R$/m\xB2)", tipo: "numero" }, { campo: "notas", label: "Notas", tipo: "area_texto" }];
var _ = class extends b {
  constructor() {
    super(...arguments);
    this.estudoId = 0;
    this.estudo = null;
    this.carregando = true;
    this.aba = "premissas";
    this.form = {};
    this.salvando = false;
    this.membros = [];
    this.usuarios = [];
    this.mostrarMembros = false;
    this._salvarPremissas = async () => {
      this.salvando = true;
      try {
        let t = {};
        for (let { campo: o, tipo: a } of mt) {
          let i = this.form[o];
          i === "" ? i = null : a === "numero" && i != null && (i = Number(i)), t[o] = i;
        }
        let r = await Ut(this.estudoId, t);
        if (r?.erro) {
          n.notificar(r.mensagem || "Erro ao salvar", "erro");
          return;
        }
        n.notificar("Premissas salvas.", "sucesso"), this._carregar();
      } catch (t) {
        n.notificar(t?.message || "Erro ao salvar", "erro");
      } finally {
        this.salvando = false;
      }
    };
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
        let t = await Nt(this.estudoId);
        if (t?.erro) n.notificar(t.mensagem || "Sem acesso", "erro"), this.estudo = null;
        else {
          this.estudo = t, this.membros = t.membros || [], this.form = {};
          for (let { campo: r } of mt) this.form[r] = t[r] ?? "";
        }
      } catch (t) {
        console.error("Erro ao carregar estudo:", t);
      }
      this.carregando = false;
    }
  }
  render() {
    if (this.carregando) return c`<div class="placeholder">Carregando…</div>`;
    if (!this.estudo) return c`
      <button class="voltar" @click=${() => n.navegarSub("/")}>← Voltar</button>
      <div class="placeholder">Estudo não encontrado ou sem acesso.</div>`;
    let t = this.estudo._permissao || {}, r = this.estudo.status;
    return c`
      <button class="voltar" @click=${() => n.navegarSub("/")}>← Voltar aos estudos</button>
      <div class="cabecalho">
        <div>
          <h1>${this.estudo.nome_exibicao || this.estudo.nome}</h1>
          <div class="meta">
            <span class="badge ${r}">${U[r] || r}</span>
            <span class="sec">${L[this.estudo.tipo_empreendimento] || this.estudo.tipo_empreendimento}</span>
            ${t.funcao ? c`<span class="sec">· sua função: ${t.funcao}</span>` : d}
          </div>
        </div>
        <div class="acoes-status">${this._renderAcoesStatus(t, r)}</div>
      </div>

      <div class="abas">
        ${["premissas", "proforma", "graficos"].map((o) => c`
          <button class="aba ${this.aba === o ? "ativa" : ""}" @click=${() => this.aba = o}>
            ${o === "premissas" ? "Premissas" : o === "proforma" ? "Proforma" : "Gr\xE1ficos"}
          </button>
        `)}
      </div>

      ${this.aba === "premissas" ? this._renderPremissas(t) : d}
      ${this.aba === "proforma" ? c`<div class="placeholder">Proforma — cálculos e sensibilidade chegam na Etapa 5/6.</div>` : d}
      ${this.aba === "graficos" ? c`<div class="placeholder">Gráficos — visualizações chegam na Etapa 6.</div>` : d}
    `;
  }
  _renderAcoesStatus(t, r) {
    let o = [];
    return t.podeEditar && r === "rascunho" && o.push(c`<button class="btn-primario btn-sm" @click=${() => this._status("em_analise")}>Submeter para análise</button>`), t.podeAprovar && r === "em_analise" && (o.push(c`<button class="btn-primario btn-sm" @click=${() => this._status("aprovado")}>Aprovar</button>`), o.push(c`<button class="btn-perigo btn-sm" @click=${() => this._status("reprovado")}>Reprovar</button>`), o.push(c`<button class="btn-sec btn-sm" @click=${() => this._status("rascunho")}>Devolver ao rascunho</button>`)), t.podeAprovar && r === "arquivado" && o.push(c`<button class="btn-sec btn-sm" @click=${() => this._status("rascunho")}>Reabrir</button>`), o.push(c`<button class="btn-sec btn-sm" @click=${() => {
      this.mostrarMembros = !this.mostrarMembros, this.mostrarMembros && this._carregarUsuarios();
    }}>Membros</button>`), o;
  }
  _renderPremissas(t) {
    let r = t.podeEditar && this.estudo.status !== "aprovado" && this.estudo.status !== "reprovado";
    return c`
      ${this.mostrarMembros ? this._renderMembros(t) : d}
      <div class="card">
        <h3 style="margin-top:0">Premissas</h3>
        <div class="grid2">
          ${mt.map((o) => c`
            <div class="campo" style=${o.tipo === "area_texto" ? "grid-column: 1 / -1" : ""}>
              <label>${o.label}</label>
              ${o.tipo === "area_texto" ? c`<textarea rows="3" ?disabled=${!r}
                    .value=${this.form[o.campo] ?? ""}
                    @input=${(a) => this.form = { ...this.form, [o.campo]: a.target.value }}></textarea>` : c`<input type=${o.tipo === "numero" ? "number" : "text"} ?disabled=${!r}
                    .value=${String(this.form[o.campo] ?? "")}
                    @input=${(a) => this.form = { ...this.form, [o.campo]: a.target.value }} />`}
            </div>
          `)}
        </div>
        ${r ? c`
          <div class="acoes">
            <button class="btn-cta" ?disabled=${this.salvando} @click=${this._salvarPremissas}>
              ${this.salvando ? "Salvando\u2026" : "Salvar premissas"}
            </button>
          </div>` : c`<p class="sec">Somente leitura neste status/função.</p>`}
      </div>
    `;
  }
  _renderMembros(t) {
    let r = t.podeEditar;
    return c`
      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-top:0">Membros do estudo</h3>
        <div class="membros-lista">
          ${this.membros.length === 0 ? c`<span class="sec">Nenhum membro.</span>` : d}
          ${this.membros.map((o) => c`
            <div class="membro">
              <span>${o.usuario_nome || `Usu\xE1rio ${o.usuario_id}`}</span>
              <div style="display:flex; gap:6px; align-items:center">
                ${r ? c`
                  <select .value=${o.funcao} @change=${(a) => this._alterarFuncao(o.usuario_id, a.target.value)}>
                    ${Kt.map((a) => c`<option value=${a} ?selected=${a === o.funcao}>${a}</option>`)}
                  </select>
                  <button class="btn-perigo btn-sm" @click=${() => this._removerMembro(o.usuario_id)}>Remover</button>
                ` : c`<span class="badge rascunho">${o.funcao}</span>`}
              </div>
            </div>
          `)}
        </div>
        ${r ? c`
          <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
            <select id="sel-usuario">
              <option value="">Selecionar usuário…</option>
              ${this.usuarios.map((o) => c`<option value=${o.id}>${o.nome}</option>`)}
            </select>
            <select id="sel-funcao">
              ${Kt.map((o) => c`<option value=${o}>${o}</option>`)}
            </select>
            <button class="btn-sec btn-sm" @click=${this._adicionarMembro}>Adicionar</button>
          </div>` : d}
      </div>
    `;
  }
  async _carregarUsuarios() {
    if (!(this.usuarios.length > 0)) try {
      this.usuarios = await Gt();
    } catch (t) {
      console.error(t);
    }
  }
  async _status(t) {
    if (!((t === "aprovado" || t === "reprovado") && !confirm(`Confirma ${{ aprovado: "aprovar", reprovado: "reprovar", rascunho: "devolver ao rascunho", em_analise: "submeter" }[t]} este estudo?`))) try {
      let o = await Ht(this.estudoId, t);
      if (o?.erro) {
        n.notificar(o.mensagem || "Transi\xE7\xE3o n\xE3o permitida", "erro");
        return;
      }
      n.notificar(`Status alterado para ${U[t] || t}.`, "sucesso"), this._carregar();
    } catch (o) {
      n.notificar(o?.message || "Erro na transi\xE7\xE3o", "erro");
    }
  }
  async _adicionarMembro() {
    let t = this.renderRoot.querySelector("#sel-usuario"), r = this.renderRoot.querySelector("#sel-funcao"), o = parseInt(t?.value || ""), a = r?.value || "leitor";
    if (!o) {
      n.notificar("Selecione um usu\xE1rio.", "alerta");
      return;
    }
    try {
      let i = await zt(this.estudoId, o, a);
      if (i?.erro) {
        n.notificar(i.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await tt(this.estudoId))?.dados || this.membros, n.notificar("Membro adicionado.", "sucesso");
    } catch (i) {
      n.notificar(i?.message || "Erro", "erro");
    }
  }
  async _alterarFuncao(t, r) {
    try {
      let o = await Bt(this.estudoId, t, r);
      if (o?.erro) {
        n.notificar(o.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await tt(this.estudoId))?.dados || this.membros;
    } catch (o) {
      n.notificar(o?.message || "Erro", "erro");
    }
  }
  async _removerMembro(t) {
    try {
      let r = await qt(this.estudoId, t);
      if (r?.erro) {
        n.notificar(r.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await tt(this.estudoId))?.dados || this.membros;
    } catch (r) {
      n.notificar(r?.message || "Erro", "erro");
    }
  }
};
_.styles = [I, y`
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
  `], p([N({ type: Number })], _.prototype, "estudoId", 2), p([h()], _.prototype, "estudo", 2), p([h()], _.prototype, "carregando", 2), p([h()], _.prototype, "aba", 2), p([h()], _.prototype, "form", 2), p([h()], _.prototype, "salvando", 2), p([h()], _.prototype, "membros", 2), p([h()], _.prototype, "usuarios", 2), p([h()], _.prototype, "mostrarMembros", 2), _ = p([w("viab-tela-estudo")], _);
var P = class extends b {
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
      let t = await jt(this.tipo);
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
    }}>${L[t]}</button>
        `)}
      </div>

      ${this.carregando ? c`<div class="vazio">Carregando…</div>` : c`
          <div class="card" style="padding:0; overflow-x:auto;">
            <table>
              <thead><tr><th>Indicador</th><th>Valor</th><th>Regra</th><th>Var + (%)</th><th>Var − (%)</th><th></th></tr></thead>
              <tbody>
                ${this.itens.length === 0 ? c`<tr><td colspan="6" class="sec" style="text-align:center; padding:24px">Nenhum benchmark. Clique em “Criar indicadores padrão”.</td></tr>` : d}
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
      let o = await Ft(t, r);
      if (o?.erro) {
        n.notificar(o.mensagem || "Erro ao salvar", "erro");
        return;
      }
    } catch (o) {
      n.notificar(o?.message || "Erro", "erro");
    }
  }
  async _remover(t) {
    if (confirm("Remover este benchmark?")) try {
      let r = await Jt(t);
      if (r?.erro) {
        n.notificar(r.mensagem || "Erro", "erro");
        return;
      }
      this._carregar();
    } catch (r) {
      n.notificar(r?.message || "Erro", "erro");
    }
  }
  async _novo() {
    let t = prompt("Identificador do indicador (ex: resultado_final):");
    if (t?.trim()) try {
      let r = await Dt({ tipo_empreendimento: this.tipo, campo: t.trim(), regra_comparacao: "atingir_ou_superar" });
      if (r?.erro) {
        n.notificar(r.mensagem || "Erro", "erro");
        return;
      }
      this._carregar();
    } catch (r) {
      n.notificar(r?.message || "Erro", "erro");
    }
  }
  async _semear() {
    try {
      let t = await Wt();
      if (t?.erro) {
        n.notificar(t.mensagem || "Erro", "erro");
        return;
      }
      n.notificar(`${t.criados ?? 0} indicador(es) criado(s).`, "sucesso"), this._carregar();
    } catch (t) {
      n.notificar(t?.message || "Erro", "erro");
    }
  }
};
P.styles = [I, y`
    :host { padding: 16px; }
    .abas { display: flex; gap: 4px; margin-bottom: 16px; }
    .aba { padding: 8px 14px; background: none; border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
           border-radius: 6px; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; cursor: pointer; }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-color: var(--cor-primaria-solida, #2AA9E0); }
    .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    td input, td select { width: 100%; box-sizing: border-box; }
    td.num input { max-width: 90px; }
  `], p([h()], P.prototype, "tipo", 2), p([h()], P.prototype, "itens", 2), p([h()], P.prototype, "carregando", 2), P = p([w("viabilidade-config-benchmarks")], P);
function Zt(s3) {
  let e = (s3 || "").replace(/^\//, "").split("/").filter(Boolean);
  if (e[0] === "detalhe" && e[1]) {
    let t = parseInt(e[1]);
    if (!isNaN(t)) return { tela: "estudo", estudoId: t };
  }
  return e[0] === "terrenos" ? { tela: "dashboard", aba: "terrenos" } : { tela: "dashboard", aba: "estudos" };
}
var H = class extends b {
  constructor() {
    super(...arguments);
    this.rota = { tela: "dashboard", aba: "estudos" };
  }
  connectedCallback() {
    super.connectedCallback(), this.rota = Zt(n.subRota()), this._cleanupRota = n.escutarRota((t) => {
      this.rota = Zt(t);
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._cleanupRota?.();
  }
  render() {
    return this.rota.tela === "estudo" ? c`<viab-tela-estudo .estudoId=${this.rota.estudoId || 0}></viab-tela-estudo>` : c`<viab-tela-dashboard .aba=${this.rota.aba || "estudos"}></viab-tela-dashboard>`;
  }
};
H.styles = y`
    :host {
      display: block;
      min-height: 100%;
      background: var(--cor-fundo, #0D1B2A);
      color: var(--cor-texto, rgba(255, 255, 255, 0.85));
    }
  `, p([h()], H.prototype, "rota", 2), H = p([w("app-viabilidade")], H);

// demo/demo.ts
var root = document.getElementById("root");
function mostrar(view) {
  if (!root) return;
  root.innerHTML = "";
  root.appendChild(document.createElement(view === "config" ? "viabilidade-config-benchmarks" : "app-viabilidade"));
  document.querySelectorAll("[data-view]").forEach((b2) => {
    b2.classList.toggle("ativa", b2.dataset.view === view);
  });
}
document.querySelectorAll("[data-view]").forEach((b2) => {
  b2.addEventListener("click", () => mostrar(b2.dataset.view || "app"));
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
