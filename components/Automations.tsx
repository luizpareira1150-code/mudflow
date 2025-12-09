
import React, { useState, useRef, useEffect } from 'react';
import { WebhookLog, Patient } from '../types';
import { patientService, authService } from '../services/mockSupabase';
import { generateWebhookPayload } from '../services/geminiService';
import { Play, Activity, Terminal, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const Automations: React.FC = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState('appointment_scheduled');
  const [patients, setPatients] = useState<Patient[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentUser = authService.getCurrentUser();

  // Load Real Patients
  useEffect(() => {
      if (currentUser) {
          patientService.getAllPatients(currentUser.clinicId).then(setPatients);
      }
  }, [currentUser]);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const triggerWebhook = async (event: string) => {
    setIsSimulating(true);
    
    // Pick random patient from DB or fallback
    let randomPatient = patients.length > 0 
        ? patients[Math.floor(Math.random() * patients.length)]
        : { id: 'mock_p1', name: 'Paciente Teste (Sem dados reais)', phone: '00000000000' } as Patient;
    
    // Optimistic log add
    // GOVERNANCE: Use crypto.randomUUID()
    const logId = crypto.randomUUID();
    
    setLogs(prev => [...prev, {
      id: logId,
      event: event,
      payload: { status: 'generating...' },
      timestamp: new Date().toLocaleTimeString(),
      status: 'Pending',
      destination: 'N8N - Main Pipeline'
    }]);

    // Use Gemini to generate realistic payload
    const payload = await generateWebhookPayload(event, {
        patient_id: randomPatient.id,
        patient_name: randomPatient.name,
        patient_phone: randomPatient.phone,
        trigger_source: "MedFlow_UI_Simulator",
        clinic_id: currentUser?.clinicId || 'unknown'
    });

    // Update log
    setLogs(prev => prev.map(log => 
        log.id === logId 
        ? { ...log, payload, status: 'Success' } 
        : log
    ));
    setIsSimulating(false);
  };

  return (
    <div className="flex flex-col h-[700px] animate-in fade-in duration-500">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Simulador de Automação</h2>
        <p className="text-slate-500 mt-1">
          Teste gatilhos N8N & Evolution API simulando eventos com dados reais do sistema.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
        
        {/* Control Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
            <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity size={20} className="text-primary-500"/> 
                    Event Triggers
                </h3>
                <div className="space-y-3">
                    {[
                        { id: 'appointment_scheduled', label: 'Appointment Scheduled' },
                        { id: 'patient_status_changed', label: 'Patient Status Change' },
                        { id: 'recovery_alert', label: 'Recovery Alert (Critical)' },
                        { id: 'payment_processed', label: 'Payment Processed' }
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setSelectedEvent(opt.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                                selectedEvent === opt.id 
                                ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium ring-2 ring-primary-100' 
                                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-auto">
                <button
                    onClick={() => triggerWebhook(selectedEvent)}
                    disabled={isSimulating}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                        isSimulating 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-200 hover:shadow-2xl'
                    }`}
                >
                    {isSimulating ? (
                        <>
                            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                            Generating Payload...
                        </>
                    ) : (
                        <>
                            <Play size={20} fill="currentColor" />
                            Simulate Webhook
                        </>
                    )}
                </button>
                <div className="mt-4 text-center">
                    <p className="text-xs text-slate-400">
                        Usando base de {patients.length} pacientes reais
                    </p>
                    <p className="text-[10px] text-slate-300 mt-1">
                        Payloads enriquecidos com IA Gemini
                    </p>
                </div>
            </div>
        </div>

        {/* Live Logs */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl shadow-xl flex flex-col overflow-hidden border border-slate-700">
            <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-200">
                    <Terminal size={18} />
                    <span className="font-mono text-sm font-semibold">webhook_outbound.log</span>
                </div>
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
            </div>
            
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm scrollbar-hide"
            >
                {logs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <Activity size={48} className="mb-4 opacity-20" />
                        <p>Waiting for event triggers...</p>
                    </div>
                )}
                
                {logs.map((log) => (
                    <div key={log.id} className="animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-3 mb-1">
                            {log.status === 'Success' ? (
                                <CheckCircle2 size={14} className="text-emerald-500" />
                            ) : log.status === 'Pending' ? (
                                <Clock size={14} className="text-amber-500" />
                            ) : (
                                <AlertCircle size={14} className="text-red-500" />
                            )}
                            <span className="text-slate-400 text-xs">{log.timestamp}</span>
                            <span className="text-primary-400 font-bold">{log.event.toUpperCase()}</span>
                            <span className="text-slate-500 text-xs ml-auto">{log.destination}</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto">
                            <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Automations;
