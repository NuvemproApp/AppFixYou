'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { pertenceAoApp } = require('../admin/services/adminPlanService');

// Todos os apps NuvemPro usam a MESMA conta Stripe, e `admin_plan_id` é o
// autoincrement da tabela AdminPlan de CADA app — o id 4 existe em todos.
// Casar produto só por admin_plan_id é ambíguo e já causou estrago real: o
// preço de um plano passou a apontar para o produto de outro app (R$ 79,90 ->
// R$ 299,00), e o products.update do sync chegava a renomear o produto alheio.
// No archiveInStripe, o mesmo descuido arquiva o produto e TODOS os preços
// ativos de outro app.

describe('pertenceAoApp — isolamento entre apps na conta Stripe compartilhada', () => {
  const plano = { appId: 'meuapp', id: 4, name: 'pro' };

  const doApp = { id: 'prod_meu', metadata: { admin_plan_id: '4', app_id: 'meuapp', app_slug: 'meuapp' } };
  const deOutro = { id: 'prod_outro', metadata: { admin_plan_id: '4', app_id: 'outroapp', app_slug: 'outroapp' } };

  it('aceita o produto do próprio app', () => {
    assert.strictEqual(pertenceAoApp(doApp, plano), true);
  });

  it('REJEITA produto de outro app com o mesmo admin_plan_id', () => {
    assert.strictEqual(pertenceAoApp(deOutro, plano), false);
  });

  it('aceita quando só app_slug bate (produtos antigos sem app_id)', () => {
    assert.strictEqual(pertenceAoApp({ metadata: { app_slug: 'meuapp' } }, plano), true);
  });

  it('rejeita produto sem metadata de app', () => {
    assert.strictEqual(pertenceAoApp({ metadata: {} }, plano), false);
    assert.strictEqual(pertenceAoApp({}, plano), false);
    assert.strictEqual(pertenceAoApp(null, plano), false);
  });

  it('rejeita tudo quando o plano não tem appId', () => {
    assert.strictEqual(pertenceAoApp(doApp, { appId: '' }), false);
    assert.strictEqual(pertenceAoApp(doApp, {}), false);
  });

  it('filtra a busca em vez de pegar o primeiro resultado', () => {
    // Reproduz o incidente: o produto do outro app veio PRIMEIRO na busca.
    const resultado = { data: [deOutro, doApp] };
    resultado.data = resultado.data.filter((p) => pertenceAoApp(p, plano));
    assert.strictEqual(resultado.data.length, 1);
    assert.strictEqual(resultado.data[0].id, 'prod_meu');
  });
});
