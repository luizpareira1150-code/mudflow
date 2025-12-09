
import React, { useState, useEffect } from 'react';
import { Doctor, DoctorAvailability, DoctorAbsence, DayOfWeek, AgendaReleaseType } from '../types';
import { doctorAvailabilityService } from '../services/doctorAvailabilityService';
import { agendaReleaseService } from '../services/agendaReleaseService';
import { authService, settingsService } from '../services/mockSupabase';
import { Clock, X, Plus, Trash2, AlertCircle, Save, Settings, CalendarOff, ChevronDown, ShieldCheck, CalendarCheck } from 'lucide-react';
import { useToast } from './ToastProvider';
import { DatePicker } from './DatePicker';

interface DoctorAvailabilityConfigProps {
  doctor: Doctor;
  onClose: () => void;
}

type TabType = 'schedule' | 'absences' | 'release_rules' | 'settings';

export const DoctorAvailabilityConfig: React.FC<DoctorAvailabilityConfigProps> = ({ doctor, onClose }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Security State
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');

  // State: Availability
  const [weekSchedule, setWeekSchedule] = useState(doctorAvailabilityService.getDefaultAvailability());
  const [absences, setAbsences] = useState<DoctorAbsence[]>([]);
  const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
  const [maxAppointmentsPerDay, setMaxAppointmentsPerDay] = useState<number | undefined>();
  const [intervalMinutes, setIntervalMinutes] = useState(30);

  // State: Release Rules
  const [releaseType, setReleaseType] = useState<AgendaReleaseType>(AgendaReleaseType.ALWAYS_OPEN);
  const [weeklyRelease, setWeeklyRelease] = useState({ dayOfWeek: DayOfWeek.MONDAY, hour: '07:00', advanceDays: 2 });
  const [monthlyRelease, setMonthlyRelease] = useState({ releaseDay: 22, fallbackToWeekday: true, hour: '00:00', targetMonthOffset: 1 });

  // New Absence Form State
  const [newAbsence, setNewAbsence] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
    type: 'FERIAS' as DoctorAbsence['type']
  });

  const dayNames = [
    { key: DayOfWeek.MONDAY, label: 'Segunda-feira' },
    { key: DayOfWeek.TUESDAY, label: 'Terça-feira' },
    { key: DayOfWeek.WEDNESDAY, label: 'Quarta-feira' },
    { key: DayOfWeek.THURSDAY, label: 'Quinta-feira' },
    { key: DayOfWeek.FRIDAY, label: 'Sexta-feira' },
    { key: DayOfWeek.SATURDAY, label: 'Sábado' },
    { key: DayOfWeek.SUNDAY, label: 'Domingo' },
  ];

  const intervalOptions = [
    { value: 10, label: '10 minutos' },
    { value: 15, label: '15 minutos' },
    { value: 20, label: '20 minutos' },
    { value: 30, label: '30 minutos (Padrão)' },
    { value: 40, label: '40 minutos' },
    { value: 45, label: '45 minutos' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1 hora e 30 min' },
    { value: 120, label: '2 horas' },
  ];

  useEffect(() => {
    loadAvailability();
  }, [doctor.id]);

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const [availability, releaseSchedule, agendaConfig] = await Promise.all([
          doctorAvailabilityService.getDoctorAvailability(doctor.id, doctor.organizationId),
          agendaReleaseService.getSchedule(doctor.id, doctor.organizationId),
          settingsService.getAgendaConfig(doctor.organizationId, doctor.id)
      ]);

      if (availability) {
        setWeekSchedule(availability.weekSchedule);
        setAbsences(availability.absences || []);
        setAdvanceBookingDays(availability.advanceBookingDays || 30);
        setMaxAppointmentsPerDay(availability.maxAppointmentsPerDay);
      } else {
        // Reset to defaults if no config exists for this doctor
        setWeekSchedule(doctorAvailabilityService.getDefaultAvailability());
        setAbsences([]);
        setAdvanceBookingDays(30);
        setMaxAppointmentsPerDay(undefined);
      }

      if (releaseSchedule) {
          setReleaseType(releaseSchedule.releaseType);
          if (releaseSchedule.weeklyConfig) setWeeklyRelease(releaseSchedule.weeklyConfig);
          if (releaseSchedule.monthlyConfig) setMonthlyRelease(releaseSchedule.monthlyConfig);
      }

      if (agendaConfig) {
          setIntervalMinutes(agendaConfig.intervalMinutes);
      }

    } catch (error) {
      console.error(error);
      showToast('error', 'Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  const initiateSave = () => {
    setSecurityPassword('');
    setIsSecurityModalOpen(true);
  };

  const confirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // 1. Verify Password
      const isValid = await authService.verifyPassword(securityPassword);
      if (!isValid) {
          showToast('error', 'Senha incorreta. Alterações não salvas.');
          setSaving(false);
          return;
      }

      // 2. Prepare Schedule with Updated Interval
      // Force update daily intervals to match global setting to fix precedence issues
      // This is crucial for seed data (like Dr. Diretor) which has explicit daily intervals
      const updatedWeekSchedule = { ...weekSchedule };
      (Object.keys(updatedWeekSchedule) as unknown as DayOfWeek[]).forEach((key) => {
        const day = Number(key) as DayOfWeek;
        if (updatedWeekSchedule[day]) {
          updatedWeekSchedule[day] = {
            ...updatedWeekSchedule[day]!,
            intervalMinutes: intervalMinutes // Apply global interval to daily config
          };
        }
      });

      // 3. Perform Save
      await doctorAvailabilityService.saveDoctorAvailability({
        doctorId: doctor.id,
        organizationId: doctor.organizationId,
        weekSchedule: updatedWeekSchedule,
        absences,
        advanceBookingDays,
        maxAppointmentsPerDay
      });

      await agendaReleaseService.saveSchedule({
        doctorId: doctor.id,
        organizationId: doctor.organizationId,
        releaseType,
        weeklyConfig: releaseType === AgendaReleaseType.WEEKLY_RELEASE ? weeklyRelease : undefined,
        monthlyConfig: releaseType === AgendaReleaseType.MONTHLY_RELEASE ? monthlyRelease : undefined,
        enabled: releaseType !== AgendaReleaseType.ALWAYS_OPEN
      });

      // Save Interval (Global Config)
      const currentConfig = await settingsService.getAgendaConfig(doctor.organizationId, doctor.id);
      await settingsService.updateAgendaConfig({
          ...currentConfig,
          intervalMinutes: intervalMinutes
      });

      setIsSecurityModalOpen(false);
      showToast('success', 'Configurações salvas com sucesso!');
      onClose();
    } catch (error) {
      showToast('error', 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  // Schedule Handlers
  const toggleDay = (day: DayOfWeek) => {
    setWeekSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day]!,
        enabled: !prev[day]?.enabled
      }
    }));
  };

  const updateDayTime = (day: DayOfWeek, field: 'startTime' | 'endTime', value: string) => {
    setWeekSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day]!,
        [field]: value
      }
    }));
  };

  // Absence Handlers
  const handleAddAbsence = () => {
    if (!newAbsence.startDate || !newAbsence.endDate || !newAbsence.reason) {
      showToast('warning', 'Preencha todos os campos da ausência');
      return;
    }

    if (new Date(newAbsence.startDate) > new Date(newAbsence.endDate)) {
        showToast('warning', 'Data final deve ser maior que data inicial');
        return;
    }

    const absence: DoctorAbsence = {
      // GOVERNANCE: Use crypto.randomUUID()
      id: crypto.randomUUID(),
      doctorId: doctor.id,
      startDate: newAbsence.startDate,
      endDate: newAbsence.endDate,
      reason: newAbsence.reason,
      type: newAbsence.type,
      createdAt: new Date().toISOString()
    };

    setAbsences([...absences, absence]);
    setNewAbsence({ 
      startDate: new Date().toISOString().split('T')[0], 
      endDate: new Date().toISOString().split('T')[0], 
      reason: '', 
      type: 'FERIAS' 
    });
    showToast('success', 'Período adicionado à lista (Salvar para confirmar)');
  };

  const handleRemoveAbsence = (absenceId: string) => {
    setAbsences(absences.filter(a => a.id !== absenceId));
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
      
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Configurar Disponibilidade</h2>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
             <span className={`w-2 h-2 rounded-full bg-${doctor.color || 'blue'}-500`}></span>
             {doctor.name} • {doctor.specialty}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-lg transition-colors shadow-sm">
          <X size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-6 overflow-x-auto">
        <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            <Clock size={18} />
            Horários Semanais
        </button>
        <button
            onClick={() => setActiveTab('absences')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'absences' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            <CalendarOff size={18} />
            Ausências & Férias
            {absences.length > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs ml-2">{absences.length}</span>}
        </button>
        <button
            onClick={() => setActiveTab('release_rules')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'release_rules' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            <CalendarCheck size={18} />
            Regras de Abertura
        </button>
        <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            <Settings size={18} />
            Configurações
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
        
        {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Carregando...</span>
                </div>
            </div>
        ) : (
            <>
                {/* TAB: SCHEDULE */}
                {activeTab === 'schedule' && (
                    <div className="space-y-3 max-w-3xl mx-auto">
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex gap-3 items-start">
                            <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
                            <p className="text-sm text-blue-800">
                                Defina os dias da semana e horários padrão de atendimento. Dias desmarcados não aparecerão na agenda.
                            </p>
                        </div>

                        {dayNames.map(({ key, label }) => (
                            <div key={key} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                                weekSchedule[key]?.enabled 
                                ? 'bg-white border-gray-200 shadow-sm' 
                                : 'bg-gray-50 border-gray-100 opacity-60'
                            }`}>
                                <div className="flex items-center gap-3 w-48">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            id={`toggle-${key}`}
                                            checked={weekSchedule[key]?.enabled || false}
                                            onChange={() => toggleDay(key)}
                                            className="peer sr-only"
                                        />
                                        <label
                                            htmlFor={`toggle-${key}`}
                                            className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 cursor-pointer"
                                        ></label>
                                    </div>
                                    <span className={`font-medium ${weekSchedule[key]?.enabled ? 'text-gray-800' : 'text-gray-500'}`}>
                                        {label}
                                    </span>
                                </div>

                                {weekSchedule[key]?.enabled ? (
                                    <div className="flex items-center gap-3 flex-1 animate-in slide-in-from-left-2 duration-200">
                                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                            <span className="text-xs text-gray-400 uppercase font-bold">Das</span>
                                            <input
                                                type="time"
                                                value={weekSchedule[key]?.startTime || '08:00'}
                                                onChange={(e) => updateDayTime(key, 'startTime', e.target.value)}
                                                className="bg-transparent text-gray-800 font-medium outline-none w-24"
                                            />
                                        </div>
                                        <span className="text-gray-300">-</span>
                                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                            <span className="text-xs text-gray-400 uppercase font-bold">Até</span>
                                            <input
                                                type="time"
                                                value={weekSchedule[key]?.endTime || '18:00'}
                                                onChange={(e) => updateDayTime(key, 'endTime', e.target.value)}
                                                className="bg-transparent text-gray-800 font-medium outline-none w-24"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-400 italic flex items-center gap-2">
                                        <CalendarOff size={14} /> Não atende
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB: ABSENCES */}
                {activeTab === 'absences' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        
                        {/* Form */}
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Plus size={18} className="text-blue-600" />
                                Adicionar Novo Bloqueio
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Início</label>
                                    <DatePicker 
                                        value={newAbsence.startDate}
                                        onChange={date => setNewAbsence({...newAbsence, startDate: date})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Fim</label>
                                    <DatePicker 
                                        value={newAbsence.endDate}
                                        onChange={date => setNewAbsence({...newAbsence, endDate: date})}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo</label>
                                    <div className="flex gap-2">
                                        <div className="relative w-32">
                                            <div className="relative">
                                                <select
                                                    value={newAbsence.type}
                                                    onChange={e => setNewAbsence({...newAbsence, type: e.target.value as any})}
                                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                                                >
                                                    <option value="FERIAS">Férias</option>
                                                    <option value="LICENCA">Licença</option>
                                                    <option value="CONGRESSO">Congresso</option>
                                                    <option value="OUTROS">Outros</option>
                                                </select>
                                                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Viagem anual..."
                                            value={newAbsence.reason}
                                            onChange={e => setNewAbsence({...newAbsence, reason: e.target.value})}
                                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={handleAddAbsence}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                Adicionar à Lista
                            </button>
                        </div>

                        {/* List */}
                        <div>
                            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                Bloqueios Registrados
                            </h4>
                            {absences.length === 0 ? (
                                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                                    <CalendarOff size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>Nenhuma ausência programada.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {absences.map((absence) => (
                                        <div key={absence.id} className="flex items-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-red-200 transition-colors group">
                                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                                                <CalendarOff size={20} />
                                            </div>
                                            <div className="ml-4 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-900">{absence.reason}</span>
                                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{absence.type}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    {new Date(absence.startDate).toLocaleDateString('pt-BR')} até {new Date(absence.endDate).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveAbsence(absence.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remover"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: RELEASE RULES (RESTORED AS DROPDOWN) */}
                {activeTab === 'release_rules' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center gap-2">
                                <CalendarCheck size={20} className="text-blue-600" />
                                Regras de Liberação
                            </h4>
                            
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Modo de Abertura</label>
                                <div className="relative">
                                    <select
                                        value={releaseType}
                                        onChange={(e) => setReleaseType(e.target.value as AgendaReleaseType)}
                                        className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-gray-700 font-medium"
                                    >
                                        <option value={AgendaReleaseType.ALWAYS_OPEN}>Sempre Aberta (Padrão)</option>
                                        <option value={AgendaReleaseType.WEEKLY_RELEASE}>Liberação Semanal</option>
                                        <option value={AgendaReleaseType.MONTHLY_RELEASE}>Liberação Mensal</option>
                                    </select>
                                    <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    {releaseType === AgendaReleaseType.ALWAYS_OPEN && "A agenda fica disponível conforme a antecedência máxima (ex: 30 dias)."}
                                    {releaseType === AgendaReleaseType.WEEKLY_RELEASE && "Define um dia e hora específicos da semana para abrir a agenda da semana seguinte."}
                                    {releaseType === AgendaReleaseType.MONTHLY_RELEASE && "Define um dia do mês para abrir a agenda do mês seguinte (ex: dia 21)."}
                                </div>
                            </div>

                            {/* Conditional Forms inside white container */}
                            {releaseType === AgendaReleaseType.WEEKLY_RELEASE && (
                                <div className="border-t border-gray-100 pt-6 animate-in fade-in">
                                    <h5 className="font-bold text-gray-700 mb-4 text-sm uppercase">Configuração Semanal</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dia da Liberação</label>
                                            <div className="relative">
                                                <select 
                                                    value={weeklyRelease.dayOfWeek}
                                                    onChange={(e) => setWeeklyRelease({...weeklyRelease, dayOfWeek: Number(e.target.value)})}
                                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white appearance-none"
                                                >
                                                    {dayNames.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                                                </select>
                                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Horário</label>
                                            <input 
                                                type="time" 
                                                value={weeklyRelease.hour}
                                                onChange={(e) => setWeeklyRelease({...weeklyRelease, hour: e.target.value})}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Antecedência Máxima (Dias)</label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                max="365"
                                                value={weeklyRelease.advanceDays}
                                                onChange={(e) => setWeeklyRelease({...weeklyRelease, advanceDays: Number(e.target.value)})}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">Ex: 2 dias antes</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {releaseType === AgendaReleaseType.MONTHLY_RELEASE && (
                                <div className="border-t border-gray-100 pt-6 animate-in fade-in">
                                    <h5 className="font-bold text-gray-700 mb-4 text-sm uppercase">Configuração Mensal</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dia do Mês</label>
                                            <input 
                                                type="number" 
                                                min="1" max="31"
                                                value={monthlyRelease.releaseDay}
                                                onChange={(e) => setMonthlyRelease({...monthlyRelease, releaseDay: Number(e.target.value)})}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Horário</label>
                                            <input 
                                                type="time" 
                                                value={monthlyRelease.hour}
                                                onChange={(e) => setMonthlyRelease({...monthlyRelease, hour: e.target.value})}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alvo (Meses à frente)</label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                max="12"
                                                value={monthlyRelease.targetMonthOffset}
                                                onChange={(e) => setMonthlyRelease({...monthlyRelease, targetMonthOffset: Number(e.target.value)})}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">1 = Próximo mês</p>
                                        </div>
                                        <div className="md:col-span-3 flex items-center pt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={monthlyRelease.fallbackToWeekday}
                                                    onChange={(e) => setMonthlyRelease({...monthlyRelease, fallbackToWeekday: e.target.checked})}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                                />
                                                <span className="text-sm text-gray-700">Evitar Fim de Semana?</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: SETTINGS */}
                {activeTab === 'settings' && (
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                            
                            <div>
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Settings size={18} className="text-gray-500" />
                                    Regras Gerais
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Interval/Slot Configuration */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Duração da Consulta (Slot)
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={intervalMinutes}
                                                onChange={(e) => setIntervalMinutes(parseInt(e.target.value))}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none pr-10"
                                            >
                                                {intervalOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Define o tempo padrão de cada horário na agenda.
                                        </p>
                                    </div>
                                    
                                    {/* Advance Booking Limit REMOVED here */}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )}
      </div>

      {/* Footer / Save Action */}
      <div className="p-6 border-t border-gray-100 bg-white flex justify-between items-center">
        <div className="text-xs text-gray-400">
            {saving ? 'Salvando alterações...' : 'Todas as alterações requerem confirmação.'}
        </div>
        <div className="flex gap-3">
            <button 
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                disabled={saving}
            >
                Cancelar
            </button>
            <button 
                onClick={initiateSave}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {saving ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                    </>
                ) : (
                    <>
                        <Save size={18} />
                        Salvar Alterações
                    </>
                )}
            </button>
        </div>
      </div>

      {/* Security Modal */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xs">
            <div className="mb-4 text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <ShieldCheck size={24} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Segurança</h3>
                <p className="text-xs text-gray-500">Digite sua senha para confirmar.</p>
            </div>
            <form onSubmit={confirmSave} className="space-y-4">
                <input
                  type="password"
                  value={securityPassword}
                  onChange={(e) => setSecurityPassword(e.target.value)}
                  className="w-full border border-gray-200 bg-white text-center text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Sua senha"
                  autoFocus
                />
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setIsSecurityModalOpen(false)}
                        className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        disabled={!securityPassword}
                        className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        Confirmar
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
