
import React, { useState } from 'react';
import { User, UserRole, AccountType, Organization } from '../../types';
import { doctorService } from '../../services/mockSupabase';
import { Users, UserPlus, Building2, Mail, Phone, KeyRound, AlertTriangle, DollarSign, RefreshCw, Trash2 } from 'lucide-react';
import { useToast } from '../ToastProvider';

interface AdminTeamProps {
  currentUser: User;
  users: User[];
  organizations: Organization[];
  onUserCreated: () => void;
  onSelectUser: (user: User) => void;
}

export const AdminTeam: React.FC<AdminTeamProps> = ({ currentUser, users, organizations, onUserCreated, onSelectUser }) => {
  const { showToast } = useToast();
  
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    username: '', 
    password: '', 
    role: UserRole.SECRETARY,
    accountType: AccountType.CONSULTORIO,
    organizationName: '',
    phone1: '',
    phone2: '',
    subscriptionValue: ''
  });

  const allowedRoleToCreate = currentUser.role === UserRole.OWNER 
    ? UserRole.DOCTOR_ADMIN 
    : UserRole.SECRETARY;

  const getUserOrg = (user: User) => organizations.find(o => o.id === user.clinicId);

  // Check Limit for Secretaries
  const secretaryCount = users.filter(u => u.role === UserRole.SECRETARY).length;
  const currentOrg = organizations.find(o => o.id === currentUser.clinicId);
  const maxSecretaries = currentOrg?.accountType === AccountType.CLINICA ? 5 : 2;
  const isLimitReached = currentUser.role === UserRole.DOCTOR_ADMIN && secretaryCount >= maxSecretaries;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await doctorService.createUser({
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        password: newUser.password,
        role: allowedRoleToCreate,
        // GOVERNANCE: Use crypto.randomUUID() instead of Date.now() for Clinic ID
        clinicId: currentUser.role === UserRole.OWNER ? `clinic_${crypto.randomUUID()}` : currentUser.clinicId,
        accountType: newUser.accountType,
        organizationName: newUser.organizationName,
        phone1: newUser.phone1,
        phone2: newUser.phone2,
        subscriptionValue: newUser.subscriptionValue ? Number(newUser.subscriptionValue) : 0
      });
      
      onUserCreated();

      setNewUser({ 
          name: '', email: '', username: '', password: '', role: UserRole.SECRETARY,
          accountType: AccountType.CONSULTORIO, organizationName: '', phone1: '', phone2: '', subscriptionValue: ''
      });
      showToast('success', 'Usuário criado com sucesso!');
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao criar usuário');
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-left-4 duration-300">
        {/* 1. Create User Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                <UserPlus size={20} className="text-blue-600" />
                Cadastrar {allowedRoleToCreate === UserRole.DOCTOR_ADMIN ? 'Novo Cliente' : 'Secretária'}
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
                {currentUser.role === UserRole.OWNER && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-3 mb-4">
                        <h4 className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1">
                            <Building2 size={14} /> Dados do Contrato
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Valor da Mensalidade (R$)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        required
                                        value={newUser.subscriptionValue}
                                        onChange={e => setNewUser({...newUser, subscriptionValue: e.target.value})}
                                        className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg pl-8 pr-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        placeholder="0.00"
                                    />
                                    <DollarSign size={14} className="absolute left-2.5 top-4 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                {currentUser.role === UserRole.OWNER && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* 2. CARD GRID VIEW */}
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <Users size={20} className="text-blue-600" />
                {currentUser.role === UserRole.OWNER ? 'Contas Ativas' : 'Minha Equipe'}
                </h3>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                {users.length} ativos
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                        <p className="text-sm text-gray-400 italic">Nenhum usuário encontrado.</p>
                    </div>
                ) : (
                    users.map(u => {
                        const userOrg = getUserOrg(u);
                        return (
                            <div 
                                key={u.id}
                                onClick={() => onSelectUser(u)}
                                className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col relative overflow-hidden h-[200px]"
                            >
                                {/* Strip based on Org Type or Role */}
                                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                                    userOrg?.accountType === AccountType.CLINICA ? 'bg-purple-500' :
                                    userOrg?.accountType === AccountType.CONSULTORIO ? 'bg-blue-500' : 
                                    'bg-gray-300'
                                }`} />

                                <div className="flex items-start justify-between mb-4 mt-2">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-12 h-12 rounded-full flex shrink-0 items-center justify-center font-bold text-lg shadow-sm ${
                                            u.role === UserRole.OWNER ? 'bg-purple-100 text-purple-600' : 
                                            u.role === UserRole.DOCTOR_ADMIN ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                                        }`}>
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            {userOrg && (
                                                <p className="text-xs text-gray-500 truncate uppercase font-bold tracking-tight">
                                                    {userOrg.name}
                                                </p>
                                            )}
                                            <h4 className="font-bold text-gray-900 leading-tight truncate">{u.name}</h4>
                                        </div>
                                    </div>
                                    {userOrg && (
                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ml-2 whitespace-nowrap ${
                                            userOrg.accountType === AccountType.CLINICA ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                                        }`}>
                                            {userOrg.accountType === AccountType.CLINICA ? 'Clínica' : 'Consul.'}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 mb-4 flex-1">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Mail size={14} className="text-gray-400" />
                                        <span className="truncate">{u.email}</span>
                                    </div>
                                    {userOrg?.subscriptionValue !== undefined && currentUser.role === UserRole.OWNER && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <DollarSign size={14} className="text-green-500" />
                                            <span className="font-medium text-green-700">R$ {userOrg.subscriptionValue.toLocaleString('pt-BR')}/mês</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Clique para detalhes</span>
                                    <span className={`font-bold uppercase ${
                                        u.role === UserRole.DOCTOR_ADMIN ? 'text-blue-600' : 'text-emerald-600'
                                    }`}>
                                        {u.role === UserRole.DOCTOR_ADMIN ? 'Cliente' : 'Equipe'}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    </div>
  );
};
