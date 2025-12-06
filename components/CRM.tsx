import React, { useEffect, useState } from 'react';
import { Appointment, AppointmentStatus, User, Column, Doctor } from '../types';
import { dataService } from '../services/mockSupabase';
import { Phone, User as UserIcon, Edit2, X, Save, Trash2, Calendar as CalendarIcon, Stethoscope, ChevronDown, AlertTriangle, MessageSquare } from 'lucide-react';
import { DatePicker } from './DatePicker';
import { useToast } from './ToastProvider';
import { useRealtimeAppointments } from '../hooks/useRealtimeData';
import { RealtimeIndicator } from './RealtimeIndicator';

interface CRMProps {
  user: User;
  doctors: Doctor[];
  selectedDoctorId: string;
  onDoctorChange: (id: string) => void;
  isConsultorio?: boolean;
}

const COLUMNS: Column[] = [
  { id: AppointmentStatus.EM_CONTATO, title: 'Bot / Em Contato', color: 'bg-yellow-100 border-yellow-300' },
  { id: AppointmentStatus.ATENDIMENTO_HUMANO, title: 'Atend. Humano', color: 'bg-purple-100 border-purple-300' },
  { id: AppointmentStatus.AGENDADO, title: 'Agendados', color: 'bg-blue-100 border-blue-300' },
  { id: AppointmentStatus.ATENDIDO, title: 'Atendidos', color: 'bg-green-100 border-green-300' },
  { id: AppointmentStatus.NAO_VEIO, title: 'Não Veio', color: 'bg-red-100 border-red-300' },
];

export const CRM: React.FC<CRMProps> = ({ user, doctors, selectedDoctorId, onDoctorChange, isConsultorio }) => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // ✅ REALTIME HOOK: Substitui polling manual
  // O hook gerencia fetching inicial e updates via WebSocket
  const { data: appointments, loading, setData: setAppointments, error, refresh } = useRealtimeAppointments(
    user.clinicId, 
    selectedDate, 
    selectedDoctorId
  );

  const [draggedApptId, setDraggedApptId] = useState<string | null>(null);

  // Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  // Edit States for Modal
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editProcedure, setEditProcedure] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [procedureOptions, setProcedureOptions] = useState<string[]>([]);

  // 1. Fetch Procedure Options (dynamic per doctor)
  useEffect(() => {
    if (selectedDoctorId) {
        dataService.getProcedureOptions(user.clinicId, selectedDoctorId).then(setProcedureOptions);
    }
  }, [user.clinicId, selectedDoctorId]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedApptId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: AppointmentStatus) => {
    e.preventDefault();
    if (!draggedApptId || !appointments) return;

    const appt = appointments.find(a => a.id === draggedApptId);
    if (!appt || appt.status === targetStatus) return;

    // --- OPTIMISTIC UPDATE START ---
    const previousAppt = { ...appt };

    try {
        // 2. Atualização Otimista: Atualiza a UI imediatamente (Local)
        setAppointments(prev => (prev || []).map(a => 
            a.id === draggedApptId ? { ...a, status: targetStatus } : a
        ));

        // 3. Chamada ao Servidor (Background)
        // O serviço emite evento WebSocket que atualizará outras abas
        await dataService.updateAppointmentStatus(draggedApptId, targetStatus);
        
        showToast('success', `Movido para ${targetStatus.replace(/_/g, ' ')}`);

    } catch (error) {
        // 5. Erro: Rollback (Reverter ao estado anterior)
        console.error("Drop failed:", error);
        setAppointments(prev => (prev || []).map(a => 
            a.id === draggedApptId ? previousAppt : a
        ));
        showToast('error', 'Erro ao atualizar status. Revertendo...');
    } finally {
        setDraggedApptId(null);
    }
    // --- OPTIMISTIC UPDATE END ---
  };

  const openDetails = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setEditDate(appt.date);
    setEditTime(appt.time);
    setEditProcedure(appt.procedure || '');
    setEditNotes(appt.notes || '');
    setIsCancelModalOpen(false);
    setCancellationReason('');
    setIsDetailsModalOpen(true);
  };

  const handleUpdateAppointment = async () => {
    if (!selectedAppointment) return;
    try {
      await dataService.updateAppointment({
        ...selectedAppointment,
        date: editDate,
        time: editTime,
        procedure: editProcedure,
        notes: editNotes
      });
      // WebSocket atualizará a UI automaticamente
      setIsDetailsModalOpen(false);
      showToast('success', 'Alterações salvas!');
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao atualizar.');
    }
  };

  const handleDeleteAppointment = async () => {
      if (!selectedAppointment) return;
      
      // Mandatoriedade
      if (!cancellationReason.trim()) {
          showToast('warning', 'O motivo do cancelamento é obrigatório.');
          return;
      }

      try {
          await dataService.deleteAppointment(selectedAppointment.id, cancellationReason);
          // WebSocket atualizará a UI automaticamente
          setIsCancelModalOpen(false);
          setIsDetailsModalOpen(false);
          showToast('success', 'Agendamento cancelado.');
      } catch (e) { 
          showToast('error', 'Erro ao excluir.');
      } finally {
        setCancellationReason('');
      }
  };

  const generateTimeOptions30Min = () => {
      const options = [];
      for (let i = 0; i < 24; i++) {
        const h = String(i).padStart(2, '0');
        options.push(`${h}:00`);
        options.push(`${h}:30`);
      }
      return options;
  };

  const currentDoctorName = doctors.find(d => d.id === selectedDoctorId)?.name;
  
  // Safe default
  const appointmentList = appointments || [];

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestão de Pacientes (CRM)</h2>
          <p className="text-sm text-gray-500">
            Arraste os cards para mudar o status • Atualização em tempo real
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            <RealtimeIndicator />
            
            {!isConsultorio ? (
                <div className="relative">
                    <UserIcon size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
                    <select
                        value={selectedDoctorId}
                        onChange={(e) => onDoctorChange(e.target.value)}
                        className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none min-w-[200px]"
                    >
                        {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>{doc.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-3.5 text-gray-400 pointer-events-none" />
                </div>
            ) : (
                <div className="flex items-center gap-2 text-gray-600 font-medium bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                    <UserIcon size={16} className="text-blue-600" />
                    {currentDoctorName || 'Meu Consultório'}
                </div>
            )}
            
            <div className="w-40">
                <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        {loading ? (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">Sincronizando...</p>
                </div>
            </div>
        ) : error ? (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertTriangle size={48} className="mx-auto text-red-300 mb-4" />
                    <p className="text-red-600">Erro ao carregar dados</p>
                    <button onClick={refresh} className="mt-4 text-blue-600 hover:underline">
                        Tentar novamente
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex gap-4 h-full min-w-[1200px]">
            {COLUMNS.map(column => (
                <div 
                    key={column.id} 
                    className="flex-1 flex flex-col rounded-xl border bg-gray-100/50 border-gray-200"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.id)}
                >
                <div className={`p-4 border-b border-gray-200 rounded-t-xl ${column.color.replace('bg-', 'bg-opacity-50 ')}`}>
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-sm uppercase tracking-wide text-gray-700">
                            {column.title}
                        </h3>
                        <span className="bg-white/50 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                            {appointmentList.filter(a => a.status === column.id).length}
                        </span>
                    </div>
                </div>

                <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                    {appointmentList.filter(a => a.status === column.id).length === 0 ? (
                        <div className="text-center text-gray-300 text-sm mt-10 italic">
                            {column.id === AppointmentStatus.ATENDIMENTO_HUMANO 
                                ? 'Nenhum paciente aguardando'
                                : 'Vazio'}
                        </div>
                    ) : (
                        appointmentList
                            .filter(a => a.status === column.id)
                            .map(appt => (
                                <div
                                    key={appt.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, appt.id)}
                                    onClick={() => openDetails(appt)}
                                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 cursor-move transition-all group active:scale-95 active:shadow-lg hover:shadow-md"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-gray-800">{appt.time}</span>
                                        {appt.procedure && column.id !== AppointmentStatus.ATENDIMENTO_HUMANO && (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 truncate max-w-[100px]">
                                                {appt.procedure}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <UserIcon size={14} className="text-gray-400" />
                                        <p className="font-medium text-gray-900 text-sm truncate">{appt.patient?.name || 'Paciente'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone size={14} className="text-gray-400" />
                                        <p className="text-xs text-gray-500">{appt.patient?.phone}</p>
                                    </div>
                                    {appt.notes && (
                                        <div className="mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-400 italic truncate">
                                            "{appt.notes}"
                                        </div>
                                    )}
                                    
                                    {column.id === AppointmentStatus.ATENDIMENTO_HUMANO && (
                                        <button className="mt-3 w-full py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1 shadow-sm">
                                            <MessageSquare size={12} />
                                            Assumir no WhatsApp
                                        </button>
                                    )}
                                </div>
                            ))
                    )}
                </div>
                </div>
            ))}
            </div>
        )}
      </div>

      {/* Details Modal */}
      {isDetailsModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                            <Edit2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Tipo de Consulta</h3>
                            <p className="text-sm text-gray-500">Visualizar e editar dados</p>
                        </div>
                    </div>
                    <button onClick={() => setIsDetailsModalOpen(false)}><X size={20} /></button>
                </div>

                <div className="space-y-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-1"><UserIcon size={20} /></div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Paciente</h4>
                            <p className="text-lg font-semibold text-gray-900">{selectedAppointment.patient?.name || 'Não encontrado'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="bg-green-50 p-2 rounded-lg text-green-600 mt-1"><Phone size={20} /></div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contato</h4>
                            <p className="text-base text-gray-700 font-medium">{selectedAppointment.patient?.phone}</p>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6">
                         <p className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                             <CalendarIcon size={12} /> Editar Agendamento
                         </p>
                         
                         <div className="grid grid-cols-2 gap-3 mb-4">
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Data</label>
                                 <DatePicker value={editDate} onChange={setEditDate} />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Hora</label>
                                 <div className="relative">
                                   <select 
                                       value={editTime}
                                       onChange={(e) => setEditTime(e.target.value)}
                                       className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 h-[42px] appearance-none"
                                   >
                                       {generateTimeOptions30Min().map((t) => (
                                           <option key={t} value={t}>{t}</option>
                                       ))}
                                   </select>
                                   <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                 </div>
                             </div>
                         </div>
                         
                         <div className="space-y-4">
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Tipo de Consulta</label>
                                 <div className="relative">
                                     <Stethoscope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                     <select
                                         value={editProcedure}
                                         onChange={e => setEditProcedure(e.target.value)}
                                         className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none appearance-none h-[42px]"
                                     >
                                         <option value="" disabled>Selecione...</option>
                                         {procedureOptions.map(opt => (
                                             <option key={opt} value={opt}>{opt}</option>
                                         ))}
                                     </select>
                                     <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                 </div>
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Observações</label>
                                 <textarea
                                     value={editNotes}
                                     onChange={e => setEditNotes(e.target.value)}
                                     className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                                     rows={2}
                                     placeholder="Adicionar notas..."
                                 />
                             </div>
                         </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setIsCancelModalOpen(true)}
                        className="flex-1 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors flex justify-center items-center gap-2 shadow-sm"
                    >
                        <Trash2 size={18} />
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleUpdateAppointment}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-md flex justify-center items-center gap-2"
                    >
                        <Save size={18} />
                        Salvar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Cancellation Pop-up Modal */}
      {isCancelModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={24} className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Confirmar Cancelamento</h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                    Esta ação removerá o agendamento da lista.
                </p>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                        Motivo do Cancelamento <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        placeholder="Descreva o motivo..."
                        className="w-full bg-white border border-red-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                        rows={3}
                        autoFocus
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => { setIsCancelModalOpen(false); setCancellationReason(''); }}
                        className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        disabled={loading} // Hook loading state
                    >
                        Voltar
                    </button>
                    <button
                        onClick={handleDeleteAppointment}
                        disabled={loading || !cancellationReason.trim()}
                        className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};