import type { NubeSDK, NubeSDKState } from "@tiendanube/nube-sdk-types";
import { box, field, select, img, text } from "@tiendanube/nube-sdk-ui";

/**
 * FixYou — app NubeSDK (worker), modo NATIVO inline.
 *
 * Fluxo (sem botão próprio — usa o "Comprar" nativo do tema):
 *  1. PDP: injeta os campos de personalização (Nome + selects por categoria) +
 *     pré-visualização no slot after_product_detail_add_to_cart. NÃO renderiza
 *     botão de compra — quem adiciona ao carrinho é o botão "Comprar" nativo do
 *     tema (com o seletor de quantidade). A cada alteração, a personalização é
 *     salva no asyncLocalStorage (chave por produto).
 *  2. Carrinho: lê o asyncLocalStorage e renderiza um bloco com a personalização
 *     de cada item no slot after_line_items — o cliente vê o que personalizou.
 *  3. Checkout: grava a personalização como metadado do pedido via
 *     `order:add:extra` (canal oficial de apps parceiros) e dispara a captura
 *     no backend (pending) — o webhook order/created concilia e escreve um
 *     resumo por item no owner_note (visível no painel da Nuvemshop).
 *
 * Por que não properties de linha? O `cart:add` do NubeSDK NÃO encaminha
 * `properties` ao carrinho/pedido (verificado ao vivo: o item fica sem o
 * campo). `window.LS.addToCartEnhanced` (usado no clássico) não existe no
 * worker. Portanto a personalização trafega por storage + order:add:extra +
 * owner_note, que são os canais nativos disponíveis.
 */

const BACKEND = "https://api.fixyou.nuvempro.com";
const PDP_SLOT = "after_product_detail_add_to_cart";
const CART_SLOT = "after_line_items";
const TEXT_LABEL = "Nome";
const TTL = 7200; // 2h

const PERSO_KEY = (pid: number | string) => "fx:perso:" + pid;
const CAP_KEY = (pid: number | string) => "fx:cap:" + pid;

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
type Saved = { texto: string; props: Record<string, string> };

export function App(nube: NubeSDK) {
  const ls = nube.getBrowserAPIs().asyncLocalStorage;

  // ---- estado da PDP ----
  let storeId: number | undefined;
  let productId: number | undefined;
  let customerId: number | null | undefined;
  let config: Config | null = null;
  let texto = "";
  let sel: Record<string, string> = {}; // categoria -> id do item (string)

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
    let u = BACKEND + "/storefront/" + storeId + "/products/" + productId +
      "/personalized-image?texto=" + encodeURIComponent(texto.trim());
    for (const cat of activeCampos()) {
      if (sel[cat]) u += "&" + IMG_PARAM[cat] + "=" + encodeURIComponent(sel[cat]);
    }
    return u;
  }

  // Salva a personalização atual no storage (fonte da verdade cross-página).
  // Reseta o flag de captura para que a nova versão seja reenviada ao backend.
  function persist() {
    if (!productId || !complete()) return;
    const payload: Saved = { texto: texto.trim(), props: buildProps() };
    void ls.setItem(PERSO_KEY(productId), JSON.stringify(payload), TTL).catch(() => {});
    void ls.removeItem(CAP_KEY(productId)).catch(() => {});
  }

  // ---- PDP: campos + preview (SEM botão — compra é o "Comprar" nativo) ----
  function pdpView() {
    if (!config || !config.enabled) return null;
    const children: any[] = [];

    children.push(field({
      name: "fx-nome",
      label: TEXT_LABEL + " *",
      value: texto,
      onChange: (d) => { texto = String(d.value ?? ""); },
      onBlur: () => { renderPDP(); persist(); },
    }));

    for (const cat of activeCampos()) {
      const options = (config.campos as Record<string, Campo[]>)[cat].map((it) => ({
        label: it.titulo, value: String(it.id),
      }));
      children.push(select({
        name: "fx-" + cat,
        label: LABELS[cat] + " *",
        value: sel[cat] || "",
        options,
        onChange: (d) => { sel[cat] = String(d.value ?? ""); renderPDP(); persist(); },
      }));
    }

    if (complete()) {
      children.push(img({
        src: previewUrl(),
        alt: "Pré-visualização da personalização",
        style: { maxWidth: "100%", height: "auto", borderRadius: "6px" },
      }));
      children.push(text({
        children: "✓ Personalização pronta — clique em COMPRAR acima para adicionar ao carrinho.",
        color: "#15803d",
        style: { fontSize: "13px" },
      }));
    } else {
      children.push(text({
        children: "Preencha os campos acima para personalizar este produto.",
        style: { fontSize: "13px", opacity: "0.7" },
      }));
    }

    return box({
      style: { display: "flex", flexDirection: "column", gap: "10px", padding: "12px 0" },
      children,
    });
  }

  function renderPDP() {
    const v = pdpView();
    if (v) nube.render(PDP_SLOT, v);
    else nube.clearSlot(PDP_SLOT);
  }

  async function loadPDP(s: any) {
    try {
      const page = s?.location?.page;
      const pid = Number(page?.data?.product?.id);
      if (!pid) { config = null; nube.clearSlot(PDP_SLOT); return; }
      if (pid !== productId) { // produto novo → reseta
        productId = pid; config = null; texto = ""; sel = {};
      }

      const cfg: Config = await fetch(
        BACKEND + "/storefront/" + storeId + "/products/" + productId + "/config"
      ).then((r) => r.json());
      config = cfg;

      if (config && config.enabled && config.campos) {
        for (const cat of activeCampos()) {
          if (!sel[cat]) sel[cat] = String(config.campos[cat][0].id);
        }
        // Recupera uma personalização salva (ex.: voltou pra PDP) para pré-preencher.
        try {
          const raw = await ls.getItem(PERSO_KEY(productId));
          if (raw) {
            const saved: Saved = JSON.parse(raw);
            if (saved.texto) texto = saved.texto;
            for (const cat of activeCampos()) {
              const items = (config.campos as Record<string, Campo[]>)[cat];
              const match = items.find((it) => it.titulo === saved.props[LABELS[cat]]);
              if (match) sel[cat] = String(match.id);
            }
          }
        } catch (_e) { /* ignore */ }
      }
      renderPDP();
    } catch (_e) {
      config = null; nube.clearSlot(PDP_SLOT);
    }
  }

  // ---- Carrinho: mostra a personalização de cada item (after_line_items) ----
  async function renderCart(s: any) {
    try {
      const items: any[] = s?.cart?.items || [];
      const blocks: any[] = [];
      for (const it of items) {
        const raw = await ls.getItem(PERSO_KEY(it.product_id));
        if (!raw) continue;
        const saved: Saved = JSON.parse(raw);
        const lines = Object.keys(saved.props).map((k) =>
          text({ children: k + ": " + saved.props[k], style: { fontSize: "12px" } })
        );
        blocks.push(box({
          style: {
            display: "flex", flexDirection: "column", gap: "2px",
            padding: "8px 10px", margin: "4px 0", borderRadius: "6px",
            background: "#f6f6f6", borderLeft: "3px solid #15803d",
          },
          children: [
            text({ children: "🎨 Personalização — " + (it.name || "item"), modifiers: ["bold"], style: { fontSize: "12px" } }),
            ...lines,
          ],
        }));
      }
      if (blocks.length) nube.render(CART_SLOT, box({ style: { display: "flex", flexDirection: "column", gap: "6px" }, children: blocks }));
      else nube.clearSlot(CART_SLOT);
    } catch (_e) { /* best-effort */ }
  }

  // ---- Captura no backend (pending) — uma vez por produto adicionado ----
  async function captureCartItems(s: any) {
    const sid = s?.store?.id; if (!sid) return;
    const items: any[] = s?.cart?.items || [];
    for (const it of items) {
      try {
        const raw = await ls.getItem(PERSO_KEY(it.product_id));
        if (!raw) continue;
        const already = await ls.getItem(CAP_KEY(it.product_id));
        if (already) continue;
        const saved: Saved = JSON.parse(raw);
        await fetch(BACKEND + "/widget/" + sid + "/products/" + it.product_id + "/personalization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: saved.texto, props: saved.props, customerId: s?.customer?.id ?? null }),
        });
        await ls.setItem(CAP_KEY(it.product_id), "1", TTL);
      } catch (_e) { /* best-effort */ }
    }
  }

  // ---- Checkout: grava metadado nativo do pedido (order.extra) ----
  async function sendOrderExtra(s: any) {
    try {
      const items: any[] = s?.cart?.items || [];
      const extra: Record<string, string> = {};
      let i = 0;
      for (const it of items) {
        const raw = await ls.getItem(PERSO_KEY(it.product_id));
        if (!raw) continue;
        const saved: Saved = JSON.parse(raw);
        const summary = Object.keys(saved.props).map((k) => k + ": " + saved.props[k]).join(" | ");
        extra["FixYou " + (++i) + " · " + (it.name || it.product_id)] = summary;
      }
      if (Object.keys(extra).length) {
        nube.send("order:add:extra", () => ({ order: { extra } }));
      }
    } catch (_e) { /* best-effort */ }
  }

  // ---- Router ----
  async function route(state: Readonly<NubeSDKState>) {
    const s = state as any;
    storeId = s?.store?.id;
    customerId = s?.customer?.id ?? null;
    const type = s?.location?.page?.type;

    if (storeId && type === "product") await loadPDP(s);
    else nube.clearSlot(PDP_SLOT);

    await renderCart(s);              // mostra personalização no carrinho/drawer
    await captureCartItems(s);        // garante captura enquanto no domínio da loja
    if (type === "checkout") await sendOrderExtra(s);
  }

  void route(nube.getState());
  nube.on("location:updated", (state) => { void route(state); });
  nube.on("cart:update", (state) => { void renderCart(state as any); void captureCartItems(state as any); });
  nube.on("cart:add:success", (state) => { void captureCartItems(state as any); });
  nube.on("checkout:ready", (state) => { void sendOrderExtra(state as any); void captureCartItems(state as any); });
}
