import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const [year, month, day] = value.split('-').map(Number);
  const [viewDate, setViewDate] = useState(new Date(year, month - 1, 1));

  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      if (y !== viewDate.getFullYear() || m - 1 !== viewDate.getMonth()) {
        setViewDate(new Date(y, m - 1, 1));
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideButton = containerRef.current && containerRef.current.contains(target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);

      if (!isInsideButton && !isInsideDropdown) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', () => setIsOpen(false), true);
    }
    
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', () => setIsOpen(false), true);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const screenH = window.innerHeight;
        const screenW = window.innerWidth;
        const width = 300;
        const height = 340;

        let style: React.CSSProperties = {
            position: 'fixed',
            zIndex: 9999,
        };

        if (screenH - rect.bottom < height && rect.top > height) {
            style.bottom = screenH - rect.top + 8;
            style.top = 'auto';
        } else {
            style.top = rect.bottom + 8;
            style.bottom = 'auto';
        }

        if (rect.left + width > screenW) {
             style.left = 'auto';
             style.right = screenW - rect.right; 
        } else {
            style.left = rect.left;
            style.right = 'auto';
        }
        
        setMenuStyle(style);
    }
  }, [isOpen]);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDayClick = (d: number) => {
    const selectedMonth = viewDate.getMonth();
    const selectedYear = viewDate.getFullYear();
    
    const m = String(selectedMonth + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    
    onChange(`${selectedYear}-${m}-${dayStr}`);
    setIsOpen(false);
  };

  const currentYear = viewDate.getFullYear();
  const currentMonthIndex = viewDate.getMonth();
  
  const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonthIndex);
  
  const displayDateObj = new Date(year, month - 1, day);
  const formattedDisplay = displayDateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm font-medium hover:border-blue-300 hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-blue-500 w-full justify-between group h-[42px]"
      >
        <div className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-gray-700 group-hover:text-gray-900">{formattedDisplay}</span>
        </div>
      </button>

      {isOpen && createPortal(
        <div 
            ref={dropdownRef}
            style={menuStyle}
            className="bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-[300px] animate-in fade-in zoom-in-95 duration-200 select-none"
        >
          <div className="flex justify-between items-center mb-4 px-1">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-gray-800 text-sm">
              {months[currentMonthIndex]} {currentYear}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {weekDays.map((wd, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-gray-400 uppercase py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const isSelected = d === day && currentMonthIndex === month - 1 && currentYear === year;
              const today = new Date();
              const isToday = 
                d === today.getDate() && 
                currentMonthIndex === today.getMonth() && 
                currentYear === today.getFullYear();

              return (
                <button
                  key={d}
                  onClick={() => handleDayClick(d)}
                  className={`
                    h-8 w-8 rounded-full text-sm flex items-center justify-center transition-all duration-200
                    ${isSelected 
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-200 scale-105' 
                      : isToday 
                        ? 'bg-blue-50 text-blue-600 font-bold border border-blue-100'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                  `}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};