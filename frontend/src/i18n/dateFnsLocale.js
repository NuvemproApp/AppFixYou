import { ptBR } from 'date-fns/locale/pt-BR';
import { es } from 'date-fns/locale/es';

const localeMap = {
  'pt-BR': ptBR,
  es: es,
};

export function getDateFnsLocale(lang) {
  return localeMap[lang] || ptBR;
}
