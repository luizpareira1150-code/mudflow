import { z } from 'zod';

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

// 1. Schema de Paciente
export const PatientSchema = z.object({
  name: z.string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome muito longo'),
  
  phone: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos (apenas números)')),
  
  cpf: z.string()
    .transform(val => val ? val.replace(/\D/g, '') : '')
    .pipe(z.string().regex(/^\d{11}$/, 'CPF deve ter exatamente 11 dígitos').optional().or(z.literal(''))),
  
  email: z.string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  
  birthDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida (use YYYY-MM-DD)')
    .optional()
    .or(z.literal('')),
  
  organizationId: z.string()
    .min(1, 'Organization ID é obrigatório'),
  
  notes: z.string()
    .max(500, 'Observações muito longas (máximo 500 caracteres)')
    .optional()
    .or(z.literal(''))
});

// 2. Schema de Agendamento
export const AppointmentSchema = z.object({
  patientId: z.string()
    .min(1, 'Paciente é obrigatório'),
  
  doctorId: z.string()
    .min(1, 'Médico é obrigatório'),
  
  clinicId: z.string()
    .min(1, 'Clinic ID é obrigatório'),
  
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use formato YYYY-MM-DD)'),
  
  time: z.string()
    .regex(/^\d{2}:\d{2}$/, 'Horário inválido (use formato HH:MM)'),
  
  status: z.enum(
    ['EM_CONTATO', 'AGENDADO', 'ATENDIDO', 'NAO_VEIO', 'BLOQUEADO'],
    { errorMap: () => ({ message: 'Status inválido' }) }
  ),
  
  procedure: z.string()
    .max(100, 'Procedimento muito longo')
    .optional()
    .or(z.literal('')),
  
  notes: z.string()
    .max(500, 'Observações muito longas')
    .optional()
    .or(z.literal(''))
});

// 3. Schema de Atualização de Agendamento
export const AppointmentUpdateSchema = AppointmentSchema.partial().extend({
  id: z.string().min(1, 'ID é obrigatório')
});

// 4. Schema de Webhook do N8N
export const N8NWebhookSchema = z.object({
  action: z.enum([
    'CREATE_APPOINTMENT', 
    'UPDATE_STATUS', 
    'BLOCK_SCHEDULE', 
    'CREATE_PATIENT_CONTACT',
    'GET_SLOT_SUGGESTIONS' // Nova ação para IA consumir inteligência
  ]),
  authToken: z.string().min(1, 'Token de autenticação obrigatório'),
  clinicId: z.string().min(1, 'Clinic ID obrigatório'),
  
  data: z.object({
    patientName: z.string().min(3).optional(),
    patientPhone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido').optional(),
    patientCPF: z.string().regex(/^\d{11}$/, 'CPF inválido').optional(),
    
    doctorId: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida').optional(),
    procedure: z.string().optional(),
    notes: z.string().optional(),
    
    appointmentId: z.string().optional(),
    newStatus: z.enum(['EM_CONTATO', 'AGENDADO', 'ATENDIDO', 'NAO_VEIO', 'BLOQUEADO']).optional(),
    
    startHour: z.string().optional(),
    endHour: z.string().optional(),
    
    source: z.string().optional(),
    message: z.string().optional()
  })
});

// 5. Schema de Configurações de Integração
export const IntegrationSettingsSchema = z.object({
  clinicId: z.string(),
  
  n8nWebhookUrl: z.string()
    .url('URL do webhook N8N inválida')
    .optional()
    .or(z.literal('')),
  
  n8nProductionMode: z.boolean().default(false),
  
  evolutionInstanceName: z.string()
    .optional()
    .or(z.literal('')),
  
  evolutionApiKey: z.string()
    .optional()
    .or(z.literal('')),
    
  clinicToken: z.string()
    .optional()
    .or(z.literal('')),
    
  apiToken: z.string()
    .optional()
    .or(z.literal(''))
});