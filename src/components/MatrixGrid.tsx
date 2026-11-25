import React from 'react';
import {
  AlertTriangle,
  Bot,
  Car,
  CheckCircle2,
  Cog,
  Cpu,
  Factory,
  Gauge,
  PackageCheck,
  Paintbrush,
  ShieldCheck,
  Target,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import {
  COMPETENCY_LEVELS,
  CompetencyLevel,
  CompetencyRecord,
  IndicatorMode,
  Operator,
  Workstation,
} from '../types/skillsMatrix';
import {
  calculateOperatorPolyvalence,
  calculateStationCoverage,
  getCellKey,
  getPolyvalenceTier,
  getTrainingPlanItems,
} from '../utils/matrixLogic';
import { LevelIconSvg, LevelIndicator } from './LevelIndicator';

interface MatrixGridProps {
  operators: Operator[];
  allOperators: Operator[];
  stations: Workstation[];
  recordsMap: Record<string, CompetencyRecord>;
  indicatorMode: IndicatorMode;
  selectedCell: { operatorId: string; stationId: string } | null;
  activeLineLabel?: string;
  onSelectCell: (operatorId: string, stationId: string) => void;
  onClearFilters: () => void;
}

function getStationIcon(stationName: string) {
  const name = stationName.toLowerCase();
  if (name.includes('ensamble') || name.includes('chasis')) return Car;
  if (name.includes('torque') || name.includes('mantenimiento') || name.includes('fijación'))
    return Wrench;
  if (name.includes('soldadura') || name.includes('robot')) return Bot;
  if (name.includes('cnc') || name.includes('mecanizado')) return Cpu;
  if (name.includes('rectificado') || name.includes('estanqueidad') || name.includes('calidad'))
    return Gauge;
  if (name.includes('metrología') || name.includes('cmm') || name.includes('control'))
    return ShieldCheck;
  if (name.includes('pintura') || name.includes('acabado')) return Paintbrush;
  if (name.includes('embalaje') || name.includes('empaque')) return PackageCheck;
  if (name.includes('logística') || name.includes('almacén')) return Truck;
  return Cog;
}

function getCellTintClass(level: CompetencyLevel, isSelected: boolean): string {
  if (isSelected) {
    return 'bg-blue-100 ring-2 ring-inset ring-blue-600';
  }
  switch (level) {
    case 4:
    case 3:
      return 'bg-[#c8efc4] hover:bg-[#b5e6b0]';
    case 2:
      return 'bg-[#fef3c7] hover:bg-[#fde68a]';
    case 1:
      return 'bg-[#fde2e4] hover:bg-[#fecdd3]';
    case 0:
    default:
      return 'bg-[#f1f5f9] hover:bg-[#e2e8f0]';
  }
}

export const MatrixGrid: React.FC<MatrixGridProps> = ({
  operators,
  allOperators,
  stations,
  recordsMap,
  indicatorMode,
  selectedCell,
  activeLineLabel = 'Producción Industrial',
  onSelectCell,
  onClearFilters,
}) => {
  if (operators.length === 0 || stations.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <p className="text-base font-semibold text-slate-900">
          No hay registros que coincidan con los filtros activos
        </p>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
          Ajusta la búsqueda por operador, cambia la línea de producción o desactiva el filtro de estaciones en riesgo.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-[#0d2d5e] rounded-lg hover:bg-[#133b7a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Restablecer filtros
        </button>
      </div>
    );
  }

  const todayFormatted = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const trainingPlanItems = getTrainingPlanItems(operators, stations, recordsMap, 5);

  return (
    <div className="space-y-4">
      {/* Top Plant Context Banner */}
      <section
        aria-label="Contexto de área y objetivo"
        className="bg-[#e6f0ff] border border-[#93c5fd] rounded-xl px-4 py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center shadow-xs"
      >
        <div className="md:col-span-4 flex items-center gap-3 md:border-r md:border-[#93c5fd]/70 md:pr-3">
          <div className="w-9 h-9 rounded-lg bg-white/80 border border-[#93c5fd] flex items-center justify-center shrink-0 text-[#0d2d5e]">
            <Factory className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="text-xs leading-snug min-w-0">
            <div className="text-slate-800 truncate">
              <strong className="text-[#0d2d5e]">Área:</strong> {activeLineLabel}
            </div>
            <div className="text-slate-700 font-mono tabular-nums mt-0.5">
              <strong className="font-sans text-[#0d2d5e]">Fecha:</strong> {todayFormatted}
            </div>
          </div>
        </div>

        <div className="md:col-span-3 flex items-center gap-3 md:border-r md:border-[#93c5fd]/70 md:pr-3">
          <div className="w-9 h-9 rounded-lg bg-white/80 border border-[#93c5fd] flex items-center justify-center shrink-0 text-[#0d2d5e]">
            <Users className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="text-xs leading-snug min-w-0">
            <div className="text-slate-800 truncate">
              <strong className="text-[#0d2d5e]">Responsable:</strong> Ing. Ana Torres
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Supervisión de Planta
            </div>
          </div>
        </div>

        <div className="md:col-span-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/80 border border-[#93c5fd] flex items-center justify-center shrink-0 text-[#0d2d5e]">
            <Target className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-xs text-slate-800 leading-snug">
            <strong className="text-[#0d2d5e]">Objetivo:</strong> Evaluar y desarrollar las habilidades del personal para cubrir múltiples procesos operativos.
          </p>
        </div>
      </section>

      {/* Main Double-Entry Matrix Table */}
      <div className="bg-white border-2 border-[#0d2d5e] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto matrix-scroll">
          <table
            className="w-full border-collapse text-left"
            aria-label="Matriz de doble entrada de habilidades y polivalencia"
            data-testid="skills-matrix-table"
          >
            <thead>
              <tr className="bg-[#0d2d5e] text-white">
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-[#0d2d5e] px-1.5 py-2.5 w-9 min-w-[36px] text-center border-r border-white/20 text-[11px] font-bold align-middle"
                >
                  No.
                </th>
                <th
                  scope="col"
                  className="sticky left-9 z-20 bg-[#0d2d5e] px-2.5 py-2.5 min-w-[152px] border-r border-white/25 align-middle"
                >
                  <div className="text-xs font-bold text-white whitespace-nowrap">
                    Nombre del Trabajador
                  </div>
                  <div className="text-[10px] font-normal text-blue-200 mt-0.5 whitespace-nowrap">
                    Código · Turno · Línea
                  </div>
                </th>

                {stations.map((station) => {
                  const coverage = calculateStationCoverage(station, allOperators, recordsMap);
                  const StationIcon = getStationIcon(station.name);
                  return (
                    <th
                      key={station.id}
                      scope="col"
                      className="px-1.5 py-2 min-w-[82px] border-r border-white/20 text-center align-top"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center justify-center gap-1">
                          <StationIcon className="w-4 h-4 text-white shrink-0" aria-hidden="true" />
                          {station.critical && (
                            <span
                              className={`text-[8.5px] font-bold px-1 py-0.2 rounded leading-tight ${
                                coverage.atRisk
                                  ? 'bg-red-500 text-white'
                                  : 'bg-blue-400/25 text-blue-100'
                              }`}
                            >
                              {coverage.atRisk ? 'Riesgo' : 'Crít.'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] font-bold text-white leading-tight line-clamp-2">
                          {station.name}
                        </div>
                        <div className="font-mono text-[9.5px] font-normal text-blue-200 tabular-nums">
                          {station.code}
                        </div>
                      </div>
                    </th>
                  );
                })}

                <th
                  scope="col"
                  className="px-2 py-2.5 min-w-[82px] bg-[#0d2d5e] text-center border-r border-white/20 align-middle"
                >
                  <div className="text-[11px] font-bold text-white leading-tight">
                    % Polivalencia
                  </div>
                </th>

                <th
                  scope="col"
                  className="px-2 py-2.5 min-w-[112px] bg-[#0d2d5e] text-center align-middle"
                >
                  <div className="text-xs font-bold text-white">Nivel</div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300">
              {operators.map((op, opIndex) => {
                const summary = calculateOperatorPolyvalence(op.id, stations, recordsMap);
                const tier = getPolyvalenceTier(summary.polyvalencePct);
                return (
                  <tr
                    key={op.id}
                    className="group transition-colors"
                    data-testid={`operator-row-${op.id}`}
                  >
                    <td className="sticky left-0 z-10 px-1.5 py-2 w-9 min-w-[36px] text-center font-mono text-xs font-bold text-slate-800 bg-white group-hover:bg-slate-50 border-r border-slate-300 align-middle tabular-nums transition-colors">
                      {opIndex + 1}
                    </td>

                    <th
                      scope="row"
                      className="sticky left-9 z-10 bg-white group-hover:bg-slate-50 px-2.5 py-2 border-r border-slate-300 align-middle transition-colors"
                    >
                      <div className="text-[13px] font-semibold text-slate-900 whitespace-nowrap">
                        {op.name}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
                        <span className="font-mono tabular-nums">{op.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{op.shift}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[68px]">
                          {op.line.split('·')[1]?.trim() ?? op.line}
                        </span>
                      </div>
                    </th>

                    {stations.map((station) => {
                      const key = getCellKey(op.id, station.id);
                      const record = recordsMap[key];
                      const level = record ? record.level : 0;
                      const levelDef = COMPETENCY_LEVELS[level];
                      const isSelected =
                        selectedCell?.operatorId === op.id &&
                        selectedCell?.stationId === station.id;

                      return (
                        <td
                          key={station.id}
                          className={`p-0 border-r border-slate-300 align-middle transition-colors ${getCellTintClass(
                            level,
                            isSelected
                          )}`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectCell(op.id, station.id)}
                            aria-label={`${op.name} en ${station.code} ${station.name}: ${levelDef.shortCode} ${levelDef.label} (${levelDef.percentage}%)`}
                            data-testid={`cell-${op.id}-${station.id}`}
                            className="w-full h-full px-1.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"
                          >
                            <LevelIndicator
                              level={level}
                              mode={indicatorMode}
                              status={record?.status}
                            />
                          </button>
                        </td>
                      );
                    })}

                    <td className="px-2 py-2 text-center align-middle bg-white border-r border-slate-300 tabular-nums">
                      <div className="text-sm font-bold font-mono text-slate-900">
                        {summary.polyvalencePct}%
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {summary.certifiedCount}/{summary.totalStations} est.
                      </div>
                    </td>

                    <td className="px-2 py-2 text-center align-middle bg-white">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${tier.badgeClass}`}
                      >
                        {tier.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-[#0d2d5e]">
                <td
                  className="sticky left-0 z-10 bg-slate-50 border-r border-slate-300"
                  aria-hidden="true"
                />
                <th
                  scope="row"
                  className="sticky left-9 z-10 bg-slate-50 px-2.5 py-2.5 border-r border-slate-300 text-left"
                >
                  <div className="text-[11px] font-bold text-[#0d2d5e]">
                    Cobertura de estación (N3–N4)
                  </div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                    Autónomos vs. mínimo
                  </div>
                </th>

                {stations.map((station) => {
                  const coverage = calculateStationCoverage(station, allOperators, recordsMap);
                  return (
                    <td
                      key={station.id}
                      className="px-1.5 py-2.5 border-r border-slate-300 align-middle"
                      data-testid={`station-coverage-${station.id}`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10.5px] tabular-nums">
                        <span className="font-mono font-bold text-slate-900">
                          {coverage.autonomousCount}/{station.minCertified}
                        </span>
                        {coverage.atRisk ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700">
                            <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                            Déficit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                            OK
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            coverage.atRisk ? 'bg-red-600' : 'bg-[#0b841f]'
                          }`}
                          style={{ width: `${coverage.coveragePct}%` }}
                        />
                      </div>
                    </td>
                  );
                })}

                <td
                  colSpan={2}
                  className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-600 tabular-nums"
                >
                  Meta operativa: N3–N4
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bottom 3 Reference Summary Cards */}
      <section
        aria-label="Escala de evaluación, resumen por trabajador y plan de capacitación"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4"
      >
        {/* Card 1: Escala de Evaluación */}
        <div className="lg:col-span-4 bg-white border border-[#0d2d5e]/30 rounded-xl overflow-hidden shadow-xs flex flex-col">
          <div className="bg-[#0d2d5e] px-4 py-2.5">
            <h2 className="text-xs font-bold text-white tracking-wide">
              Escala de Evaluación
            </h2>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-center divide-y divide-slate-200 text-xs">
            <div className="py-2.5 first:pt-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LevelIconSvg level={4} className="w-7 h-7 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">Totalmente competente</div>
                  <div className="text-[11px] text-slate-500">N3 Autónomo · N4 Instructor</div>
                </div>
              </div>
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                75–100%
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LevelIconSvg level={2} className="w-7 h-7 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">En proceso</div>
                  <div className="text-[11px] text-slate-500">N1 Entrenamiento · N2 Asistido</div>
                </div>
              </div>
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                25–50%
              </span>
            </div>

            <div className="py-2.5 last:pb-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LevelIconSvg level={0} className="w-7 h-7 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">No competente</div>
                  <div className="text-[11px] text-slate-500">N0 Sin formación</div>
                </div>
              </div>
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                0%
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Resumen por Trabajador */}
        <div className="lg:col-span-4 bg-white border border-[#0d2d5e]/30 rounded-xl overflow-hidden shadow-xs flex flex-col">
          <div className="bg-[#0d2d5e] px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-white tracking-wide">
              Resumen por Trabajador
            </h2>
            <span className="text-[11px] font-mono text-blue-200 tabular-nums">
              {operators.length} activos
            </span>
          </div>
          <div className="px-4 py-3 space-y-2 flex-1 flex flex-col justify-center">
            {operators.map((op) => {
              const summary = calculateOperatorPolyvalence(op.id, stations, recordsMap);
              const tier = getPolyvalenceTier(summary.polyvalencePct);
              return (
                <div key={op.id} className="grid grid-cols-12 items-center gap-2 text-xs">
                  <span className="col-span-5 font-medium text-slate-800 truncate">
                    {op.name}
                  </span>
                  <div className="col-span-5 h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${tier.barColorClass}`}
                      style={{ width: `${summary.polyvalencePct}%` }}
                    />
                  </div>
                  <span className="col-span-2 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {summary.polyvalencePct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Plan de Capacitación */}
        <div className="lg:col-span-4 bg-white border border-[#0d2d5e]/30 rounded-xl overflow-hidden shadow-xs flex flex-col">
          <div className="bg-[#0d2d5e] px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-white tracking-wide">
              Plan de Capacitación
            </h2>
            <span className="text-[11px] font-mono text-blue-200 tabular-nums">
              Prioridad
            </span>
          </div>
          {trainingPlanItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 flex-1 flex items-center justify-center">
              Sin brechas activas en las estaciones seleccionadas.
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#dbeafe] border-b border-[#93c5fd] text-[#0d2d5e] font-bold">
                    <th scope="col" className="px-3 py-2">Trabajador</th>
                    <th scope="col" className="px-3 py-2">Área a Desarrollar</th>
                    <th scope="col" className="px-3 py-2 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {trainingPlanItems.map((item) => (
                    <tr
                      key={`${item.operatorId}-${item.stationId}`}
                      className="hover:bg-blue-50/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                        {item.operatorName.split(' ')[0]}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <button
                          type="button"
                          onClick={() => onSelectCell(item.operatorId, item.stationId)}
                          className="text-left hover:text-blue-700 hover:underline font-medium"
                        >
                          {item.stationName}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                        {item.suggestedDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
