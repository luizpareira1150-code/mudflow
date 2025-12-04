import React, { useEffect, useState } from 'react';
import { MOCK_PATIENTS, MOCK_APPOINTMENTS, MOCK_DOCTORS } from '../constants';
import { Users, Calendar, ArrowUpRight, Activity, Clock } from 'lucide-react';
import { analyzeRecoveryTrend } from '../services/geminiService';
import { AppointmentStatus } from '../types';

const Dashboard: React.FC = () => {
  const [aiInsight, setAiInsight] = useState<string>("Analisando dados da clínica...");

  useEffect(() => {
    let mounted = true;
    analyzeRecoveryTrend(MOCK_APPOINTMENTS).then(insight => {
        if(mounted) setAiInsight(insight);
    });
    return () => { mounted = false; };
  }, []);

  const totalAppointments = MOCK_APPOINTMENTS.length;
  const attendedCount = MOCK_APPOINTMENTS.filter(a => a.status === AppointmentStatus.ATENDIDO).length;
  
  const stats = [
    { label: 'Total de Pacientes', value: MOCK_PATIENTS.length.toString(), icon: Users, change: '+12%', color: 'bg-blue-500' },
    { label: 'Agendamentos', value: totalAppointments.toString(), icon: Calendar, change: '+5%', color: 'bg-violet-500' },
    { label: 'Atendimentos', value: attendedCount.toString(), icon: Activity, change: '+2%', color: 'bg-emerald-500' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 mt-1">Bem-vindo, {MOCK_DOCTORS[0].name}</p>
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
              <div className="flex items-center gap-1 mt-2 text-emerald-600 text-sm font-medium">
                <ArrowUpRight size={16} />
                <span>{stat.change} vs mês anterior</span>
              </div>
            </div>
            <div className={`${stat.color} p-4 rounded-xl text-white shadow-lg shadow-opacity-20`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* AI Insight Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100">
         <div className="flex items-start gap-4">
             <div className="bg-white p-2 rounded-lg shadow-sm">
                 <Activity className="text-indigo-600" size={24} />
             </div>
             <div>
                 <h4 className="text-indigo-900 font-bold text-lg mb-1">Insight MedFlow AI</h4>
                 <p className="text-indigo-700 leading-relaxed max-w-3xl">
                     {aiInsight}
                 </p>
             </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Appointments */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center justify-between">
              <span>Agenda de Hoje</span>
              <button className="text-sm text-primary-600 font-medium hover:text-primary-700">Ver Calendário</button>
          </h3>
          <div className="space-y-4">
            {MOCK_APPOINTMENTS.map((apt) => {
               const doctor = MOCK_DOCTORS.find(d => d.id === apt.doctorId);
               return (
                <div key={apt.id} className="flex items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">
                      {apt.time}
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className="font-semibold text-slate-900">{apt.patientName}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{apt.procedure}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${doctor?.color || 'bg-slate-100'}`}>
                            {doctor?.name}
                        </span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold
                    ${apt.status === AppointmentStatus.AGENDADO ? 'bg-amber-100 text-amber-700' : 
                      apt.status === AppointmentStatus.ATENDIDO ? 'bg-emerald-100 text-emerald-700' :
                      apt.status === AppointmentStatus.EM_CONTATO ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                    {apt.status}
                  </div>
                </div>
               );
            })}
          </div>
        </div>

        {/* Quick Actions (Mock N8N Triggers) */}
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
    </div>
  );
};

export default Dashboard;
