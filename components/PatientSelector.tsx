
import React, { useState, useEffect, useRef } from 'react';
import { Patient } from '../types';
import { patientService } from '../services/mockSupabase';
import { Search, UserPlus, X, Check, User as UserIcon } from 'lucide-react';
import { QuickPatientForm } from './QuickPatientForm';

interface PatientSelectorProps {
  organizationId: string;
  onSelect: (patient: Patient) => void;
  selectedPatient: Patient | null;
  onClear?: () => void;
}

export const PatientSelector: React.FC<PatientSelectorProps> = ({ 
  organizationId, 
  onSelect, 
  selectedPatient,
  onClear
}) => {
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Create New Patient State
  const [isCreating, setIsCreating] = useState(false);

  // Debounced Search
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await patientService.searchPatients(searchTerm, organizationId);
        setSearchResults(results);
        setShowResults(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, organizationId]);

  const handlePatientCreated = (patient: Patient) => {
      onSelect(patient);
      setIsCreating(false);
      setShowResults(false);
      setSearchTerm('');
  };

  const handleClear = () => {
      setSearchTerm('');
      if (onClear) onClear();
  };

  if (selectedPatient) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center animate-in fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <Check size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">{selectedPatient.name}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{selectedPatient.phone}</span>
                {selectedPatient.cpf && <span>• CPF: {selectedPatient.cpf}</span>}
            </div>
          </div>
        </div>
        <button 
          onClick={handleClear}
          className="text-gray-400 hover:text-red-500 hover:bg-white p-2 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  if (isCreating) {
      return (
          <QuickPatientForm 
            organizationId={organizationId}
            onSuccess={handlePatientCreated}
            onCancel={() => setIsCreating(false)}
            initialName={searchTerm}
          />
      );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
          placeholder="Buscar paciente por nome, CPF ou telefone..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {showResults && searchTerm.length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-64 overflow-y-auto">
          {searchResults.length === 0 ? (
             <div className="p-4 text-center">
               <p className="text-sm text-gray-500 mb-3">Nenhum paciente encontrado.</p>
               <button 
                 onClick={() => { setIsCreating(true); setShowResults(false); }}
                 className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors w-full flex items-center justify-center gap-2"
               >
                 <UserPlus size={16} />
                 Cadastrar Novo Paciente
               </button>
             </div>
          ) : (
             <div className="divide-y divide-gray-50">
               {searchResults.map(patient => (
                 <button
                   key={patient.id}
                   onClick={() => { onSelect(patient); setShowResults(false); setSearchTerm(''); }}
                   className="w-full text-left p-3 hover:bg-blue-50 transition-colors flex items-center gap-3 group"
                 >
                   <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center group-hover:bg-blue-200 group-hover:text-blue-700">
                     <UserIcon size={16} />
                   </div>
                   <div>
                     <p className="text-sm font-bold text-gray-800">{patient.name}</p>
                     <p className="text-xs text-gray-500 flex gap-2">
                       <span>{patient.phone}</span>
                       {patient.cpf && <span>• CPF: {patient.cpf}</span>}
                     </p>
                   </div>
                 </button>
               ))}
               <div className="p-2 bg-gray-50 border-t border-gray-100">
                  <button 
                    onClick={() => { setIsCreating(true); setShowResults(false); }}
                    className="w-full py-2 text-xs font-bold text-blue-600 hover:text-blue-700 text-center"
                  >
                    + Cadastrar Novo
                  </button>
               </div>
             </div>
          )}
        </div>
      )}
    </div>
  );
};
