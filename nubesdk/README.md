# FixYou — App NubeSDK (vitrine)

App NubeSDK do FixYou. Roda num Web Worker (sem DOM da loja) e renderiza o widget
de personalização como um **iframe** (servido pelo backend) na página de produto,
fazendo a ponte dos eventos (`fx:addToCart` → `cart:add`).

O vínculo **personalização → pedido** é feito pelo **backend** (o `cart:add` do
NubeSDK não carrega properties de linha): a página do iframe grava a personalização
(`POST /widget/.../personalization`) e o webhook `order/created` a anexa ao pedido.

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

- `src/main.ts` — entry `export function App(nube)`: renderiza o iframe no slot
  `after_product_detail_add_to_cart` e trata `fx:addToCart` (→ `cart:add`).
- A página do iframe e a captura ficam no backend (`backend/public/widget.html`,
  `backend/src/routes/widget.js`).

## Teste

O sandbox do NubeSDK **não** simula o runtime cross-origin — teste na **loja real**:
que o iframe aparece na página de produto, o preview atualiza, "Adicionar ao
carrinho" adiciona o produto (variante correta) e a personalização aparece no
`owner_note` do pedido.
