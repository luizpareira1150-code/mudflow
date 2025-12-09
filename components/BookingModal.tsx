
import React from 'react';
import { User } from '../types';
import { QuickPatientForm } from './QuickPatientForm';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onConflict?: () => void;
  user: User;
  preSelectedDate?: string;
  preSelectedTime?: string;
  preSelectedDoctorId?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  onConflict,
  user, 
  preSelectedDate,
  preSelectedTime,
  preSelectedDoctorId
}) => {
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
         <QuickPatientForm 
            organizationId={user.clinicId}
            onSuccess={() => { onSuccess(); onClose(); }}
            onCancel={onClose}
            onConflict={onConflict}
            initialDate={preSelectedDate}
            initialTime={preSelectedTime}
            initialDoctorId={preSelectedDoctorId}
         />
      </div>
    </div>
  );
};
