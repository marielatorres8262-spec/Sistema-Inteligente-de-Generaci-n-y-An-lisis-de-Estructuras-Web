import React, { useEffect, useState } from 'react';
import { X, Check, Clock } from 'lucide-react';
import {
  AuditLogEntry,
  CertificationStatus,
  COMPETENCY_LEVELS,
  CompetencyLevel,
  CompetencyRecord,
  Operator,
  Workstation,
} from '../types/skillsMatrix';
import { LevelIconSvg, LevelIndicator } from './LevelIndicator';

interface AuditCellDrawerProps {
  operator: Operator | null;
  station: Workstation | null;
  record: CompetencyRecord | null;
  cellLogs: AuditLogEntry[];
  onClose: () => void;
  onSave: (payload: {
    operatorId: string;
    stationId: string;
    level: CompetencyLevel;
    status: CertificationStatus;
    auditor: string;
    notes: string;
  }) => void;
}

const ALL_LEVELS: CompetencyLevel[] = [0, 1, 2, 3, 4];

export const AuditCellDrawer: React.FC<AuditCellDrawerProps> = ({
  operator,
  station,
  record,
  cellLogs,
  onClose,
  onSave,
}) => {
  const [level, setLevel] = useState<CompetencyLevel>(record?.level ?? 0);
  const [status, setStatus] = useState<CertificationStatus>(record?.status ?? 'Vigente');
  const [auditor, setAuditor] = useState<string>(record?.auditor ?? '');
  const [notes, setNotes] = useState<string>(record?.notes ?? '');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (record) {
      setLevel(record.level);
      setStatus(record.status);
      setAuditor(record.auditor);
      setNotes(record.notes);
      setErrorMsg('');
    }
  }, [record, operator?.id, station?.id]);

  if (!operator || !station || !record) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditor.trim()) {
      setErrorMsg('Ingresa el nombre del supervisor o auditor que valida la competencia.');
      return;
    }
    if (!notes.trim()) {
      setErrorMsg('Registra una observación o evidencia técnica de la auditoría.');
      return;
    }
    onSave({
      operatorId: operator.id,
      stationId: station.id,
      level,
      status,
      auditor: auditor.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="w-full max-w-lg bg-white h-full border-l border-slate-200 flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Auditoría de competencia técnica
            </p>
            <h2 id="drawer-title" className="text-lg font-bold text-slate-900 mt-0.5">
              {operator.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-mono">{operator.code}</span> · {operator.shift} ·{' '}
              <span className="font-semibold text-slate-700">
                {station.code} {station.name}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de auditoría"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">
                  Vista previa del indicador dinámico
                </span>
                <span className="text-xs text-slate-500">
                  Meta estación: {COMPETENCY_LEVELS[station.targetLevel].shortCode}
                </span>
              </div>
              <LevelIndicator level={level} mode="bars" status={status} />
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                {COMPETENCY_LEVELS[level].description}
              </p>
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-900 mb-2.5">
                Nivel de competencia (0 – 4)
              </span>
              <div className="space-y-2">
                {ALL_LEVELS.map((lvl) => {
                  const def = COMPETENCY_LEVELS[lvl];
                  const active = level === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setLevel(lvl);
                        if (lvl > 0 && status === 'Pendiente') {
                          setStatus('Vigente');
                        }
                      }}
                      data-testid={`select-level-${lvl}`}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-all ${
                        active
                          ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <LevelIconSvg level={lvl} className="w-5 h-5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {def.shortCode} · {def.label}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            Equivalente ILUO: {def.iluoCode}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                        {def.percentage}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="audit-status"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Estado de certificación
                </label>
                <select
                  id="audit-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CertificationStatus)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Vigente">Vigente</option>
                  <option value="Por vencer">Por vencer</option>
                  <option value="Pendiente">Pendiente</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="audit-auditor"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Auditor / Supervisor responsable
                </label>
                <input
                  id="audit-auditor"
                  type="text"
                  value={auditor}
                  onChange={(e) => setAuditor(e.target.value)}
                  placeholder="Ej. Ing. Sofía Ramírez"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="audit-notes"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Evidencia técnica y observaciones de auditoría
              </label>
              <textarea
                id="audit-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe la prueba práctica, tiempo ciclo verificado o desviaciones..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {errorMsg && (
              <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="pt-2 border-t border-slate-200">
              <h3 className="text-xs font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                Historial de cambios en esta celda ({cellLogs.length})
              </h3>
              {cellLogs.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Aún no existen modificaciones registradas para esta asignación en la sesión actual.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {cellLogs.map((entry) => (
                    <li
                      key={entry.id}
                      className="text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between gap-2 font-medium text-slate-900">
                        <span className="font-mono tabular-nums">
                          N{entry.previousLevel} → N{entry.newLevel}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {new Date(entry.timestamp).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">{entry.notes}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Auditor: {entry.auditor} · {entry.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="save-audit-button"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              Guardar auditoría
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
