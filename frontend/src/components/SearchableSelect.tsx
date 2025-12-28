import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface Option {
  label: string;
  value: string | number;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string; // Container class
  triggerClassName?: string; // Trigger button specific class
  disabled?: boolean;
  icon?: React.ReactNode; // Optional icon to display on the left
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  triggerClassName = '',
  disabled = false,
  icon
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Default styles for the trigger if not overridden
  const defaultTriggerStyles = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2";
  const finalTriggerClassName = triggerClassName || defaultTriggerStyles;

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div
        className={`flex items-center justify-between cursor-pointer ${finalTriggerClassName} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {icon}
          <span className={`block truncate ${!selectedOption ? 'text-gray-500' : 'text-gray-900'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={16} className={`text-gray-500 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full min-w-[200px] mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col left-0">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center bg-gray-50 rounded-md px-2 py-1">
              <Search size={14} className="text-gray-400 mr-2" />
              <input
                type="text"
                className="bg-transparent outline-none w-full text-sm py-1"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-blue-50 ${
                    String(option.value) === String(value) ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <span>{option.label}</span>
                  {String(option.value) === String(value) && <Check size={14} />}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
