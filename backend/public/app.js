/* FixYou — storefront script v1.0.0
 * Compatível com TODOS os temas Nuvemshop: legados, atuais, componentizados e futuros.
 * Referências:
 *   Anchor Points  : https://docs.nuvemshop.com.br/help/pontos-de-anchoragem
 *   Scripts API    : https://tiendanube.github.io/api-documentation/resources/script
 *   Migration Guide: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/migration-guide
 *
 * NubeSDK NÃO é necessário — este é um script de vitrine/carrinho (não é checkout).
 * Mesmo esqueleto de anchor points + fallback usado no SuperCampos/AlugueMais.
 * ES5 puro + fetch + MutationObserver (disponíveis em todos os temas NS).
 */
!function () {
  'use strict';

  var _selfScript = document.currentScript;

  // ─── Utilidades DOM ──────────────────────────────────────────────────────────
  function qs(sel, ctx) { try { return (ctx || document).querySelector(sel); } catch (e) { return null; } }
  function qsa(sel, ctx) {
    try { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
    catch (e) { return []; }
  }
  function firstEl(selectors, ctx) {
    for (var i = 0; i < selectors.length; i++) {
      var el = qs(selectors[i], ctx);
      if (el) return el;
    }
    return null;
  }
  function firstEls(selectors, ctx) {
    for (var i = 0; i < selectors.length; i++) {
      var els = qsa(selectors[i], ctx);
      if (els.length) return els;
    }
    return [];
  }
  function noop() {}

  // ─── API base ─────────────────────────────────────────────────────────────────
  var API_FALLBACK = 'https://appfixyou-production.up.railway.app';

  function detectApiBase() {
    if (_selfScript && _selfScript.src) {
      try {
        var apiSelf = new URL(_selfScript.src, location.href).searchParams.get('api');
        if (apiSelf) return apiSelf.replace(/\/$/, '');
      } catch (e) {}
    }
    var tags = qsa('script[src*="fixyou"],script[src*="app.min.js"],script[src*="app.js"]');
    for (var i = 0; i < tags.length; i++) {
      try {
        var api = new URL(tags[i].src, location.href).searchParams.get('api');
        if (api) return api.replace(/\/$/, '');
      } catch (e) {}
    }
    return API_FALLBACK;
  }

  // ─── window.LS ────────────────────────────────────────────────────────────────
  var LS = window.LS || {};
  var storeId = LS.store && LS.store.id ? String(LS.store.id) : null;
  if (!storeId) return;

  function productId() { return LS.product && LS.product.id ? String(LS.product.id) : null; }
  function storeCountry() { return String((LS.store && LS.store.country) || 'BR').toUpperCase(); }

  var _country;
  function country() { return _country || (_country = storeCountry()); }
  function isBR() { return country() === 'BR'; }

  // ─── Rótulos (mesma lógica de i18n inline do AlugueMais/SuperCampos — o
  // script standalone não tem acesso ao i18n React do painel admin) ────────────
  function textoLabel() { return isBR() ? 'Nome' : 'Nombre'; }

  var FIELD_LABEL = {
    fontes:           function () { return isBR() ? 'Fonte' : 'Fuente'; },
    coresDeFonte:     function () { return isBR() ? 'Cor de fonte' : 'Color de fuente'; },
    icones:           function () { return isBR() ? 'Ícone' : 'Ícono'; },
    imagensDeFundo:   function () { return isBR() ? 'Imagem de fundo' : 'Imagen de fondo'; },
    conjuntosDeCores: function () { return isBR() ? 'Conjunto de cores' : 'Conjunto de colores'; },
    patterns:         function () { return 'Pattern'; },
  };

  // Ordem fixa de renderização — mesma prioridade do controller legado
  // (só entra no formulário a categoria que o modelo do produto usa).
  var FIELD_ORDER = ['fontes', 'coresDeFonte', 'icones', 'imagensDeFundo', 'conjuntosDeCores', 'patterns'];

  // Nome do parâmetro correspondente no endpoint de geração de imagem.
  var IMG_PARAM = {
    fontes: 'fonte', coresDeFonte: 'corDeFonte', icones: 'icone',
    imagensDeFundo: 'fundo', conjuntosDeCores: 'conjuntoDeCores', patterns: 'pattern',
  };

  var TXT = {
    previewLegend: function () { return isBR() ? 'Pré-visualização da personalização' : 'Vista previa de la personalización'; },
  };

  // ─── Anchor Points — seletores multi-tema (mesmo conjunto do SuperCampos) ────
  var SEL_FORM = [
    '[data-store^="product-form-"]',
    '#product_form',
    'form.js-product-form',
    'form[action*="/cart"]',
    'form[action*="/carrinho"]',
  ];

  var SEL_BUY_BTN = [
    "[data-store='product-buy-button']",
    "[data-component='product-buy-button']",
    'button[name="add"]',
    '[data-action="add-to-cart"]',
    '.js-add-to-cart',
    'button[type="submit"].js-buy-button',
  ];

  var SEL_LINE_ITEM = [
    '[data-component="cart.line-item"]',
    '[data-store^="cart-item-"]',
    '.js-cart-item',
    '.cart-item.form-row',
    '.cart-item',
    'tr[data-id]',
    '[data-item]',
  ];

  var SEL_CART_ROOT = [
    '[data-component="cart"]',
    '[data-store="cart-form"]',
    '[data-store="cart"]',
    '.js-cart-container',
    '.js-cart',
    '#cart',
    '#cart-dropdown',
    '.cart-dropdown',
    '.mini-cart',
    '.cart-popup',
    '.cart-sidebar',
  ];

  var SEL_NAME_CONTAINER = [
    '[data-component="line-item.name"]',
    '.cart-item-name',
    '.item-name',
    '.js-item-name',
    '.product-name',
    'td.name',
  ];

  var SEL_INSERT_AFTER = [
    '[data-component="name.short-variant-name"]',
    '[data-component="name.short-name"]',
    'small',
    'span.variant',
  ];

  // ─── DOM ready ───────────────────────────────────────────────────────────────
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var _debounce;
  function debounce(fn, ms) { clearTimeout(_debounce); _debounce = setTimeout(fn, ms || 350); }

  // ─── Injeção de CSS ──────────────────────────────────────────────────────────
  var _cssInjected = false;
  function injectCSS() {
    if (_cssInjected || qs('#fx-styles')) { _cssInjected = true; return; }
    _cssInjected = true;
    var css =
      '.fx-elementos{padding:16px 0;margin-bottom:1.28rem;box-sizing:border-box}' +
      '.fx-elemento{padding:0 0 14px;box-sizing:border-box}' +
      '.fx-label{font-weight:600;font-size:.88rem;display:block;margin-bottom:6px}' +
      '.fx-input-texto,.fx-select{width:100%;max-width:420px;box-sizing:border-box;' +
        'padding:8px 12px;font-size:14px;border:1px solid #ccc;border-radius:6px;' +
        'background:#fff;color:#333}' +
      '.fx-legend{display:block;margin:6px 0 0;font-size:.75em;opacity:.65}' +
      '.fx-btn-hide{display:none!important}' +
      // Exibição de propriedades no carrinho — mesma classe usada pelo
      // SuperCampos/AlugueMais (idempotente entre os 3 apps; cada um só
      // injeta nas linhas do carrinho cujo produto é dele mesmo).
      '.nuvempro-cart-prod-pers{font-size:.82em;line-height:1.6;margin-top:5px;padding:3px 0;clear:both}' +
      '.nuvempro-cart-prod-pers>div{display:block}' +
      '.nuvempro-cart-prod-pers strong{font-weight:600}' +
      '.nuvempro-cart-prod-pers span{margin-left:2px}';
    var style = document.createElement('style');
    style.id = 'fx-styles';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA DE PRODUTO — campos de personalização + preview de imagem
  // ═══════════════════════════════════════════════════════════════════════════

  function renderCampos(campos, form) {
    if (qs('.fx-elementos', form)) return null; // idempotência

    var container = document.createElement('div');
    container.className = 'fx-elementos';

    // Campo de texto — sempre o primeiro, com default preenchido (obrigatório
    // por natureza, mas nunca bloqueia o botão de comprar de cara).
    var textBox = document.createElement('div');
    textBox.className = 'fx-elemento';
    textBox.setAttribute('data-elemento', 'texto');

    var lbl0 = document.createElement('label');
    lbl0.className = 'fx-label';
    lbl0.textContent = textoLabel() + ' *';
    textBox.appendChild(lbl0);

    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'fx-input-texto';
    textInput.name = 'properties[' + textoLabel() + ']';
    textInput.value = textoLabel();
    textBox.appendChild(textInput);
    container.appendChild(textBox);

    var selects = [];
    for (var i = 0; i < FIELD_ORDER.length; i++) {
      var categoria = FIELD_ORDER[i];
      var itens = campos[categoria];
      if (!itens || !itens.length) continue;

      var box = document.createElement('div');
      box.className = 'fx-elemento';
      box.setAttribute('data-elemento', categoria);

      var label = FIELD_LABEL[categoria]();

      var lbl = document.createElement('label');
      lbl.className = 'fx-label';
      lbl.textContent = label + ' *';
      box.appendChild(lbl);

      var sel = document.createElement('select');
      sel.className = 'fx-select';
      sel.name = 'properties[' + label + ']';

      for (var k = 0; k < itens.length; k++) {
        var opt = document.createElement('option');
        opt.value = itens[k].titulo;
        opt.textContent = itens[k].titulo;
        opt.setAttribute('data-personalizacao-id', String(itens[k].id));
        sel.appendChild(opt);
      }
      box.appendChild(sel);
      container.appendChild(box);
      selects.push({ categoria: categoria, el: sel });
    }

    var img = document.createElement('img');
    img.id = 'fx-img-preview';
    img.style.cssText = 'max-width:100%;height:auto;display:none;';
    container.appendChild(img);

    var legend = document.createElement('small');
    legend.className = 'fx-legend';
    legend.textContent = TXT.previewLegend();
    legend.style.display = 'none';
    container.appendChild(legend);

    form.insertAdjacentElement('afterbegin', container);

    return { container: container, textInput: textInput, selects: selects, img: img, legend: legend };
  }

  function setupValidation(apiBase, sid, pid, refs, form) {
    var btn = firstEl(SEL_BUY_BTN, form) || firstEl(SEL_BUY_BTN);
    if (!btn) return;

    function currentIds() {
      var ids = {};
      for (var i = 0; i < refs.selects.length; i++) {
        var s = refs.selects[i];
        var opt = s.el.options[s.el.selectedIndex];
        ids[IMG_PARAM[s.categoria]] = opt ? opt.getAttribute('data-personalizacao-id') : '';
      }
      return ids;
    }

    function buildImageUrl(texto, ids) {
      var url = apiBase + '/storefront/' + sid + '/products/' + pid +
                '/personalized-image?texto=' + encodeURIComponent(texto);
      for (var key in ids) {
        if (ids.hasOwnProperty(key) && ids[key]) url += '&' + key + '=' + encodeURIComponent(ids[key]);
      }
      return url;
    }

    function validate() {
      var texto = refs.textInput.value.trim();
      var filled = !!texto;
      for (var i = 0; i < refs.selects.length && filled; i++) {
        if (!refs.selects[i].el.value) filled = false;
      }

      if (!filled) {
        btn.classList.add('fx-btn-hide');
        refs.img.style.display = 'none';
        refs.legend.style.display = 'none';
        return;
      }

      btn.classList.remove('fx-btn-hide');
      refs.img.setAttribute('src', buildImageUrl(texto, currentIds()));
      refs.img.style.display = 'block';
      refs.legend.style.display = 'block';
    }

    // Event delegation: um único listener no container cobre todos os campos,
    // inclusive os que forem reinseridos por AJAX/rerender do tema.
    refs.container.addEventListener('input', function () { debounce(validate, 350); });
    refs.container.addEventListener('change', function () { debounce(validate, 350); });

    validate(); // estado inicial — defaults já preenchidos, então normalmente já libera o botão
  }

  function initProductPage(apiBase, sid, pid) {
    var form = firstEl(SEL_FORM);
    var buyBtn = form ? firstEl(SEL_BUY_BTN, form) : firstEl(SEL_BUY_BTN);

    // Esconde o botão até sabermos se esse produto é personalizável — evita
    // comprar sem personalização na corrida entre o carregamento da página e
    // a resposta de /products/:id/config (mesmo raciocínio do AlugueMais).
    if (buyBtn) buyBtn.classList.add('fx-btn-hide');

    fetch(apiBase + '/storefront/' + sid + '/products/' + pid + '/config')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.enabled || !form) {
          if (buyBtn) buyBtn.classList.remove('fx-btn-hide');
          return;
        }
        var refs = renderCampos(data.campos, form);
        if (!refs) { if (buyBtn) buyBtn.classList.remove('fx-btn-hide'); return; }
        setupValidation(apiBase, sid, pid, refs, form);
      })
      .catch(function () {
        if (buyBtn) buyBtn.classList.remove('fx-btn-hide');
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARRINHO — exibição das personalizações escolhidas (mesmo motor do
  // SuperCampos: genérico, captura qualquer properties[] do formulário, sem
  // precisar conhecer os nomes específicos dos campos do FixYou)
  // ═══════════════════════════════════════════════════════════════════════════

  var PROPS_KEY = 'fx_props_' + storeId;
  var cartTimer = null;

  function propKey(name) { return name.replace(/^properties\[/, '').replace(/\]$/, ''); }

  function loadStorage() {
    try {
      var raw = sessionStorage.getItem(PROPS_KEY);
      if (!raw) return { byItemId: {}, queue: {} };
      var s = JSON.parse(raw);
      return { byItemId: s.byItemId || {}, queue: s.queue || {} };
    } catch (e) { return { byItemId: {}, queue: {} }; }
  }
  function saveStorage(s) {
    try { sessionStorage.setItem(PROPS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function getItemId(item) {
    var id = item.getAttribute('data-item-id') ||
             item.getAttribute('data-cart-item-id') ||
             item.getAttribute('data-line-item-id') ||
             item.getAttribute('data-id');
    if (id && /^\d+$/.test(id)) return id;

    var qInput = qs('input[name^="quantity["]', item);
    if (qInput) {
      var m = String(qInput.name || '').match(/^quantity\[(\d+)\]$/);
      if (m) return m[1];
    }
    var rmEl = qs('[onclick*="removeItem"]', item);
    if (rmEl) {
      var m2 = (rmEl.getAttribute('onclick') || '').match(/removeItem\((\d+)/);
      if (m2) return m2[1];
    }
    var sub = qs('[data-line-item-id]', item);
    if (sub) return sub.getAttribute('data-line-item-id');
    return null;
  }

  function getProductId(item) {
    var ds = item.getAttribute('data-store') || '';
    var m = ds.match(/^cart-item-(\d+)$/);
    if (m) return m[1];
    return item.getAttribute('data-product-id') ||
      (function () {
        var inner = qs('[data-product-id]', item);
        return inner ? inner.getAttribute('data-product-id') : null;
      }());
  }

  function hasNativeProperties(lineItem) {
    var nameEl = firstEl(SEL_NAME_CONTAINER, lineItem);
    if (!nameEl) return false;
    return Array.prototype.slice.call(nameEl.children).some(function (child) {
      if (child.tagName !== 'DIV') return false;
      var cls = child.className || '';
      if (cls.indexOf('nuvempro-cart-prod-pers') >= 0) return false;
      return !!child.querySelector('strong');
    });
  }

  function captureProps() {
    var pid = productId();
    var form = firstEl(SEL_FORM);
    if (!form || !pid) return;

    var props = {};
    qsa('input[type="text"][name^="properties["]', form).forEach(function (el) {
      var v = el.value.trim(); if (v) props[propKey(el.name)] = v;
    });
    qsa('select[name^="properties["]', form).forEach(function (el) {
      if (el.selectedIndex > -1 && el.value) props[propKey(el.name)] = el.value;
    });

    if (!Object.keys(props).length) return;

    var s = loadStorage();
    if (!s.queue[pid]) s.queue[pid] = [];
    s.queue[pid].push({ props: props, ts: Date.now() });
    saveStorage(s);
  }

  function extractItems(resp) {
    if (!resp) return [];
    try {
      var p = typeof resp === 'string' ? JSON.parse(resp) : resp;
      if (!p || typeof p !== 'object') return [];
      if (Array.isArray(p)) return p;
      if (Array.isArray(p.items)) return p.items;
      if (p.cart && Array.isArray(p.cart.items)) return p.cart.items;
    } catch (e) {}
    return [];
  }

  function associateItemId(resp, productIdArg) {
    var s = loadStorage();
    var queue = s.queue[productIdArg] || [];
    if (!queue.length) return;

    var knownIds = Object.keys(s.byItemId);
    var newItemId = null;

    var items = extractItems(resp);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || !it.id) continue;
      var itPid = String((it.product && it.product.id) || it.product_id || '');
      if (itPid !== String(productIdArg)) continue;
      if (knownIds.indexOf(String(it.id)) === -1) { newItemId = String(it.id); break; }
    }

    if (!newItemId) {
      var lineItems = firstEls(SEL_LINE_ITEM);
      for (var j = 0; j < lineItems.length; j++) {
        var pid = getProductId(lineItems[j]);
        if (pid && pid !== String(productIdArg)) continue;
        var lid = getItemId(lineItems[j]);
        if (lid && knownIds.indexOf(lid) === -1) { newItemId = lid; break; }
      }
    }

    if (newItemId) {
      var entry = queue.shift();
      s.byItemId[newItemId] = entry.props;
      s.queue[productIdArg] = queue;
      saveStorage(s);
    }
  }

  function injectIntoItem(lineItem, props) {
    if (qs('.nuvempro-cart-prod-pers', lineItem)) return;
    if (hasNativeProperties(lineItem)) return;

    var keys = Object.keys(props);
    if (!keys.length) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'nuvempro-cart-prod-pers';
    var hasContent = false;

    for (var i = 0; i < keys.length; i++) {
      var val = String(props[keys[i]] || '').trim();
      if (!val) continue;
      var line = document.createElement('div');
      var strong = document.createElement('strong');
      var span = document.createElement('span');
      strong.textContent = keys[i] + ': ';
      span.textContent = val;
      line.appendChild(strong);
      line.appendChild(span);
      wrapper.appendChild(line);
      hasContent = true;
    }
    if (!hasContent) return;

    var nameEl = firstEl(SEL_NAME_CONTAINER, lineItem);
    var afterEl = nameEl ? firstEl(SEL_INSERT_AFTER, nameEl) : null;

    if (afterEl && afterEl.parentNode) afterEl.parentNode.insertBefore(wrapper, afterEl.nextSibling);
    else if (nameEl) nameEl.appendChild(wrapper);
    else lineItem.appendChild(wrapper);
  }

  function renderCartDisplay() {
    var s = loadStorage();
    if (!Object.keys(s.byItemId).length && !Object.keys(s.queue).length) return;

    var prev = qsa('.nuvempro-cart-prod-pers');
    for (var i = 0; i < prev.length; i++) {
      if (prev[i].parentNode) prev[i].parentNode.removeChild(prev[i]);
    }

    var lineItems = firstEls(SEL_LINE_ITEM);
    if (!lineItems.length) return;

    var cursor = {};
    for (var j = 0; j < lineItems.length; j++) {
      var item = lineItems[j];
      var itemId = getItemId(item);
      if (itemId && s.byItemId[itemId]) { injectIntoItem(item, s.byItemId[itemId]); continue; }

      var pid = getProductId(item);
      if (pid) {
        var queue = s.queue[pid] || [];
        if (!cursor[pid]) cursor[pid] = 0;
        var idx = cursor[pid];
        if (idx < queue.length) { injectIntoItem(item, queue[idx].props); cursor[pid]++; }
      }
    }
  }

  function initCartDisplay() {
    renderCartDisplay();

    var form = firstEl(SEL_FORM);
    if (form) form.addEventListener('submit', captureProps);

    var patchTries = 0;
    (function tryPatch() {
      if (window.LS && typeof window.LS.addToCartEnhanced === 'function') {
        var orig = window.LS.addToCartEnhanced;
        window.LS.addToCartEnhanced = function () {
          captureProps();
          var currentPid = productId();
          var args = Array.prototype.slice.call(arguments);
          var origCb = typeof args[5] === 'function' ? args[5] : noop;
          args[5] = function (resp) {
            origCb.apply(this, arguments);
            if (currentPid) associateItemId(resp, currentPid);
            setTimeout(function () {
              if (currentPid) associateItemId(null, currentPid);
              renderCartDisplay();
            }, 800);
            setTimeout(renderCartDisplay, 2400);
          };
          return orig.apply(this, args);
        };
      } else if (++patchTries < 30) {
        setTimeout(tryPatch, 300);
      }
    }());

    if (window.MutationObserver) {
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
            clearTimeout(cartTimer);
            cartTimer = setTimeout(renderCartDisplay, 400);
            return;
          }
        }
      });
      observer.observe(firstEl(SEL_CART_ROOT) || document.body, { childList: true, subtree: true });
    }
  }

  // ─── Inicialização ────────────────────────────────────────────────────────────
  function init() {
    var apiBase = detectApiBase();

    injectCSS();
    initCartDisplay(); // roda em toda página — o carrinho pode ter itens personalizados mesmo fora da página de produto

    var pid = productId();
    if (pid) initProductPage(apiBase, storeId, pid);
  }

  ready(init);
}();
