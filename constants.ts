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
    name: 'Ana Silva',
    age: 34,
    condition: 'Pós-op Joelho',
    status: PatientStatus.Recovering,
    lastVisit: '2023-10-24',
    email: 'ana.silva@example.com',
    phone: '+55 11 99999-0001',
    nextStep: 'Fisioterapia Sessão 3'
  },
  {
    id: 'P002',
    name: 'Carlos Oliveira',
    age: 52,
    condition: 'Hipertensão',
    status: PatientStatus.Active,
    lastVisit: '2023-10-20',
    email: 'carlos.o@example.com',
    phone: '+55 11 99999-0002',
    nextStep: 'Check-up Mensal'
  },
  {
    id: 'P003',
    name: 'Mariana Costa',
    age: 28,
    condition: 'Rotina',
    status: PatientStatus.Active,
    lastVisit: '2023-10-25',
    email: 'mari.costa@example.com',
    phone: '+55 11 99999-0003',
    nextStep: 'Análise de Exames'
  },
  {
    id: 'P004',
    name: 'Roberto Santos',
    age: 45,
    condition: 'Diabetes Tipo 2',
    status: PatientStatus.Critical,
    lastVisit: '2023-10-15',
    email: 'roberto.s@example.com',
    phone: '+55 11 99999-0004',
    nextStep: 'Consulta Endocrinologia'
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'APT001',
    clinicId: 'ORG001',
    doctorId: 'DOC001',
    patientId: 'P001',
    patientName: 'Ana Silva',
    patientPhone: '+55 11 99999-0001',
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
    patientName: 'Mariana Costa',
    patientPhone: '+55 11 99999-0003',
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
    patientName: 'Carlos Oliveira',
    patientPhone: '+55 11 99999-0002',
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
    patientName: 'Roberto Santos',
    patientPhone: '+55 11 99999-0004',
    date: '2023-10-28',
    time: '15:00',
    status: AppointmentStatus.NAO_VEIO,
    procedure: 'Retorno',
    notes: 'Não atende telefone',
    createdAt: '2023-10-21T11:00:00Z',
    n8nProcessed: true
  }
];