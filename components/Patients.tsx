
import React, { useState } from 'react';
import { Patient, PatientStatus, Appointment } from '../types';
import { generateSmartSummary } from '../services/geminiService';
import { dataService } from '../services/mockSupabase'; // To fetch history
import { Search, Filter, MoreHorizontal, Sparkles, X, Activity, UserPlus, Calendar, Clock, History } from 'lucide-react';
import { authService } from '../services/mockSupabase';
import { useRealtimePatients } from '../hooks/useRealtimeData';

const Patients: React.FC = () => {
  // ✅ REALTIME HOOK
  const currentUser = authService.getCurrentUser();
  const { data: patients, loading } = useRealtimePatients(currentUser?.clinicId || '');

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [patientHistory, setPatientHistory] = useState<Appointment[]>([]);

  const handleViewPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    // Set immediate placeholder to prevent blank space flicker
    setSummary("Carregando análise operacional...");
    setLoadingSummary(true);
    setPatientHistory([]);

    // 1. Load History
    const history = await dataService.getPatientAppointments(patient.id);
    setPatientHistory(history);

    // 2. Generate CRM Summary (Wait slightly for effect)
    setTimeout(async () => {
        const result = await generateSmartSummary(patient, history);
        setSummary(result);
        setLoadingSummary(false);
    }, 500);
  };

  const closeDetails = () => {
    setSelectedPatient(null);
    setSummary("");
    setPatientHistory([]);
  };

  const patientList = patients || [];
  const filteredPatients = patientList.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  );

  return (
    <div className="p-8 h-screen flex flex-col animate-in fade-in duration-500 relative">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Base de Pacientes</h2>
          <p className="text-slate-500 mt-1">Gerencie cadastros e histórico de agendamentos.</p>
        </div>
        <button className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-colors flex items-center gap-2">
          <UserPlus size={18} />
          Novo Paciente
        </button>
      </header>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 flex gap-4 items-center">
        <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, email ou telefone..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter size={18} />
            <span>Filtro</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Paciente</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Status</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Telefone</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Cadastro</th>
                        <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                Carregando...
                            </td>
                        </tr>
                    ) : filteredPatients.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                Nenhum paciente encontrado.
                            </td>
                        </tr>
                    ) : (
                        filteredPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4">
                                <div>
                                    <p className="font-semibold text-slate-900">{patient.name}</p>
                                    <p className="text-xs text-slate-400">{patient.email || 'Sem email'}</p>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    patient.status === PatientStatus.Active ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    {patient.status === PatientStatus.Active ? 'Ativo' : 'Inativo'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{patient.phone}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                                {new Date(patient.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-6 py-4">
                                <button 
                                    onClick={() => handleViewPatient(patient)}
                                    className="text-slate-400 hover:text-primary-600 p-2 rounded-full hover:bg-primary-50 transition-all"
                                >
                                    <MoreHorizontal size={20} />
                                </button>
                            </td>
                        </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Patient Detail Modal / Slide-over */}
      {selectedPatient && (
          <div className="absolute inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={closeDetails} />
              <div className="w-full max-w-md bg-white h-full shadow-2xl relative animate-in slide-in-from-right duration-300 flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                      <div>
                          <h3 className="text-2xl font-bold text-slate-900">{selectedPatient.name}</h3>
                          <p className="text-slate-500 text-sm">{selectedPatient.email || selectedPatient.phone}</p>
                      </div>
                      <button onClick={closeDetails} className="text-slate-400 hover:text-slate-600 p-2">
                          <X size={24} />
                      </button>
                  </div>

                  <div className="p-6 space-y-6 overflow-y-auto flex-1">
                      {/* AI Summary Card (Strictly Operational) */}
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-2xl border border-indigo-100 relative overflow-hidden">
                          <div className="flex items-center gap-2 mb-3">
                              <Sparkles size={18} className="text-indigo-600" />
                              <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wide">Perfil de Agendamento (IA)</h4>
                          </div>
                          <div className="text-indigo-800 text-sm leading-relaxed whitespace-pre-line">
                              {loadingSummary ? (
                                  <div className="flex items-center gap-2 animate-pulse">
                                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                                      <span>Analisando histórico...</span>
                                  </div>
                              ) : (
                                  summary
                              )}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                              <History size={16} /> Histórico Recente
                          </h4>
                          
                          {patientHistory.length === 0 ? (
                              <p className="text-sm text-slate-400 italic">Nenhum agendamento registrado.</p>
                          ) : (
                              <div className="space-y-3">
                                  {patientHistory.slice(0, 5).map(apt => (
                                      <div key={apt.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                          <div className={`w-2 h-2 rounded-full ${
                                              apt.status === 'ATENDIDO' ? 'bg-green-500' :
                                              apt.status === 'NAO_VEIO' ? 'bg-red-500' :
                                              apt.status === 'AGENDADO' ? 'bg-blue-500' : 'bg-gray-400'
                                          }`} />
                                          <div className="flex-1">
                                              <p className="text-sm font-medium text-slate-800">{new Date(apt.date).toLocaleDateString('pt-BR')} • {apt.time}</p>
                                              <p className="text-xs text-slate-500">{apt.procedure || 'Consulta'} - {apt.status.replace('_', ' ')}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      <div className="space-y-4 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 rounded-lg">
                                  <p className="text-xs text-slate-500 uppercase">CPF</p>
                                  <p className="font-medium text-slate-800">{selectedPatient.cpf || '-'}</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg">
                                  <p className="text-xs text-slate-500 uppercase">Nascimento</p>
                                  <p className="font-medium text-slate-800">
                                      {selectedPatient.birthDate ? new Date(selectedPatient.birthDate).toLocaleDateString('pt-BR') : '-'}
                                  </p>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-2">
                           <button className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium transition-colors">
                                <Calendar size={18} />
                                Novo Agendamento
                           </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Patients;
