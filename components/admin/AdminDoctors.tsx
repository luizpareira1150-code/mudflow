import React, { useState } from 'react';
import { Doctor, Organization, User } from '../../types';
import { dataService } from '../../services/mockSupabase';
import { Stethoscope, UserPlus, Users, Calendar, Trash2, FileBadge } from 'lucide-react';
import { useToast } from '../ToastProvider';

interface AdminDoctorsProps {
  currentUser: User;
  doctors: Doctor[];
  currentOrganization: Organization | null;
  onDoctorCreated: () => void;
  onDeleteDoctor: (doctor: Doctor) => void;
  onConfigureAvailability: (doctor: Doctor) => void;
}

export const AdminDoctors: React.FC<AdminDoctorsProps> = ({ 
  currentUser, 
  doctors, 
  currentOrganization, 
  onDoctorCreated,
  onDeleteDoctor,
  onConfigureAvailability 
}) => {
  const { showToast } = useToast();
  const [newDoctor, setNewDoctor] = useState({ name: '', specialty: 'Clínico Geral', crm: '', color: 'blue' });

  const handleCreateDoctor = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentOrganization) return;
      
      if (currentOrganization.maxDoctors <= doctors.length) {
          showToast('error', `Limite de médicos atingido (${currentOrganization.maxDoctors}).`);
          return;
      }

      try {
          await dataService.createDoctor({
              organizationId: currentUser.clinicId,
              name: newDoctor.name,
              specialty: newDoctor.specialty,
              crm: newDoctor.crm,
              color: newDoctor.color
          });
          onDoctorCreated();
          setNewDoctor({ name: '', specialty: 'Clínico Geral', crm: '', color: 'blue' });
          showToast('success', 'Médico adicionado à equipe!');
      } catch (error) {
          showToast('error', 'Erro ao adicionar médico.');
      }
  };

  return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
           {/* Add Doctor Form */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                    <Stethoscope size={20} className="text-teal-600" />
                    Adicionar Médico à Equipe
                </h3>
                <form onSubmit={handleCreateDoctor} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nome do Médico</label>
                        <input
                            type="text"
                            required
                            value={newDoctor.name}
                            onChange={e => setNewDoctor({...newDoctor, name: e.target.value})}
                            className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-teal-500 outline-none transition-all placeholder-gray-400"
                            placeholder="Dr. Fulano de Tal"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Especialidade</label>
                            <input
                                type="text"
                                required
                                value={newDoctor.specialty}
                                onChange={e => setNewDoctor({...newDoctor, specialty: e.target.value})}
                                className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-teal-500 outline-none transition-all placeholder-gray-400"
                                placeholder="Ex: Cardiologia"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">CRM</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    value={newDoctor.crm}
                                    onChange={e => setNewDoctor({...newDoctor, crm: e.target.value})}
                                    className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg pl-8 pr-3 py-2 mt-1 focus:ring-2 focus:ring-teal-500 outline-none transition-all placeholder-gray-400"
                                    placeholder="123456-SP"
                                />
                                <FileBadge size={14} className="absolute left-2.5 top-4 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Cor na Agenda</label>
                         <div className="flex gap-2">
                             {['blue', 'green', 'purple', 'rose', 'amber'].map(color => (
                                 <button
                                    key={color}
                                    type="button"
                                    onClick={() => setNewDoctor({...newDoctor, color})}
                                    className={`w-8 h-8 rounded-full border-2 ${newDoctor.color === color ? 'border-gray-600 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                                 >
                                     <div className={`w-full h-full rounded-full bg-${color}-500`} />
                                 </button>
                             ))}
                         </div>
                    </div>

                    <button 
                        type="submit" 
                        className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 shadow-sm transition-all mt-2 flex justify-center items-center gap-2"
                    >
                    <UserPlus size={18} />
                    Cadastrar Médico
                    </button>
                </form>
           </div>

           {/* Doctors List */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                    <Users size={20} className="text-teal-600" />
                    Corpo Clínico Atual
                    </h3>
                    <span className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full">
                    {doctors.length}
                    </span>
                </div>
                <div className="space-y-3">
                     {doctors.map(doc => (
                         <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                             <div className="flex items-center gap-3">
                                 <div className={`w-10 h-10 rounded-full bg-${doc.color || 'blue'}-100 flex items-center justify-center text-${doc.color || 'blue'}-600`}>
                                     <Stethoscope size={20} />
                                 </div>
                                 <div>
                                     <p className="font-semibold text-gray-800">{doc.name}</p>
                                     <p className="text-xs text-gray-500">{doc.specialty} {doc.crm && `• CRM: ${doc.crm}`}</p>
                                 </div>
                             </div>
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => onConfigureAvailability(doc)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Configurar Disponibilidade"
                                >
                                    <Calendar size={18} />
                                </button>
                                {doctors.length > 1 && (
                                    <button 
                                        onClick={() => onDeleteDoctor(doc)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                             </div>
                         </div>
                     ))}
                </div>
           </div>
      </div>
  );
};