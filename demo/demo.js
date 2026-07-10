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
  const m = membros.find((x2) => x2.estudo_id === estudo.id && x2.usuario_id === USUARIO_ATUAL.id);
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
      if (!r[3] && metodo === "GET") return { dados: membros.filter((m) => m.estudo_id === id) };
      if (!r[3] && metodo === "POST") {
        const u = usuarios.find((x2) => x2.id === Number(body.usuario_id));
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
        const m = membros.find((x2) => x2.estudo_id === id && x2.usuario_id === uid);
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
var De = Object.defineProperty;
var Ge = Object.getOwnPropertyDescriptor;
var p = (o3, e, t, r) => {
  for (var a = r > 1 ? void 0 : r ? Ge(e, t) : e, s = o3.length - 1, i; s >= 0; s--) (i = o3[s]) && (a = (r ? i(e, t, a) : i(a)) || a);
  return r && a && De(e, t, a), a;
};
var rt = globalThis;
var ot = rt.ShadowRoot && (rt.ShadyCSS === void 0 || rt.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var $t = Symbol();
var Vt = /* @__PURE__ */ new WeakMap();
var D = class {
  constructor(e, t, r) {
    if (this._$cssResult$ = true, r !== $t) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o, t = this.t;
    if (ot && e === void 0) {
      let r = t !== void 0 && t.length === 1;
      r && (e = Vt.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), r && Vt.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
var Jt = (o3) => new D(typeof o3 == "string" ? o3 : o3 + "", void 0, $t);
var x = (o3, ...e) => {
  let t = o3.length === 1 ? o3[0] : e.reduce((r, a, s) => r + ((i) => {
    if (i._$cssResult$ === true) return i.cssText;
    if (typeof i == "number") return i;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + i + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(a) + o3[s + 1], o3[0]);
  return new D(t, o3, $t);
};
var Wt = (o3, e) => {
  if (ot) o3.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (let t of e) {
    let r = document.createElement("style"), a = rt.litNonce;
    a !== void 0 && r.setAttribute("nonce", a), r.textContent = t.cssText, o3.appendChild(r);
  }
};
var xt = ot ? (o3) => o3 : (o3) => o3 instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (let r of e.cssRules) t += r.cssText;
  return Jt(t);
})(o3) : o3;
var { is: Ve, defineProperty: Je, getOwnPropertyDescriptor: We, getOwnPropertyNames: Ke, getOwnPropertySymbols: Xe, getPrototypeOf: Ze } = Object;
var at = globalThis;
var Kt = at.trustedTypes;
var Qe = Kt ? Kt.emptyScript : "";
var Ye = at.reactiveElementPolyfillSupport;
var G = (o3, e) => o3;
var V = { toAttribute(o3, e) {
  switch (e) {
    case Boolean:
      o3 = o3 ? Qe : null;
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
var st = (o3, e) => !Ve(o3, e);
var Xt = { attribute: true, type: String, converter: V, reflect: false, useDefault: false, hasChanged: st };
Symbol.metadata ??= Symbol("metadata"), at.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var P = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = Xt) {
    if (t.state && (t.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = true), this.elementProperties.set(e, t), !t.noAccessor) {
      let r = Symbol(), a = this.getPropertyDescriptor(e, r, t);
      a !== void 0 && Je(this.prototype, e, a);
    }
  }
  static getPropertyDescriptor(e, t, r) {
    let { get: a, set: s } = We(this.prototype, e) ?? { get() {
      return this[t];
    }, set(i) {
      this[t] = i;
    } };
    return { get: a, set(i) {
      let l = a?.call(this);
      s?.call(this, i), this.requestUpdate(e, l, r);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? Xt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(G("elementProperties"))) return;
    let e = Ze(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(G("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(G("properties"))) {
      let t = this.properties, r = [...Ke(t), ...Xe(t)];
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
      for (let a of r) t.unshift(xt(a));
    } else e !== void 0 && t.push(xt(e));
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
    return Wt(e, this.constructor.elementStyles), e;
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
      let s = (r.converter?.toAttribute !== void 0 ? r.converter : V).toAttribute(t, r.type);
      this._$Em = e, s == null ? this.removeAttribute(a) : this.setAttribute(a, s), this._$Em = null;
    }
  }
  _$AK(e, t) {
    let r = this.constructor, a = r._$Eh.get(e);
    if (a !== void 0 && this._$Em !== a) {
      let s = r.getPropertyOptions(a), i = typeof s.converter == "function" ? { fromAttribute: s.converter } : s.converter?.fromAttribute !== void 0 ? s.converter : V;
      this._$Em = a;
      let l = i.fromAttribute(t, s.type);
      this[a] = l ?? this._$Ej?.get(a) ?? l, this._$Em = null;
    }
  }
  requestUpdate(e, t, r, a = false, s) {
    if (e !== void 0) {
      let i = this.constructor;
      if (a === false && (s = this[e]), r ??= i.getPropertyOptions(e), !((r.hasChanged ?? st)(s, t) || r.useDefault && r.reflect && s === this._$Ej?.get(e) && !this.hasAttribute(i._$Eu(e, r)))) return;
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
        let { wrapped: i } = s, l = this[a];
        i !== true || this._$AL.has(a) || l === void 0 || this.C(a, void 0, s, l);
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
P.elementStyles = [], P.shadowRootOptions = { mode: "open" }, P[G("elementProperties")] = /* @__PURE__ */ new Map(), P[G("finalized")] = /* @__PURE__ */ new Map(), Ye?.({ ReactiveElement: P }), (at.reactiveElementVersions ??= []).push("2.1.2");
var wt = globalThis;
var Zt = (o3) => o3;
var it = wt.trustedTypes;
var Qt = it ? it.createPolicy("lit-html", { createHTML: (o3) => o3 }) : void 0;
var ae = "$lit$";
var C = `lit$${Math.random().toFixed(9).slice(2)}$`;
var se = "?" + C;
var tr = `<${se}>`;
var O = document;
var W = () => O.createComment("");
var K = (o3) => o3 === null || typeof o3 != "object" && typeof o3 != "function";
var Ct = Array.isArray;
var er = (o3) => Ct(o3) || typeof o3?.[Symbol.iterator] == "function";
var yt = `[ 	
\f\r]`;
var J = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var Yt = /-->/g;
var te = />/g;
var T = RegExp(`>|${yt}(?:([^\\s"'>=/]+)(${yt}*=${yt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var ee = /'/g;
var re = /"/g;
var ie = /^(?:script|style|textarea|title)$/i;
var Rt = (o3) => (e, ...t) => ({ _$litType$: o3, strings: e, values: t });
var c = Rt(1);
var pr = Rt(2);
var hr = Rt(3);
var I = Symbol.for("lit-noChange");
var h = Symbol.for("lit-nothing");
var oe = /* @__PURE__ */ new WeakMap();
var L = O.createTreeWalker(O, 129);
function ne(o3, e) {
  if (!Ct(o3) || !o3.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Qt !== void 0 ? Qt.createHTML(e) : e;
}
var rr = (o3, e) => {
  let t = o3.length - 1, r = [], a, s = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", i = J;
  for (let l = 0; l < t; l++) {
    let u = o3[l], b, v, m = -1, E = 0;
    for (; E < u.length && (i.lastIndex = E, v = i.exec(u), v !== null); ) E = i.lastIndex, i === J ? v[1] === "!--" ? i = Yt : v[1] !== void 0 ? i = te : v[2] !== void 0 ? (ie.test(v[2]) && (a = RegExp("</" + v[2], "g")), i = T) : v[3] !== void 0 && (i = T) : i === T ? v[0] === ">" ? (i = a ?? J, m = -1) : v[1] === void 0 ? m = -2 : (m = i.lastIndex - v[2].length, b = v[1], i = v[3] === void 0 ? T : v[3] === '"' ? re : ee) : i === re || i === ee ? i = T : i === Yt || i === te ? i = J : (i = T, a = void 0);
    let A = i === T && o3[l + 1].startsWith("/>") ? " " : "";
    s += i === J ? u + tr : m >= 0 ? (r.push(b), u.slice(0, m) + ae + u.slice(m) + C + A) : u + C + (m === -2 ? l : A);
  }
  return [ne(o3, s + (o3[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), r];
};
var X = class o {
  constructor({ strings: e, _$litType$: t }, r) {
    let a;
    this.parts = [];
    let s = 0, i = 0, l = e.length - 1, u = this.parts, [b, v] = rr(e, t);
    if (this.el = o.createElement(b, r), L.currentNode = this.el.content, t === 2 || t === 3) {
      let m = this.el.content.firstChild;
      m.replaceWith(...m.childNodes);
    }
    for (; (a = L.nextNode()) !== null && u.length < l; ) {
      if (a.nodeType === 1) {
        if (a.hasAttributes()) for (let m of a.getAttributeNames()) if (m.endsWith(ae)) {
          let E = v[i++], A = a.getAttribute(m).split(C), N = /([.?@])?(.*)/.exec(E);
          u.push({ type: 1, index: s, name: N[2], strings: A, ctor: N[1] === "." ? At : N[1] === "?" ? kt : N[1] === "@" ? St : q }), a.removeAttribute(m);
        } else m.startsWith(C) && (u.push({ type: 6, index: s }), a.removeAttribute(m));
        if (ie.test(a.tagName)) {
          let m = a.textContent.split(C), E = m.length - 1;
          if (E > 0) {
            a.textContent = it ? it.emptyScript : "";
            for (let A = 0; A < E; A++) a.append(m[A], W()), L.nextNode(), u.push({ type: 2, index: ++s });
            a.append(m[E], W());
          }
        }
      } else if (a.nodeType === 8) if (a.data === se) u.push({ type: 2, index: s });
      else {
        let m = -1;
        for (; (m = a.data.indexOf(C, m + 1)) !== -1; ) u.push({ type: 7, index: s }), m += C.length - 1;
      }
      s++;
    }
  }
  static createElement(e, t) {
    let r = O.createElement("template");
    return r.innerHTML = e, r;
  }
};
function H(o3, e, t = o3, r) {
  if (e === I) return e;
  let a = r !== void 0 ? t._$Co?.[r] : t._$Cl, s = K(e) ? void 0 : e._$litDirective$;
  return a?.constructor !== s && (a?._$AO?.(false), s === void 0 ? a = void 0 : (a = new s(o3), a._$AT(o3, t, r)), r !== void 0 ? (t._$Co ??= [])[r] = a : t._$Cl = a), a !== void 0 && (e = H(o3, a._$AS(o3, e.values), a, r)), e;
}
var Et = class {
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
    let { el: { content: t }, parts: r } = this._$AD, a = (e?.creationScope ?? O).importNode(t, true);
    L.currentNode = a;
    let s = L.nextNode(), i = 0, l = 0, u = r[0];
    for (; u !== void 0; ) {
      if (i === u.index) {
        let b;
        u.type === 2 ? b = new Z(s, s.nextSibling, this, e) : u.type === 1 ? b = new u.ctor(s, u.name, u.strings, this, e) : u.type === 6 && (b = new Pt(s, this, e)), this._$AV.push(b), u = r[++l];
      }
      i !== u?.index && (s = L.nextNode(), i++);
    }
    return L.currentNode = O, a;
  }
  p(e) {
    let t = 0;
    for (let r of this._$AV) r !== void 0 && (r.strings !== void 0 ? (r._$AI(e, r, t), t += r.strings.length - 2) : r._$AI(e[t])), t++;
  }
};
var Z = class o2 {
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
    e = H(this, e, t), K(e) ? e === h || e == null || e === "" ? (this._$AH !== h && this._$AR(), this._$AH = h) : e !== this._$AH && e !== I && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : er(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== h && K(this._$AH) ? this._$AA.nextSibling.data = e : this.T(O.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    let { values: t, _$litType$: r } = e, a = typeof r == "number" ? this._$AC(e) : (r.el === void 0 && (r.el = X.createElement(ne(r.h, r.h[0]), this.options)), r);
    if (this._$AH?._$AD === a) this._$AH.p(t);
    else {
      let s = new Et(a, this), i = s.u(this.options);
      s.p(t), this.T(i), this._$AH = s;
    }
  }
  _$AC(e) {
    let t = oe.get(e.strings);
    return t === void 0 && oe.set(e.strings, t = new X(e)), t;
  }
  k(e) {
    Ct(this._$AH) || (this._$AH = [], this._$AR());
    let t = this._$AH, r, a = 0;
    for (let s of e) a === t.length ? t.push(r = new o2(this.O(W()), this.O(W()), this, this.options)) : r = t[a], r._$AI(s), a++;
    a < t.length && (this._$AR(r && r._$AB.nextSibling, a), t.length = a);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    for (this._$AP?.(false, true, t); e !== this._$AB; ) {
      let r = Zt(e).nextSibling;
      Zt(e).remove(), e = r;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
};
var q = class {
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
    if (s === void 0) e = H(this, e, t, 0), i = !K(e) || e !== this._$AH && e !== I, i && (this._$AH = e);
    else {
      let l = e, u, b;
      for (e = s[0], u = 0; u < s.length - 1; u++) b = H(this, l[r + u], t, u), b === I && (b = this._$AH[u]), i ||= !K(b) || b !== this._$AH[u], b === h ? e = h : e !== h && (e += (b ?? "") + s[u + 1]), this._$AH[u] = b;
    }
    i && !a && this.j(e);
  }
  j(e) {
    e === h ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
};
var At = class extends q {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === h ? void 0 : e;
  }
};
var kt = class extends q {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== h);
  }
};
var St = class extends q {
  constructor(e, t, r, a, s) {
    super(e, t, r, a, s), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = H(this, e, t, 0) ?? h) === I) return;
    let r = this._$AH, a = e === h && r !== h || e.capture !== r.capture || e.once !== r.once || e.passive !== r.passive, s = e !== h && (r === h || a);
    a && this.element.removeEventListener(this.name, this, r), s && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
};
var Pt = class {
  constructor(e, t, r) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = r;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    H(this, e);
  }
};
var or = wt.litHtmlPolyfillSupport;
or?.(X, Z), (wt.litHtmlVersions ??= []).push("3.3.3");
var ce = (o3, e, t) => {
  let r = t?.renderBefore ?? e, a = r._$litPart$;
  if (a === void 0) {
    let s = t?.renderBefore ?? null;
    r._$litPart$ = a = new Z(e.insertBefore(W(), s), s, void 0, t ?? {});
  }
  return a._$AI(o3), a;
};
var Mt = globalThis;
var f = class extends P {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    let e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    let t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = ce(t, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return I;
  }
};
f._$litElement$ = true, f.finalized = true, Mt.litElementHydrateSupport?.({ LitElement: f });
var ar = Mt.litElementPolyfillSupport;
ar?.({ LitElement: f });
(Mt.litElementVersions ??= []).push("4.2.2");
var S = (o3) => (e, t) => {
  t !== void 0 ? t.addInitializer(() => {
    customElements.define(o3, e);
  }) : customElements.define(o3, e);
};
var sr = { attribute: true, type: String, converter: V, reflect: false, hasChanged: st };
var ir = (o3 = sr, e, t) => {
  let { kind: r, metadata: a } = t, s = globalThis.litPropertyMetadata.get(a);
  if (s === void 0 && globalThis.litPropertyMetadata.set(a, s = /* @__PURE__ */ new Map()), r === "setter" && ((o3 = Object.create(o3)).wrapped = true), s.set(t.name, o3), r === "accessor") {
    let { name: i } = t;
    return { set(l) {
      let u = e.get.call(this);
      e.set.call(this, l), this.requestUpdate(i, u, o3, true, l);
    }, init(l) {
      return l !== void 0 && this.C(i, void 0, o3, l), l;
    } };
  }
  if (r === "setter") {
    let { name: i } = t;
    return function(l) {
      let u = this[i];
      e.call(this, l), this.requestUpdate(i, u, o3, true, l);
    };
  }
  throw Error("Unsupported decorator location: " + r);
};
function w(o3) {
  return (e, t) => typeof t == "object" ? ir(o3, e, t) : ((r, a, s) => {
    let i = a.hasOwnProperty(s);
    return a.constructor.createProperty(s, r), i ? Object.getOwnPropertyDescriptor(a, s) : void 0;
  })(o3, e, t);
}
function _(o3) {
  return w({ ...o3, state: true, attribute: false });
}
var j = { rascunho: "Rascunho", em_analise: "Em an\xE1lise", aprovado: "Aprovado", reprovado: "Reprovado", arquivado: "Arquivado" };
var F = { loteamento: "Loteamento", incorporacao: "Incorpora\xE7\xE3o" };
function le(o3) {
  if (!o3) return "\u2014";
  let e = new Date(o3);
  return isNaN(e.getTime()) ? "\u2014" : e.toLocaleDateString("pt-BR");
}
var R = x`
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
function ue(o3 = {}) {
  let e = new URLSearchParams();
  o3.tipo_empreendimento && e.set("tipo_empreendimento", o3.tipo_empreendimento), o3.status && e.set("status", o3.status);
  let t = e.toString() ? `?${e}` : "";
  return n.api(`${g}/estudos${t}`);
}
function de(o3) {
  return n.api(`${g}/estudos`, { method: "POST", body: JSON.stringify(o3) });
}
function me(o3) {
  return n.api(`${g}/estudos/${o3}`);
}
function pe(o3, e) {
  return n.api(`${g}/estudos/${o3}`, { method: "PATCH", body: JSON.stringify(e) });
}
function he(o3) {
  return n.api(`${g}/estudos/${o3}`, { method: "DELETE" });
}
function _e(o3) {
  return n.api(`${g}/estudos/${o3}/duplicar`, { method: "POST" });
}
function be(o3, e) {
  return n.api(`${g}/estudos/${o3}/status`, { method: "POST", body: JSON.stringify({ status: e }) });
}
function ct(o3) {
  return n.api(`${g}/estudos/${o3}/membros`);
}
function ve(o3, e, t) {
  return n.api(`${g}/estudos/${o3}/membros`, { method: "POST", body: JSON.stringify({ usuario_id: e, funcao: t }) });
}
function ge(o3, e, t) {
  return n.api(`${g}/estudos/${o3}/membros/${e}`, { method: "PATCH", body: JSON.stringify({ funcao: t }) });
}
function fe(o3, e) {
  return n.api(`${g}/estudos/${o3}/membros/${e}/remover`, { method: "PATCH" });
}
function lt(o3) {
  let e = o3 ? `?tipo_empreendimento=${o3}` : "";
  return n.api(`${g}/benchmarks${e}`);
}
function $e(o3) {
  return n.api(`${g}/benchmarks`, { method: "POST", body: JSON.stringify(o3) });
}
function xe(o3, e) {
  return n.api(`${g}/benchmarks/${o3}`, { method: "PATCH", body: JSON.stringify(e) });
}
function ye(o3) {
  return n.api(`${g}/benchmarks/${o3}`, { method: "DELETE" });
}
function Ee() {
  return n.api(`${g}/benchmarks/semear`, { method: "POST" });
}
function Ae() {
  return n.api(`${g}/config`);
}
async function ke() {
  let o3 = await n.api("/shell/apps/viabilidade/roles/usuarios");
  return [...Array.isArray(o3) ? o3 : o3?.usuarios || []].sort((t, r) => (t.nome ?? "").localeCompare(r.nome ?? "", "pt-BR", { sensitivity: "base" }));
}
var $ = class extends f {
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
        let t = await de({ nome: this.form.nome.trim(), tipo_empreendimento: this.form.tipo_empreendimento, nivel_analise: this.form.nivel_analise, origem_terreno: this.form.origem_terreno, uf: this.form.uf || null });
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
      let t = await ue({ tipo_empreendimento: this.filtroTipo || void 0, status: this.filtroStatus || void 0 });
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
        <button class="aba ${this.aba === "estudos" ? "ativa" : ""}" @click=${() => n.navegarSub("/")}>Estudos</button>
        <button class="aba ${this.aba === "terrenos" ? "ativa" : ""}" @click=${() => n.navegarSub("/terrenos")}>Terrenos</button>
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
          ${Object.entries(j).map(([t, r]) => c`<option value=${t}>${r}</option>`)}
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
                      <td>${F[t.tipo_empreendimento] || t.tipo_empreendimento}</td>
                      <td><span class="badge ${t.status}">${j[t.status] || t.status}</span></td>
                      <td class="sec">${le(t.criado_em)}</td>
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
      let r = await _e(t);
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
      let r = await he(t.id);
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
$.styles = [R, x`
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
  `], p([w({ type: String })], $.prototype, "aba", 2), p([_()], $.prototype, "estudos", 2), p([_()], $.prototype, "carregando", 2), p([_()], $.prototype, "filtroTipo", 2), p([_()], $.prototype, "filtroStatus", 2), p([_()], $.prototype, "mostrarForm", 2), p([_()], $.prototype, "form", 2), p([_()], $.prototype, "salvando", 2), p([_()], $.prototype, "formErro", 2), $ = p([S("viab-tela-dashboard")], $);
var d = (o3) => Number(o3) || 0;
function Nt(o3) {
  let e = o3.tipo_empreendimento === "loteamento", t = d(o3.terreno_manual_area), r = 0, a = 0, s = 0, i = 0, l = 0, u = d(o3.preco_venda_m2);
  if (e) {
    let z = d(o3.app_pct) + d(o3.faixas_nao_edificaveis_pct) + d(o3.sistema_viario_pct) + d(o3.elup_pct) + d(o3.epc_pct) + d(o3.epu_pct) + d(o3.areas_privativas_nao_vendaveis_pct);
    r = t * (1 - z / 100), a = r;
  } else {
    let z = d(o3.area_pvt_r_fechada), ft = d(o3.area_pvt_nr_fechada), Be = d(o3.area_pvt_r_aberta), ze = d(o3.area_pvt_nr_aberta);
    a = z + ft + Be + ze, s = a + d(o3.area_comum_total), r = z + ft, i = z * d(o3.preco_venda_m2_residencial), l = ft * d(o3.preco_venda_m2_nao_residencial);
  }
  let b = o3.permuta_fisica_modo === "pct_area_venda" ? r * d(o3.permuta_fisica_pct) / 100 : d(o3.permuta_fisica_area_m2), v = r - b;
  e && (i = v * u);
  let m = i + l, E = o3.sujeito_ret ? o3.aliquota_ret_pct ?? 4 : d(o3.imposto_percentual), A = m * E / 100, N = m * d(o3.corretagem_percentual) / 100, Lt = m * d(o3.marketing_percentual) / 100, dt = i * d(o3.permuta_financeira_residencial_pct) / 100, mt = l * d(o3.permuta_financeira_nao_residencial_pct) / 100, pt = m - A - N - Lt - dt - mt, Ot = o3.considerar_custo_terreno === false ? 0 : d(o3.custo_terreno_m2) * t, Q = e ? o3.infra_modo === "valor_m2" ? d(o3.custo_infra_m2) * r : m * d(o3.infra_pct) / 100 : 0, Y = e ? 0 : d(o3.custo_construcao_m2) * a, tt = e ? 0 : d(o3.custo_decoracao_m2) * a, Te = e ? Q : Y + tt, ht = e ? 0 : Te * d(o3.taxa_gestao_pct) / 100, It = o3.projetos_modo === "valor_fixo" ? d(o3.projetos_valor_fixo) : m * d(o3.projetos_pct) / 100, Ut = e ? 0 : d(o3.coef_aproveitamento_basico) > 0 ? d(o3.valor_venal_terreno_m2) / d(o3.coef_aproveitamento_basico) * t * (d(o3.coef_aproveitamento_maximo) - d(o3.coef_aproveitamento_basico)) * 0.2 : 0, Ht = e ? 0 : m * d(o3.incorporacao_registro_pct) / 100, qt = m * d(o3.manutencao_pct) / 100, jt = m * d(o3.contingencias_pct) / 100, _t = Ot + It + Q + Ut + Ht + Y + ht + tt + qt + jt, Ft = m * d(o3.marketing_global_pct) / 100 + (e ? d(o3.stand_vendas_valor) : 0), Bt = m * d(o3.gestao_indiretos_pct) / 100, bt = Ft + Bt, et = pt - _t - bt, zt = et + dt + mt, Le = e ? u : r > 0 ? m / r : 0, Dt = b * Le, Oe = zt + Dt, Ie = m > 0 ? et / m * 100 : 0, vt = _t + bt, Gt = e ? Q : Y + tt + ht, Ue = m > 0 ? Gt / m * 100 : 0, He = m > 0 ? pt / m * 100 : 0, qe = vt > 0 ? et / vt * 100 : 0, je = t > 0 ? r / t * 100 : 0, gt = e ? d(o3.area_media_lote_m2) > 0 ? Math.floor(v / d(o3.area_media_lote_m2)) : 0 : d(o3.num_unidades), Fe = e ? d(o3.area_media_lote_m2) * u : gt > 0 ? m / gt : 0;
  return { areaTerreno: t, areaVendavel: r, areaPermutaFisica: b, areaVendavelLiquida: v, areaPrivativa: a, areaConstruida: s, vgvResidencial: i, vgvNaoResidencial: l, vgv: m, imposto: A, corretagem: N, marketing: Lt, permutaFinResidencial: dt, permutaFinNaoResidencial: mt, receitaLiquida: pt, custoTerreno: Ot, projetos: It, infraestrutura: Q, outorga: Ut, incorporacaoRegistro: Ht, construcao: Y, gestaoConstrucao: ht, decoracao: tt, manutencao: qt, contingencias: jt, custoDiretoTotal: _t, marketingGlobal: Ft, gestaoIndiretos: Bt, custoIndiretoTotal: bt, resultado: et, resultadoComPermutasFin: zt, resultadoComPermutasFisicas: Oe, valorPermutaFisica: Dt, margemLiquidaPct: Ie, investimentoTotal: vt, custoObras: Gt, custoObrasVgvPct: Ue, margemBrutaPct: He, roiPct: qe, eficienciaPct: je, numUnidades: gt, precoMedioUnidade: Fe };
}
function Se(o3, e) {
  let t = o3.tipo_empreendimento === "loteamento", r = (l) => {
    let u = t ? { ...o3, preco_venda_m2: l } : { ...o3, preco_venda_m2_residencial: l, preco_venda_m2_nao_residencial: l };
    return Nt(u).margemLiquidaPct;
  }, a = 1e6;
  if (r(a) < e) return null;
  if (r(0.01) >= e) return 0;
  let s = 0, i = a;
  for (let l = 0; l < 60; l++) {
    let u = (s + i) / 2;
    r(u) >= e ? i = u : s = u;
  }
  return i;
}
var Pe = [{ k: "custo_terreno_m2", label: "Custo do terreno", t: "num", sufixo: "R$/m\xB2" }, { k: "custo_infra_m2", label: "Infraestrutura (R$/m\xB2)", t: "num", sufixo: "R$/m\xB2", so: "loteamento" }, { k: "infra_pct", label: "Infraestrutura (% VGV)", t: "num", sufixo: "%", so: "loteamento" }, { k: "custo_construcao_m2", label: "Constru\xE7\xE3o", t: "num", sufixo: "R$/m\xB2", so: "incorporacao" }, { k: "custo_decoracao_m2", label: "Decora\xE7\xE3o", t: "num", sufixo: "R$/m\xB2", so: "incorporacao" }, { k: "taxa_gestao_pct", label: "Gest\xE3o da constru\xE7\xE3o", t: "num", sufixo: "%", so: "incorporacao" }, { k: "incorporacao_registro_pct", label: "Incorpora\xE7\xE3o e registro", t: "num", sufixo: "% VGV", so: "incorporacao" }, { k: "valor_venal_terreno_m2", label: "Valor venal do terreno (outorga)", t: "num", sufixo: "R$/m\xB2", so: "incorporacao" }, { k: "projetos_pct", label: "Projetos", t: "num", sufixo: "% VGV" }, { k: "manutencao_pct", label: "Manuten\xE7\xE3o p\xF3s-obra", t: "num", sufixo: "% VGV" }, { k: "contingencias_pct", label: "Conting\xEAncias", t: "num", sufixo: "% VGV" }, { k: "stand_vendas_valor", label: "Stand de vendas", t: "num", sufixo: "R$", so: "loteamento" }, { k: "marketing_global_pct", label: "Marketing global / estrutura", t: "num", sufixo: "% VGV" }, { k: "gestao_indiretos_pct", label: "Gest\xE3o e indiretos", t: "num", sufixo: "% VGV" }];
var we = [{ k: "imposto_percentual", label: "Imposto (se n\xE3o RET)", t: "num", sufixo: "%" }, { k: "corretagem_percentual", label: "Corretagem", t: "num", sufixo: "%" }, { k: "marketing_percentual", label: "Marketing", t: "num", sufixo: "%" }, { k: "permuta_financeira_residencial_pct", label: "Permuta financeira residencial", t: "num", sufixo: "%" }, { k: "permuta_financeira_nao_residencial_pct", label: "Permuta financeira n\xE3o residencial", t: "num", sufixo: "%" }];
var Ce = [{ k: "app_pct", label: "APP", t: "num", sufixo: "% gleba" }, { k: "faixas_nao_edificaveis_pct", label: "Faixas n\xE3o edific\xE1veis", t: "num", sufixo: "% gleba" }, { k: "sistema_viario_pct", label: "Sistema vi\xE1rio", t: "num", sufixo: "% gleba" }, { k: "elup_pct", label: "ELUP", t: "num", sufixo: "% gleba" }, { k: "epc_pct", label: "EPC", t: "num", sufixo: "% gleba" }, { k: "epu_pct", label: "EPU", t: "num", sufixo: "% gleba" }, { k: "areas_privativas_nao_vendaveis_pct", label: "Priv. n\xE3o vend\xE1veis", t: "num", sufixo: "% gleba" }, { k: "area_media_lote_m2", label: "\xC1rea m\xE9dia do lote", t: "num", sufixo: "m\xB2" }, { k: "preco_venda_m2", label: "Pre\xE7o de venda", t: "num", sufixo: "R$/m\xB2" }];
var Re = [{ k: "coef_aproveitamento_basico", label: "Coef. aproveitamento b\xE1sico", t: "num" }, { k: "coef_aproveitamento_maximo", label: "Coef. aproveitamento m\xE1ximo", t: "num" }, { k: "area_pvt_r_fechada", label: "\xC1rea PVT R Fechada", t: "num", sufixo: "m\xB2" }, { k: "area_pvt_nr_fechada", label: "\xC1rea PVT NR Fechada", t: "num", sufixo: "m\xB2" }, { k: "area_pvt_r_aberta", label: "\xC1rea PVT R Aberta", t: "num", sufixo: "m\xB2" }, { k: "area_pvt_nr_aberta", label: "\xC1rea PVT NR Aberta", t: "num", sufixo: "m\xB2" }, { k: "area_comum_total", label: "\xC1rea comum total", t: "num", sufixo: "m\xB2" }, { k: "num_unidades", label: "N\xBA de unidades", t: "num" }, { k: "preco_venda_m2_residencial", label: "Pre\xE7o venda residencial", t: "num", sufixo: "R$/m\xB2" }, { k: "preco_venda_m2_nao_residencial", label: "Pre\xE7o venda n\xE3o residencial", t: "num", sufixo: "R$/m\xB2" }];
var nr = new Set([...Pe, ...we, ...Ce, ...Re, { k: "permuta_fisica_area_m2" }, { k: "permuta_fisica_pct" }, { k: "terreno_manual_area" }].filter((o3) => o3.t === "num" || ["permuta_fisica_area_m2", "permuta_fisica_pct", "terreno_manual_area"].includes(o3.k)).map((o3) => o3.k));
var Tt = (o3) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(o3 || 0);
var U = (o3, e = 0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: e }).format(o3 || 0);
var ut = (o3) => `${(o3 || 0).toFixed(1)}%`;
var k = class extends f {
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
        for (let [a, s] of Object.entries(this.form)) ["id", "id_legivel", "nome_exibicao", "sequencia", "status", "autor_id", "criado_em", "atualizado_em", "membros", "imoveis", "_permissao", "_funcao", "autor_nome", "autor_avatar_url"].includes(a) || (nr.has(a) ? t[a] = s === "" || s == null ? null : Number(s) : t[a] = s);
        let r = await pe(this.estudo.id, t);
        if (r?.erro) {
          n.notificar(r.mensagem || "Erro ao salvar", "erro");
          return;
        }
        n.notificar("Premissas salvas.", "sucesso");
      } catch (t) {
        n.notificar(t?.message || "Erro ao salvar", "erro");
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
        let [t, r] = await Promise.all([lt(this.estudo.tipo_empreendimento), Ae()]);
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
    let t = this.estudo.tipo_empreendimento === "loteamento", r = t ? Ce : Re, a = Pe.filter((i) => !i.so || i.so === this.estudo.tipo_empreendimento), s = !this.editavel;
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
          <div class="grid">${we.map((i) => this._input(i, s || i.k === "imposto_percentual" && !!this.form.sujeito_ret))}</div>
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
        ${r.map((l) => c`<button class=${i === l.v ? "on" : ""} ?disabled=${s} @click=${() => this._set(t, l.v)}>${l.l}</button>`)}
      </div>
    </div>`;
  }
  _benchmark(t) {
    return this.benchmarks.find((r) => r.campo === t);
  }
  _renderResumo(t) {
    let r = Nt(this._entradaProforma()), a = [];
    if (t) {
      let l = this._benchmark("eficiencia_aproveitamento");
      a.push({ rot: "\xC1rea da gleba", val: `${U(r.areaTerreno)} m\xB2` }, { rot: "\xC1rea vend\xE1vel", val: `${U(r.areaVendavel)} m\xB2` }, { rot: "Vend\xE1vel / gleba", val: ut(r.eficienciaPct), bm: l ? { ok: r.eficienciaPct >= Number(l.valor) } : void 0 }, { rot: "VGV", val: Tt(r.vgv) }, { rot: "N\xBA de lotes", val: U(r.numUnidades) }, { rot: "Margem l\xEDquida", val: ut(r.margemLiquidaPct) });
    } else {
      let l = this._benchmark("custo_obras_vgv"), u = this._benchmark("margem_liquida");
      a.push({ rot: "\xC1rea privativa total", val: `${U(r.areaPrivativa)} m\xB2` }, { rot: "\xC1rea constru\xEDda", val: `${U(r.areaConstruida)} m\xB2` }, { rot: "N\xBA de unidades", val: U(r.numUnidades) }, { rot: "Pre\xE7o m\xE9dio/unid.", val: Tt(r.precoMedioUnidade) }, { rot: "Custo obras / VGV", val: ut(r.custoObrasVgvPct), bm: l ? { ok: r.custoObrasVgvPct <= Number(l.valor) } : void 0 }, { rot: "Margem l\xEDquida", val: ut(r.margemLiquidaPct), bm: u ? { ok: r.margemLiquidaPct >= Number(u.valor) } : void 0 });
    }
    let s = this._benchmark("resultado_final"), i = null;
    return s && Number(s.valor) > 0 && (i = Se(this._entradaProforma(), Number(s.valor))), c`
      <div class="card" style="margin-top:16px">
        <h3 style="margin-top:0">Resumo</h3>
        <div class="kpis">
          ${a.map((l) => c`
            <div class="kpi ${l.bm ? l.bm.ok ? "ok" : "ruim" : ""}">
              <div class="rot">${l.rot}</div>
              <div class="val">${l.val}</div>
            </div>
          `)}
        </div>
        ${s ? c`
          <div class="preco-sugerido">
            Preço sugerido/m² para atingir o piso de resultado final (${U(Number(s.valor))}%):
            <strong>${i !== null ? Tt(i) + "/m\xB2" : "inating\xEDvel com as premissas atuais"}</strong>
          </div>
        ` : c`<p class="sec" style="margin-top:12px">Defina o benchmark “resultado_final” para calcular o preço sugerido/m².</p>`}
      </div>
    `;
  }
};
k.styles = [R, x`
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
  `], p([w({ attribute: false })], k.prototype, "estudo", 2), p([w({ type: Boolean })], k.prototype, "editavel", 2), p([_()], k.prototype, "form", 2), p([_()], k.prototype, "salvando", 2), p([_()], k.prototype, "benchmarks", 2), p([_()], k.prototype, "aliquotaRet", 2), k = p([S("viab-tela-premissas")], k);
var Me = ["leitor", "editor", "aprovador"];
var y = class extends f {
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
        let t = await me(this.estudoId);
        t?.erro ? (n.notificar(t.mensagem || "Sem acesso", "erro"), this.estudo = null) : (this.estudo = t, this.membros = t.membros || []);
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
            <span class="badge ${r}">${j[r] || r}</span>
            <span class="sec">${F[this.estudo.tipo_empreendimento] || this.estudo.tipo_empreendimento}</span>
            ${t.funcao ? c`<span class="sec">· sua função: ${t.funcao}</span>` : h}
          </div>
        </div>
        <div class="acoes-status">${this._renderAcoesStatus(t, r)}</div>
      </div>

      <div class="abas">
        ${["premissas", "proforma", "graficos"].map((a) => c`
          <button class="aba ${this.aba === a ? "ativa" : ""}" @click=${() => this.aba = a}>
            ${a === "premissas" ? "Premissas" : a === "proforma" ? "Proforma" : "Gr\xE1ficos"}
          </button>
        `)}
      </div>

      ${this.aba === "premissas" ? this._renderPremissas(t) : h}
      ${this.aba === "proforma" ? c`<div class="placeholder">Proforma — cálculos e sensibilidade chegam na Etapa 5/6.</div>` : h}
      ${this.aba === "graficos" ? c`<div class="placeholder">Gráficos — visualizações chegam na Etapa 6.</div>` : h}
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
                    ${Me.map((s) => c`<option value=${s} ?selected=${s === a.funcao}>${s}</option>`)}
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
              ${Me.map((a) => c`<option value=${a}>${a}</option>`)}
            </select>
            <button class="btn-sec btn-sm" @click=${this._adicionarMembro}>Adicionar</button>
          </div>` : h}
      </div>
    `;
  }
  async _carregarUsuarios() {
    if (!(this.usuarios.length > 0)) try {
      this.usuarios = await ke();
    } catch (t) {
      console.error(t);
    }
  }
  async _status(t) {
    if (!((t === "aprovado" || t === "reprovado") && !confirm(`Confirma ${{ aprovado: "aprovar", reprovado: "reprovar", rascunho: "devolver ao rascunho", em_analise: "submeter" }[t]} este estudo?`))) try {
      let a = await be(this.estudoId, t);
      if (a?.erro) {
        n.notificar(a.mensagem || "Transi\xE7\xE3o n\xE3o permitida", "erro");
        return;
      }
      n.notificar(`Status alterado para ${j[t] || t}.`, "sucesso"), this._carregar();
    } catch (a) {
      n.notificar(a?.message || "Erro na transi\xE7\xE3o", "erro");
    }
  }
  async _adicionarMembro() {
    let t = this.renderRoot.querySelector("#sel-usuario"), r = this.renderRoot.querySelector("#sel-funcao"), a = parseInt(t?.value || ""), s = r?.value || "leitor";
    if (!a) {
      n.notificar("Selecione um usu\xE1rio.", "alerta");
      return;
    }
    try {
      let i = await ve(this.estudoId, a, s);
      if (i?.erro) {
        n.notificar(i.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await ct(this.estudoId))?.dados || this.membros, n.notificar("Membro adicionado.", "sucesso");
    } catch (i) {
      n.notificar(i?.message || "Erro", "erro");
    }
  }
  async _alterarFuncao(t, r) {
    try {
      let a = await ge(this.estudoId, t, r);
      if (a?.erro) {
        n.notificar(a.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await ct(this.estudoId))?.dados || this.membros;
    } catch (a) {
      n.notificar(a?.message || "Erro", "erro");
    }
  }
  async _removerMembro(t) {
    try {
      let r = await fe(this.estudoId, t);
      if (r?.erro) {
        n.notificar(r.mensagem || "Erro", "erro");
        return;
      }
      this.membros = (await ct(this.estudoId))?.dados || this.membros;
    } catch (r) {
      n.notificar(r?.message || "Erro", "erro");
    }
  }
};
y.styles = [R, x`
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
  `], p([w({ type: Number })], y.prototype, "estudoId", 2), p([_()], y.prototype, "estudo", 2), p([_()], y.prototype, "carregando", 2), p([_()], y.prototype, "aba", 2), p([_()], y.prototype, "membros", 2), p([_()], y.prototype, "usuarios", 2), p([_()], y.prototype, "mostrarMembros", 2), y = p([S("viab-tela-estudo")], y);
var M = class extends f {
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
      let t = await lt(this.tipo);
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
    }}>${F[t]}</button>
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
      let a = await xe(t, r);
      if (a?.erro) {
        n.notificar(a.mensagem || "Erro ao salvar", "erro");
        return;
      }
    } catch (a) {
      n.notificar(a?.message || "Erro", "erro");
    }
  }
  async _remover(t) {
    if (confirm("Remover este benchmark?")) try {
      let r = await ye(t);
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
      let r = await $e({ tipo_empreendimento: this.tipo, campo: t.trim(), regra_comparacao: "atingir_ou_superar" });
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
      let t = await Ee();
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
M.styles = [R, x`
    :host { padding: 16px; }
    .abas { display: flex; gap: 4px; margin-bottom: 16px; }
    .aba { padding: 8px 14px; background: none; border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
           border-radius: 6px; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; cursor: pointer; }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-color: var(--cor-primaria-solida, #2AA9E0); }
    .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    td input, td select { width: 100%; box-sizing: border-box; }
    td.num input { max-width: 90px; }
  `], p([_()], M.prototype, "tipo", 2), p([_()], M.prototype, "itens", 2), p([_()], M.prototype, "carregando", 2), M = p([S("viabilidade-config-benchmarks")], M);
function Ne(o3) {
  let e = (o3 || "").replace(/^\//, "").split("/").filter(Boolean);
  if (e[0] === "detalhe" && e[1]) {
    let t = parseInt(e[1]);
    if (!isNaN(t)) return { tela: "estudo", estudoId: t };
  }
  return e[0] === "terrenos" ? { tela: "dashboard", aba: "terrenos" } : { tela: "dashboard", aba: "estudos" };
}
var B = class extends f {
  constructor() {
    super(...arguments);
    this.rota = { tela: "dashboard", aba: "estudos" };
  }
  connectedCallback() {
    super.connectedCallback(), this.rota = Ne(n.subRota()), this._cleanupRota = n.escutarRota((t) => {
      this.rota = Ne(t);
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._cleanupRota?.();
  }
  render() {
    return this.rota.tela === "estudo" ? c`<viab-tela-estudo .estudoId=${this.rota.estudoId || 0}></viab-tela-estudo>` : c`<viab-tela-dashboard .aba=${this.rota.aba || "estudos"}></viab-tela-dashboard>`;
  }
};
B.styles = x`
    :host {
      display: block;
      min-height: 100%;
      background: var(--cor-fundo, #0D1B2A);
      color: var(--cor-texto, rgba(255, 255, 255, 0.85));
    }
  `, p([_()], B.prototype, "rota", 2), B = p([S("app-viabilidade")], B);

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
