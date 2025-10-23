
import React from 'react';

export const ProgressBar = ({ percentage = 0 }) => {
  const safePercentage = Math.max(0, Math.min(100, percentage));
  
  let colorClass = 'bg-green-500';
  if (safePercentage < 75) colorClass = 'bg-yellow-500';
  if (safePercentage < 50) colorClass = 'bg-red-500';

  return (
    <div className="w-full bg-slate-700 rounded-full h-2.5">
      <div 
        className={`${colorClass} h-2.5 rounded-full transition-all duration-500 ease-out`} 
        style={{ width: `${safePercentage}%` }}
      ></div>
    </div>
  );
};
