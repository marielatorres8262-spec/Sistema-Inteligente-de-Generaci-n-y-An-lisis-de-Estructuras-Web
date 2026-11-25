import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  CompetencyLevel,
  Operator,
  PRODUCTION_LINES,
  ProductionLine,
  SHIFTS,
  ShiftType,
  Workstation,
} from '../types/skillsMatrix';

interface AddEntityModalProps {
  mode: 'operator' | 'station' | null;
  onClose: () => void;
  onAddOperator: (op: Omit<Operator, 'id'>) => void;
  onAddStation: (station: Omit<Workstation, 'id'>) => void;
}

export const AddEntityModal: React.FC<AddEntityModalProps> = ({
  mode,
  onClose,
  onAddOperator,
  onAddStation,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Operador de Planta');
  const [shift, setShift] = useState<ShiftType>('Turno A');
  const [line, setLine] = useState<ProductionLine>(PRODUCTION_LINES[0]);
  const [critical, setCritical] = useState(true);
  const [minCertified, setMinCertified] = useState(2);
  const [targetLevel, setTargetLevel] = useState<CompetencyLevel>(3);
  const [error, setError] = useState('');

  if (!mode) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Completa tanto el código identificador como el nombre completo.');
      return;
    }

    if (mode === 'operator') {
      onAddOperator({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        role: role.trim() || 'Operador de Planta',
        shift,
        line,
        hireDate: new Date().toISOString().slice(0, 10),
      });
    } else {
      onAddStation({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        line,
        critical,
        minCertified: Math.max(1, minCertified),
        targetLevel,
      });
    }

    setCode('');
    setName('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-entity-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="add-entity-title" className="text-base font-bold text-slate-900">
            {mode === 'operator' ? 'Registrar nuevo operador' : 'Registrar nueva estación'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label htmlFor="entity-code" className="block text-xs font-semibold text-slate-700 mb-1">
                Código
              </label>
              <input
                id="entity-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={mode === 'operator' ? 'OP-110' : 'EST-09'}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="entity-name" className="block text-xs font-semibold text-slate-700 mb-1">
                {mode === 'operator' ? 'Nombre del operador' : 'Nombre de la estación'}
              </label>
              <input
                id="entity-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === 'operator' ? 'Ej. Laura Domínguez' : 'Ej. Calibración Láser'}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="entity-line" className="block text-xs font-semibold text-slate-700 mb-1">
              Línea de producción
            </label>
            <select
              id="entity-line"
              value={line}
              onChange={(e) => setLine(e.target.value as ProductionLine)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {PRODUCTION_LINES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {mode === 'operator' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="entity-shift" className="block text-xs font-semibold text-slate-700 mb-1">
                  Turno
                </label>
                <select
                  id="entity-shift"
                  value={shift}
                  onChange={(e) => setShift(e.target.value as ShiftType)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="entity-role" className="block text-xs font-semibold text-slate-700 mb-1">
                  Puesto
                </label>
                <input
                  id="entity-role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="station-min" className="block text-xs font-semibold text-slate-700 mb-1">
                  Mínimo autónomos (N3+)
                </label>
                <input
                  id="station-min"
                  type="number"
                  min={1}
                  max={10}
                  value={minCertified}
                  onChange={(e) => setMinCertified(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="station-target" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nivel objetivo
                </label>
                <select
                  id="station-target"
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(Number(e.target.value) as CompetencyLevel)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value={2}>N2 · Operación asistida</option>
                  <option value={3}>N3 · Autónomo</option>
                  <option value={4}>N4 · Instructor</option>
                </select>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-xs font-medium text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={critical}
                  onChange={(e) => setCritical(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                Estación crítica de calidad o seguridad
              </label>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              {mode === 'operator' ? 'Agregar operador' : 'Agregar estación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
