import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full border-blue-600 border-t-transparent animate-spin`}
      />
      {text && <p className="text-sm font-medium text-slate-500">{text}</p>}
    </div>
  )
}
