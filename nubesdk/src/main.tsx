/**
 * FixYou — widget de vitrine (NubeSDK), DUAL-MODE por tema.
 *
 *  Campos nativos (Nome + selects) + preview no slot before_product_detail_add_to_cart.
 *  A personalização fica no asyncLocalStorage (sobrevive às páginas).
 *
 *  MODO GATE (temas que roteiam o add pelo NubeSDK, ex.: Ipanema) — igual Alugue Mais:
 *    intercepta o "Comprar" nativo no cart:before_update, cancela o add do nosso
 *    produto e, se completo, re-adiciona com as `properties` (num tick, flag selfAdd).
 *    Incompleto → cancela (não entra sem personalizar). Relabel do botão.
 *    As properties chegam ao carrinho/pedido por item (nativo).
 *
 *  MODO CHECKOUT (temas em que o add NÃO passa pelo before_update, ex.: Brasília):
 *    não dá pra bloquear o add. O dado vai ao pedido por `order:add:extra` e o
 *    cart:validate TRAVA o checkout se faltar personalização.
 *
 *  Detecção: `state.store.theme`. Default seguro = modo CHECKOUT (nunca duplica).
 */
import { Box, Column, Row, Text, Field, Select, Image } from "@tiendanube/nube-sdk-jsx";
import type { NubeSDK, NubeSDKState } from "@tiendanube/nube-sdk-types";

declare const NUBE_API_BASE: string;
const API_BASE: string =
  typeof NUBE_API_BASE !== "undefined" && NUBE_API_BASE ? NUBE_API_BASE : "https://api.fixyou.nuvempro.com";

const SLOT = "before_product_detail_add_to_cart";
const CART_SLOT = "before_line_item";
const TEXT_LABEL = "Nome";

// Temas onde o cancelamento do add via cart:before_update FUNCIONA (gate).
// Fora desta lista → modo checkout (seguro). Expanda conforme validar novos temas.
const GATE_THEMES = ["ipanema"];

const DEBUG = false;
function log(...args: any[]) { if (DEBUG) { try { console.log("[FixYou]", ...args); } catch (_e) { /* noop */ } } }

const OK = "#15803d";
const ERR = "#b91c1c";
const MUTED = "#6b7280";
const TEXT = "#111827";

const FIELD_ORDER = ["fontes", "coresDeFonte", "icones", "imagensDeFundo", "conjuntosDeCores", "patterns"];
const LABELS: Record<string, string> = {
  fontes: "Fonte", coresDeFonte: "Cor de fonte", icones: "Ícone",
  imagensDeFundo: "Imagem de fundo", conjuntosDeCores: "Conjunto de cores", patterns: "Pattern",
};
const IMG_PARAM: Record<string, string> = {
  fontes: "fonte", coresDeFonte: "corDeFonte", icones: "icone",
  imagensDeFundo: "fundo", conjuntosDeCores: "conjuntoDeCores", patterns: "pattern",
};

type Campo = { id: number | string; titulo: string; posicao?: number };
type Config = { enabled: boolean; modelo?: number; campos?: Record<string, Campo[]> };
type Saved = { productName: string; props: Record<string, string> };
type BUPayload = {
  request_id?: string;
  action?: string;
  item?: { product_id?: number; variant_id?: number | null; previous_quantity?: number; new_quantity?: number };
};

// ─── estado ───────────────────────────────────────────────────────────────────
let nube: NubeSDK;
let storeId = "";
let productId = "";
let productName = "";
let variantId: number | null = null;
let config: Config | null = null;
let texto = "";
let sel: Record<string, string> = {};
let msg = "";
let tone: "ok" | "err" | "muted" = "muted";
let addedMsg = "";
let selfAdd = false;
let gateMode = false;
const personalizableIds = new Set<number>();
let data: Record<string, Saved> = {}; // productId -> { productName, props }

// ─── storage ─────────────────────────────────────────────────────────────────────
function sstore() { return nube.getBrowserAPIs().asyncLocalStorage; }
function storageKey() { return "fixyou_" + storeId; }
async function loadStore() {
  try { const raw = await sstore().getItem(storageKey()); if (raw) data = JSON.parse(raw) || {}; } catch (_e) { /* noop */ }
}
function persist() { try { sstore().setItem(storageKey(), JSON.stringify(data)); } catch (_e) { /* noop */ } }
// DEBUG: o worker grava o estado no localStorage (legível da página via Chrome).
function writeDebug(extra?: any) {
  if (!DEBUG) return;
  try {
    sstore().setItem("fixyou_debug", JSON.stringify({
      t: new Date().toISOString(), gateMode,
      personalizableIds: Array.from(personalizableIds), dataKeys: Object.keys(data),
      ...(extra || {}),
    }));
  } catch (_e) { /* noop */ }
}

// ─── helpers ────────────────────────────────────────────────────────────────────
function activeCampos(): string[] {
  const c = config?.campos || {};
  return FIELD_ORDER.filter((cat) => Array.isArray(c[cat]) && c[cat].length > 0);
}
function complete(): boolean {
  if (!texto.trim()) return false;
  return activeCampos().every((cat) => !!sel[cat]);
}
function buildProps(): Record<string, string> {
  const props: Record<string, string> = {};
  props[TEXT_LABEL] = texto.trim();
  for (const cat of activeCampos()) {
    const it = (config!.campos as Record<string, Campo[]>)[cat].find((x) => String(x.id) === sel[cat]);
    if (it) props[LABELS[cat]] = it.titulo;
  }
  return props;
}
function previewUrl(): string {
  let u = API_BASE + "/storefront/" + storeId + "/products/" + productId +
    "/personalized-image?texto=" + encodeURIComponent(texto.trim());
  for (const cat of activeCampos()) if (sel[cat]) u += "&" + IMG_PARAM[cat] + "=" + encodeURIComponent(sel[cat]);
  return u;
}
async function getJSON(url: string): Promise<any | null> {
  try { const r = await fetch(url); if (!r || !r.ok) return null; return await r.json(); } catch (_e) { return null; }
}

function saveCurrent() {
  if (!productId) return;
  if (complete()) data[productId] = { productName, props: buildProps() };
  else delete data[productId];
  persist();
  log("saveCurrent pid=", productId, "complete=", complete(), "dataKeys=", Object.keys(data));
  pushExtra();
}

// ─── order:add:extra (só no modo checkout; no gate as properties já vão na linha) ─
function pushExtra() {
  if (gateMode) return;
  try {
    const items: any[] = (nube.getState().cart as any)?.items || [];
    const inCart = Object.keys(data).filter((p) =>
      Object.keys(data[p].props || {}).length && items.some((it) => String(it.product_id) === p));
    if (!inCart.length) { log("pushExtra vazio"); return; }
    const multi = inCart.length > 1;
    const extra: Record<string, string> = {};
    for (const p of inCart) {
      const sd = data[p];
      for (const k of Object.keys(sd.props)) {
        const label = multi && sd.productName ? sd.productName + " · " + k : k;
        extra[label] = String(sd.props[k]);
      }
    }
    log("pushExtra ENVIADO extra=", JSON.stringify(extra));
    nube.send("order:add:extra", (() => ({ order: { extra } })) as any);
  } catch (_e) { /* noop */ }
}

// ─── botão nativo: relabel (só no modo gate, onde o add é controlável) ───────────
function customization(): any {
  try { return nube.api && (nube.api as any).getCustomization ? (nube.api as any).getCustomization() : null; } catch (_e) { return null; }
}
function relabelNativeButton() {
  if (!gateMode || !config || !config.enabled) return;
  const c = customization();
  if (c && typeof c.set === "function") {
    try { c.set("add-to-cart-button", { text: complete() ? "Adicionar ao carrinho" : "Preencha a personalização" }); } catch (_e) { /* noop */ }
  }
}
function resetNativeButton() {
  if (!gateMode) return;
  const c = customization();
  if (c && typeof c.reset === "function") { try { c.reset("add-to-cart-button"); } catch (_e) { /* noop */ } }
}

// ─── gate (modo gate): cancela o add nativo + re-adiciona com properties ─────────
function respond(requestId: string, proceed: boolean) {
  nube.send("cart:before_update:result", (() => ({ eventPayload: { request_id: requestId, proceed } })) as any);
}
function gate(st: NubeSDKState) {
  const payload = (st && (st as any).eventPayload) as BUPayload | null;
  const requestId = payload && payload.request_id;
  if (!requestId) return;

  if (selfAdd) { respond(requestId, true); return; }
  if (!payload || payload.action !== "ADD" || !config || !config.enabled) { respond(requestId, true); return; }
  const pid = payload.item && payload.item.product_id;
  if (pid != null && String(pid) !== productId) { respond(requestId, true); return; }

  respond(requestId, false); // cancela o add nativo

  if (!complete()) {
    addedMsg = ""; msg = "⚠ Preencha a personalização para adicionar ao carrinho."; tone = "err"; renderBlock();
    log("gate: incompleto → CANCELADO");
    return;
  }

  const prev = (payload.item && payload.item.previous_quantity) || 0;
  const next = (payload.item && payload.item.new_quantity) || prev + 1;
  const q = Math.max(1, next - prev);
  const v = payload.item?.variant_id ?? variantId ?? undefined;
  const props = buildProps();
  log("gate: completo → re-adiciona q=", q);

  setTimeout(() => {
    selfAdd = true;
    const item: any = { product_id: Number(productId), quantity: q, properties: props };
    if (v) item.variant_id = v;
    nube.send("cart:add", (() => ({ cart: { items: [item] } })) as any);
    setTimeout(() => { selfAdd = false; }, 1200);
  }, 0);

  addedMsg = "✓ Adicionado ao carrinho"; msg = ""; renderBlock();
}

// ─── checkout gate (ambos os modos) ───────────────────────────────────────────────
function setupValidation() {
  try {
    nube.send("cart:validate", ((s: any) => {
      try {
        const items: any[] = (s.cart && s.cart.items) || [];
        if (!personalizableIds.size) return { cart: { validation: { status: "success" } } };
        const missing = items.some((it) =>
          personalizableIds.has(Number(it.product_id)) &&
          !(data[String(it.product_id)] && Object.keys(data[String(it.product_id)].props || {}).length));
        log("validate items=", items.map((it: any) => it.product_id), "dataKeys=", Object.keys(data), "=> missing=", missing);
        writeDebug({ ev: "validate", items: items.map((it: any) => it.product_id), missing });
        return { cart: { validation: missing ? { status: "fail", reason: "Personalize os produtos antes de finalizar a compra." } : { status: "success" } } };
      } catch (_e) {
        return { cart: { validation: { status: "success" } } };
      }
    }) as any);
    log("cart:validate registrado");
  } catch (_e) { /* noop */ }
}
async function loadPersonalizableIds() {
  const d = await getJSON(API_BASE + "/storefront/" + storeId + "/personalizable-ids");
  if (d && Array.isArray(d.ids)) for (const x of d.ids) personalizableIds.add(Number(x));
  log("personalizable-ids=", Array.from(personalizableIds));
  writeDebug({ ev: "ids-loaded", idsResp: d });
}

// ─── painel: campos + preview ────────────────────────────────────────────────────
function labeledField(label: string, node: any) {
  return (
    <Column style={{ gap: "4px", width: "100%" } as any}>
      <Text style={{ fontSize: "13px", color: MUTED, fontWeight: "600" } as any}>{label}</Text>
      {node}
    </Column>
  );
}
function buildBlock() {
  const kids: any[] = [];
  kids.push(<Text style={{ fontSize: "15px", fontWeight: "700", color: TEXT } as any}>Personalize seu produto</Text>);

  kids.push(labeledField(
    TEXT_LABEL + " *",
    <Field name="fx-nome" label="" value={texto}
      onChange={((d: any) => { texto = String(d.value ?? ""); relabelNativeButton(); }) as any}
      onBlur={(() => { saveCurrent(); renderBlock(); }) as any} />,
  ));

  for (const cat of activeCampos()) {
    const opts = (config!.campos as Record<string, Campo[]>)[cat].map((it) => ({ label: it.titulo, value: String(it.id) }));
    kids.push(labeledField(
      LABELS[cat] + " *",
      <Select name={"fx-" + cat} label="" value={sel[cat] || ""} options={opts}
        onChange={((d: any) => { sel[cat] = String(d.value ?? ""); saveCurrent(); renderBlock(); }) as any} />,
    ));
  }

  if (complete()) {
    kids.push(<Image src={previewUrl()} alt="Pré-visualização da personalização"
      style={{ maxWidth: "100%", height: "auto", borderRadius: "8px", marginTop: "2px" } as any} />);
  }

  const color = tone === "ok" ? OK : tone === "err" ? ERR : MUTED;
  if (addedMsg) kids.push(<Text style={{ fontSize: "14px", color: OK, fontWeight: "700" } as any}>{addedMsg}</Text>);
  else if (msg) kids.push(<Text style={{ fontSize: "13px", color, fontWeight: tone === "err" ? "700" : "400" } as any}>{msg}</Text>);
  else if (complete()) kids.push(<Text style={{ fontSize: "13px", color: OK } as any}>✓ Personalização pronta.</Text>);
  else kids.push(<Text style={{ fontSize: "13px", color: MUTED } as any}>{gateMode ? "Preencha os campos — obrigatório para finalizar a compra." : "Preencha os campos para personalizar seu produto."}</Text>);

  return (
    <Column style={{ gap: "12px", padding: "12px 0", width: "100%", maxWidth: "420px", boxSizing: "border-box" } as any}>
      {kids}
    </Column>
  );
}
function renderBlock() {
  if (!config || !config.enabled) { try { nube.clearSlot(SLOT as any); } catch (_e) { /* noop */ } return; }
  try { nube.render(SLOT as any, buildBlock()); } catch (_e) { /* noop */ }
  relabelNativeButton();
}

// ─── carrinho: personalização por item via before_line_item (lê do storage) ──────
async function renderCart() {
  try {
    const api: any = nube.api;
    if (!api || !api.getAvailableSlots) return;
    const all = await api.getAvailableSlots().getStatic();
    const lineSlots = (all || []).filter((s: any) => s.slotId === CART_SLOT && s.isRepeatable && s.pick != null);
    if (!lineSlots.length) return;
    const items: any[] = (nube.getState().cart as any)?.items || [];
    for (const slot of lineSlots) {
      const item = items.find((i) => String(i.id) === String(slot.pick) || String(i.product_id) === String(slot.pick));
      const sd = item ? data[String(item.product_id)] : null;
      if (sd && Object.keys(sd.props).length) {
        const rows = Object.keys(sd.props).map((k) => (
          <Row style={{ gap: "4px" } as any}>
            <Text style={{ fontSize: "12px", fontWeight: "700" } as any}>{k + ":"}</Text>
            <Text style={{ fontSize: "12px" } as any}>{String(sd.props[k])}</Text>
          </Row>
        ));
        nube.render(slot as any, <Column style={{ gap: "2px", marginTop: "4px", marginBottom: "4px" } as any}>{rows}</Column>);
      } else {
        try { nube.clearSlot(slot as any); } catch (_e) { /* noop */ }
      }
    }
  } catch (_e) { /* noop */ }
}
function scheduleCart() { renderCart(); setTimeout(renderCart, 300); setTimeout(renderCart, 900); }

// ─── página de produto ───────────────────────────────────────────────────────────
async function initProduct(product: any) {
  productId = String(product.id);
  productName = String(product.name || product.title || "").trim() || productId;
  const vs: any[] = (product && product.variants) || [];
  variantId = vs.length ? Number(vs[0].id) : null;
  texto = ""; sel = {}; msg = ""; tone = "muted"; addedMsg = ""; config = null;

  const cfg = await getJSON(API_BASE + "/storefront/" + storeId + "/products/" + productId + "/config");
  config = cfg;
  log("initProduct pid=", productId, "enabled=", cfg && cfg.enabled);
  if (!cfg || !cfg.enabled) { try { nube.clearSlot(SLOT as any); } catch (_e) { /* noop */ } resetNativeButton(); return; }

  for (const cat of activeCampos()) if (!sel[cat]) sel[cat] = String((cfg.campos as Record<string, Campo[]>)[cat][0].id);
  const prev = data[productId];
  if (prev && prev.props) {
    if (prev.props[TEXT_LABEL]) texto = prev.props[TEXT_LABEL];
    for (const cat of activeCampos()) {
      const items = (cfg.campos as Record<string, Campo[]>)[cat];
      const match = items.find((it) => it.titulo === prev.props[LABELS[cat]]);
      if (match) sel[cat] = String(match.id);
    }
  }
  renderBlock();
}
function handleLocation(st: NubeSDKState) {
  try {
    const page: any = st.location && (st.location as any).page;
    if (page && page.type === "product" && page.data && page.data.product) initProduct(page.data.product);
    else { try { nube.clearSlot(SLOT as any); } catch (_e) { /* noop */ } resetNativeButton(); }
  } catch (_e) { /* noop */ }
}

// ─── entry ────────────────────────────────────────────────────────────────────────
export function App(n: NubeSDK) {
  nube = n;
  const st = nube.getState();
  storeId = st.store ? String(st.store.id) : "";
  if (!storeId) return;

  const theme = String((st.store as any).theme || "").toLowerCase();
  gateMode = GATE_THEMES.some((t) => theme.indexOf(t) >= 0);
  log("App init storeId=", storeId, "theme=", theme, "gateMode=", gateMode, "page=", (st.location as any) && (st.location as any).page && (st.location as any).page.type);

  try { nube.send("config:set", (() => ({ config: { has_cart_validation: true, handle_cart_before_update: gateMode } })) as any); } catch (_e) { /* noop */ }
  writeDebug({ ev: "boot", theme, page: (st.location as any) && (st.location as any).page && (st.location as any).page.type });
  setupValidation();

  loadStore().then(() => {
    loadPersonalizableIds();
    handleLocation(st);
    pushExtra();
    scheduleCart();
  });

  if (gateMode) {
    nube.on("cart:before_update", ((s2: NubeSDKState) => { gate(s2); }) as any);
    nube.on("product:variant_selected", ((s2: any) => {
      try {
        const p = (s2 && s2.eventPayload) || {};
        const vid = p.variant_id || p.id || (p.variant && p.variant.id);
        if (vid) variantId = Number(vid);
      } catch (_e) { /* noop */ }
      relabelNativeButton();
    }) as any);
  }

  nube.on("cart:add:success", (() => { pushExtra(); scheduleCart(); }) as any);
  nube.on("cart:update", (() => { pushExtra(); scheduleCart(); }) as any);
  nube.on("cart:view", (() => { scheduleCart(); }) as any);
  nube.on("cart:open", (() => { scheduleCart(); }) as any);
  nube.on("page:loaded", (() => { pushExtra(); scheduleCart(); }) as any);
  nube.on("checkout:ready", (() => { pushExtra(); }) as any);
  nube.on("location:updated", ((s2: NubeSDKState) => { handleLocation(s2); pushExtra(); scheduleCart(); }) as any);
}
