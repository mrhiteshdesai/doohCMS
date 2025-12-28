import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled = false, className = '' }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row clicks or other events
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      style={{ width: '2.75rem', height: '1.5rem' }}
      className={`
        relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <span
        aria-hidden="true"
        style={{ width: '1.25rem', height: '1.25rem' }}
        className={`
          pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
};

export default Switch;
