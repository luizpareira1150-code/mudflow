
import React, { useState, useEffect } from 'react';
import { User, Doctor, AppointmentStatus } from '../types';
import { dataService } from '../services/mockSupabase';
import { DatePicker } from './DatePicker';
import { X, Lock, AlertCircle, Clock, ChevronDown } from 'lucide-react';
import { useToast } from './ToastProvider';

interface BlockScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User;
  doctors: Doctor[];
  preSelectedDate: string;
  preSelectedDoctorId: string;
}

export const BlockScheduleModal: React.FC<BlockScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user,
  doctors,
  preSelectedDate,
  preSelectedDoctorId
}) => {
  const { showToast } = useToast();
  const [selectedDoctorId, setSelectedDoctorId] = useState(preSelectedDoctorId);
  const [date, setDate] = useState(preSelectedDate);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
        setSelectedDoctorId(preSelectedDoctorId || (doctors[0]?.id || ''));
        setDate(preSelectedDate);
        setReason('');
    }
  }, [isOpen, preSelectedDate, preSelectedDoctorId, doctors]);

  const generateTimeOptions = () => {
    const options = [];
    for (let i = 0; i < 24; i++) {
      const h = String(i).padStart(2, '0');
      options.push(`${h}:00`);
      options.push(`${h}:30`);
    }
    return options;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !date || !startTime || !endTime) {
        showToast('error', 'Preencha todos os campos obrigatórios.');
        return;
    }
    
    if (startTime >= endTime) {
        showToast('error', 'Horário final deve ser maior que o inicial.');
        return;
    }

    setIsSubmitting(true);

    try {
        const config = await dataService.getAgendaConfig(user.clinicId, selectedDoctorId);
        const interval = config.intervalMinutes || 30;

        const slotsToBlock = [];
        let current = new Date(`2000-01-01T${startTime}:00`);
        const end = new Date(`2000-01-01T${endTime}:00`);

        while (current < end) {
            const timeStr = current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            slotsToBlock.push({
                clinicId: user.clinicId,
                doctorId: selectedDoctorId,
                date: date,
                time: timeStr,
                status: AppointmentStatus.BLOQUEADO,
                notes: reason || 'Bloqueio Manual'
            });
            current.setMinutes(current.getMinutes() + interval);
        }

        if (slotsToBlock.length === 0) {
             showToast('warning', 'Nenhum horário gerado neste intervalo.');
             setIsSubmitting(false);
             return;
        }

        await dataService.createBatchAppointments(slotsToBlock);
        showToast('success', `${slotsToBlock.length} horários bloqueados com sucesso.`);
        onSuccess();
        onClose();

    } catch (error) {
        console.error(error);
        showToast('error', 'Erro ao processar bloqueio.');
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Lock size={20} className="text-red-500" />
                Fechar Horários
            </h3>
            <p className="text-sm text-slate-500">Bloqueie um período da agenda</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {doctors.length > 1 && (
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Médico</label>
                    <div className="relative">
                        <select 
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-700 appearance-none text-sm font-medium"
                        >
                            {doctors.map(doc => (
                                <option key={doc.id} value={doc.id}>{doc.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            )}

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Data do Bloqueio</label>
                <DatePicker value={date} onChange={setDate} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">De</label>
                    <div className="relative">
                        <select
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500 text-sm appearance-none"
                        >
                            {generateTimeOptions().map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Até</label>
                    <div className="relative">
                        <select
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500 text-sm appearance-none"
                        >
                            {generateTimeOptions().map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Motivo (Opcional)</label>
                <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: Reunião, Almoço..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white"
                />
            </div>

            <div className="bg-red-50 p-3 rounded-lg flex items-start gap-2 border border-red-100">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                    Isso criará agendamentos de bloqueio para todos os horários livres no intervalo selecionado.
                </p>
            </div>

            <div className="pt-2">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/30 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                    {isSubmitting ? 'Processando...' : 'Confirmar Bloqueio'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};
