import React, { useState, useEffect } from 'react';
import { User, Doctor, AvailableSlot, AppointmentStatus } from '../types';
import { dataService } from '../services/mockSupabase';
import { DatePicker } from './DatePicker';
import { X, Check, AlertCircle, Phone, User as UserIcon, Calendar, Clock } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User;
  preSelectedDate?: string;
  preSelectedTime?: string;
  preSelectedDoctorId?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  user, 
  preSelectedDate,
  preSelectedTime,
  preSelectedDoctorId
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [procedures, setProcedures] = useState<string[]>([]);

  // Form State
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [procedure, setProcedure] = useState('');
  const [notes, setNotes] = useState('');

  // Initialization when modal opens
  useEffect(() => {
    if (isOpen) {
      // Load doctors
      dataService.getDoctors(user.clinicId).then(docs => {
        setDoctors(docs);
        // Priority: 1. Prop passed, 2. If only 1 doctor, 3. Empty
        if (preSelectedDoctorId) {
            setSelectedDoctor(preSelectedDoctorId);
        } else if(docs.length === 1) {
            setSelectedDoctor(docs[0].id);
        }
      });

      // Set initials
      setDate(preSelectedDate || new Date().toISOString().split('T')[0]);
      setSelectedTime(preSelectedTime || '');
      setPatientName('');
      setPatientPhone('');
      setNotes('');
      setError('');
      setLoading(false);
    }
  }, [isOpen, user.clinicId, preSelectedDate, preSelectedTime, preSelectedDoctorId]);

  // Load Slots & Procedures when Doctor/Date changes
  useEffect(() => {
    if (selectedDoctor && date) {
      setLoading(true);
      Promise.all([
        dataService.getAvailableSlots(user.clinicId, selectedDoctor, date),
        dataService.getProcedureOptions(user.clinicId, selectedDoctor)
      ]).then(([fetchedSlots, fetchedProcs]) => {
        setSlots(fetchedSlots);
        setProcedures(fetchedProcs);
        
        // Auto-select procedure if empty
        if(fetchedProcs.length > 0 && !procedure) setProcedure(fetchedProcs[0]);
        
        // If we have a preSelectedTime, ensure it is still valid/visible, otherwise clear it if it's not in the new slot list (optional strictness)
        setLoading(false);
      });
    }
  }, [selectedDoctor, date, user.clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !date || !selectedTime || !patientName || !patientPhone) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      await dataService.createAppointment({
        clinicId: user.clinicId,
        doctorId: selectedDoctor,
        patientId: `new_${Date.now()}`,
        patientName,
        patientPhone,
        date,
        time: selectedTime,
        status: AppointmentStatus.AGENDADO,
        procedure: procedure || 'Consulta',
        notes
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao criar agendamento.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Novo Agendamento</h3>
            <p className="text-sm text-slate-500">Preencha os dados do paciente</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          
          {/* 1. Doctor & Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Profissional</label>
              <select 
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                disabled={!!preSelectedDoctorId} // Disable if passed from grid context
                className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 appearance-none ${preSelectedDoctorId ? 'bg-slate-50 text-slate-500' : ''}`}
              >
                <option value="">Selecione...</option>
                {doctors.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name}</option>
                ))}
              </select>
            </div>
            
            <div className="col-span-2 sm:col-span-1">
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Data</label>
               <DatePicker value={date} onChange={setDate} />
            </div>
          </div>

          {/* 2. Slots Selection */}
          {selectedDoctor && (
            <div className="animate-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                <span>Horários Disponíveis</span>
                {loading && <span className="text-xs text-blue-500 animate-pulse">Atualizando...</span>}
              </label>
              
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                {slots.length === 0 && !loading ? (
                    <div className="col-span-full text-center py-4 text-sm text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        Nenhum horário disponível.
                    </div>
                ) : (
                    slots.map(slot => (
                    <button
                        key={slot.time}
                        type="button"
                        disabled={slot.isBooked}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`
                        px-2 py-2 text-sm font-medium rounded-lg border transition-all text-center
                        ${selectedTime === slot.time
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                            : slot.isBooked
                            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed decoration-slate-400 hidden' // Hide booked in modal to clean up
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                        }
                        `}
                    >
                        {slot.time}
                    </button>
                    ))
                )}
              </div>
            </div>
          )}

          {/* 3. Patient Info */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do Paciente</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone / WhatsApp</label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                        type="tel"
                        value={patientPhone}
                        onChange={e => setPatientPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Procedimento</label>
                    <select
                        value={procedure}
                        onChange={e => setProcedure(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                    >
                        {procedures.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Observações</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  placeholder="Detalhes adicionais..."
                />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm animate-pulse">
                <AlertCircle size={16} />
                {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 flex items-center gap-2"
          >
            {loading ? (
                <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
                </>
            ) : (
                <>
                <Check size={18} />
                Confirmar Agendamento
                </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};