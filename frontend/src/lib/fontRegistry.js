// Registro idempotente de webfonts carregadas dinamicamente via FontFace API.
// Usado tanto pelo FontPicker (preview em cada opção) quanto por páginas de
// listagem que precisam renderizar texto na fonte escolhida pelo usuário.
// Nunca deve lançar — falha ao carregar uma fonte apenas faz o navegador
// cair no fallback padrão, sem quebrar a página.
//
// registerFont retorna uma Promise<boolean> (true = carregou, false = falhou)
// — quem chama deve esperar essa promise antes de aplicar `fontFamily` no
// estilo do elemento. Aplicar o nome da fonte antes dela carregar de verdade
// é o que causava o texto aparecer com a fonte padrão (serif) por um tempo
// variável dependendo da rede — em vez de esperar "tempo suficiente" (que
// varia por conexão), a UI deve só trocar pra fonte customizada quando essa
// promise resolver com sucesso, mantendo a fonte padrão (neutra) até então.
// Cacheia a MESMA promise por família pra sempre (nunca remove do Map) —
// FontPicker e a lista de itens chamam registerFont pra mesma família em
// momentos diferentes, e todo mundo precisa ver o MESMO resultado final.
//
// Fila com limite de concorrência: o catálogo tem ~50 fontes, e disparar
// 50 FontFace.load() simultâneos estoura o limite de conexões simultâneas
// por host do navegador — as últimas da fila estouram timeout mesmo com o
// arquivo íntegro (mais um motivo pro problema aparecer mais em produção,
// com rede mais lenta que localhost). Limitar a poucas cargas em paralelo
// evita esse auto-congestionamento em vez de só tentar de novo depois.
const MAX_CONCURRENT_LOADS = 6;
const MAX_ATTEMPTS = 2;

const registry = new Map();
const queue = [];
let activeLoads = 0;

async function loadWithRetry(family, webfontUrl) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const fontFace = new FontFace(family, `url("${webfontUrl}")`);
      const loaded = await fontFace.load();
      document.fonts.add(loaded);
      return true;
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  return false;
}

function runQueue() {
  if (activeLoads >= MAX_CONCURRENT_LOADS || queue.length === 0) return;
  activeLoads++;
  const { family, webfontUrl, resolve } = queue.shift();
  loadWithRetry(family, webfontUrl).then((ok) => {
    activeLoads--;
    resolve(ok);
    runQueue();
  });
}

export function registerFont(family, webfontUrl) {
  if (!family || !webfontUrl) return Promise.resolve(false);
  if (registry.has(family)) return registry.get(family);

  const promise = new Promise((resolve) => {
    queue.push({ family, webfontUrl, resolve });
    runQueue();
  });

  registry.set(family, promise);
  return promise;
}

// Nomes de família com espaço+hífen isolado ("Nome - Personal Use") ou
// caracteres como "&" quebram o parser CSS quando atribuídos direto a
// style.fontFamily sem aspas — o navegador rejeita o valor inteiro
// silenciosamente (fontFamily some, sem erro no console) porque um hífen
// sozinho ou "&" não são <custom-ident> válidos fora de uma string CSS.
// Sempre envolver em aspas duplas na atribuição resolve, já que
// font-family também aceita <string> livremente. Único caractere que
// precisaria de escape aqui é aspas duplas dentro do próprio nome, o que
// não ocorre em nenhuma entrada do catálogo atual.
export function cssFontFamily(family) {
  return `"${family.replace(/"/g, '\\"')}"`;
}
