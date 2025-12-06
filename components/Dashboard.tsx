
import React, { useEffect, useState } from 'react';
import { authService } from '../services/mockSupabase';
import { AppointmentStatus, DashboardMetrics } from '../types';
import { Users, Calendar, ArrowUpRight, Activity, Sparkles } from 'lucide-react';
import { analyzeRecoveryTrend } from '../services/geminiService';
import { useRealtimeAppointments, useRealtimePatients } from '../hooks/useRealtimeData';
import { RealtimeIndicator } from './RealtimeIndicator';

const Dashboard: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  
  if (!currentUser) return null;

  const today = new Date().toISOString().split('T')[0];
  
  // ✅ DADOS EM TEMPO REAL
  const { data: todayAppointments, loading: loadingAppts } = useRealtimeAppointments(
    currentUser.clinicId,
    today
  );
  
  const { data: patients, loading: loadingPatients } = useRealtimePatients(
    currentUser.clinicId
  );

  const [aiInsight, setAiInsight] = useState<string>("Carregando análise...");

  useEffect(() => {
    const appts = todayAppointments || [];
    // Only fetch if we have data or to clear state
    if (appts.length > 0) {
        const timer = setTimeout(() => {
            analyzeRecoveryTrend(appts).then(insight => {
                if (insight && insight !== "Analysis unavailable.") {
                    setAiInsight(insight);
                }
            });
        }, 1500); 
        return () => clearTimeout(timer);
    } else {
        setAiInsight("Sem dados suficientes hoje para análise de IA.");
    }
  }, [todayAppointments]);

  const totalAppointments = todayAppointments?.length || 0;
  const attendedCount = todayAppointments?.filter(a => a.status === AppointmentStatus.ATENDIDO).length || 0;
  const totalPatients = patients?.length || 0;

  const attendanceRate = totalAppointments > 0 ? (attendedCount / totalAppointments) * 100 : 0;
  
  const stats = [
    { 
      label: 'Total de Pacientes', 
      value: totalPatients.toString(),
      icon: Users, 
      change: '+0%', 
      color: 'bg-blue-500' 
    },
    { 
      label: 'Agendamentos Hoje', 
      value: totalAppointments.toString(),
      icon: Calendar, 
      change: 'Hoje', 
      color: 'bg-violet-500' 
    },
    { 
      label: 'Atendimentos', 
      value: attendedCount.toString(),
      icon: Activity, 
      change: `${attendanceRate.toFixed(0)}% taxa`, 
      color: 'bg-emerald-500' 
    },
  ];

  if (loadingAppts || loadingPatients) {
    return (
      <div className="p-8 flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Dashboard</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500">Bem-vindo, {currentUser.name}</p>
            <span className="text-gray-300">•</span>
            <RealtimeIndicator />
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
             <span className="text-xs font-bold text-primary-600 px-2 py-1 bg-primary-50 rounded-md">IA ATIVA</span>
             <span className="text-sm text-slate-600">Gemini 2.5 Flash</span>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</h3>
              <div className="flex items-center gap-1 mt-2 text-slate-600 text-sm font-medium">
                <ArrowUpRight size={16} className="text-emerald-500" />
                <span>{stat.change}</span>
              </div>
            </div>
            <div className={`${stat.color} p-4 rounded-xl text-white shadow-lg shadow-opacity-20`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Appointments */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center justify-between">
              <span>Agenda de Hoje</span>
              <button className="text-sm text-primary-600 font-medium hover:text-primary-700">Ver Calendário</button>
          </h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {(!todayAppointments || todayAppointments.length === 0) ? (
                <div className="text-center py-8 text-gray-400 italic">
                    <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Nenhum agendamento para hoje.</p>
                </div>
            ) : (
                todayAppointments.map((apt) => (
                    <div key={apt.id} className="flex items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                        <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {apt.time}
                        </div>
                        <div className="ml-4 flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-900 truncate">{apt.patient?.name || 'Paciente Desconhecido'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[150px]">{apt.procedure || 'Consulta'}</span>
                            </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold shrink-0
                            ${apt.status === AppointmentStatus.AGENDADO ? 'bg-amber-100 text-amber-700' : 
                            apt.status === AppointmentStatus.ATENDIDO ? 'bg-emerald-100 text-emerald-700' :
                            apt.status === AppointmentStatus.EM_CONTATO ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                            }`}>
                            {apt.status}
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-4">Ações Rápidas (N8N)</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="p-4 border border-slate-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left group">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Users size={16} />
                </div>
                <p className="font-semibold text-slate-700">Sincronizar Pacientes</p>
                <p className="text-xs text-slate-500 mt-1">Gatilho Manual N8N</p>
            </button>
            <button className="p-4 border border-slate-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left group">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Calendar size={16} />
                </div>
                <p className="font-semibold text-slate-700">Disparo WhatsApp</p>
                <p className="text-xs text-slate-500 mt-1">Lembretes Evolution API</p>
            </button>
          </div>
        </div>
      </div>

      {/* AI Insight Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100 shadow-sm transition-all hover:shadow-md">
         <div className="flex items-start gap-4">
             <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50">
                 <Sparkles className="text-indigo-600" size={24} />
             </div>
             <div className="flex-1">
                 <h4 className="text-indigo-900 font-bold text-lg mb-2 flex items-center gap-2">
                    INSIGHTS OPERACIONAIS (IA)
                    <span className="text-[10px] font-normal bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Análise em Tempo Real</span>
                 </h4>
                 <div className="text-indigo-800 text-sm leading-relaxed whitespace-pre-line">
                     {aiInsight}
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};
export default Dashboard;
