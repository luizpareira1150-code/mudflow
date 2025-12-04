
import React, { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus, User, AgendaConfig, Doctor, AvailableSlot } from '../types';
import { dataService, authService } from '../services/mockSupabase';
import { Clock, Plus, AlertCircle, CheckCircle, Settings, X, Save, Lock, CalendarOff, Trash2, User as UserIcon, Phone, Calendar as CalendarIcon, Edit2, FileText, Stethoscope, Tag, ChevronDown, AlertTriangle } from 'lucide-react';
import { DatePicker } from './DatePicker';
import { BookingModal } from './BookingModal';
import { useToast } from './ToastProvider';

interface AgendaProps {
  user: User;
  doctors?: Doctor[];
  selectedDoctorId?: string;
  onDoctorChange?: (id: string) => void;
  isConsultorio?: boolean;
}

export const Agenda: React.FC<AgendaProps> = ({ 
  user, 
  doctors: propDoctors, 
  selectedDoctorId: propSelectedDoctorId, 
  onDoctorChange: propOnDoctorChange, 
  isConsultorio 
}) => {
  const { showToast } = useToast();
  // Controlled vs Uncontrolled logic (to support standalone usage if needed)
  const isControlled = propDoctors !== undefined;
  const [internalDoctors, setInternalDoctors] = useState<Doctor[]>([]);
  const [internalSelectedDoctorId, setInternalSelectedDoctorId] = useState<string>('');
  
  const doctors = isControlled ? propDoctors! : internalDoctors;
  const selectedDoctorId = isControlled ? propSelectedDoctorId || '' : internalSelectedDoctorId;
  const onDoctorChange = isControlled ? propOnDoctorChange! : setInternalSelectedDoctorId;

  // State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [config, setConfig] = useState<AgendaConfig>({ clinicId: user.clinicId, startHour: '08:00', endHour: '18:00', intervalMinutes: 30, availableProcedures: [] });
  const [procedureOptions, setProcedureOptions] = useState<string[]>([]);
  
  // Modal State - New Appointment
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Modal State - Details
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  // Modal State - Cancellation
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  
  // Edit States for Existing Appointment
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editProcedure, setEditProcedure] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Config & Block Modals
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<AgendaConfig>({...config});
  const [newProcedureInput, setNewProcedureInput] = useState('');
  
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockData, setBlockData] = useState({
    date: new Date().toISOString().split('T')[0],
    startHour: '09:00',
    endHour: '17:00'
  });

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  // Fetch doctors if uncontrolled
  useEffect(() => {
      if (!isControlled) {
          dataService.getDoctors(user.clinicId).then(docs => {
              setInternalDoctors(docs);
              if (docs.length > 0) setInternalSelectedDoctorId(docs[0].id);
          });
      }
  }, [user.clinicId, isControlled]);

  // Fetch Config and Procedures whenever the selected doctor changes
  useEffect(() => {
    const init = async () => {
      if (!selectedDoctorId) return;
      const [conf, procs] = await Promise.all([
        dataService.getAgendaConfig(user.clinicId, selectedDoctorId),
        dataService.getProcedureOptions(user.clinicId, selectedDoctorId)
      ]);
      setConfig(conf);
      setTempConfig(conf);
      setProcedureOptions(procs);
    };
    init();
  }, [user.clinicId, selectedDoctorId]);

  // Subscribe to Slots (Real-time Simulation)
  const refreshSlots = async () => {
      if (!selectedDoctorId) return;
      const slots = await dataService.getAvailableSlots(user.clinicId, selectedDoctorId, selectedDate);
      setAvailableSlots(slots);
      setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    refreshSlots();
    // In a real app, we'd use a subscription. Here we can just poll or rely on refreshSlots.
    const interval = setInterval(refreshSlots, 5000);
    return () => clearInterval(interval);
  }, [selectedDate, selectedDoctorId]);

  const handleSlotClick = (slot: AvailableSlot) => {
    if (slot.isBooked && slot.appointment) {
      setSelectedAppointment(slot.appointment);
      setEditDate(slot.appointment.date);
      setEditTime(slot.appointment.time);
      setEditProcedure(slot.appointment.procedure || '');
      setEditNotes(slot.appointment.notes || '');
      // Reset cancel states
      setIsCancelModalOpen(false);
      setCancellationReason('');
      setIsDetailsModalOpen(true);
    } else {
      setSelectedSlot(slot);
      setIsModalOpen(true);
    }
  };

  const handleBookingSuccess = () => {
      setIsModalOpen(false);
      refreshSlots();
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;
    
    // Mandatoriedade do motivo (exceto se for BLOQUEADO que é sistema)
    if (selectedAppointment.status !== AppointmentStatus.BLOQUEADO && !cancellationReason.trim()) {
        showToast('warning', 'O motivo do cancelamento é obrigatório.');
        return;
    }

    try {
        setLoading(true);
        await dataService.deleteAppointment(selectedAppointment.id, cancellationReason);
        setIsCancelModalOpen(false);
        setIsDetailsModalOpen(false);
        refreshSlots();
        if (selectedAppointment.status === AppointmentStatus.BLOQUEADO) {
            showToast('success', 'Horário liberado.');
        } else {
            showToast('success', 'Agendamento cancelado.');
        }
    } catch (error) {
        showToast('error', 'Erro ao excluir.');
    } finally {
        setLoading(false);
        setCancellationReason('');
    }
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
      setIsDetailsModalOpen(false);
      refreshSlots();
      showToast('success', 'Consulta remarcada com sucesso!');
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao atualizar.');
    }
  };

  const handleBlockSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const slotsToBlock: string[] = [];
    const [startH, startM] = blockData.startHour.split(':').map(Number);
    const [endH, endM] = blockData.endHour.split(':').map(Number);
    let current = new Date(); current.setHours(startH, startM, 0, 0);
    const end = new Date(); end.setHours(endH, endM, 0, 0);

    while (current < end) {
      slotsToBlock.push(current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      current.setMinutes(current.getMinutes() + config.intervalMinutes);
    }

    const newBlockAppointments = slotsToBlock.map(time => ({
      clinicId: user.clinicId,
      doctorId: selectedDoctorId,
      patientId: 'system_block',
      patientName: 'AGENDA FECHADA',
      patientPhone: '',
      date: blockData.date,
      time: time,
      status: AppointmentStatus.BLOQUEADO,
      notes: 'Bloqueio manual'
    }));

    try {
      await dataService.createBatchAppointments(newBlockAppointments);
      setIsBlockModalOpen(false);
      refreshSlots();
      showToast('warning', `${newBlockAppointments.length} horários bloqueados com sucesso.`);
    } catch (error) {
      showToast('error', 'Erro ao fechar agenda.');
    }
  };

  // --- CONFIG SETTINGS HANDLERS ---
  const handleAddProcedure = () => {
    if (newProcedureInput && !tempConfig.availableProcedures.includes(newProcedureInput)) {
        setTempConfig({
            ...tempConfig,
            availableProcedures: [...tempConfig.availableProcedures, newProcedureInput]
        });
        setNewProcedureInput('');
    }
  };

  const handleRemoveProcedure = (proc: string) => {
      setTempConfig({
          ...tempConfig,
          availableProcedures: tempConfig.availableProcedures.filter(p => p !== proc)
      });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const isValid = await authService.verifyPassword(confirmPassword);
        if (!isValid) { 
            showToast('error', 'Senha incorreta.');
            return; 
        }
        
        const configToSave = { ...tempConfig, doctorId: selectedDoctorId };
        await dataService.updateAgendaConfig(configToSave);
        
        setConfig(configToSave);
        setProcedureOptions(configToSave.availableProcedures); 
        
        // Reset password state and close modals
        setConfirmPassword(''); 
        setIsConfigOpen(false);
        setIsPasswordModalOpen(false);
        refreshSlots();
        showToast('success', 'Configurações de agenda salvas!');

      } catch (e) { 
          showToast('error', 'Erro ao salvar configurações.');
      }
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
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

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500 bg-slate-50 rounded-2xl">
      {/* HEADER WITH DOCTOR SELECTOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Agenda Médica</h2>
          
          <div className="flex items-center gap-2">
             {!isConsultorio ? (
                 <div className="relative group">
                    <select
                        value={selectedDoctorId}
                        onChange={(e) => onDoctorChange(e.target.value)}
                        className="pr-10 py-1 bg-transparent border-none p-0 text-3xl font-bold text-slate-800 outline-none focus:ring-0 appearance-none min-w-[200px] cursor-pointer hover:text-blue-600 transition-colors"
                        style={{ backgroundImage: 'none' }}
                    >
                        {doctors.map(doc => (
                            <option key={doc.id} value={doc.id} className="text-lg text-slate-800">{doc.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={28} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
                 </div>
             ) : (
                 <div className="text-3xl font-bold text-slate-800 py-1">
                    {currentDoctorName || 'Meu Consultório'}
                 </div>
             )}

             <span className="text-gray-300 text-3xl font-light mx-2">|</span>
             <p className="text-sm text-gray-500 self-center pt-2">
                Intervalo: <span className="font-medium text-gray-700">{formatDuration(config.intervalMinutes)}</span>
             </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-40">
            <DatePicker value={selectedDate} onChange={setSelectedDate} />
          </div>
          
          <button 
            onClick={() => { setBlockData({...blockData, date: selectedDate}); setIsBlockModalOpen(true); }}
            className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm h-[42px] flex items-center gap-2"
          >
            <CalendarOff size={18} /> <span className="hidden sm:inline">FECHAR AGENDA</span>
          </button>

          <button 
            onClick={() => setIsConfigOpen(true)}
            className="p-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:text-blue-600 h-[42px] w-[42px] flex items-center justify-center"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* SLOT GRID */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-6 relative">
        {loading && (
             <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center text-gray-400">
                <div className="flex flex-col items-center">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    Atualizando...
                </div>
             </div>
        )}

        {availableSlots.length === 0 && !loading ? (
           <div className="h-full flex flex-col items-center justify-center text-gray-400">
             <AlertCircle size={48} className="mb-4 text-gray-300" />
             <p>Nenhum horário configurado para este médico.</p>
             <button onClick={() => setIsConfigOpen(true)} className="mt-4 text-blue-600 hover:underline">Configurar Agenda</button>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {availableSlots.map(slot => {
              const appt = slot.appointment;
              const isBlocked = appt?.status === AppointmentStatus.BLOQUEADO;
              const isAvailable = !slot.isBooked;

              if (isBlocked) {
                  return (
                    <div 
                        key={slot.id} 
                        onClick={() => handleSlotClick(slot)}
                        className="p-4 rounded-lg border-2 border-gray-100 bg-gray-50 flex items-center justify-between opacity-70 cursor-pointer hover:border-red-200 transition-colors"
                    >
                        <div>
                            <span className="text-lg font-bold text-gray-400">{slot.time}</span>
                            <p className="text-xs text-gray-400 font-medium mt-1">BLOQUEADO</p>
                        </div>
                        <Lock size={20} className="text-gray-300" />
                    </div>
                  )
              }

              return (
                <div 
                  key={slot.id}
                  onClick={() => handleSlotClick(slot)}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all cursor-pointer group
                    ${isAvailable 
                      ? 'border-gray-100 hover:border-blue-400 hover:bg-blue-50' 
                      : 'border-blue-100 bg-blue-50 hover:border-blue-300 hover:shadow-md'}
                  `}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-lg font-bold ${isAvailable ? 'text-gray-600' : 'text-blue-600'}`}>
                      {slot.time}
                    </span>
                    {isAvailable ? (
                      <Plus size={20} className="text-gray-300 group-hover:text-blue-500" />
                    ) : (
                      <CheckCircle size={20} className="text-blue-500" />
                    )}
                  </div>

                  {appt ? (
                    <div>
                      <p className="font-semibold text-gray-800 truncate">{appt.patientName}</p>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} /> {appt.status}
                        </p>
                        {appt.procedure && (
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded w-fit border border-indigo-100 flex items-center gap-1">
                                <Tag size={10} />
                                {appt.procedure}
                            </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2 group-hover:text-blue-500 transition-colors">Disponível</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Appointment Modal */}
      <BookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleBookingSuccess}
        user={user}
        preSelectedDate={selectedDate}
        preSelectedTime={selectedSlot?.time}
        preSelectedDoctorId={selectedDoctorId}
      />

      {/* Details Modal */}
      {isDetailsModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${selectedAppointment.status === AppointmentStatus.BLOQUEADO ? 'bg-gray-100' : 'bg-blue-100'}`}>
                            {selectedAppointment.status === AppointmentStatus.BLOQUEADO ? (
                                <Lock size={24} className="text-gray-600" />
                            ) : (
                                <Edit2 size={24} className="text-blue-600" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">
                                {selectedAppointment.status === AppointmentStatus.BLOQUEADO ? 'Agenda Fechada' : 'Gerenciar Consulta'}
                            </h3>
                            <p className="text-sm text-gray-500">Detalhes & Remarcação</p>
                        </div>
                    </div>
                    <button onClick={() => setIsDetailsModalOpen(false)}><X size={20} /></button>
                </div>

                <div className="space-y-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-1">
                            <UserIcon size={20} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Paciente</h4>
                            <p className="text-lg font-semibold text-gray-900">{selectedAppointment.patientName}</p>
                        </div>
                    </div>

                    {selectedAppointment.patientPhone && (
                        <div className="flex items-start gap-4">
                            <div className="bg-green-50 p-2 rounded-lg text-green-600 mt-1">
                                <Phone size={20} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contato</h4>
                                <p className="text-base text-gray-700 font-medium">{selectedAppointment.patientPhone}</p>
                            </div>
                        </div>
                    )}
                    
                     {selectedAppointment.status !== AppointmentStatus.BLOQUEADO ? (
                        <div className="border-t border-gray-100 pt-6">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                                <CalendarIcon size={12} /> Editar Dados
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
                    ) : (
                        <div className="space-y-4">
                            {selectedAppointment.notes && (
                                <div className="flex items-start gap-4">
                                    <div className="bg-yellow-50 p-2 rounded-lg text-yellow-600 mt-1">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Observações</h4>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-600 italic">
                                            "{selectedAppointment.notes}"
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setIsCancelModalOpen(true)}
                        className="flex-1 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors flex justify-center items-center gap-2 shadow-sm"
                    >
                        <Trash2 size={18} />
                        {selectedAppointment.status === AppointmentStatus.BLOQUEADO ? 'Liberar Horário' : 'Cancelar'}
                    </button>
                    
                    {selectedAppointment.status !== AppointmentStatus.BLOQUEADO && (
                        <button
                            type="button"
                            onClick={handleUpdateAppointment}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-md flex justify-center items-center gap-2"
                        >
                            <Save size={18} />
                            Salvar
                        </button>
                    )}
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
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                    {selectedAppointment.status === AppointmentStatus.BLOQUEADO ? 'Confirmar Liberação' : 'Confirmar Cancelamento'}
                </h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                    {selectedAppointment.status === AppointmentStatus.BLOQUEADO 
                        ? 'Tem certeza que deseja liberar este horário?' 
                        : 'Esta ação removerá o agendamento da lista.'}
                </p>

                {selectedAppointment.status !== AppointmentStatus.BLOQUEADO && (
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
                )}

                <div className="flex gap-3">
                    <button
                        onClick={() => { setIsCancelModalOpen(false); setCancellationReason(''); }}
                        className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        disabled={loading}
                    >
                        Voltar
                    </button>
                    <button
                        onClick={handleDeleteAppointment}
                        disabled={loading || (selectedAppointment.status !== AppointmentStatus.BLOQUEADO && !cancellationReason.trim())}
                        className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Config Modal */}
       {isConfigOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">Configuração de Agenda</h3>
                    <button onClick={() => setIsConfigOpen(false)}><X size={20} /></button>
                 </div>
                 
                 <form onSubmit={(e) => { e.preventDefault(); setConfirmPassword(''); setIsPasswordModalOpen(true); }} className="space-y-4">
                     <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-sm font-bold text-gray-500">Início</label>
                            <div className="relative">
                                <select 
                                    value={tempConfig.startHour} 
                                    onChange={e => setTempConfig({...tempConfig, startHour: e.target.value})} 
                                    className="w-full border border-gray-300 p-2 rounded-lg mt-1 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-base shadow-sm appearance-none"
                                >
                                    {generateTimeOptions30Min().map(t => <option key={t} value={t} className="bg-white text-gray-900">{t}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                         </div>
                         <div>
                            <label className="text-sm font-bold text-gray-500">Fim</label>
                            <div className="relative">
                                <select 
                                    value={tempConfig.endHour} 
                                    onChange={e => setTempConfig({...tempConfig, endHour: e.target.value})} 
                                    className="w-full border border-gray-300 p-2 rounded-lg mt-1 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-base shadow-sm appearance-none"
                                >
                                    {generateTimeOptions30Min().map(t => <option key={t} value={t} className="bg-white text-gray-900">{t}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                         </div>
                     </div>
                     <div>
                        <label className="text-sm font-bold text-gray-500">Intervalo</label>
                        <div className="grid grid-cols-4 gap-2 mt-1">
                            {[15, 30, 45, 60, 75, 90, 120].map(min => (
                                <button
                                    key={min}
                                    type="button"
                                    onClick={() => setTempConfig({...tempConfig, intervalMinutes: min})}
                                    className={`py-1 text-sm rounded border ${tempConfig.intervalMinutes === min ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                                >
                                    {min < 60 ? `${min}m` : min === 60 ? '1h' : min === 90 ? '1.5h' : `${min/60}h`}
                                </button>
                            ))}
                        </div>
                     </div>

                     <div className="border-t pt-4">
                        <label className="text-sm font-bold text-gray-500 mb-2 block">Tipos de Consulta</label>
                        <div className="flex gap-2 mb-2">
                            <input 
                                value={newProcedureInput}
                                onChange={e => setNewProcedureInput(e.target.value)}
                                placeholder="Novo tipo..."
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700"
                            />
                            <button type="button" onClick={handleAddProcedure} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200"><Plus size={16}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar p-1">
                            {tempConfig.availableProcedures.length === 0 && <span className="text-sm text-gray-400 italic">Nenhum tipo cadastrado.</span>}
                            {tempConfig.availableProcedures.map(proc => (
                                <span key={proc} className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1 border border-blue-100">
                                    {proc}
                                    <button type="button" onClick={() => handleRemoveProcedure(proc)} className="hover:text-red-500"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                     </div>

                     <button className="w-full bg-blue-600 text-white py-3 rounded-xl mt-4 font-medium hover:bg-blue-700 transition-colors">Salvar Alterações</button>
                 </form>
            </div>
        </div>
       )}
       
       {/* Password Check */}
       {isPasswordModalOpen && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white p-6 rounded-xl w-64 shadow-xl animate-in zoom-in-95">
                <p className="mb-2 font-bold text-center">Senha de Confirmação</p>
                <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="border w-full p-2 rounded-lg mb-4 text-center focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                    placeholder="Sua senha"
                    autoFocus
                />
                <button onClick={handleSaveConfig} className="bg-blue-600 text-white w-full py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors">Confirmar</button>
                <button onClick={() => { setIsPasswordModalOpen(false); setConfirmPassword(''); }} className="w-full py-2 text-gray-500 text-sm mt-2 hover:underline">Cancelar</button>
            </div>
         </div>
       )}

       {/* Block Modal */}
       {isBlockModalOpen && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
               <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in-95">
                   <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold text-red-600 flex items-center gap-2"><Lock size={18} /> Fechar Agenda</h3>
                       <button onClick={() => setIsBlockModalOpen(false)}><X size={20} /></button>
                   </div>
                   
                   <form onSubmit={handleBlockSchedule} className="space-y-4">
                       <div>
                           <label className="text-xs font-bold text-gray-500 mb-1 block">Dia do Bloqueio</label>
                           <DatePicker value={blockData.date} onChange={d => setBlockData({...blockData, date: d})} />
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                           <div>
                               <label className="text-xs font-bold text-gray-500 mb-1 block">De</label>
                               <div className="relative">
                                   <select value={blockData.startHour} onChange={e => setBlockData({...blockData, startHour: e.target.value})} className="border p-2 rounded-lg w-full bg-white appearance-none">
                                       {generateTimeOptions30Min().map(t => <option key={t} value={t}>{t}</option>)}
                                   </select>
                                   <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                               </div>
                           </div>
                           <div>
                               <label className="text-xs font-bold text-gray-500 mb-1 block">Até</label>
                               <div className="relative">
                                   <select value={blockData.endHour} onChange={e => setBlockData({...blockData, endHour: e.target.value})} className="border p-2 rounded-lg w-full bg-white appearance-none">
                                       {generateTimeOptions30Min().map(t => <option key={t} value={t}>{t}</option>)}
                                   </select>
                                   <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                               </div>
                           </div>
                       </div>
                       <div className="bg-red-50 p-3 rounded-lg text-xs text-red-600 border border-red-100">
                           Isso bloqueará todos os horários entre {blockData.startHour} e {blockData.endHour}.
                       </div>
                       <button className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors">Confirmar Bloqueio</button>
                   </form>
               </div>
           </div>
       )}
    </div>
  );
};
