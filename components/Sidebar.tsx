
import React from 'react';
import { User, UserRole, ViewState } from '../types';
import { LayoutDashboard, Users, Calendar, LogOut, Settings } from 'lucide-react';

interface SidebarProps {
  user: User;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activePage, onNavigate, onLogout }) => {
  const menuItems = [
    { id: ViewState.Dashboard, label: 'Visão Global', icon: LayoutDashboard, roles: [UserRole.OWNER] },
    { id: ViewState.Dashboard, label: 'CRM', icon: LayoutDashboard, roles: [UserRole.SECRETARY, UserRole.DOCTOR_ADMIN] },
    { id: ViewState.Agenda, label: 'Agenda', icon: Calendar, roles: [UserRole.SECRETARY, UserRole.DOCTOR_ADMIN] },
    { id: ViewState.Settings, label: 'Administração', icon: Settings, roles: [UserRole.OWNER, UserRole.DOCTOR_ADMIN] },
  ];

  return (
    <div className="w-64 bg-white h-screen shadow-lg flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          MedFlow
        </h1>
        <p className="text-xs text-gray-500 mt-1">CRM Integrado</p>
      </div>

      <div className="p-4 flex-1">
        <div className="mb-6 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-semibold text-blue-900">{user.name}</p>
          <p className="text-xs text-blue-600 capitalize">{user.role}</p>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item, idx) => {
            if (!item.roles.includes(user.role)) return null;
            
            const Icon = item.icon;
            const isActive = activePage === item.id;
            
            return (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                  }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
