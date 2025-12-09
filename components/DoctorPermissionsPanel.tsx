
import React, { useState, useEffect } from 'react';
import { Doctor, User, UserRole, DoctorAccessControl } from '../types';
import { doctorService } from '../services/doctorService';
import { Users, Check, Shield, AlertCircle } from 'lucide-react';
import { useToast } from './ToastProvider';

interface DoctorPermissionsPanelProps {
  doctor: Doctor;
  organizationId: string;
  onUpdate: () => void;
}

export const DoctorPermissionsPanel: React.FC<DoctorPermissionsPanelProps> = ({
  doctor,
  organizationId,
  onUpdate
}) => {
  const { showToast } = useToast();
  
  // State
  const [secretaries, setSecretaries] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [accessControl, setAccessControl] = useState<DoctorAccessControl>(
    doctor.accessControl || DoctorAccessControl.ALL
  );
  const [selectedSecretaries, setSelectedSecretaries] = useState<Set<string>>(
    new Set(doctor.authorizedSecretaries || [])
  );

  // Carregar secretárias
  useEffect(() => {
    loadSecretaries();
  }, [organizationId]);

  // Sync prop changes to state (if doctor prop updates)
  useEffect(() => {
      setAccessControl(doctor.accessControl || DoctorAccessControl.ALL);
      setSelectedSecretaries(new Set(doctor.authorizedSecretaries || []));
  }, [doctor]);

  const loadSecretaries = async () => {
    try {
      setLoading(true);
      const users = await doctorService.getUsers(organizationId);
      const secs = users.filter(u => u.role === UserRole.SECRETARY);
      setSecretaries(secs);
    } catch (error) {
      showToast('error', 'Erro ao carregar secretárias');
    } finally {
      setLoading(false);
    }
  };

  // Toggle secretária
  const toggleSecretary = (secretaryId: string) => {
    const newSelected = new Set(selectedSecretaries);
    
    if (newSelected.has(secretaryId)) {
      newSelected.delete(secretaryId);
    } else {
      newSelected.add(secretaryId);
    }
    
    setSelectedSecretaries(newSelected);
  };

  // Selecionar todas
  const selectAll = () => {
    setSelectedSecretaries(new Set(secretaries.map(s => s.id)));
  };

  // Desselecionar todas
  const deselectAll = () => {
    setSelectedSecretaries(new Set());
  };

  // Salvar permissões
  const handleSave = async () => {
    setSaving(true);
    
    try {
      await doctorService.updateDoctorPermissions(
        doctor.id,
        accessControl,
        Array.from(selectedSecretaries)
      );
      
      showToast('success', 'Permissões atualizadas com sucesso!');
      onUpdate();
      
    } catch (error) {
      showToast('error', 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  // Verificar se houve mudanças
  const hasChanges = () => {
    if (accessControl !== (doctor.accessControl || DoctorAccessControl.ALL)) {
      return true;
    }
    
    const currentSet = new Set(doctor.authorizedSecretaries || []);
    if (currentSet.size !== selectedSecretaries.size) return true;
    
    for (const id of selectedSecretaries) {
      if (!currentSet.has(id)) return true;
    }
    
    return false;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Shield size={20} className="text-indigo-600" />
        </div>
        <div>
          <h4 className="font-bold text-gray-800">Controle de Acesso da Agenda</h4>
          <p className="text-xs text-gray-500">
            Defina quais secretárias podem visualizar e gerenciar a agenda deste médico.
          </p>
        </div>
      </div>

      {/* Tipo de Acesso */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-gray-700 mb-3">
          Nível de Visibilidade
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Opção: TODAS */}
          <label className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all h-full
            ${accessControl === DoctorAccessControl.ALL 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
                <input
                type="radio"
                name="accessControl"
                checked={accessControl === DoctorAccessControl.ALL}
                onChange={() => setAccessControl(DoctorAccessControl.ALL)}
                className="w-4 h-4 text-blue-600"
                />
                <span className="font-bold text-gray-800 text-sm">Todas</span>
            </div>
            <p className="text-[10px] text-gray-500 text-center">
              Todas as secretárias da clínica
            </p>
          </label>

          {/* Opção: SELECIONADAS */}
          <label className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all h-full
            ${accessControl === DoctorAccessControl.SELECTED 
              ? 'border-amber-500 bg-amber-50' 
              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
                <input
                type="radio"
                name="accessControl"
                checked={accessControl === DoctorAccessControl.SELECTED}
                onChange={() => setAccessControl(DoctorAccessControl.SELECTED)}
                className="w-4 h-4 text-amber-600"
                />
                <span className="font-bold text-gray-800 text-sm">Selecionadas</span>
            </div>
            <p className="text-[10px] text-gray-500 text-center">
              Apenas equipe autorizada
            </p>
          </label>

          {/* Opção: NENHUMA */}
          <label className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all h-full
            ${accessControl === DoctorAccessControl.NONE 
              ? 'border-red-500 bg-red-50' 
              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
                <input
                type="radio"
                name="accessControl"
                checked={accessControl === DoctorAccessControl.NONE}
                onChange={() => setAccessControl(DoctorAccessControl.NONE)}
                className="w-4 h-4 text-red-600"
                />
                <span className="font-bold text-gray-800 text-sm">Privado</span>
            </div>
            <p className="text-[10px] text-gray-500 text-center">
              Apenas o médico vê a agenda
            </p>
          </label>
        </div>
      </div>

      {/* Lista de Secretárias (só aparece se SELECTED) */}
      {accessControl === DoctorAccessControl.SELECTED && (
        <div className="border-t border-gray-100 pt-6 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-bold text-gray-700">
              Selecione as Secretárias ({selectedSecretaries.size}/{secretaries.length})
            </label>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Marcar Todas
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                Limpar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : secretaries.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <Users size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Nenhuma secretária cadastrada</p>
              <p className="text-xs text-gray-400 mt-1">
                Cadastre secretárias na aba "Minha Equipe"
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {secretaries.map(secretary => {
                const isSelected = selectedSecretaries.has(secretary.id);
                
                return (
                  <label
                    key={secretary.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                      ${isSelected 
                        ? 'border-blue-300 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSecretary(secretary.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{secretary.name}</p>
                      <p className="text-xs text-gray-500">{secretary.email}</p>
                    </div>
                    
                    {isSelected && (
                      <Check size={16} className="text-blue-600" />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {/* Aviso se nenhuma selecionada */}
          {selectedSecretaries.size === 0 && accessControl === DoctorAccessControl.SELECTED && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>Atenção:</strong> Nenhuma secretária selecionada. 
                A agenda deste médico ficará inacessível para todas as secretárias.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Botão Salvar */}
      <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
        <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className={`px-6 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2
                ${hasChanges() 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
            `}
        >
            {saving ? (
            <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
            </>
            ) : (
            <>
                <Check size={18} />
                Salvar Alterações
            </>
            )}
        </button>
      </div>
    </div>
  );
};