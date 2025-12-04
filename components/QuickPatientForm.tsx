
import React, { useState } from 'react';
import { UserPlus, X, Save, AlertCircle } from 'lucide-react';
import { dataService } from '../services/mockSupabase';
import { Patient, PatientStatus } from '../types';
import { useToast } from './ToastProvider';
import { validateCPF, formatCPF, normalizeCPF } from '../utils/cpfUtils';
import { formatPhone, normalizePhone } from '../utils/phoneUtils';
import { validateSafe } from '../utils/validator';
import { PatientSchema } from '../utils/validationSchemas';

interface QuickPatientFormProps {
  organizationId: string;
  onSuccess: (patient: Patient) => void;
  onCancel: () => void;
  initialName?: string;
}

export const QuickPatientForm: React.FC<QuickPatientFormProps> = ({ 
  organizationId, 
  onSuccess, 
  onCancel,
  initialName = '' 
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: initialName,
    phone: '',
    cpf: '',
    email: '',
    birthDate: ''
  });

  const handleChange = (field: string, value: string) => {
    let newValue = value;
    
    // Auto-masking
    if (field === 'phone') newValue = formatPhone(value);
    if (field === 'cpf') newValue = formatCPF(value);
    
    setFormData(prev => ({ ...prev, [field]: newValue }));
    if (error) setError('');
    if (validationErrors.length) setValidationErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors([]);

    // 1. Zod Validation
    const validation = validateSafe(PatientSchema, {
      ...formData,
      cpf: formData.cpf || undefined, // handle empty strings as undefined for schema optional
      email: formData.email || undefined,
      birthDate: formData.birthDate || undefined,
      organizationId // required
    });

    if (!validation.success) {
      setValidationErrors(validation.errors || ['Erro de validação']);
      return;
    }

    // 2. Additional CPF Validation (Algorithm check)
    if (formData.cpf && !validateCPF(formData.cpf)) {
      setError('CPF inválido.');
      return;
    }

    setLoading(true);
    try {
      // 3. Save (Backend will validate again)
      const validData = validation.data as any;
      const newPatient = await dataService.createPatient({
        organizationId,
        name: validData.name,
        phone: validData.phone,
        cpf: validData.cpf || undefined,
        email: validData.email || undefined,
        birthDate: validData.birthDate || undefined,
        status: PatientStatus.Active
      });
      
      showToast('success', 'Paciente cadastrado com sucesso!');
      onSuccess(newPatient);
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar paciente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in slide-in-from-right duration-200">
      <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
        <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
          <UserPlus size={16} className="text-blue-600" />
          Novo Paciente
        </h4>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Error Display */}
        {(error || validationErrors.length > 0) && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 mb-3">
                <div className="flex items-center gap-2 font-bold mb-1">
                    <AlertCircle size={14} />
                    <span>Verifique os erros:</span>
                </div>
                {error && <p>{error}</p>}
                {validationErrors.map((err, i) => (
                    <p key={i}>{err}</p>
                ))}
            </div>
        )}

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nome Completo <span className="text-red-500">*</span></label>
          <input 
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ex: Maria Silva"
            autoFocus
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Telefone <span className="text-red-500">*</span></label>
            <input 
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="(11) 99999-9999"
              maxLength={15}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">CPF</label>
            <input 
              value={formData.cpf}
              onChange={e => handleChange('cpf', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
           <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email</label>
            <input 
              type="email"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="email@exemplo.com"
            />
           </div>
           <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nascimento</label>
            <input 
              type="date"
              value={formData.birthDate}
              onChange={e => handleChange('birthDate', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
           </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
                <Save size={16} />
                Salvar Paciente
            </>
          )}
        </button>
      </form>
    </div>
  );
};
