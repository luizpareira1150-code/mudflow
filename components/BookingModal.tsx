
import React, { useState, useEffect } from 'react';
import { User, Patient, RecommendedSlot } from '../types';
import { dataService } from '../services/mockSupabase'; // Kept only for initial doctor load if needed, but hook handles it
import { DatePicker } from './DatePicker';
import { PatientSelector } from './PatientSelector';
import { useAppointmentBooking } from '../hooks/useAppointmentBooking';
import { X, Check, AlertCircle, ChevronDown, Tag, Sparkles, ArrowRight } from 'lucide-react';

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
  // UI Form State (Controlled Inputs)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [procedure, setProcedure] = useState('');
  const [notes, setNotes] = useState('');

  // Business Logic Hook
  const {
    doctors,
    slots,
    procedures,
    suggestions,
    loadingData,
    loadingSuggestions,
    isSubmitting,
    error,
    fetchSuggestions,
    clearSuggestions,
    bookAppointment
  } = useAppointmentBooking({
    clinicId: user.clinicId,
    selectedDoctorId,
    selectedDate: date
  });

  // Initialization Effect
  useEffect(() => {
    if (isOpen) {
      // Set initial values based on props or defaults
      if (preSelectedDoctorId) {
          setSelectedDoctorId(preSelectedDoctorId);
      } else {
          // If pure open, wait for doctors to load then set first? 
          // The hook loads doctors. We can listen to doctors change.
      }
      
      setDate(preSelectedDate || new Date().toISOString().split('T')[0]);
      setSelectedTime(preSelectedTime || '');
      setSelectedPatient(null);
      setProcedure('');
      setNotes('');
      clearSuggestions();
    }
  }, [isOpen, preSelectedDate, preSelectedTime, preSelectedDoctorId, clearSuggestions]);

  // Auto-select first doctor if none selected and doctors loaded
  useEffect(() => {
      if (isOpen && !selectedDoctorId && doctors.length > 0 && !preSelectedDoctorId) {
          setSelectedDoctorId(doctors[0].id);
      }
  }, [isOpen, doctors, selectedDoctorId, preSelectedDoctorId]);

  // Handlers
  const handleSuggestionClick = (rec: RecommendedSlot) => {
      setDate(rec.slot.date);
      setSelectedTime(rec.slot.time);
      clearSuggestions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await bookAppointment({
      patient: selectedPatient,
      time: selectedTime,
      procedure,
      notes,
      currentUser: user
    });

    if (success) {
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
        
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
          
          {/* Patient Selector */}
          <div className="space-y-2">
             <label className="block text-xs font-bold text-slate-500 uppercase">Paciente</label>
             <PatientSelector 
                organizationId={user.clinicId}
                selectedPatient={selectedPatient}
                onSelect={setSelectedPatient}
                onClear={() => setSelectedPatient(null)}
             />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Controls */}
            <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Profissional</label>
                  <div className="relative">
                    <select 
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                        disabled={!!preSelectedDoctorId}
                        className={`w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 appearance-none text-sm font-medium ${preSelectedDoctorId ? 'bg-slate-50 text-slate-500' : ''}`}
                    >
                        <option value="">Selecione...</option>
                        {doctors.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Data</label>
                   <DatePicker value={date} onChange={setDate} />
                </div>

                {/* AI Button */}
                {selectedDoctorId && selectedPatient && (
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => fetchSuggestions(selectedPatient.id, selectedDoctorId)}
                            disabled={loadingSuggestions}
                            className="w-full py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all text-xs font-bold flex items-center justify-center gap-2"
                        >
                            {loadingSuggestions ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Sparkles size={14} className="text-yellow-300" />
                            )}
                            Sugerir Melhores Horários
                        </button>
                    </div>
                )}
            </div>

            {/* Right: Slots */}
            <div>
               {/* Suggestions List */}
               {suggestions.length > 0 && (
                   <div className="mb-4 animate-in slide-in-from-top-2">
                       <label className="block text-xs font-bold text-purple-600 uppercase mb-2 flex items-center gap-1">
                           <Sparkles size={12} /> Sugestões Inteligentes
                       </label>
                       <div className="space-y-2">
                           {suggestions.map((rec, idx) => (
                               <button
                                   key={idx}
                                   type="button"
                                   onClick={() => handleSuggestionClick(rec)}
                                   className="w-full text-left p-3 rounded-lg border border-purple-100 bg-purple-50 hover:bg-purple-100 hover:border-purple-200 transition-all group"
                               >
                                   <div className="flex justify-between items-start">
                                       <div>
                                            <p className="font-bold text-purple-900 text-sm">
                                                {new Date(rec.slot.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} • {rec.slot.time}
                                            </p>
                                            <p className="text-[10px] text-purple-600 mt-0.5">{rec.reason}</p>
                                       </div>
                                       <div className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-500">
                                           <ArrowRight size={16} />
                                       </div>
                                   </div>
                               </button>
                           ))}
                       </div>
                   </div>
               )}

               {selectedDoctorId && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                    <span>Horários Disponíveis ({date.split('-').reverse().join('/')})</span>
                    {loadingData && <span className="text-xs text-blue-500 animate-pulse font-normal lowercase">atualizando...</span>}
                  </label>
                  
                  <div className="grid grid-cols-4 gap-2 max-h-[220px] overflow-y-auto p-1 custom-scrollbar">
                    {slots.length === 0 && !loadingData ? (
                        <div className="col-span-full text-center py-8 text-sm text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            Nenhum horário disponível nesta data.
                        </div>
                    ) : (
                        slots.map(slot => (
                        <button
                            key={slot.time}
                            type="button"
                            disabled={slot.isBooked || slot.isReserved}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`
                            px-1 py-2 text-sm font-medium rounded-lg border transition-all text-center
                            ${selectedTime === slot.time
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                                : (slot.isBooked || slot.isReserved)
                                ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed line-through'
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
             <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tipo de Consulta</label>
                <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select
                        value={procedure}
                        onChange={e => setProcedure(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 bg-white appearance-none border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm"
                    >
                        <option value="">Selecione...</option>
                        {procedures.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
             </div>

             <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Observações</label>
                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm"
                    placeholder="Detalhes adicionais..."
                />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm animate-pulse border border-red-100">
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
            disabled={isSubmitting || !selectedPatient || !selectedTime}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:shadow-none flex items-center gap-2"
          >
            {isSubmitting ? (
                <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processando...
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
