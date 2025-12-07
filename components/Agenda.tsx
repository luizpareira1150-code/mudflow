import React, { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus, User, AgendaConfig, Doctor, AvailableSlot } from '../types';
import { dataService, doctorAvailabilityService } from '../services/mockSupabase';
import { Clock, Plus, AlertCircle, CheckCircle, Settings, X, Save, Lock, CalendarOff, Trash2, User as UserIcon, Phone, Calendar as CalendarIcon, Edit2, FileText, Stethoscope, Tag, ChevronDown, AlertTriangle } from 'lucide-react';
import { DatePicker } from './DatePicker';
import { BookingModal } from './BookingModal';
import { useToast } from './ToastProvider';
import { slotReservationService } from '../services/slotReservationService';
import { DoctorAvailabilityConfig } from './DoctorAvailabilityConfig';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { SocketEvent } from '../lib/socketServer';
import { RealtimeIndicator } from './RealtimeIndicator';
import { BlockScheduleModal } from './BlockScheduleModal';

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
  const isControlled = propDoctors !== undefined;
  const [internalDoctors, setInternalDoctors] = useState<Doctor[]>([]);
  const [internalSelectedDoctorId, setInternalSelectedDoctorId] = useState<string>('');
  
  const doctors = isControlled ? propDoctors! : internalDoctors;
  const selectedDoctorId = isControlled ? propSelectedDoctorId || '' : internalSelectedDoctorId;
  const onDoctorChange = isControlled ? propOnDoctorChange! : setInternalSelectedDoctorId;

  // State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // ✅ REALTIME HOOK: Substitui polling manual para Available Slots
  // Ouve eventos de criação/edição/exclusão de agendamentos e alterações de config
  const { data: availableSlots, loading, refresh: refreshSlots, error } = useRealtimeData<AvailableSlot[]>(
    () => {
        if (!selectedDoctorId) return Promise.resolve([]);
        return dataService.getAvailableSlots(user.clinicId, selectedDoctorId, selectedDate);
    },
    [
        SocketEvent.APPOINTMENT_CREATED,
        SocketEvent.APPOINTMENT_UPDATED,
        SocketEvent.APPOINTMENT_DELETED,
        SocketEvent.APPOINTMENT_STATUS_CHANGED,
        SocketEvent.AGENDA_CONFIG_UPDATED
    ],
    [user.clinicId, selectedDoctorId, selectedDate]
  );
  
  const [config, setConfig] = useState<AgendaConfig>({ clinicId: user.clinicId, startHour: '08:00', endHour: '18:00', intervalMinutes: 30, availableProcedures: [] });
  const [procedureOptions, setProcedureOptions] = useState<string[]>([]);
  
  // Availability Info State
  const [availabilityInfo, setAvailabilityInfo] = useState<string>('');

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

  // Config Modal
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // Block Schedule Modal
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  // Fetch doctors if uncontrolled
  useEffect(() => {
      if (!isControlled) {
          dataService.getDoctors(user.clinicId).then(docs => {
              setInternalDoctors(docs);
              if (docs.length > 0) setInternalSelectedDoctorId(docs[0].id);
          });
      }
  }, [user.clinicId, isControlled]);

  // Fetch Config & Procedures
  useEffect(() => {
    const init = async () => {
      if (!selectedDoctorId) return;
      const [conf, procs] = await Promise.all([
        dataService.getAgendaConfig(user.clinicId, selectedDoctorId),
        dataService.getProcedureOptions(user.clinicId, selectedDoctorId)
      ]);
      setConfig(conf);
      setProcedureOptions(procs);
    };
    init();
  }, [user.clinicId, selectedDoctorId, isConfigOpen]); // Reload when config modal closes

  // Check Availability for selected date
  useEffect(() => {
    const checkAvailability = async () => {
      if (!selectedDoctorId || !selectedDate) return;

      // Pass true for computeSuggestions, but service handles internal safety
      const validation = await doctorAvailabilityService.validateAvailability(
        selectedDoctorId,
        user.clinicId,
        selectedDate
      );

      if (!validation.isAvailable) {
        setAvailabilityInfo(validation.reason || 'Médico não disponível nesta data');
      } else {
        setAvailabilityInfo('');
      }
    };
    checkAvailability();
  }, [selectedDate, selectedDoctorId, user.clinicId]);

  const handleSlotClick = async (slot: AvailableSlot) => {
    // Verificar se está reservado temporariamente por outra pessoa
    const isReserved = slotReservationService.isSlotReserved(
      user.clinicId, 
      selectedDoctorId, 
      selectedDate, 
      slot.time
    );
    
    // Se o slot estiver reservado e NÃO for um agendamento (pois se for, eu quero ver os detalhes)
    if (isReserved && !slot.isBooked && !slot.appointment) {
      showToast('warning', 'Este horário está sendo processado por outro usuário. Aguarde alguns segundos.');
      return;
    }

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
      // Não precisa chamar refreshSlots() - WebSocket e o hook cuidam disso
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;
    
    // Mandatoriedade do motivo (exceto se for BLOQUEADO que é sistema)
    if (selectedAppointment.status !== AppointmentStatus.BLOQUEADO && !cancellationReason.trim()) {
        showToast('warning', 'O motivo do cancelamento é obrigatório.');
        return;
    }

    try {
        await dataService.deleteAppointment(selectedAppointment.id, cancellationReason);
        setIsCancelModalOpen(false);
        setIsDetailsModalOpen(false);
        // WebSocket atualizará a UI
        if (selectedAppointment.status === AppointmentStatus.BLOQUEADO) {
            showToast('success', 'Horário liberado.');
        } else {
            showToast('success', 'Agendamento cancelado.');
        }
    } catch (error) {
        showToast('error', 'Erro ao excluir.');
    } finally {
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
      // WebSocket atualizará a UI
      showToast('success', 'Consulta remarcada com sucesso!');
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao atualizar.');
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

  const currentDoctor = doctors.find(d => d.id === selectedDoctorId);
  const slotsToRender = availableSlots || [];

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500 bg-slate-50 rounded-2xl">
      {/* HEADER WITH DOCTOR SELECTOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Agenda Médica</h2>
          
          <div className="flex items-start gap-3">
             <div className="flex flex-col">
                {!isConsultorio ? (
                    <div className="relative group">
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => onDoctorChange(e.target.value)}
                            className="pr-10 py-0 bg-transparent border-none p-0 text-2xl font-bold text-slate-800 outline-none focus:ring-0 appearance-none min-w-[200px] cursor-pointer hover:text-blue-600 transition-colors"
                            style={{ backgroundImage: 'none' }}
                        >
                            {doctors.map(doc => (
                                <option key={doc.id} value={doc.id} className="text-lg text-slate-800">
                                    {doc.name} - {doc.specialty}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={24} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-blue-50 transition-colors" />
                    </div>
                ) : (
                    <div className="text-2xl font-bold text-slate-800 py-0">
                        {currentDoctor?.name || 'Meu Consultório'}
                    </div>
                )}
                {/* Specialty Display */}
                <span className="text-sm font-medium text-blue-600 mt-0.5">
                    {currentDoctor?.specialty || 'Especialidade não definida'}
                </span>
             </div>

             <span className="text-gray-300 text-3xl font-light mx-2 self-start mt-1">|</span>
             
             <div className="flex flex-col gap-1 mt-1 self-start">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] text-gray-400 uppercase font-medium">Intervalo:</span>
                    <span className="text-sm text-gray-700">{formatDuration(config.intervalMinutes)}</span>
                </div>
                <div className="-ml-1 origin-left scale-90">
                    <RealtimeIndicator className="py-0.5 px-2 text-[10px]" />
                </div>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-40">
            <DatePicker value={selectedDate} onChange={setSelectedDate} />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsBlockModalOpen(true)}
                className="px-4 py-2 bg-white border border-gray-200 text-red-600 rounded-lg hover:border-red-300 hover:bg-red-50 font-medium text-sm h-[42px] flex items-center gap-2 shadow-sm transition-colors"
                title="Fechar Horários"
            >
                <Lock size={18} />
                <span className="hidden sm:inline">Bloquear</span>
            </button>

            <button 
                onClick={() => setIsConfigOpen(true)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-blue-400 hover:text-blue-600 font-medium text-sm h-[42px] flex items-center gap-2 shadow-sm transition-colors"
            >
                <Settings size={18} />
                <span className="hidden sm:inline">Configurar</span>
            </button>
          </div>
        </div>
      </div>

      {/* AVAILABILITY WARNING BANNER */}
      {availabilityInfo && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3 animate-in fade-in">
            <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">{availabilityInfo}</p>
                <button 
                    onClick={async () => {
                        const nextDates = await doctorAvailabilityService.getNextAvailableDates(
                            selectedDoctorId,
                            user.clinicId,
                            selectedDate,
                            5
                        );
                        if (nextDates.length > 0) {
                            setSelectedDate(nextDates[0]);
                        }
                    }}
                    className="text-xs text-yellow-700 underline hover:text-yellow-900 mt-1 font-medium"
                >
                    Ver próxima data disponível
                </button>
            </div>
        </div>
      )}

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

        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle size={48} className="mx-auto text-red-300 mb-4" />
              <p className="text-red-600">Erro ao carregar horários</p>
              <button onClick={refreshSlots} className="mt-4 text-blue-600 hover:underline">
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {slotsToRender.length === 0 && !loading && !error ? (
           <div className="h-full flex flex-col items-center justify-center text-gray-400">
             <AlertCircle size={48} className="mb-4 text-gray-300" />
             <p>Nenhum horário disponível para esta data.</p>
             <p className="text-sm mt-1">Verifique as configurações de dias, horários ou bloqueios de agenda.</p>
             {availabilityInfo ? null : (
                 <button onClick={() => setIsConfigOpen(true)} className="mt-4 text-blue-600 hover:underline">Configurar Agenda</button>
             )}
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {slotsToRender.map(slot => {
              const appt = slot.appointment;
              const isBlocked = appt?.status === AppointmentStatus.BLOQUEADO;
              const isAvailable = !slot.isBooked && !slot.isReserved;

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
                      : (slot.isReserved && !slot.isBooked) 
                          ? 'border-amber-200 bg-amber-50 hover:border-amber-300' // Visual lock state
                          : 'border-blue-100 bg-blue-50 hover:border-blue-300 hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-lg font-bold ${isAvailable ? 'text-gray-600' : 'text-blue-600'}`}>
                      {slot.time}
                    </span>
                    {isAvailable ? (
                      <Plus size={20} className="text-gray-300 group-hover:text-blue-500" />
                    ) : (slot.isReserved && !slot.isBooked) ? (
                      <Clock size={20} className="text-amber-500 animate-pulse" /> // Lock icon/status
                    ) : (
                      <CheckCircle size={20} className="text-blue-500" />
                    )}
                  </div>

                  {appt ? (
                    <div>
                      {/* UPDATED: Patient Name Access */}
                      <p className="font-semibold text-gray-800 truncate">{appt.patient?.name || 'Paciente'}</p>
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
                  ) : (slot.isReserved && !slot.isBooked) ? (
                    <p className="text-sm text-amber-600 font-medium mt-2">Reservando...</p>
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

      {/* Block Schedule Modal */}
      <BlockScheduleModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onSuccess={() => { /* Realtime hook handles refresh */ }}
        user={user}
        doctors={doctors}
        preSelectedDate={selectedDate}
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
                    {/* Patient Name Section */}
                    {selectedAppointment.status !== AppointmentStatus.BLOQUEADO && (
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-1">
                                <UserIcon size={20} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Paciente</h4>
                                <p className="text-lg font-semibold text-gray-900">{selectedAppointment.patient?.name || 'Paciente'}</p>
                            </div>
                        </div>
                    )}

                    {selectedAppointment.patient?.phone && (
                        <div className="flex items-start gap-4">
                            <div className="bg-green-50 p-2 rounded-lg text-green-600 mt-1">
                                <Phone size={20} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contato</h4>
                                <p className="text-base text-gray-700 font-medium">{selectedAppointment.patient.phone}</p>
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
                        disabled={loading} // Use realtime hook loading
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

      {/* Configuration Modal */}
       {isConfigOpen && currentDoctor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl h-[90vh]">
              <DoctorAvailabilityConfig 
                doctor={currentDoctor}
                onClose={() => {
                  setIsConfigOpen(false);
                  refreshSlots(); // Refresh grid after closing config
                }}
              />
            </div>
        </div>
       )}

    </div>
  );
}