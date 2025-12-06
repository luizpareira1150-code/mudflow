
/**
 * Utilitário centralizado para manipulação de datas no padrão Brasileiro e Fuso Horário de Brasília.
 */

const BR_TIMEZONE = 'America/Sao_Paulo';

// Formata uma string ISO ou Date para o padrão visual BR (DD/MM/YYYY)
export const formatDateBR = (dateInput: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

// Formata para visualização com hora (DD/MM/YYYY HH:mm)
export const formatDateTimeBR = (dateInput: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Retorna a data atual em YYYY-MM-DD ajustada para Brasília (para inputs type="date")
export const getTodayDateString = (): string => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { // en-CA output is YYYY-MM-DD
    timeZone: BR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
};

// Obtém o dia da semana (0-6) baseado em Brasília, corrigindo distorções de UTC
export const getDayOfWeekBR = (dateString: string): number => {
  // dateString espera formato YYYY-MM-DD
  // Criamos a data tratando-a como meio-dia em Brasília para evitar virada de dia
  const [year, month, day] = dateString.split('-').map(Number);
  // O construtor Date(y, m, d) usa o fuso local do browser, o que pode dar erro.
  // Vamos criar um objeto Date e forçar a interpretação.
  const date = new Date(year, month - 1, day, 12, 0, 0); 
  return date.getDay();
};

// Valida se uma data é passada
export const isDateInPastBR = (dateString: string): boolean => {
  const today = getTodayDateString();
  return dateString < today;
};
