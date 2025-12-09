
/**
 * Utilitário centralizado para manipulação de datas no padrão Brasileiro e Fuso Horário de Brasília.
 * Enforces 'America/Sao_Paulo' as the single source of truth.
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

// Formata apenas a hora (HH:mm) forçando timezone BR
export const formatTimeBR = (dateInput: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Retorna a data atual em YYYY-MM-DD ajustada para Brasília
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

// Obtém o dia da semana (0-6) baseado em Brasília
export const getDayOfWeekBR = (dateString: string): number => {
  // Parsing manually to avoid Browser Timezone interference
  const [year, month, day] = dateString.split('-').map(Number);
  // Create a UTC date at noon to avoid boundary shifts
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  // Ask Intl what day of week this instant is in Sao Paulo
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BR_TIMEZONE,
    weekday: 'short'
  });
  
  const dayName = formatter.format(date);
  
  // Map to 0-6 (Sun-Sat)
  const map: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  
  return map[dayName] !== undefined ? map[dayName] : date.getUTCDay();
};

// Adiciona dias a uma data string YYYY-MM-DD de forma segura
export const addDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Helper: Converte HH:MM para minutos
export const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper: Cria objeto Date combinando YYYY-MM-DD com HH:MM
// Fix: Force ISO -03:00 to ensure Absolute Brazil Time regardless of user location
export const createDateAtHour = (dateStr: string, timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  
  // Construct ISO 8601 with -03:00 offset (Brasilia Standard Time)
  return new Date(`${dateStr}T${paddedHours}:${paddedMinutes}:00-03:00`);
};

// Valida se uma data é passada
export const isDateInPastBR = (dateString: string): boolean => {
  const today = getTodayDateString();
  return dateString < today;
};
