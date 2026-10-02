import type { NubeSDK, NubeSDKState } from "@tiendanube/nube-sdk-types";
import { iframe } from "@tiendanube/nube-sdk-ui";

/**
 * FixYou — app NubeSDK (worker). Roda sem DOM da loja; só renderiza um iframe
 * (servido pelo backend) na página de produto e faz a ponte dos eventos:
 *
 *  - o iframe mostra os campos de personalização + preview e, ao "Adicionar ao
 *    carrinho", posta { type: "fx:addToCart", productId, quantity } pro worker,
 *    que dispara o `cart:add` nativo (window.LS/comprar não existem no iframe
 *    cross-origin).
 *  - a PERSONALIZAÇÃO em si (texto + opções escolhidas) é gravada pelo próprio
 *    iframe no backend (POST .../personalization); o vínculo com o PEDIDO é
 *    feito no backend pelo webhook `order/created` (o cart:add do NubeSDK não
 *    suporta properties de linha). Por isso o worker só precisa de product_id +
 *    variant_id aqui.
 */

const BACKEND = "https://api.fixyou.nuvempro.com";
const SLOT_PRODUCT = "after_product_detail_add_to_cart";

// width/height do iframe aceitam px/%/em/rem (tipo Size). overflow/etc. vão no style.
const STYLE = {
  width: "100%",
  border: "none",
  display: "block",
  overflow: "hidden",
} as const;

export function App(nube: NubeSDK) {
  let productId: number | undefined;
  let variantId: number | undefined;

  // O state não expõe um campo único "variante selecionada"; pegamos a marcada
  // (quando o tema reporta) ou a primeira variante. Atualizado em
  // product:variant_selected. É um ponto a confirmar no teste ao vivo.
  function pickVariant(state: unknown): number | undefined {
    const s = state as any;
    const variants = s?.location?.page?.data?.product?.variants;
    if (Array.isArray(variants) && variants.length) {
      const sel = variants.find((v: any) => v && (v.selected || v.is_selected));
      const id = Number((sel || variants[0])?.id);
      return Number.isFinite(id) && id > 0 ? id : undefined;
    }
    return undefined;
  }

  function onMessage(e: unknown) {
    const v = (e as any)?.value;
    if (!v || typeof v !== "object" || v.type !== "fx:addToCart") return;
    const pid = Number(v.productId) || productId;
    const vid = Number(v.variantId) || variantId;
    if (!pid || !vid) return;
    nube.send("cart:add", () => ({
      cart: { items: [{ variant_id: vid, product_id: pid, quantity: Number(v.quantity) || 1 }] },
    }));
  }

  function render(state: Readonly<NubeSDKState>) {
    try {
      const s = state as any;
      const storeId = s?.store?.id;
      const page = s?.location?.page;
      if (!storeId || !page || page.type !== "product") {
        nube.clearSlot(SLOT_PRODUCT);
        return;
      }
      const pid = Number(page?.data?.product?.id);
      if (!pid) return;
      productId = pid;
      variantId = pickVariant(s) || variantId;
      const customerId = s?.customer?.id;
      nube.render(
        SLOT_PRODUCT,
        iframe({
          src: pageUrl(storeId, pid, customerId),
          width: "100%",
          height: "280",
          autoresize: true,
          style: STYLE,
          onMessage,
        }),
      );
    } catch (_e) {
      /* nunca lança no storefront */
    }
  }

  render(nube.getState());
  nube.on("location:updated", (state) => render(state));
  nube.on("product:variant_selected", (state) => {
    const v = pickVariant(state);
    if (v) variantId = v;
  });
}

function pageUrl(storeId: number, productId: number, customerId?: number | null): string {
  let u = BACKEND + "/widget/" + storeId + "/products/" + productId + "/page";
  if (customerId) u += "?customerId=" + encodeURIComponent(String(customerId));
  return u;
}
