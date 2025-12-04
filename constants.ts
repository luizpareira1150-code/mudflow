
import { Patient, Appointment, AppointmentStatus, Doctor, Organization, AccountType, PatientStatus } from './types';

export const MOCK_ORGANIZATION: Organization = {
  id: 'ORG001',
  name: 'MedFlow Clinic',
  accountType: AccountType.CLINICA,
  ownerUserId: 'USR001',
  maxDoctors: 5
};

export const MOCK_DOCTORS: Doctor[] = [
  {
    id: 'DOC001',
    organizationId: 'ORG001',
    name: 'Dr. Admin',
    specialty: 'Cardiologia',
    color: 'bg-blue-100 text-blue-700'
  },
  {
    id: 'DOC002',
    organizationId: 'ORG001',
    name: 'Dra. Sarah',
    specialty: 'Dermatologia',
    color: 'bg-purple-100 text-purple-700'
  }
];

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'P001',
    organizationId: 'ORG001',
    name: 'Ana Silva',
    phone: '+55 11 99999-0001',
    email: 'ana.silva@example.com',
    status: PatientStatus.Recovering,
    condition: 'Pós-op Joelho',
    lastVisit: '2023-10-24',
    nextStep: 'Fisioterapia Sessão 3',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-10-24T00:00:00Z'
  },
  {
    id: 'P002',
    organizationId: 'ORG001',
    name: 'Carlos Oliveira',
    phone: '+55 11 99999-0002',
    email: 'carlos.o@example.com',
    status: PatientStatus.Active,
    condition: 'Hipertensão',
    lastVisit: '2023-10-20',
    nextStep: 'Check-up Mensal',
    createdAt: '2023-02-01T00:00:00Z',
    updatedAt: '2023-10-20T00:00:00Z'
  },
  {
    id: 'P003',
    organizationId: 'ORG001',
    name: 'Mariana Costa',
    phone: '+55 11 99999-0003',
    email: 'mari.costa@example.com',
    status: PatientStatus.Active,
    condition: 'Rotina',
    lastVisit: '2023-10-25',
    nextStep: 'Análise de Exames',
    createdAt: '2023-03-01T00:00:00Z',
    updatedAt: '2023-10-25T00:00:00Z'
  },
  {
    id: 'P004',
    organizationId: 'ORG001',
    name: 'Roberto Santos',
    phone: '+55 11 99999-0004',
    email: 'roberto.s@example.com',
    status: PatientStatus.Critical,
    condition: 'Diabetes Tipo 2',
    lastVisit: '2023-10-15',
    nextStep: 'Consulta Endocrinologia',
    createdAt: '2023-04-01T00:00:00Z',
    updatedAt: '2023-10-15T00:00:00Z'
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'APT001',
    clinicId: 'ORG001',
    doctorId: 'DOC001',
    patientId: 'P001',
    patient: MOCK_PATIENTS[0],
    date: '2023-10-27',
    time: '09:00',
    status: AppointmentStatus.AGENDADO,
    procedure: 'Retorno Cirúrgico',
    notes: 'Trazer exames de imagem',
    createdAt: '2023-10-20T10:00:00Z',
    n8nProcessed: true
  },
  {
    id: 'APT002',
    clinicId: 'ORG001',
    doctorId: 'DOC002',
    patientId: 'P003',
    patient: MOCK_PATIENTS[2],
    date: '2023-10-27',
    time: '10:30',
    status: AppointmentStatus.EM_CONTATO,
    procedure: 'Primeira Consulta',
    notes: 'Aguardando confirmação via WhatsApp',
    createdAt: '2023-10-26T14:30:00Z',
    n8nProcessed: false
  },
  {
    id: 'APT003',
    clinicId: 'ORG001',
    doctorId: 'DOC001',
    patientId: 'P002',
    patient: MOCK_PATIENTS[1],
    date: '2023-10-28',
    time: '14:00',
    status: AppointmentStatus.ATENDIDO,
    procedure: 'Check-up',
    notes: 'Receita renovada',
    createdAt: '2023-10-15T09:15:00Z',
    n8nProcessed: true
  },
  {
    id: 'APT004',
    clinicId: 'ORG001',
    doctorId: 'DOC002',
    patientId: 'P004',
    patient: MOCK_PATIENTS[3],
    date: '2023-10-28',
    time: '15:00',
    status: AppointmentStatus.NAO_VEIO,
    procedure: 'Retorno',
    notes: 'Não atende telefone',
    createdAt: '2023-10-21T11:00:00Z',
    n8nProcessed: true
  }
];
