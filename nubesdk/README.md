# FixYou — App NubeSDK (vitrine)

App NubeSDK do FixYou. Roda num Web Worker e renderiza o widget de personalização
**inline e nativo** (componentes `field` / `select` / `img` / `button` do NubeSDK)
no slot `after_product_detail_add_to_cart` da página de produto — **sem iframe**.

O worker faz `fetch` direto no backend: GET da config (campos/itens), a `img` do
preview aponta pro endpoint de imagem, e no "Adicionar ao carrinho" grava a
personalização (`POST /widget/.../personalization`) e dispara o `cart:add`.

O vínculo **personalização → pedido** é feito pelo **backend** (o `cart:add` do
NubeSDK não carrega properties de linha): o webhook `order/created` casa a captura
e anexa o resumo ao `owner_note` do pedido.

## Build

```bash
cd nubesdk
npm install
npm run build          # gera dist/main.min.js (ESM minificado, nube-sdk-ui embutido)
cp dist/main.min.js ../backend/public/nubesdk.min.js
```

O backend serve esse arquivo em **`/widget/app.js`**.

## Registrar no Portal de Parceiros

1. **Script do app NubeSDK**: `https://api.fixyou.nuvempro.com/widget/app.js`
2. **Webhook** do evento `order/created`: `https://api.fixyou.nuvempro.com/webhooks/orders/created`

## Estrutura

- `src/main.ts` — entry `export function App(nube)`: faz `fetch` da config,
  renderiza os campos nativos (field/select) + preview (`img`) + botão, e no
  clique grava a captura e dispara o `cart:add`.
- Backend: `GET /storefront/.../config`, `.../personalized-image` (preview),
  `POST /widget/.../personalization` (captura) e o webhook `order/created`
  (`backend/src/routes/widget.js`, `nuvemshopWebhooks.js`).

## Teste

O sandbox do NubeSDK **não** simula o runtime cross-origin — teste na **loja real**
(com o app instalado e um produto configurado): que os campos aparecem na página
de produto, o preview atualiza, "Adicionar ao carrinho" adiciona o produto
(variante correta) e a personalização aparece no `owner_note` do pedido.
