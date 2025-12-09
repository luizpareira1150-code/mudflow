
import React, { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus } from '../../types';
import { DatePicker } from '../DatePicker';
import { User as UserIcon, Phone, Calendar as CalendarIcon, Edit2, FileText, X, Trash2, Save, ChevronDown, CreditCard, Stethoscope, Lock } from 'lucide-react';
import { formatCPF } from '../../utils/cpfUtils';
import { sanitizeInput } from '../../utils/sanitizer';

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  procedureOptions: string[];
  onUpdate: (data: { date: string; time: string; procedure: string; notes: string; cpf: string }) => Promise<void>;
  onCancelRequest: () => void;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  isOpen,
  onClose,
  appointment,
  procedureOptions,
  onUpdate,
  onCancelRequest
}) => {
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editProcedure, setEditProcedure] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCpf, setEditCpf] = useState('');

  // Sync state with appointment when it changes or modal opens
  useEffect(() => {
    if (appointment && isOpen) {
      setEditDate(appointment.date);
      setEditTime(appointment.time);
      setEditProcedure(appointment.procedure || '');
      setEditNotes(appointment.notes || '');
      setEditCpf(appointment.patient?.cpf || '');
    }
  }, [appointment, isOpen]);

  const generateTimeOptions30Min = () => {
    const options = [];
    for (let i = 0; i < 24; i++) {
      const h = String(i).padStart(2, '0');
      options.push(`${h}:00`);
      options.push(`${h}:30`);
    }
    return options;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditCpf(formatCPF(e.target.value));
  };

  const handleSave = () => {
    const safeNotes = sanitizeInput(editNotes);
    onUpdate({
      date: editDate,
      time: editTime,
      procedure: editProcedure,
      notes: safeNotes,
      cpf: editCpf
    });
  };

  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${appointment.status === AppointmentStatus.BLOQUEADO ? 'bg-gray-100' : 'bg-blue-100'}`}>
              {appointment.status === AppointmentStatus.BLOQUEADO ? (
                <Lock size={24} className="text-gray-600" />
              ) : (
                <Edit2 size={24} className="text-blue-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                {appointment.status === AppointmentStatus.BLOQUEADO ? 'Agenda Fechada' : 'Gerenciar Consulta'}
              </h3>
              <p className="text-sm text-gray-500">Detalhes & Remarcação</p>
            </div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="space-y-6 mb-6">
          {/* Patient Name Section */}
          {appointment.status !== AppointmentStatus.BLOQUEADO && (
            <div className="flex items-start gap-4">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-1">
                <UserIcon size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Paciente</h4>
                <p className="text-lg font-semibold text-gray-900">{appointment.patient?.name || 'Paciente'}</p>
              </div>
            </div>
          )}

          {appointment.patient?.phone && (
            <div className="flex items-start gap-4">
              <div className="bg-green-50 p-2 rounded-lg text-green-600 mt-1">
                <Phone size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contato</h4>
                <p className="text-base text-gray-700 font-medium">{appointment.patient.phone}</p>
              </div>
            </div>
          )}

          {appointment.status !== AppointmentStatus.BLOQUEADO ? (
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
                  <label className="block text-xs text-gray-500 mb-1">CPF</label>
                  <div className="relative">
                    <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={editCpf}
                      onChange={handleCpfChange}
                      className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none h-[42px]"
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

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
              {appointment.notes && (
                <div className="flex items-start gap-4">
                  <div className="bg-yellow-50 p-2 rounded-lg text-yellow-600 mt-1">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Observações</h4>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-600 italic">
                      "{appointment.notes}"
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
            onClick={onCancelRequest}
            className="flex-1 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors flex justify-center items-center gap-2 shadow-sm"
          >
            <Trash2 size={18} />
            {appointment.status === AppointmentStatus.BLOQUEADO ? 'Liberar Horário' : 'Cancelar'}
          </button>

          {appointment.status !== AppointmentStatus.BLOQUEADO && (
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-md flex justify-center items-center gap-2"
            >
              <Save size={18} />
              Salvar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
