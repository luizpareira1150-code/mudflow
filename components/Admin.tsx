
import React, { useState, useEffect } from 'react';
import { User, UserRole, ClinicSettings, Doctor, Organization, AccountType } from '../types';
import { dataService, authService } from '../services/mockSupabase';
import Automations from './Automations';
import { Users, Building2, UserPlus, KeyRound, Trash2, RefreshCw, AlertTriangle, X, Webhook, MessageSquare, Save, Link2, Lock, Eye, EyeOff, Stethoscope, ShieldCheck, Workflow, Copy, Shield, CheckCircle, Zap, Phone, Activity, Calendar } from 'lucide-react';
import { useToast } from './ToastProvider';
import { generateApiToken } from '../services/n8nIntegration';
import { ActivityLogs } from './ActivityLogs';
import { DoctorAvailabilityConfig } from './DoctorAvailabilityConfig';

interface AdminProps {
  user: User;
}

const Admin: React.FC<AdminProps> = ({ user: currentUser }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'team' | 'doctors' | 'integrations' | 'automations' | 'audit'>('team');

  // --- TEAM STATE ---
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    username: '', 
    password: '', 
    role: UserRole.SECRETARY,
    accountType: AccountType.CONSULTORIO,
    organizationName: '',
    phone1: '',
    phone2: ''
  });
  
  // --- DOCTORS STATE (For CLINICA accounts only) ---
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newDoctor, setNewDoctor] = useState({ name: '', specialty: 'Clínico Geral', color: 'blue' });
  const [selectedDoctorForAvailability, setSelectedDoctorForAvailability] = useState<Doctor | null>(null);

  // --- ORGANIZATION STATE ---
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  
  // --- INTEGRATIONS STATE ---
  const [settings, setSettings] = useState<ClinicSettings>({ clinicId: currentUser.clinicId });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Modal States
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; user: User | null; doctor: Doctor | null }>({ isOpen: false, user: null, doctor: null });
  const [resetModal, setResetModal] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Security Modal State
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');

  // Logic: Owner creates Doctors. Doctors create Secretaries.
  const allowedRoleToCreate = currentUser.role === UserRole.OWNER 
    ? UserRole.DOCTOR_ADMIN 
    : UserRole.SECRETARY;

  const loadData = async () => {
    // 1. Load Users
    const fetchedUsers = await dataService.getUsers(
      currentUser.role === UserRole.OWNER ? undefined : currentUser.clinicId
    );

    if (currentUser.role === UserRole.OWNER) {
      const adminsOnly = fetchedUsers.filter(u => 
        u.role === UserRole.DOCTOR_ADMIN && u.id !== currentUser.id
      );
      setUsers(adminsOnly);
    } else {
      setUsers(fetchedUsers);
    }

    // 2. Load Organization & Doctors
    if (currentUser.role === UserRole.DOCTOR_ADMIN) {
        const org = await dataService.getOrganization(currentUser.clinicId);
        setCurrentOrganization(org);
        
        if (org?.accountType === AccountType.CLINICA) {
            const docs = await dataService.getDoctors(currentUser.clinicId);
            setDoctors(docs);
        }
    }
  };

  const loadSettings = async () => {
    if (currentUser.role !== UserRole.OWNER) {
        const data = await dataService.getClinicSettings(currentUser.clinicId);
        setSettings(data);
    }
  };

  useEffect(() => {
    loadData();
    if (activeTab === 'integrations') loadSettings();
  }, [currentUser, activeTab]);

  // --- HANDLERS: TEAM ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dataService.createUser({
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        password: newUser.password,
        role: allowedRoleToCreate,
        clinicId: currentUser.role === UserRole.OWNER ? `clinic_${Date.now()}` : currentUser.clinicId,
        accountType: newUser.accountType,
        organizationName: newUser.organizationName,
        phone1: newUser.phone1,
        phone2: newUser.phone2
      });
      
      await loadData();

      setNewUser({ 
          name: '', email: '', username: '', password: '', role: UserRole.SECRETARY,
          accountType: AccountType.CONSULTORIO, organizationName: '', phone1: '', phone2: ''
      });
      showToast('success', 'Usuário criado com sucesso!');
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao criar usuário');
    }
  };

  // --- HANDLERS: DOCTORS ---
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
              color: newDoctor.color
          });
          await loadData();
          setNewDoctor({ name: '', specialty: 'Clínico Geral', color: 'blue' });
          showToast('success', 'Médico adicionado à equipe!');
      } catch (error) {
          showToast('error', 'Erro ao adicionar médico.');
      }
  };

  // --- HANDLERS: SETTINGS ---
  const initiateSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityPassword('');
    setIsSecurityModalOpen(true);
  };

  const confirmSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const isValid = await authService.verifyPassword(securityPassword);
        if (!isValid) {
            showToast('error', "Senha incorreta. Acesso negado.");
            return;
        }

        setIsSecurityModalOpen(false);
        setSettingsLoading(true);
        await dataService.updateClinicSettings(settings);
        showToast('success', 'Configurações de integração salvas!');
    } catch (error) {
        showToast('error', 'Erro ao salvar configurações.');
    } finally {
        setSettingsLoading(false);
    }
  };

  const handleCopyApiToken = () => {
    if (settings.apiToken) {
        navigator.clipboard.writeText(settings.apiToken);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
        showToast('success', 'Token de API copiado!');
    }
  };
  
  const handleGenerateToken = () => {
    const newToken = generateApiToken(currentUser.clinicId);
    setSettings({...settings, apiToken: newToken});
    showToast('info', 'Novo token gerado. Clique em Salvar para persistir.');
  };

  // --- DELETE LOGIC ---
  const confirmDelete = async () => {
    setActionLoading(true);
    try {
      if (deleteModal.user) {
          await dataService.deleteUser(deleteModal.user.id);
          showToast('success', 'Usuário removido.');
      } else if (deleteModal.doctor) {
          await dataService.deleteDoctor(deleteModal.doctor.id);
          showToast('success', 'Médico removido.');
      }
      await loadData();
      setDeleteModal({ isOpen: false, user: null, doctor: null });
    } catch (error) {
      showToast('error', 'Erro ao excluir.');
    } finally {
      setActionLoading(false);
    }
  };

  // --- RESET PASSWORD LOGIC ---
  const confirmReset = async () => {
    if (!resetModal.user || !newPassword) return;
    setActionLoading(true);
    try {
      await dataService.resetPassword(resetModal.user.id, newPassword);
      setResetModal({ isOpen: false, user: null });
      showToast('success', `Senha de ${resetModal.user.name} alterada!`);
    } catch (error) {
      showToast('error', 'Erro ao resetar senha.');
    } finally {
      setActionLoading(false);
    }
  };

  // Check Limit for Secretaries
  const secretaryCount = users.filter(u => u.role === UserRole.SECRETARY).length;
  const maxSecretaries = currentOrganization?.accountType === AccountType.CLINICA ? 5 : 2;
  const isLimitReached = currentUser.role === UserRole.DOCTOR_ADMIN && secretaryCount >= maxSecretaries;

  // Check Permissions for Tabs
  const canViewDoctors = currentUser.role === UserRole.DOCTOR_ADMIN && currentOrganization?.accountType === AccountType.CLINICA;

  return (
    <div className={`mx-auto pb-10 relative p-8 animate-in fade-in duration-500 ${activeTab === 'automations' ? 'max-w-6xl' : 'max-w-4xl'}`}>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Painel Administrativo</h2>
        <div className="flex items-center gap-2 text-gray-500 mt-1">
            {currentOrganization && (
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded border border-gray-200 uppercase font-bold tracking-wider">
                    {currentOrganization.accountType}
                </span>
            )}
            <p className="text-sm">{currentUser.role === UserRole.OWNER ? 'Gestão Global do Sistema' : currentOrganization?.name || 'Configurações da Clínica'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
            ${activeTab === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={18} />
          {currentUser.role === UserRole.OWNER ? 'Médicos (Clientes)' : 'Minha Equipe'}
        </button>
        
        {canViewDoctors && (
            <button
            onClick={() => setActiveTab('doctors')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === 'doctors' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
            <Stethoscope size={18} />
            Corpo Clínico
            </button>
        )}

        {currentUser.role !== UserRole.OWNER && (
            <>
                <button
                onClick={() => setActiveTab('integrations')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                    ${activeTab === 'integrations' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                <Webhook size={18} />
                Integrações (API)
                </button>
                <button
                onClick={() => setActiveTab('automations')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                    ${activeTab === 'automations' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                <Workflow size={18} />
                Automação
                </button>
            </>
        )}
        
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
            ${activeTab === 'audit' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Activity size={18} />
          Auditoria
        </button>
      </div>

      {/* --- TAB: TEAM --- */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Create User Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                <UserPlus size={20} className="text-blue-600" />
                Cadastrar {allowedRoleToCreate === UserRole.DOCTOR_ADMIN ? 'Novo Cliente' : 'Secretária'}
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
                {currentUser.role === UserRole.OWNER && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3 mb-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                            <Building2 size={14} /> Dados do Contrato
                        </h4>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Conta</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setNewUser({...newUser, accountType: AccountType.CONSULTORIO})}
                                    className={`text-xs py-2 px-3 rounded border transition-colors ${newUser.accountType === AccountType.CONSULTORIO ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                >
                                    Consultório (Individual)
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setNewUser({...newUser, accountType: AccountType.CLINICA})}
                                    className={`text-xs py-2 px-3 rounded border transition-colors ${newUser.accountType === AccountType.CLINICA ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                >
                                    Clínica (Multi-Médico)
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome do Estabelecimento</label>
                            <input
                                type="text"
                                required
                                value={newUser.organizationName}
                                onChange={e => setNewUser({...newUser, organizationName: e.target.value})}
                                className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                placeholder={newUser.accountType === AccountType.CONSULTORIO ? "Consultório Dr. Fulano" : "Clínica Saúde Total"}
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700">Nome do Usuário</label>
                    <input
                        type="text"
                        required
                        value={newUser.name}
                        onChange={e => setNewUser({...newUser, name: e.target.value})}
                        className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                        placeholder="Nome completo"
                        disabled={isLimitReached}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email de Contato</label>
                    <input
                        type="email"
                        required
                        value={newUser.email}
                        onChange={e => setNewUser({...newUser, email: e.target.value})}
                        className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                        placeholder="contato@email.com"
                        disabled={isLimitReached}
                    />
                </div>

                {currentUser.role === UserRole.OWNER && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Telefone 1</label>
                        <div className="relative">
                          <input
                              type="text"
                              value={newUser.phone1}
                              onChange={e => setNewUser({...newUser, phone1: e.target.value})}
                              className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg pl-8 pr-2 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                              placeholder="(00) 00000-0000"
                          />
                          <Phone size={14} className="absolute left-2.5 top-4 text-gray-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Telefone 2</label>
                        <div className="relative">
                          <input
                              type="text"
                              value={newUser.phone2}
                              onChange={e => setNewUser({...newUser, phone2: e.target.value})}
                              className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg pl-8 pr-2 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                              placeholder="(00) 00000-0000"
                          />
                          <Phone size={14} className="absolute left-2.5 top-4 text-gray-400" />
                        </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Login</label>
                    <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                    className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                    placeholder="usuario.login"
                    disabled={isLimitReached}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Senha</label>
                    <div className="relative">
                    <input
                        type="text"
                        required
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg pl-8 pr-2 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                        placeholder="123456"
                        disabled={isLimitReached}
                    />
                    <KeyRound size={14} className="absolute left-2.5 top-4 text-gray-400" />
                    </div>
                </div>
                </div>
                
                {isLimitReached && (
                    <div className="bg-red-50 p-3 rounded-lg text-xs text-red-600 border border-red-100 mt-2 flex items-start gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>Limite de contas atingido. Você já possui {maxSecretaries} secretárias.</span>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isLimitReached}
                    className={`w-full py-2.5 rounded-lg font-medium shadow-sm transition-all mt-2 flex justify-center items-center gap-2
                        ${isLimitReached 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }
                    `}
                >
                <UserPlus size={18} />
                {isLimitReached ? 'Limite Atingido' : 'Criar Usuário'}
                </button>
            </form>
            </div>

            {/* User List */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <Users size={20} className="text-blue-600" />
                {currentUser.role === UserRole.OWNER ? 'Contas Ativas' : 'Minha Equipe'}
                </h3>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                {users.length}
                </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {users.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-sm text-gray-400 italic">Nenhum usuário encontrado.</p>
                </div>
                ) : (
                users.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div>
                        <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{u.name}</p>
                        <span className="text-xs text-gray-400">({u.username})</span>
                        </div>
                        <p className="text-xs text-gray-500">{u.email}</p>
                        {u.phone1 && <p className="text-[10px] text-gray-400 mt-1">Tel: {u.phone1} {u.phone2 ? `/ ${u.phone2}` : ''}</p>}
                        <div className="mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold
                            ${u.role === UserRole.OWNER ? 'bg-purple-50 text-purple-700' : ''}
                            ${u.role === UserRole.DOCTOR_ADMIN ? 'bg-blue-50 text-blue-700' : ''}
                            ${u.role === UserRole.SECRETARY ? 'bg-emerald-50 text-emerald-700' : ''}
                        `}>
                            {u.role === UserRole.DOCTOR_ADMIN ? 'MÉDICO ADMIN' : u.role === UserRole.SECRETARY ? 'SECRETÁRIA' : 'DONO'}
                        </span>
                        </div>
                    </div>
                    
                    {u.id !== currentUser.id && (
                        <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setNewPassword(''); setResetModal({ isOpen: true, user: u }); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Resetar Senha"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={() => setDeleteModal({ isOpen: true, user: u, doctor: null })}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Usuário"
                        >
                            <Trash2 size={18} />
                        </button>
                        </div>
                    )}
                    </div>
                ))
                )}
            </div>
            </div>
        </div>
      )}

      {/* --- TAB: DOCTORS (CLINICA ONLY) --- */}
      {activeTab === 'doctors' && (
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
                                         <p className="text-xs text-gray-500">{doc.specialty}</p>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setSelectedDoctorForAvailability(doc)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Configurar Disponibilidade"
                                    >
                                        <Calendar size={18} />
                                    </button>
                                    {doctors.length > 1 && (
                                        <button 
                                            onClick={() => setDeleteModal({ isOpen: true, user: null, doctor: doc })}
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
      )}

      {/* --- TAB: INTEGRATIONS --- */}
      {activeTab === 'integrations' && (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                <div className="mb-8">
                   <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                       <Webhook size={24} className="text-purple-600" />
                       Configuração de Automação (N8N)
                   </h3>
                   <p className="text-gray-500 text-sm mt-1">
                       Integração de WhatsApp (Evolution API) e Webhooks.
                   </p>
                </div>

                <form onSubmit={initiateSaveSettings} className="space-y-6">
                    {/* API Token Section */}
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                        <h4 className="font-bold text-orange-800 flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
                            <Shield size={16} /> Token de API (Autenticação)
                        </h4>
                        
                        <p className="text-xs text-orange-700 mb-3">
                            Este token permite que o N8N envie dados DE VOLTA para o sistema (criar agendamentos via WhatsApp, por exemplo).
                        </p>
                        
                        <div className="flex gap-2 mb-3">
                            <input 
                            type="text"
                            value={settings.apiToken || 'Clique em "Gerar Token" para criar'}
                            disabled
                            className="flex-1 border border-orange-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm font-mono"
                            />
                            <button
                            type="button"
                            onClick={handleCopyApiToken}
                            disabled={!settings.apiToken}
                            className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Copiar Token"
                            >
                            {tokenCopied ? <CheckCircle size={18} /> : <Copy size={18} />}
                            </button>
                            <button
                            type="button"
                            onClick={handleGenerateToken}
                            className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                            title="Gerar Novo Token"
                            >
                            <RefreshCw size={18} />
                            </button>
                        </div>
                        
                        <div className="bg-white/50 p-3 rounded text-xs text-orange-600 border border-orange-100/50">
                            <strong>⚠️ Segurança:</strong> Não compartilhe este token publicamente. Ele permite que o N8N faça alterações no seu sistema.
                        </div>
                    </div>

                    {/* Evolution API Section */}
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                        <h4 className="font-bold text-green-800 flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
                            <MessageSquare size={16} /> Evolution API
                        </h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Instance Name</label>
                                <input 
                                    type="text"
                                    value={settings.evolutionInstanceName || ''}
                                    onChange={e => setSettings({...settings, evolutionInstanceName: e.target.value})}
                                    placeholder="Ex: clinica_dr_house"
                                    className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">API Key (Token)</label>
                                <div className="relative">
                                    <input 
                                        type={showApiKey ? "text" : "password"}
                                        value={settings.evolutionApiKey || ''}
                                        onChange={e => setSettings({...settings, evolutionApiKey: e.target.value})}
                                        className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-green-600 transition-colors"
                                    >
                                        {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* N8N Section */}
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                        <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
                            <Link2 size={16} /> Webhook N8N (Saída)
                        </h4>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Webhook URL</label>
                            <input 
                                type="url"
                                value={settings.n8nWebhookUrl || ''}
                                onChange={e => setSettings({...settings, n8nWebhookUrl: e.target.value})}
                                className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                         {/* Toggle Modo de Produção */}
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mt-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                            <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wide flex items-center gap-2">
                                <Zap size={16} /> Modo de Operação
                            </h4>
                            <p className="text-xs text-blue-600 mt-1">
                                {settings.n8nProductionMode 
                                ? 'Webhooks estão sendo enviados REALMENTE para o N8N' 
                                : 'Webhooks estão sendo simulados (apenas logs no console)'}
                            </p>
                            </div>
                            
                            <button
                            type="button"
                            onClick={() => setSettings({...settings, n8nProductionMode: !settings.n8nProductionMode})}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                                settings.n8nProductionMode ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                            >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                settings.n8nProductionMode ? 'translate-x-7' : 'translate-x-1'
                                }`}
                            />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className={`p-2 rounded ${!settings.n8nProductionMode ? 'bg-white border-2 border-blue-400' : 'bg-white/50'}`}>
                            <p className="font-bold text-blue-800">🧪 Desenvolvimento</p>
                            <p className="text-blue-600 text-[10px] mt-1">Logs no console, sem envio real</p>
                            </div>
                            <div className={`p-2 rounded ${settings.n8nProductionMode ? 'bg-white border-2 border-green-400' : 'bg-white/50'}`}>
                            <p className="font-bold text-green-800">🚀 Produção</p>
                            <p className="text-green-600 text-[10px] mt-1">Envia webhooks reais ao N8N</p>
                            </div>
                        </div>
                        
                        {settings.n8nProductionMode && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-start gap-2">
                            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                            <span>
                                <strong>Atenção:</strong> Certifique-se de que a URL do webhook está correta e o N8N está configurado antes de ativar o modo produção.
                            </span>
                            </div>
                        )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <button
                            type="submit"
                            disabled={settingsLoading}
                            className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-black transition-all shadow-lg flex justify-center items-center gap-2"
                        >
                            <Lock size={18} />
                            {settingsLoading ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                    </div>
                </form>
             </div>
        </div>
      )}

      {/* --- TAB: AUTOMATIONS --- */}
      {activeTab === 'automations' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <Automations />
        </div>
      )}
      
      {/* --- TAB: AUDIT --- */}
      {activeTab === 'audit' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <ActivityLogs user={currentUser} />
        </div>
      )}

      {/* --- DELETE MODAL --- */}
      {deleteModal.isOpen && (deleteModal.user || deleteModal.doctor) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Excluir Registro?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Esta ação é permanente. Tem certeza que deseja excluir <strong>{deleteModal.user?.name || deleteModal.doctor?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteModal({ isOpen: false, user: null, doctor: null })}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex justify-center"
              >
                {actionLoading ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RESET PASSWORD MODAL --- */}
      {resetModal.isOpen && resetModal.user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nova Senha</h3>
              <button onClick={() => setResetModal({ isOpen: false, user: null })} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="mb-6">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nova senha..."
                autoFocus
              />
            </div>
            <button 
              onClick={confirmReset}
              disabled={!newPassword || actionLoading}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
            >
              {actionLoading ? 'Salvando...' : 'Salvar Senha'}
            </button>
          </div>
        </div>
      )}

      {/* --- SECURITY CONFIRMATION MODAL --- */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xs">
            <div className="mb-4 text-center">
                <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <ShieldCheck size={24} className="text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Segurança</h3>
                <p className="text-xs text-gray-500">Digite sua senha para confirmar.</p>
            </div>
            <form onSubmit={confirmSaveSettings} className="space-y-4">
                <input
                  type="password"
                  value={securityPassword}
                  onChange={(e) => setSecurityPassword(e.target.value)}
                  className="w-full border border-gray-200 bg-white text-center text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Sua senha"
                  autoFocus
                />
                <button 
                    type="submit" 
                    disabled={!securityPassword}
                    className="w-full py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                    Confirmar
                </button>
            </form>
          </div>
        </div>
      )}

      {/* --- AVAILABILITY CONFIG MODAL --- */}
      {selectedDoctorForAvailability && ( 
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl h-[90vh]">
                <DoctorAvailabilityConfig 
                    doctor={selectedDoctorForAvailability} 
                    onClose={() => setSelectedDoctorForAvailability(null)} 
                /> 
            </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
