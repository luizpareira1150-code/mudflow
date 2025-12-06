
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
    ['EM_CONTATO', 'AGENDADO', 'ATENDIDO', 'NAO_VEIO', 'BLOQUEADO', 'ATENDIMENTO_HUMANO'],
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

// 4. Schemas de Webhook do N8N (Discriminated Unions)

// Base fields required for all requests
const WebhookBase = z.object({
  authToken: z.string().min(1, 'Token de autenticação obrigatório'),
  clinicId: z.string().min(1, 'Clinic ID obrigatório'),
});

// Action-Specific Data Schemas
const CreateAppointmentData = z.object({
  action: z.literal('CREATE_APPOINTMENT'),
  data: z.object({
    doctorId: z.string().min(1, 'ID do médico obrigatório'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)'),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida (HH:MM)'),
    patientName: z.string().optional(),
    patientPhone: z.string().optional(),
    patientCPF: z.string().optional(),
    procedure: z.string().optional(),
    notes: z.string().optional()
  })
});

const UpdateStatusData = z.object({
  action: z.literal('UPDATE_STATUS'),
  data: z.object({
    appointmentId: z.string().min(1, 'ID do agendamento obrigatório'),
    newStatus: z.enum(['EM_CONTATO', 'AGENDADO', 'ATENDIDO', 'NAO_VEIO', 'BLOQUEADO', 'ATENDIMENTO_HUMANO'])
  })
});

const BlockScheduleData = z.object({
  action: z.literal('BLOCK_SCHEDULE'),
  data: z.object({
    doctorId: z.string().min(1, 'ID do médico obrigatório'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    startHour: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de início inválida'),
    endHour: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de fim inválida'),
    notes: z.string().optional()
  })
});

const CreateContactData = z.object({
  action: z.literal('CREATE_PATIENT_CONTACT'),
  data: z.object({
    patientName: z.string().min(1, 'Nome obrigatório'),
    patientPhone: z.string().min(8, 'Telefone obrigatório'),
    doctorId: z.string().min(1, 'ID do médico obrigatório'),
    message: z.string().optional()
  })
});

// ✅ NOVO SCHEMA PARA SUGGESTIONS
const GetSuggestionsData = z.object({
  action: z.literal('GET_SLOT_SUGGESTIONS'),
  data: z.object({
    patientPhone: z.string().min(8, 'Telefone do paciente obrigatório'),
    doctorId: z.string().min(1, 'ID do médico obrigatório')
  })
});

const HumanHandoverData = z.object({
  action: z.enum(['MOVE_TO_HUMAN_ATTENDANCE', 'DETECT_HUMAN_INTERVENTION']),
  data: z.object({
    appointmentId: z.string().min(1, 'ID do agendamento obrigatório'),
    patientName: z.string().optional(),
    patientPhone: z.string().optional()
  })
});

// The Discriminated Union
export const N8NWebhookSchema = WebhookBase.and(
  z.discriminatedUnion('action', [
    CreateAppointmentData,
    UpdateStatusData,
    BlockScheduleData,
    CreateContactData,
    GetSuggestionsData, // Adicionado aqui
    HumanHandoverData
  ])
);

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
