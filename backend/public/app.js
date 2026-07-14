/* FixYou — storefront script for Nuvemshop / Tiendanube
 *
 * Carregado como Script Resource via CDN da Tiendanube.
 * Sem dependências externas.
 */
(function () {
  'use strict';

  var BACKEND_ORIGIN = 'https://api.fixyou.nuvempro.com';

  function getStoreId() {
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      var m = scripts[i].src.match(/[?&]store=(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  function init() {
    var storeId = getStoreId();
    if (!storeId) return;
    // TODO: inicializar lógica do FixYou
    console.log('[FixYou] init storeId=' + storeId);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
