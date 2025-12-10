
import React, { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus, User, AgendaConfig, Doctor, AvailableSlot, UserRole } from '../types';
import { settingsService, appointmentService, doctorAvailabilityService, patientService } from '../services/mockSupabase';
import { Clock, Plus, AlertCircle, CheckCircle, Settings, Lock, Tag, ChevronDown } from 'lucide-react';
import { DatePicker } from './DatePicker';
import { BookingModal } from './BookingModal';
import { useToast } from './ToastProvider';
import { slotReservationService } from '../services/slotReservationService';
import { DoctorAvailabilityConfig } from './DoctorAvailabilityConfig';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { SocketEvent } from '../lib/socketServer';
import { RealtimeIndicator } from './RealtimeIndicator';
import { BlockScheduleModal } from './BlockScheduleModal';
import { useDoctorsByAccess } from '../hooks/useDoctorsByAccess';
import { AppointmentDetailsModal } from './agenda/AppointmentDetailsModal';
import { CancellationModal } from './agenda/CancellationModal';

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
  
  // Use hook for internal logic if not controlled
  const { doctors: accessDoctors } = useDoctorsByAccess(user, user.clinicId);
  const [internalSelectedDoctorId, setInternalSelectedDoctorId] = useState<string>('');
  
  const doctors = isControlled ? propDoctors! : accessDoctors;
  const selectedDoctorId = isControlled ? propSelectedDoctorId || '' : internalSelectedDoctorId;
  const onDoctorChange = isControlled ? propOnDoctorChange! : setInternalSelectedDoctorId;

  // Permissions Check: All users who can access this view (including Secretaries) 
  // are allowed to help configure the agenda via their own password confirmation.
  const canConfigureAgenda = true;

  // Auto-select first doctor if none selected
  useEffect(() => {
      if (!isControlled && doctors.length > 0 && !internalSelectedDoctorId) {
          setInternalSelectedDoctorId(doctors[0].id);
      }
  }, [doctors, isControlled, internalSelectedDoctorId]);

  // State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // ✅ REALTIME HOOK: Substitui polling manual para Available Slots
  const { data: availableSlots, loading, refresh: refreshSlots, error } = useRealtimeData<AvailableSlot[]>(
    () => {
        if (!selectedDoctorId) return Promise.resolve([]);
        return appointmentService.getAvailableSlots(user.clinicId, selectedDoctorId, selectedDate);
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

  // Modal State - Details & Cancellation
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Config Modal
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // Block Schedule Modal
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  // Fetch Config & Procedures
  useEffect(() => {
    const init = async () => {
      if (!selectedDoctorId) return;
      const [conf, procs] = await Promise.all([
        settingsService.getAgendaConfig(user.clinicId, selectedDoctorId),
        settingsService.getProcedureOptions(user.clinicId, selectedDoctorId)
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
      setIsDetailsModalOpen(true);
      setIsCancelModalOpen(false);
    } else {
      setSelectedSlot(slot);
      setIsModalOpen(true);
    }
  };

  const handleBookingSuccess = () => {
      setIsModalOpen(false);
  };

  const handleDeleteAppointment = async (reason: string) => {
    if (!selectedAppointment) return;
    
    try {
        await appointmentService.deleteAppointment(selectedAppointment.id, reason, user);
        setIsCancelModalOpen(false);
        setIsDetailsModalOpen(false);
        if (selectedAppointment.status === AppointmentStatus.BLOQUEADO) {
            showToast('success', 'Horário liberado.');
        } else {
            showToast('success', 'Agendamento cancelado.');
        }
    } catch (error) {
        showToast('error', 'Erro ao excluir.');
    }
  };

  const handleUpdateAppointment = async (data: { date: string; time: string; procedure: string; notes: string; cpf: string }) => {
    if (!selectedAppointment) return;
    try {
      // 1. Check if CPF changed and update Patient record first
      if (selectedAppointment.patientId && data.cpf !== (selectedAppointment.patient?.cpf || '')) {
          await patientService.updatePatient(selectedAppointment.patientId, { cpf: data.cpf }, user);
      }

      // 2. Update Appointment with Sanitized Notes (Note: AppointmentDetailsModal handles sanitization before passing data)
      await appointmentService.updateAppointment({
        ...selectedAppointment,
        date: data.date,
        time: data.time,
        procedure: data.procedure,
        notes: data.notes
      }, user);
      
      setIsDetailsModalOpen(false);
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
                <span className="text-sm font-medium text-blue-600 mt-0.5">
                    {currentDoctor?.specialty || (doctors.length === 0 ? 'Nenhum médico disponível' : 'Especialidade não definida')}
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
            {canConfigureAgenda && (
                <>
                    <button 
                        onClick={() => setIsBlockModalOpen(true)}
                        disabled={!currentDoctor}
                        className="px-4 py-2 bg-white border border-gray-200 text-red-600 rounded-lg hover:border-red-300 hover:bg-red-50 font-medium text-sm h-[42px] flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Fechar Horários"
                    >
                        <Lock size={18} />
                        <span className="hidden sm:inline">Bloquear</span>
                    </button>

                    <button 
                        onClick={() => setIsConfigOpen(true)}
                        disabled={!currentDoctor}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-blue-400 hover:text-blue-600 font-medium text-sm h-[42px] flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Settings size={18} />
                        <span className="hidden sm:inline">Configurar</span>
                    </button>
                </>
            )}
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
                        } else {
                            showToast('info', 'Não encontramos horários livres nos próximos 60 dias.');
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
             <p>{doctors.length === 0 ? 'Você não tem acesso a nenhuma agenda.' : 'Nenhum horário disponível para esta data.'}</p>
             {doctors.length > 0 && (
                 <p className="text-sm mt-1">Verifique as configurações de dias, horários ou bloqueios de agenda.</p>
             )}
             {/* Only show config button if user has permission */}
             {canConfigureAgenda && !availabilityInfo && (
                 <button disabled={!currentDoctor} onClick={() => setIsConfigOpen(true)} className="mt-4 text-blue-600 hover:underline disabled:opacity-0">Configurar Agenda</button>
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
                          ? 'border-amber-200 bg-amber-50 hover:border-amber-300' 
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
                      <Clock size={20} className="text-amber-500 animate-pulse" />
                    ) : (
                      <CheckCircle size={20} className="text-blue-500" />
                    )}
                  </div>

                  {appt ? (
                    <div>
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
        onConflict={() => {
            refreshSlots(); // Refresh grid immediately when conflict detected
        }}
        user={user}
        preSelectedDate={selectedDate}
        preSelectedTime={selectedSlot?.time}
        preSelectedDoctorId={selectedDoctorId}
      />

      {/* Block Schedule Modal - Accessible to all authorized users */}
      {canConfigureAgenda && (
          <BlockScheduleModal
            isOpen={isBlockModalOpen}
            onClose={() => setIsBlockModalOpen(false)}
            onSuccess={() => { /* Realtime hook handles refresh */ }}
            user={user}
            doctors={doctors}
            preSelectedDate={selectedDate}
            preSelectedDoctorId={selectedDoctorId}
          />
      )}

      {/* Details Modal */}
      <AppointmentDetailsModal 
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        appointment={selectedAppointment}
        procedureOptions={procedureOptions}
        onUpdate={handleUpdateAppointment}
        onCancelRequest={() => setIsCancelModalOpen(true)}
      />

      {/* Cancellation Modal */}
      <CancellationModal 
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleDeleteAppointment}
        loading={loading}
        isBlockedStatus={selectedAppointment?.status === AppointmentStatus.BLOQUEADO}
      />

      {/* Configuration Modal - Accessible to all authorized users */}
       {isConfigOpen && currentDoctor && canConfigureAgenda && (
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
