
import React, { useState, useEffect } from 'react';
import { Doctor, DoctorAvailability, DoctorAbsence, DayOfWeek } from '../types';
import { doctorAvailabilityService } from '../services/doctorAvailabilityService';
import { Clock, X, Plus, Trash2, AlertCircle, Save, Settings, CalendarOff, AlertTriangle } from 'lucide-react';
import { useToast } from './ToastProvider';

interface DoctorAvailabilityConfigProps {
  doctor: Doctor;
  onClose: () => void;
}

type TabType = 'schedule' | 'absences' | 'settings';

export const DoctorAvailabilityConfig: React.FC<DoctorAvailabilityConfigProps> = ({ doctor, onClose }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // State
  const [weekSchedule, setWeekSchedule] = useState(doctorAvailabilityService.getDefaultAvailability());
  const [absences, setAbsences] = useState<DoctorAbsence[]>([]);
  const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
  const [maxAppointmentsPerDay, setMaxAppointmentsPerDay] = useState<number | undefined>();

  // New Absence Form State
  const [newAbsence, setNewAbsence] = useState({
    startDate: '',
    endDate: '',
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

  useEffect(() => {
    loadAvailability();
  }, [doctor.id]);

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const availability = await doctorAvailabilityService.getDoctorAvailability(doctor.id, doctor.organizationId);
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
    } catch (error) {
      console.error(error);
      showToast('error', 'Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await doctorAvailabilityService.saveDoctorAvailability({
        doctorId: doctor.id,
        organizationId: doctor.organizationId,
        weekSchedule,
        absences,
        advanceBookingDays,
        maxAppointmentsPerDay
      });
      showToast('success', 'Disponibilidade salva com sucesso!');
      onClose();
    } catch (error) {
      showToast('error', 'Erro ao salvar disponibilidade');
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
      id: `temp_${Date.now()}`,
      doctorId: doctor.id,
      startDate: newAbsence.startDate,
      endDate: newAbsence.endDate,
      reason: newAbsence.reason,
      type: newAbsence.type,
      createdAt: new Date().toISOString()
    };

    setAbsences([...absences, absence]);
    setNewAbsence({ startDate: '', endDate: '', reason: '', type: 'FERIAS' });
    showToast('success', 'Período adicionado à lista (Salvar para confirmar)');
  };

  const handleRemoveAbsence = (absenceId: string) => {
    setAbsences(absences.filter(a => a.id !== absenceId));
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
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
      <div className="flex border-b border-gray-100 px-6">
        <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            <Clock size={18} />
            Horários Semanais
        </button>
        <button
            onClick={() => setActiveTab('absences')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'absences' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            <CalendarOff size={18} />
            Ausências & Férias
            {absences.length > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs ml-2">{absences.length}</span>}
        </button>
        <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 ${
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
                                    <input 
                                        type="date" 
                                        value={newAbsence.startDate}
                                        onChange={e => setNewAbsence({...newAbsence, startDate: e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Fim</label>
                                    <input 
                                        type="date" 
                                        value={newAbsence.endDate}
                                        onChange={e => setNewAbsence({...newAbsence, endDate: e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={newAbsence.type}
                                            onChange={e => setNewAbsence({...newAbsence, type: e.target.value as any})}
                                            className="w-32 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                            <option value="FERIAS">Férias</option>
                                            <option value="LICENCA">Licença</option>
                                            <option value="CONGRESSO">Congresso</option>
                                            <option value="OUTROS">Outros</option>
                                        </select>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Viagem anual..."
                                            value={newAbsence.reason}
                                            onChange={e => setNewAbsence({...newAbsence, reason: e.target.value})}
                                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={handleAddAbsence}
                                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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

                {/* TAB: settings */}
                {activeTab === 'settings' && (
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                            
                            <div>
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Settings size={18} className="text-gray-500" />
                                    Regras Gerais
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Janela de Agendamento (Dias)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={advanceBookingDays}
                                                onChange={e => setAdvanceBookingDays(parseInt(e.target.value))}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-12 outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">dias</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Permitir agendamentos até quantos dias no futuro.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Limite Diário (Opcional)
                                        </label>
                                        <input 
                                            type="number" 
                                            value={maxAppointmentsPerDay || ''}
                                            onChange={e => setMaxAppointmentsPerDay(e.target.value ? parseInt(e.target.value) : undefined)}
                                            placeholder="Ilimitado"
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Máximo de atendimentos permitidos por dia.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 flex items-start gap-3">
                                <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <h5 className="font-bold text-yellow-800 text-sm">Nota Importante</h5>
                                    <p className="text-xs text-yellow-700 mt-1">
                                        Alterações na disponibilidade não afetam agendamentos já realizados. Conflitos devem ser resolvidos manualmente na agenda.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3">
        <button 
          onClick={onClose}
          disabled={saving}
          className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
            </>
          ) : (
            <>
                <Save size={18} />
                Salvar Configurações
            </>
          )}
        </button>
      </div>
    </div>
  );
};
