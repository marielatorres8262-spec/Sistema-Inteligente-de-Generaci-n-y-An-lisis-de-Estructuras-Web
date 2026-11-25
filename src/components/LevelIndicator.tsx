import React from 'react';
import {
  CertificationStatus,
  COMPETENCY_LEVELS,
  CompetencyLevel,
  IndicatorMode,
} from '../types/skillsMatrix';

interface LevelIndicatorProps {
  level: CompetencyLevel;
  mode: IndicatorMode;
  status?: CertificationStatus;
  compact?: boolean;
}

export function LevelIconSvg({
  level,
  className = 'w-6 h-6',
}: {
  level: CompetencyLevel;
  className?: string;
}) {
  if (level === 0) {
    return (
      <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.6" />
      </svg>
    );
  }
  if (level === 1) {
    return (
      <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="#FACC15" stroke="#B45309" strokeWidth="1.6" />
        <path
          d="M9.5 10.5C10.8 8.7 13 7.8 15.2 8.1"
          stroke="#FEF9C3"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (level === 2) {
    return (
      <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="#FFFFFF" stroke="#166534" strokeWidth="1.6" />
        <path
          d="M14 3A11 11 0 0 0 14 25Z"
          fill="#16A34A"
        />
        <circle cx="14" cy="14" r="11" stroke="#14532D" strokeWidth="1.5" />
      </svg>
    );
  }
  if (level === 3) {
    return (
      <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="#16A34A" stroke="#14532D" strokeWidth="1.6" />
        <path
          d="M9.5 10.5C10.8 8.7 13 7.8 15.2 8.1"
          stroke="#BBF7D0"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <circle cx="14" cy="14" r="11" fill="#0B841F" stroke="#052E16" strokeWidth="1.6" />
      <path
        d="M9.5 10.5C10.8 8.7 13 7.8 15.2 8.1"
        stroke="#86EFAC"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const LevelIndicator: React.FC<LevelIndicatorProps> = ({
  level,
  mode,
  status,
  compact = false,
}) => {
  const def = COMPETENCY_LEVELS[level];

  if (mode === 'icons') {
    if (compact) {
      return (
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            <LevelIconSvg level={level} className="w-5 h-5 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
              {def.shortCode} · {def.iluoCode}
            </span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            {def.percentage}%
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-0.5 py-0.5">
        <LevelIconSvg level={level} className="w-7 h-7 drop-shadow-xs" />
        {status === 'Por vencer' && (
          <span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 px-1 rounded leading-tight">
            Por vencer
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full min-w-[72px]">
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[11px] font-semibold tabular-nums ${def.textClass}`}>
          {def.shortCode}
          <span className="text-slate-500 font-normal ml-0.5">·{def.iluoCode}</span>
        </span>
        <span className="text-[10px] font-mono tabular-nums text-slate-700">
          {def.percentage}%
        </span>
      </div>
      <div className="grid grid-cols-4 gap-0.5 h-2 w-full" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => {
          const active = level >= segment;
          return (
            <span
              key={segment}
              className={`h-full rounded-[2px] transition-colors duration-200 ${
                active ? def.barClass : 'bg-white/80 border border-slate-300/60'
              }`}
            />
          );
        })}
      </div>
      {!compact && status === 'Por vencer' && (
        <span className="text-[10px] font-medium text-amber-800 leading-none">
          Por vencer
        </span>
      )}
    </div>
  );
};
