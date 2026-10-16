import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';

// Mapeia qualquer código de idioma (Nuvemshop/Tiendanube ou navegador) para os
// 2 idiomas suportados: pt-BR e es (espanhol único/neutro). Retorna null se não
// reconhecer. Ex.: 'es', 'es-AR', 'es-mx', 'es_CL' → 'es'; 'pt', 'pt-BR' → 'pt-BR'.
export function resolveLang(input) {
  const l = String(input || '').toLowerCase();
  if (l.startsWith('pt')) return 'pt-BR';
  if (l.startsWith('es')) return 'es';
  return null;
}

// Fallback: deduz o idioma pelo país da loja quando o idioma não veio.
// Brasil → pt-BR; países de língua espanhola da LATAM → es.
export function langFromCountry(country) {
  const c = String(country || '').toUpperCase();
  if (c === 'BR') return 'pt-BR';
  if (['AR', 'MX', 'CO', 'CL', 'PE', 'UY', 'EC', 'BO', 'PY', 'VE', 'GT', 'CR', 'DO', 'PA', 'HN', 'NI', 'SV'].includes(c)) return 'es';
  return null;
}

export const SUPPORTED_LANGS = ['pt-BR', 'es'];
export const DEFAULT_LANG = 'pt-BR';

function detectLanguage() {
  // 1) ?lang= na URL (a Nuvemshop pode enviar)
  const params = new URLSearchParams(window.location.search);
  const fromUrl = resolveLang(params.get('lang'));
  if (fromUrl) return fromUrl;

  // 2) escolha explícita salva do usuário
  const stored = localStorage.getItem('app_language');
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;

  // 3) idioma do navegador
  const fromBrowser = resolveLang(navigator.language);
  if (fromBrowser) return fromBrowser;

  return DEFAULT_LANG;
}

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    es: { translation: es },
  },
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANG,
  interpolation: {
    escapeValue: false,
  },
});

// Persist language changes
i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem('app_language', lng); } catch { /* noop */ }
});

export default i18n;
