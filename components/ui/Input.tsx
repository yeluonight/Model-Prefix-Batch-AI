import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary group-focus-within:text-accent transition-colors">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full bg-white border border-border text-primary text-sm rounded-lg
            placeholder-tertiary transition-all duration-200
            focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
            disabled:bg-subtle disabled:text-tertiary
            ${icon ? 'pl-10 pr-3' : 'px-3'} py-2.5
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-error-text">{error}</p>}
    </div>
  );
};