import { z } from 'zod';

// ==========================================
// FUNÇÃO PRINCIPAL DE VALIDAÇÃO
// ==========================================

/**
 * Valida dados usando um schema Zod
 * @param schema - Schema Zod para validação
 * @param data - Dados a serem validados
 * @returns Dados validados e formatados
 * @throws Error com mensagens amigáveis se inválido
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Formatar erros de forma amigável
      const errorMessages = error.errors.map(err => {
        const field = err.path.join('.');
        return `${field}: ${err.message}`;
      }).join(', ');
      
      throw new Error(`Dados inválidos: ${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Valida dados SEM lançar erro (retorna resultado)
 * Útil para validar antes de enviar ao backend
 * @param schema - Schema Zod
 * @param data - Dados a validar
 * @returns { success: boolean, data?: T, errors?: string[] }
 */
export function validateSafe<T>(schema: z.ZodType<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => {
    const field = err.path.join('.');
    return `${field}: ${err.message}`;
  });
  
  return { success: false, errors };
}

// ==========================================
// VALIDAÇÕES CUSTOMIZADAS (helpers extras)
// ==========================================

/**
 * Normaliza telefone (remove espaços, traços, parênteses)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Normaliza CPF (remove pontos e traços)
 */
export function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida se data não é no passado (útil pra agendamentos)
 */
export function isDateInFuture(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}
