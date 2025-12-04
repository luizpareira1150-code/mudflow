import React, { useState } from 'react';
import { MOCK_PATIENTS } from '../constants';
import { Patient, PatientStatus } from '../types';
import { generateSmartSummary } from '../services/geminiService';
import { Search, Filter, MoreHorizontal, Sparkles, X, Activity } from 'lucide-react';

const Patients: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  const handleViewPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSummary("");
    setLoadingSummary(true);
    const result = await generateSmartSummary(patient);
    setSummary(result);
    setLoadingSummary(false);
  };

  const closeDetails = () => {
    setSelectedPatient(null);
    setSummary("");
  };

  return (
    <div className="p-8 h-screen flex flex-col animate-in fade-in duration-500 relative">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Patients</h2>
          <p className="text-slate-500 mt-1">Manage patient records and statuses.</p>
        </div>
        <button className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-colors">
          + Add Patient
        </button>
      </header>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 flex gap-4 items-center">
        <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="Search by name, email or condition..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter size={18} />
            <span>Filter</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Patient</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Status</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Condition</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Last Visit</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {MOCK_PATIENTS.map((patient) => (
                    <tr key={patient.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                            <div>
                                <p className="font-semibold text-slate-900">{patient.name}</p>
                                <p className="text-xs text-slate-400">{patient.email}</p>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                patient.status === PatientStatus.Active ? 'bg-emerald-100 text-emerald-700' :
                                patient.status === PatientStatus.Critical ? 'bg-red-100 text-red-700' :
                                patient.status === PatientStatus.Recovering ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                                {patient.status}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{patient.condition}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{patient.lastVisit}</td>
                        <td className="px-6 py-4">
                            <button 
                                onClick={() => handleViewPatient(patient)}
                                className="text-slate-400 hover:text-primary-600 p-2 rounded-full hover:bg-primary-50 transition-all"
                            >
                                <MoreHorizontal size={20} />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Patient Detail Modal / Slide-over */}
      {selectedPatient && (
          <div className="absolute inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={closeDetails} />
              <div className="w-full max-w-md bg-white h-full shadow-2xl relative animate-in slide-in-from-right duration-300 flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                      <div>
                          <h3 className="text-2xl font-bold text-slate-900">{selectedPatient.name}</h3>
                          <p className="text-slate-500 text-sm">{selectedPatient.email}</p>
                      </div>
                      <button onClick={closeDetails} className="text-slate-400 hover:text-slate-600 p-2">
                          <X size={24} />
                      </button>
                  </div>

                  <div className="p-6 space-y-6 overflow-y-auto flex-1">
                      {/* AI Summary Card */}
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 relative overflow-hidden">
                          <div className="flex items-center gap-2 mb-3">
                              <Sparkles size={18} className="text-indigo-600" />
                              <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wide">AI Health Summary</h4>
                          </div>
                          <div className="text-indigo-800 text-sm leading-relaxed">
                              {loadingSummary ? (
                                  <div className="flex items-center gap-2 animate-pulse">
                                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                                      <span>Generating clinical insight...</span>
                                  </div>
                              ) : (
                                  summary
                              )}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Patient Details</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 rounded-lg">
                                  <p className="text-xs text-slate-500 uppercase">Status</p>
                                  <p className="font-medium text-slate-800">{selectedPatient.status}</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg">
                                  <p className="text-xs text-slate-500 uppercase">Age</p>
                                  <p className="font-medium text-slate-800">{selectedPatient.age}</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg col-span-2">
                                  <p className="text-xs text-slate-500 uppercase">Next Scheduled Step</p>
                                  <p className="font-medium text-slate-800">{selectedPatient.nextStep}</p>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-2">
                           <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Quick Actions</h4>
                           <button className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium transition-colors">
                                <Activity size={18} />
                                Update Status
                           </button>
                      </div>
                  </div>
                  
                  <div className="p-6 bg-slate-50 border-t border-slate-200">
                      <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-colors">
                          View Full Record
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Patients;
