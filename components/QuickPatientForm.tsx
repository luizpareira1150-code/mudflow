
import React, { useState, useEffect } from 'react';
import { X, AlertCircle, FileText, Calendar, Clock, Stethoscope, ChevronDown, User, Phone, CreditCard } from 'lucide-react';
import { authService, settingsService, doctorService, patientService } from '../services/mockSupabase';
import { appointmentService } from '../services/appointmentService';
import { Patient, PatientStatus } from '../types';
import { useToast } from './ToastProvider';
import { validateCPF, formatCPF } from '../utils/cpfUtils';
import { formatPhone } from '../utils/phoneUtils';
import { validateSafe } from '../utils/validator';
import { PatientSchema } from '../utils/validationSchemas';
import { DatePicker } from './DatePicker';
import { sanitizeInput } from '../utils/sanitizer';

interface QuickPatientFormProps {
  organizationId: string;
  onSuccess: (patient: Patient) => void;
  onCancel: () => void;
  onConflict?: () => void;
  initialName?: string;
  initialDate?: string;
  initialTime?: string;
  initialDoctorId?: string;
}

export const QuickPatientForm: React.FC<QuickPatientFormProps> = ({ 
  organizationId, 
  onSuccess, 
  onCancel,
  onConflict,
  initialName = '',
  initialDate,
  initialTime,
  initialDoctorId
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [procedures, setProcedures] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<{id: string, name: string}[]>([]);

  // Form State - Unified Patient & Appointment
  const [formData, setFormData] = useState({
    // Patient Data
    name: initialName,
    phone: '',
    cpf: '',
    birthDate: '',
    // Appointment Data
    apptDate: initialDate || new Date().toISOString().split('T')[0],
    apptTime: initialTime || '',
    apptProcedure: '',
    doctorId: initialDoctorId || '',
    // Shared
    notes: ''
  });

  // Load procedures and doctors
  useEffect(() => {
    const loadData = async () => {
        const [procs, docs] = await Promise.all([
            settingsService.getProcedureOptions(organizationId),
            doctorService.getDoctors(organizationId)
        ]);
        setProcedures(procs);
        setDoctors(docs);

        // Auto-select doctor if only one or if initial passed
        if (!formData.doctorId) {
            if (initialDoctorId) {
                setFormData(prev => ({ ...prev, doctorId: initialDoctorId }));
            } else if (docs.length > 0) {
                setFormData(prev => ({ ...prev, doctorId: docs[0].id }));
            }
        }
    };
    loadData();
  }, [organizationId, initialDoctorId]);

  const handleChange = (field: string, value: string) => {
    let newValue = value;
    
    // Auto-masking
    if (field === 'phone') newValue = formatPhone(value);
    if (field === 'cpf') newValue = formatCPF(value);
    
    setFormData(prev => ({ ...prev, [field]: newValue }));
    if (error) setError('');
    if (validationErrors.length) setValidationErrors([]);
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let i = 7; i < 20; i++) {
      const h = String(i).padStart(2, '0');
      options.push(`${h}:00`);
      options.push(`${h}:30`);
    }
    return options;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors([]);

    // 1. Basic Validation
    if (formData.cpf && !validateCPF(formData.cpf)) {
      setError('CPF inválido.');
      return;
    }

    const isBookingContext = !!initialDate || !!initialTime;
    const hasApptData = formData.apptDate || formData.apptTime || isBookingContext;
    
    if (hasApptData) {
        if (!formData.apptDate || !formData.apptTime) {
            setError('Para agendar, preencha Data e Horário.');
            return;
        }
        if (!formData.doctorId) {
            setError('Selecione um médico para o agendamento.');
            return;
        }
    }

    setLoading(true);

    // Sanitize notes once
    const safeNotes = sanitizeInput(formData.notes);

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) throw new Error("Usuário não autenticado");

      // Determine flow: Pure Patient Create VS Patient + Appointment Transaction
      if (hasApptData) {
          // --- TRANSACTIONAL FLOW (ATOMIC) ---
          const { patient } = await appointmentService.processBookingTransaction({
              clinicId: organizationId,
              doctorId: formData.doctorId,
              date: formData.apptDate,
              time: formData.apptTime,
              procedure: formData.apptProcedure || 'Consulta',
              notes: safeNotes,
              newPatientData: {
                  name: formData.name,
                  phone: formData.phone,
                  cpf: formData.cpf || undefined,
                  birthDate: formData.birthDate || undefined,
                  notes: safeNotes
              },
              currentUser: currentUser
          });

          showToast('success', 'Paciente cadastrado e agendado!');
          onSuccess(patient);

      } else {
          // --- STANDARD PATIENT CREATION FLOW ---
          // Validate using Zod schema via helper
          const validation = validateSafe(PatientSchema, {
            name: formData.name,
            phone: formData.phone,
            organizationId,
            cpf: formData.cpf || undefined, 
            birthDate: formData.birthDate || undefined,
            notes: safeNotes,
          });

          if (!validation.success) {
            setValidationErrors(validation.errors || ['Erro de validação']);
            setLoading(false);
            return;
          }

          const validData = validation.data as any;
          const newPatient = await patientService.createPatient({
            organizationId,
            name: validData.name,
            phone: validData.phone,
            cpf: validData.cpf || undefined,
            birthDate: validData.birthDate || undefined,
            notes: validData.notes || undefined,
            status: PatientStatus.Active
          }, undefined, currentUser);

          showToast('success', 'Paciente cadastrado com sucesso!');
          onSuccess(newPatient);
      }
      
    } catch (err: any) {
      let msg = err.message || "Erro desconhecido.";
      if (msg.startsWith('CONFLICT_DETECTED:')) {
          msg = msg.replace('CONFLICT_DETECTED:', '');
          showToast('warning', msg); // Warning is better for conflicts
          if (onConflict) onConflict();
      } else {
          showToast('error', msg);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-none h-full flex flex-col animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
              {initialDate ? 'Novo Agendamento' : 'Novo Cadastro'}
          </h3>
          <p className="text-xs text-slate-500">
              {initialDate ? 'Registre o paciente para confirmar o horário.' : 'Preencha os dados do paciente.'}
          </p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
        
        {/* Error Feedback */}
        {(error || validationErrors.length > 0) && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 font-bold mb-2">
                    <AlertCircle size={16} />
                    <span>Atenção:</span>
                </div>
                {error && <p className="mb-1 font-medium">{error}</p>}
                {validationErrors.length > 0 && (
                    <ul className="list-disc list-inside opacity-80">
                      {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                )}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Patient */}
            <div className="space-y-5">
                <div className="flex items-center gap-2 text-blue-600 border-b border-blue-100 pb-2 mb-2">
                    <User size={18} />
                    <h4 className="font-bold text-sm uppercase tracking-wide">Dados do Paciente</h4>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo *</label>
                    <input 
                        value={formData.name}
                        onChange={e => handleChange('name', e.target.value)}
                        className="w-full border border-slate-300 bg-white text-gray-900 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Nome do paciente"
                        autoFocus
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone *</label>
                        <div className="relative">
                            <input 
                                value={formData.phone}
                                onChange={e => handleChange('phone', e.target.value)}
                                className="w-full border border-slate-300 bg-white text-gray-900 rounded-lg pl-8 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="(00) 00000-0000"
                            />
                            <Phone size={14} className="absolute left-2.5 top-3 text-slate-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF</label>
                        <div className="relative">
                            <input 
                                value={formData.cpf}
                                onChange={e => handleChange('cpf', e.target.value)}
                                className="w-full border border-slate-300 bg-white text-gray-900 rounded-lg pl-8 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="000.000.000-00"
                            />
                            <CreditCard size={14} className="absolute left-2.5 top-3 text-slate-400" />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Nascimento</label>
                    <input 
                        type="date"
                        value={formData.birthDate}
                        onChange={e => handleChange('birthDate', e.target.value)}
                        className="w-full border border-slate-300 bg-white text-gray-900 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Right Column: Appointment */}
            <div className="space-y-5">
                <div className="flex items-center gap-2 text-green-600 border-b border-green-100 pb-2 mb-2">
                    <Calendar size={18} />
                    <h4 className="font-bold text-sm uppercase tracking-wide">Agendamento</h4>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                        <DatePicker 
                            value={formData.apptDate}
                            onChange={date => handleChange('apptDate', date)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label>
                        <div className="relative">
                            <select
                                value={formData.apptTime}
                                onChange={e => handleChange('apptTime', e.target.value)}
                                className="w-full border border-slate-300 bg-white text-gray-900 rounded-lg pl-3 pr-8 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none h-[42px]"
                            >
                                <option value="">Selecionar...</option>
                                {generateTimeOptions().map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <Clock size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Procedimento</label>
                    <div className="relative">
                        <select
                            value={formData.apptProcedure}
                            onChange={e => handleChange('apptProcedure', e.target.value)}
                            className="w-full border border-slate-300 bg-white text-gray-900 rounded-lg pl-9 pr-8 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none h-[42px]"
                        >
                            <option value="">Consulta Padrão</option>
                            {procedures.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <Stethoscope size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                        <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                    <div className="relative">
                        <textarea 
                            value={formData.notes}
                            onChange={e => handleChange('notes', e.target.value)}
                            className="w-full border border-slate-300 bg-white text-gray-900 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24"
                            placeholder="Queixa principal ou observações..."
                        />
                        <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                </div>
            </div>
        </div>
      </form>

      {/* Footer */}
      <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-xl">
        <button 
            onClick={onCancel}
            className="px-6 py-2.5 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-white transition-colors"
            disabled={loading}
        >
            Cancelar
        </button>
        <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {loading ? (
                <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processando...</span>
                </>
            ) : 'Salvar & Agendar'}
        </button>
      </div>
    </div>
  );
};
