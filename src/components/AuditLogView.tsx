import React, { useMemo, useState } from 'react';
import { ArrowRight, Paperclip, Search } from 'lucide-react';
import { AuditLogEntry, COMPETENCY_LEVELS } from '../types/skillsMatrix';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Vigente' | 'Por vencer' | 'Pendiente'>('ALL');

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (statusFilter !== 'ALL' && entry.status !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.operatorName.toLowerCase().includes(q) ||
        entry.operatorCode.toLowerCase().includes(q) ||
        entry.stationName.toLowerCase().includes(q) ||
        entry.stationCode.toLowerCase().includes(q) ||
        entry.auditor.toLowerCase().includes(q) ||
        entry.notes.toLowerCase().includes(q)
      );
    });
  }, [logs, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por operador, estación, auditor o nota..."
            aria-label="Buscar en registro de auditorías"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['ALL', 'Vigente', 'Por vencer', 'Pendiente'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status === 'ALL' ? 'Todos' : status}
            </button>
          ))}
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-base font-semibold text-slate-900">
            No se encontraron registros de auditoría
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Modifica el término de búsqueda o selecciona cualquier celda de la matriz para registrar una nueva evaluación.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" data-testid="audit-log-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Operador</th>
                  <th scope="col" className="px-4 py-3">Estación</th>
                  <th scope="col" className="px-4 py-3">Cambio de nivel</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Auditor y evidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredLogs.map((entry) => {
                  const prevDef = COMPETENCY_LEVELS[entry.previousLevel];
                  const nextDef = COMPETENCY_LEVELS[entry.newLevel];
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{entry.operatorName}</div>
                        <div className="text-xs font-mono text-slate-500">{entry.operatorCode}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{entry.stationName}</div>
                        <div className="text-xs font-mono text-slate-500">{entry.stationCode}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 font-mono text-xs tabular-nums">
                          <span className="text-slate-600">
                            {prevDef.shortCode} ({prevDef.percentage}%)
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                          <span className={`font-semibold ${nextDef.textClass}`}>
                            {nextDef.shortCode} ({nextDef.percentage}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                        <span
                          className={
                            entry.status === 'Vigente'
                              ? 'text-emerald-700'
                              : entry.status === 'Por vencer'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                          }
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <div className="text-xs font-semibold text-slate-800">{entry.auditor}</div>
                        <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                          {entry.notes}
                        </div>
                        {entry.attachmentName && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-medium text-blue-800">
                            <Paperclip className="w-3 h-3 shrink-0" aria-hidden="true" />
                            {entry.attachmentName}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
