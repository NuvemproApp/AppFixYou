/**
 * FixYou — widget de vitrine (NubeSDK). Tudo nativo, sem iframe.
 * Mesmo padrão validado no Alugue Mais:
 *
 *  UM único botão (o NATIVO do tema): renomeado conforme o estado
 *  ("Preencha a personalização" → "Adicionar ao carrinho").
 *    - O add nativo é SEMPRE cancelado para o produto personalizável
 *      (via `cart:before_update`) — não há "compra normal" sem personalização.
 *    - Quando a personalização está completa, disparamos NOSSO `cart:add` num
 *      tick separado com `properties` (OBJETO { "Nome": "...", "Fonte": "..." })
 *      + a quantidade nativa (delta do payload) + a variante.
 *    - `properties` como OBJETO persiste no item do carrinho E chega ao pedido
 *      (products[].properties) de forma NATIVA — aparece no painel da Nuvemshop
 *      por item, sem webhook/owner_note. (Confirmado em produção no Alugue Mais;
 *      a forma array [{name,value}] NÃO funciona.)
 *  No painel (slot before_product_detail_add_to_cart): os campos (Nome + selects)
 *  + pré-visualização. A quantidade é a nativa do tema.
 *  `before_line_item` (repetível): mostra a personalização em cada item do carrinho.
 *  `cart:validate`: bloqueia o checkout de item personalizável sem personalização.
 */
import { Box, Column, Row, Text, Field, Select, Image } from "@tiendanube/nube-sdk-jsx";
import type { NubeSDK, NubeSDKState } from "@tiendanube/nube-sdk-types";

declare const NUBE_API_BASE: string;
const API_BASE: string =
  typeof NUBE_API_BASE !== "undefined" && NUBE_API_BASE
    ? NUBE_API_BASE
    : "https://api.fixyou.nuvempro.com";

const SLOT = "before_product_detail_add_to_cart";
const TEXT_LABEL = "Nome";

const ACCENT = "#7c3aed";
const OK = "#15803d";
const ERR = "#b91c1c";
const MUTED = "#6b7280";
const BORDER = "#d1d5db";
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
const OUR_LABELS = new Set<string>([TEXT_LABEL, ...Object.values(LABELS)]);

type Campo = { id: number | string; titulo: string; posicao?: number };
type Config = { enabled: boolean; modelo?: number; campos?: Record<string, Campo[]> };
type BUPayload = {
  request_id?: string;
  action?: string;
  item?: { product_id?: number; variant_id?: number | null; previous_quantity?: number; new_quantity?: number };
};

// ─── estado ───────────────────────────────────────────────────────────────────
let nube: NubeSDK;
let storeId = "";
let productId = "";
let variantId: number | null = null;
let config: Config | null = null;
let texto = "";
let sel: Record<string, string> = {};
let msg = "";
let tone: "ok" | "err" | "muted" = "muted";
let addedMsg = "";
let selfAdd = false;
const personalizableIds = new Set<number>();

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
function itemProps(item: any): Record<string, string> | null {
  const p = item && item.properties;
  if (p && !Array.isArray(p) && typeof p === "object") return p as Record<string, string>;
  return null;
}

// ─── painel: campos + preview ────────────────────────────────────────────────────
function buildBlock() {
  const kids: any[] = [];
  kids.push(<Text style={{ fontSize: "15px", fontWeight: "700", color: TEXT } as any}>Personalize seu produto</Text>);

  kids.push(
    <Field
      name="fx-nome"
      label={TEXT_LABEL + " *"}
      value={texto}
      onChange={((d: any) => { texto = String(d.value ?? ""); relabelNativeButton(); }) as any}
      onBlur={(() => { renderBlock(); }) as any}
    />,
  );

  for (const cat of activeCampos()) {
    const opts = (config!.campos as Record<string, Campo[]>)[cat].map((it) => ({ label: it.titulo, value: String(it.id) }));
    kids.push(
      <Select
        name={"fx-" + cat}
        label={LABELS[cat] + " *"}
        value={sel[cat] || ""}
        options={opts}
        onChange={((d: any) => { sel[cat] = String(d.value ?? ""); renderBlock(); }) as any}
      />,
    );
  }

  if (complete()) {
    kids.push(
      <Image src={previewUrl()} alt="Pré-visualização da personalização"
        style={{ maxWidth: "100%", height: "auto", borderRadius: "8px", border: "1px solid " + BORDER } as any} />,
    );
  }

  const color = tone === "ok" ? OK : tone === "err" ? ERR : MUTED;
  if (addedMsg) {
    kids.push(<Text style={{ fontSize: "14px", color: OK, fontWeight: "700" } as any}>{addedMsg}</Text>);
  } else if (msg) {
    kids.push(<Text style={{ fontSize: "13px", color, fontWeight: tone === "err" ? "700" : "400" } as any}>{msg}</Text>);
  } else if (complete()) {
    kids.push(<Text style={{ fontSize: "13px", color: OK } as any}>✓ Pronto! Use o botão de compra acima.</Text>);
  } else {
    kids.push(<Text style={{ fontSize: "13px", color: MUTED } as any}>Preencha os campos para personalizar.</Text>);
  }

  return (
    <Column style={{
      gap: "10px", padding: "14px", border: "1px solid " + BORDER, borderRadius: "14px",
      background: "#ffffff", width: "100%", maxWidth: "360px", boxSizing: "border-box",
      borderTop: "3px solid " + ACCENT,
    } as any}>
      {kids}
    </Column>
  );
}
function renderBlock() {
  if (!config || !config.enabled) { try { nube.clearSlot(SLOT as any); } catch (_e) { /* noop */ } return; }
  try { nube.render(SLOT as any, buildBlock()); } catch (_e) { /* noop */ }
  relabelNativeButton();
}

// ─── botão nativo: relabel conforme o estado ─────────────────────────────────────
function customization(): any {
  try { return nube.api && (nube.api as any).getCustomization ? (nube.api as any).getCustomization() : null; } catch (_e) { return null; }
}
function relabelNativeButton() {
  if (!config || !config.enabled) return;
  const c = customization();
  if (c && typeof c.set === "function") {
    try { c.set("add-to-cart-button", { text: complete() ? "Adicionar ao carrinho" : "Preencha a personalização" }); } catch (_e) { /* noop */ }
  }
}
function resetNativeButton() {
  const c = customization();
  if (c && typeof c.reset === "function") { try { c.reset("add-to-cart-button"); } catch (_e) { /* noop */ } }
}

// ─── intercepta o botão nativo: cancela sempre + adiciona com properties ──────────
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

  // produto personalizável → SEMPRE cancela o add nativo
  respond(requestId, false);

  if (!complete()) {
    addedMsg = ""; msg = "⚠ Preencha a personalização acima para adicionar ao carrinho."; tone = "err"; renderBlock();
    return;
  }

  // quantidade = delta do seletor nativo (os absolutos do payload são instáveis)
  const prev = (payload.item && payload.item.previous_quantity) || 0;
  const next = (payload.item && payload.item.new_quantity) || prev + 1;
  const q = Math.max(1, next - prev);
  const v = payload.item?.variant_id ?? variantId ?? undefined;
  const props = buildProps();

  setTimeout(() => {
    selfAdd = true;
    const item: any = { product_id: Number(productId), quantity: q, properties: props };
    if (v) item.variant_id = v;
    nube.send("cart:add", (() => ({ cart: { items: [item] } })) as any);
    setTimeout(() => { selfAdd = false; }, 1200);
  }, 0);

  addedMsg = "✓ Adicionado ao carrinho"; msg = ""; renderBlock(); // feedback otimista
}

// ─── carrinho: mostra a personalização em cada item (before_line_item) ────────────
async function renderCartProps() {
  try {
    const api: any = nube.api;
    if (!api || !api.getAvailableSlots) return;
    const all = await api.getAvailableSlots().getStatic();
    const lineSlots = (all || []).filter((s: any) => s.slotId === "before_line_item" && s.isRepeatable && s.pick != null);
    if (!lineSlots.length) return;
    const items: any[] = (nube.getState().cart as any)?.items || [];
    for (const slot of lineSlots) {
      const item = items.find((i) => String(i.id) === String(slot.pick) || String(i.product_id) === String(slot.pick));
      const props = item ? itemProps(item) : null;
      const ours = props && Object.keys(props).some((k) => OUR_LABELS.has(k));
      if (ours) {
        const rows = Object.keys(props!)
          .filter((k) => OUR_LABELS.has(k))
          .map((k) => (
            <Row style={{ gap: "4px" } as any}>
              <Text style={{ fontSize: "12px", fontWeight: "700" } as any}>{k + ":"}</Text>
              <Text style={{ fontSize: "12px" } as any}>{String(props![k])}</Text>
            </Row>
          ));
        nube.render(slot as any, <Column style={{ gap: "2px", marginTop: "4px", marginBottom: "4px" } as any}>{rows}</Column>);
      } else {
        try { nube.clearSlot(slot as any); } catch (_e) { /* noop */ }
      }
    }
  } catch (_e) { /* noop */ }
}
function scheduleCartProps() {
  renderCartProps();
  setTimeout(renderCartProps, 250);
  setTimeout(renderCartProps, 700);
  setTimeout(renderCartProps, 1500);
}

// ─── checkout: bloqueia item personalizável sem personalização (backstop) ─────────
function setupValidation() {
  try {
    nube.send("cart:validate", ((s: any) => {
      try {
        if (!personalizableIds.size) return { cart: { validation: { status: "success" } } };
        const items: any[] = (s.cart && s.cart.items) || [];
        const missing = items.some((it) => {
          if (!personalizableIds.has(Number(it.product_id))) return false;
          const p = itemProps(it);
          return !(p && String(p[TEXT_LABEL] || "").length > 0);
        });
        return { cart: { validation: missing ? { status: "fail", reason: "Personalize os produtos antes de finalizar a compra." } : { status: "success" } } };
      } catch (_e) {
        return { cart: { validation: { status: "success" } } };
      }
    }) as any);
  } catch (_e) { /* noop */ }
}
async function loadPersonalizableIds() {
  const data = await getJSON(API_BASE + "/storefront/" + storeId + "/personalizable-ids");
  if (data && Array.isArray(data.ids)) for (const x of data.ids) personalizableIds.add(Number(x));
  setupValidation();
}

// ─── página de produto ───────────────────────────────────────────────────────────
async function initProduct(product: any) {
  productId = String(product.id);
  const vs: any[] = (product && product.variants) || [];
  variantId = vs.length ? Number(vs[0].id) : null;
  texto = ""; sel = {}; msg = ""; tone = "muted"; addedMsg = ""; config = null;

  const data = await getJSON(API_BASE + "/storefront/" + storeId + "/products/" + productId + "/config");
  config = data;
  if (!data || !data.enabled) { try { nube.clearSlot(SLOT as any); } catch (_e) { /* noop */ } resetNativeButton(); return; }

  for (const cat of activeCampos()) if (!sel[cat]) sel[cat] = String((data.campos as Record<string, Campo[]>)[cat][0].id);
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
  try {
    nube.send("config:set", (() => ({ config: { has_cart_validation: true, handle_cart_before_update: true } })) as any);
  } catch (_e) { /* noop */ }

  const st = nube.getState();
  storeId = st.store ? String(st.store.id) : "";
  if (!storeId) return;

  nube.on("product:variant_selected", ((s2: any) => {
    try {
      const p = (s2 && s2.eventPayload) || {};
      const vid = p.variant_id || p.id || (p.variant && p.variant.id);
      if (vid) variantId = Number(vid);
    } catch (_e) { /* noop */ }
    relabelNativeButton();
  }) as any);

  nube.on("cart:before_update", ((s2: NubeSDKState) => { gate(s2); }) as any);
  nube.on("cart:add:success", (() => {
    if (config && config.enabled) { addedMsg = "✓ Adicionado ao carrinho"; msg = ""; renderBlock(); }
    scheduleCartProps();
  }) as any);
  nube.on("cart:update", (() => { scheduleCartProps(); }) as any);
  nube.on("cart:view", (() => { scheduleCartProps(); }) as any);
  nube.on("cart:open", (() => { scheduleCartProps(); }) as any);
  nube.on("page:loaded", (() => { scheduleCartProps(); }) as any);

  loadPersonalizableIds();
  handleLocation(st);
  scheduleCartProps();
  nube.on("location:updated", ((s2: NubeSDKState) => { handleLocation(s2); scheduleCartProps(); }) as any);
}
