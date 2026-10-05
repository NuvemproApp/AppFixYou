import type { NubeSDK, NubeSDKState } from "@tiendanube/nube-sdk-types";
import { box, field, select, img, button } from "@tiendanube/nube-sdk-ui";

/**
 * FixYou — app NubeSDK (worker), modo NATIVO (sem iframe).
 *
 * Injeta os campos de personalização direto no slot da página de produto, como
 * o widget clássico fazia inline: campo de texto (Nome) + selects por categoria
 * (fonte, cor, ícone…) + pré-visualização da imagem + botão próprio de
 * "Adicionar ao carrinho". Tudo com componentes nativos do NubeSDK (field /
 * select / img / button) — nada de iframe.
 *
 * Dados: o worker faz `fetch` direto no backend do app:
 *  - GET  /storefront/:store/products/:product/config         → campos/itens
 *  - (img) /storefront/:store/products/:product/personalized-image?... → preview
 *  - POST /widget/:store/products/:product/personalization    → grava a captura
 * O vínculo com o PEDIDO é feito no backend pelo webhook order/created (o
 * cart:add do NubeSDK não carrega properties de linha).
 */

const BACKEND = "https://api.fixyou.nuvempro.com";
const SLOT = "after_product_detail_add_to_cart";
const TEXT_LABEL = "Nome";

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

export function App(nube: NubeSDK) {
  let storeId: number | undefined;
  let productId: number | undefined;
  let variantId: number | undefined;
  let customerId: number | null | undefined;
  let config: Config | null = null;
  let texto = TEXT_LABEL;
  let sel: Record<string, string> = {}; // categoria -> id do item (string)
  let adding = false;
  let added = false;

  function pickVariant(state: unknown): number | undefined {
    const variants = (state as any)?.location?.page?.data?.product?.variants;
    if (Array.isArray(variants) && variants.length) {
      const chosen = variants.find((v: any) => v && (v.selected || v.is_selected)) || variants[0];
      const id = Number(chosen?.id);
      return Number.isFinite(id) && id > 0 ? id : undefined;
    }
    return undefined;
  }

  function activeCampos(): string[] {
    const c = config?.campos || {};
    return FIELD_ORDER.filter((cat) => Array.isArray(c[cat]) && c[cat].length > 0);
  }

  function complete(): boolean {
    if (!texto.trim()) return false;
    return activeCampos().every((cat) => !!sel[cat]);
  }

  function previewUrl(): string {
    let u = BACKEND + "/storefront/" + storeId + "/products/" + productId +
      "/personalized-image?texto=" + encodeURIComponent(texto.trim());
    for (const cat of activeCampos()) {
      if (sel[cat]) u += "&" + IMG_PARAM[cat] + "=" + encodeURIComponent(sel[cat]);
    }
    return u;
  }

  function view() {
    if (!config || !config.enabled) return null;

    const children: any[] = [];

    children.push(field({
      name: "fx-nome",
      label: TEXT_LABEL + " *",
      value: texto,
      // onChange guarda o valor; o preview/botão atualizam no onBlur (evita
      // re-render a cada tecla). Selects atualizam no change (imediato).
      onChange: (d) => { texto = String(d.value ?? ""); },
      onBlur: () => renderNow(),
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
        onChange: (d) => { sel[cat] = String(d.value ?? ""); renderNow(); },
      }));
    }

    if (complete()) {
      children.push(img({
        src: previewUrl(),
        alt: "Pré-visualização da personalização",
        style: { maxWidth: "100%", height: "auto", borderRadius: "6px" },
      }));
    }

    children.push(button({
      children: added ? "✓ Adicionado!" : (adding ? "Adicionando..." : "Adicionar ao carrinho"),
      variant: "primary",
      disabled: !complete() || adding,
      onClick: () => { void onAdd(); },
    }));

    return box({
      style: { display: "flex", flexDirection: "column", gap: "10px", padding: "12px 0" },
      children,
    });
  }

  function renderNow() {
    const v = view();
    if (v) nube.render(SLOT, v);
    else nube.clearSlot(SLOT);
  }

  async function onAdd() {
    if (!complete() || adding || !storeId || !productId) return;
    adding = true; renderNow();

    const props: Record<string, string> = {};
    props[TEXT_LABEL] = texto.trim();
    for (const cat of activeCampos()) {
      const it = (config!.campos as Record<string, Campo[]>)[cat].find((x) => String(x.id) === sel[cat]);
      if (it) props[LABELS[cat]] = it.titulo;
    }

    try {
      await fetch(BACKEND + "/widget/" + storeId + "/products/" + productId + "/personalization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim(), props, customerId: customerId ?? null }),
      });
    } catch (_e) { /* best-effort: mesmo falhando, adiciona ao carrinho */ }

    if (variantId && productId) {
      const vid = variantId, pid = productId;
      nube.send("cart:add", () => ({ cart: { items: [{ variant_id: vid, product_id: pid, quantity: 1 }] } }));
    }

    adding = false; added = true; renderNow();
    setTimeout(() => { added = false; renderNow(); }, 2500);
  }

  async function loadForState(state: Readonly<NubeSDKState>) {
    try {
      const s = state as any;
      storeId = s?.store?.id;
      customerId = s?.customer?.id ?? null;
      const page = s?.location?.page;
      if (!storeId || !page || page.type !== "product") { config = null; nube.clearSlot(SLOT); return; }

      const pid = Number(page?.data?.product?.id);
      if (!pid) return;
      if (pid !== productId) { // produto novo → reseta estado
        productId = pid; config = null; texto = TEXT_LABEL; sel = {}; adding = false; added = false;
      }
      variantId = pickVariant(s) || variantId;

      const cfg: Config = await fetch(
        BACKEND + "/storefront/" + storeId + "/products/" + productId + "/config"
      ).then((r) => r.json());
      config = cfg;

      // defaults: primeira opção de cada categoria ativa
      if (config && config.enabled && config.campos) {
        for (const cat of activeCampos()) {
          if (!sel[cat]) sel[cat] = String(config.campos[cat][0].id);
        }
      }
      renderNow();
    } catch (_e) {
      config = null; nube.clearSlot(SLOT);
    }
  }

  void loadForState(nube.getState());
  nube.on("location:updated", (state) => { void loadForState(state); });
  nube.on("product:variant_selected", (state) => { const v = pickVariant(state); if (v) variantId = v; });
}
