import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Code2,
  FilePlus2,
  Grid3X3,
  Menu,
  Paperclip,
  Plus,
  ScanSearch,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  AuditLogEntry,
  CapturedInterfaceItem,
  CertificationStatus,
  COMPETENCY_LEVELS,
  CompetencyLevel,
  CompetencyRecord,
  DEFAULT_MATRIX_METADATA,
  IndicatorMode,
  MatrixMetadata,
  MergeFormatMode,
  Operator,
  PhysicalFormatAttachment,
  PRODUCTION_LINES,
  ProductionLine,
  SHIFTS,
  ShiftType,
  WorkspaceView,
  Workstation,
} from './types/skillsMatrix';
import { buildPreviewDocument } from './utils/sketchHelpers';
import {
  createSeedRecords,
  SEED_AUDIT_LOGS,
  SEED_OPERATORS,
  SEED_STATIONS,
} from './data/seedMatrix';
import {
  calculatePlantMetrics,
  calculateStationCoverage,
  getCellKey,
  mergeExtractedMatrixIntoCurrent,
} from './utils/matrixLogic';
import { MatrixGrid } from './components/MatrixGrid';
import { AuditCellDrawer } from './components/AuditCellDrawer';
import { AuditLogView } from './components/AuditLogView';
import { HtmlGeneratorView } from './components/HtmlGeneratorView';
import { SketchStudioView } from './components/SketchStudioView';
import { AddEntityModal } from './components/AddEntityModal';
import { FormatImportModal } from './components/FormatImportModal';
import { LevelIndicator } from './components/LevelIndicator';

const STORAGE_KEY = 'matripol_state_v1';

interface PersistedState {
  operators: Operator[];
  stations: Workstation[];
  recordsMap: Record<string, CompetencyRecord>;
  auditLogs: AuditLogEntry[];
  metadata?: MatrixMetadata;
}

function loadInitialState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (
        Array.isArray(parsed.operators) &&
        Array.isArray(parsed.stations) &&
        parsed.recordsMap &&
        Array.isArray(parsed.auditLogs)
      ) {
        return parsed;
      }
    }
  } catch {
    // Fallback to deterministic baseline
  }
  return {
    operators: SEED_OPERATORS,
    stations: SEED_STATIONS,
    recordsMap: createSeedRecords(),
    auditLogs: SEED_AUDIT_LOGS,
    metadata: DEFAULT_MATRIX_METADATA,
  };
}

export default function App() {
  const initialState = useMemo(() => loadInitialState(), []);

  const [operators, setOperators] = useState<Operator[]>(initialState.operators);
  const [stations, setStations] = useState<Workstation[]>(initialState.stations);
  const [recordsMap, setRecordsMap] = useState<Record<string, CompetencyRecord>>(
    initialState.recordsMap
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialState.auditLogs);
  const [metadata, setMetadata] = useState<MatrixMetadata>(
    initialState.metadata ?? DEFAULT_MATRIX_METADATA
  );
  const [attachments, setAttachments] = useState<PhysicalFormatAttachment[]>([]);

  const [activeView, setActiveView] = useState<WorkspaceView>('matrix');
  const [indicatorMode, setIndicatorMode] = useState<IndicatorMode>('icons');
  const [searchQuery, setSearchQuery] = useState('');
  const [lineFilter, setLineFilter] = useState<'ALL' | ProductionLine>('ALL');
  const [shiftFilter, setShiftFilter] = useState<'ALL' | ShiftType>('ALL');
  const [onlyRiskStations, setOnlyRiskStations] = useState(false);

  const [selectedCell, setSelectedCell] = useState<{
    operatorId: string;
    stationId: string;
  } | null>(null);
  const [addModalMode, setAddModalMode] = useState<'operator' | 'station' | null>(null);
  const [formatModalTab, setFormatModalTab] = useState<'attach' | 'manual' | 'history' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dynamicCapture, setDynamicCapture] = useState<CapturedInterfaceItem | null>(null);
  const hasHydratedServerRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [matrixRes, attachRes] = await Promise.all([
          fetch('/api/matrix'),
          fetch('/api/attachments'),
        ]);
        if (matrixRes.ok && active) {
          const data = (await matrixRes.json()) as PersistedState;
          if (
            Array.isArray(data.operators) &&
            Array.isArray(data.stations) &&
            data.recordsMap &&
            Array.isArray(data.auditLogs)
          ) {
            setOperators(data.operators);
            setStations(data.stations);
            setRecordsMap(data.recordsMap);
            setAuditLogs(data.auditLogs);
            if (data.metadata) {
              setMetadata(data.metadata);
            }
          }
        }
        if (attachRes.ok && active) {
          const attData = (await attachRes.json()) as {
            attachments?: PhysicalFormatAttachment[];
          };
          if (Array.isArray(attData.attachments)) {
            setAttachments(attData.attachments);
          }
        }
      } catch {
        // Keep local fallback if server request fails
      } finally {
        hasHydratedServerRef.current = true;
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const payload: PersistedState = {
      operators,
      stations,
      recordsMap,
      auditLogs,
      metadata,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
    if (!hasHydratedServerRef.current) return;
    void fetch('/api/matrix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Non-blocking sync
    });
  }, [operators, stations, recordsMap, auditLogs, metadata]);

  const plantMetrics = useMemo(
    () => calculatePlantMetrics(operators, stations, recordsMap),
    [operators, stations, recordsMap]
  );

  const filteredOperators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return operators.filter((op) => {
      if (lineFilter !== 'ALL' && op.line !== lineFilter) return false;
      if (shiftFilter !== 'ALL' && op.shift !== shiftFilter) return false;
      if (!q) return true;
      return (
        op.name.toLowerCase().includes(q) ||
        op.code.toLowerCase().includes(q) ||
        op.role.toLowerCase().includes(q)
      );
    });
  }, [operators, searchQuery, lineFilter, shiftFilter]);

  const filteredStations = useMemo(() => {
    return stations.filter((st) => {
      if (lineFilter !== 'ALL' && st.line !== lineFilter) return false;
      if (onlyRiskStations) {
        const coverage = calculateStationCoverage(st, operators, recordsMap);
        return coverage.atRisk;
      }
      return true;
    });
  }, [stations, lineFilter, onlyRiskStations, operators, recordsMap]);

  const selectedOperator = useMemo(
    () => operators.find((o) => o.id === selectedCell?.operatorId) ?? null,
    [operators, selectedCell]
  );

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === selectedCell?.stationId) ?? null,
    [stations, selectedCell]
  );

  const selectedRecord = useMemo(() => {
    if (!selectedCell) return null;
    const key = getCellKey(selectedCell.operatorId, selectedCell.stationId);
    return (
      recordsMap[key] ?? {
        operatorId: selectedCell.operatorId,
        stationId: selectedCell.stationId,
        level: 0 as CompetencyLevel,
        status: 'Pendiente' as CertificationStatus,
        lastAuditedAt: new Date().toISOString().slice(0, 10),
        auditor: '',
        notes: '',
      }
    );
  }, [recordsMap, selectedCell]);

  const selectedCellLogs = useMemo(() => {
    if (!selectedCell) return [];
    return auditLogs.filter(
      (entry) =>
        entry.operatorId === selectedCell.operatorId &&
        entry.stationId === selectedCell.stationId
    );
  }, [auditLogs, selectedCell]);

  const handleSaveAudit = (payload: {
    operatorId: string;
    stationId: string;
    level: CompetencyLevel;
    status: CertificationStatus;
    auditor: string;
    notes: string;
  }) => {
    const key = getCellKey(payload.operatorId, payload.stationId);
    const prevRecord = recordsMap[key];
    const previousLevel: CompetencyLevel = prevRecord ? prevRecord.level : 0;

    const op = operators.find((o) => o.id === payload.operatorId);
    const st = stations.find((s) => s.id === payload.stationId);
    if (!op || !st) return;

    const today = new Date().toISOString().slice(0, 10);

    setRecordsMap((prev) => ({
      ...prev,
      [key]: {
        operatorId: payload.operatorId,
        stationId: payload.stationId,
        level: payload.level,
        status: payload.status,
        lastAuditedAt: today,
        auditor: payload.auditor,
        notes: payload.notes,
      },
    }));

    const newLog: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operatorId: op.id,
      operatorName: op.name,
      operatorCode: op.code,
      stationId: st.id,
      stationCode: st.code,
      stationName: st.name,
      previousLevel,
      newLevel: payload.level,
      auditor: payload.auditor,
      notes: payload.notes,
      status: payload.status,
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    setSelectedCell(null);
  };

  const handleAddOperator = (newOp: Omit<Operator, 'id'>) => {
    const id = `op-${Date.now()}`;
    const created: Operator = { ...newOp, id };
    setOperators((prev) => [...prev, created]);
    setRecordsMap((prev) => {
      const next = { ...prev };
      stations.forEach((st) => {
        next[getCellKey(id, st.id)] = {
          operatorId: id,
          stationId: st.id,
          level: 0,
          status: 'Pendiente',
          lastAuditedAt: new Date().toISOString().slice(0, 10),
          auditor: 'Alta inicial',
          notes: 'Sin asignación previa en estación.',
        };
      });
      return next;
    });
  };

  const handleAddStation = (newStation: Omit<Workstation, 'id'>) => {
    const id = `est-${Date.now()}`;
    const created: Workstation = { ...newStation, id };
    setStations((prev) => [...prev, created]);
    setRecordsMap((prev) => {
      const next = { ...prev };
      operators.forEach((op) => {
        next[getCellKey(op.id, id)] = {
          operatorId: op.id,
          stationId: id,
          level: 0,
          status: 'Pendiente',
          lastAuditedAt: new Date().toISOString().slice(0, 10),
          auditor: 'Alta inicial',
          notes: 'Estación recién incorporada a la matriz.',
        };
      });
      return next;
    });
  };

  const handleApplyParsedMatrix = (parsed: {
    operators: Operator[];
    stations: Workstation[];
    records: Record<string, CompetencyRecord>;
    convertedSymbolsCount: number;
  }) => {
    setOperators(parsed.operators);
    setStations(parsed.stations);
    setRecordsMap(parsed.records);
    setSearchQuery('');
    setLineFilter('ALL');
    setShiftFilter('ALL');
    setOnlyRiskStations(false);
  };

  const handleResetToBaseline = () => {
    setOperators(SEED_OPERATORS);
    setStations(SEED_STATIONS);
    setRecordsMap(createSeedRecords());
    setAuditLogs(SEED_AUDIT_LOGS);
    setMetadata(DEFAULT_MATRIX_METADATA);
    setSearchQuery('');
    setLineFilter('ALL');
    setShiftFilter('ALL');
    setOnlyRiskStations(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setLineFilter('ALL');
    setShiftFilter('ALL');
    setOnlyRiskStations(false);
  };

  const handleMergeFormatData = (payload: {
    operators: string[];
    stations: string[];
    levels: number[][];
    operatorShifts?: ShiftType[];
    operatorLines?: ProductionLine[];
    mode: MergeFormatMode;
    auditor: string;
    sourceLabel: string;
    updateMetadata?: MatrixMetadata;
    attachment?: PhysicalFormatAttachment | null;
  }) => {
    const merged = mergeExtractedMatrixIntoCurrent({
      currentOperators: operators,
      currentStations: stations,
      currentRecordsMap: recordsMap,
      extracted: {
        operators: payload.operators,
        stations: payload.stations,
        levels: payload.levels,
        operatorShifts: payload.operatorShifts,
        operatorLines: payload.operatorLines,
      },
      mode: payload.mode,
      auditor: payload.auditor,
      sourceLabel: payload.sourceLabel,
      attachmentId: payload.attachment?.id,
      attachmentName: payload.attachment?.fileName,
    });

    setOperators(merged.operators);
    setStations(merged.stations);
    setRecordsMap(merged.recordsMap);
    if (merged.addedAuditLogs.length > 0) {
      setAuditLogs((prev) => [...merged.addedAuditLogs, ...prev]);
    }
    if (payload.updateMetadata) {
      setMetadata(payload.updateMetadata);
    }
    if (payload.attachment && merged.addedAuditLogs.length > 0) {
      const attId = payload.attachment.id;
      const count = merged.addedAuditLogs.length;
      void fetch(`/api/attachments/${attId}/link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res: { attachment?: PhysicalFormatAttachment } | null) => {
          if (res?.attachment) {
            setAttachments((prev) =>
              prev.map((a) => (a.id === attId ? res.attachment! : a))
            );
          }
        })
        .catch(() => {
          // Non-blocking counter update
        });
    }

    setSearchQuery('');
    setLineFilter('ALL');
    setShiftFilter('ALL');
    setOnlyRiskStations(false);
    return merged.stats;
  };

  const handleMergeParsedCsv = (parsed: {
    operators: Operator[];
    stations: Workstation[];
    records: Record<string, CompetencyRecord>;
    convertedSymbolsCount: number;
  }) => {
    handleMergeFormatData({
      operators: parsed.operators.map((o) => o.name),
      stations: parsed.stations.map((s) => `${s.code} ${s.name}`),
      levels: parsed.operators.map((op) =>
        parsed.stations.map((st) => parsed.records[getCellKey(op.id, st.id)]?.level ?? 0)
      ),
      mode: 'merge_all',
      auditor: metadata.responsible || 'Intérprete CSV',
      sourceLabel: 'Intérprete de matriz CSV',
    });
  };

  const handleIntegrateFromStudio = (payload: {
    operators: Operator[];
    stations: Workstation[];
    records: Record<string, CompetencyRecord>;
    sourceTitle: string;
  }) => {
    setOperators(payload.operators);
    setStations(payload.stations);
    setRecordsMap(payload.records);
    setSearchQuery('');
    setLineFilter('ALL');
    setShiftFilter('ALL');
    setOnlyRiskStations(false);
    setActiveView('matrix');
  };

  const breadcrumbLabel =
    activeView === 'matrix'
      ? 'Matriz de Polivalencia'
      : activeView === 'audits'
        ? 'Registro de Auditorías'
        : activeView === 'studio'
          ? 'Digitalizador IA (Boceto → HTML)'
          : activeView === 'dynamic-view'
            ? dynamicCapture?.title || 'Vista Dinámica Generada'
            : 'Generador HTML y Prompt';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
          MatriPol
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Cerrar menú lateral"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="p-3 space-y-1" aria-label="Navegación principal">
        <button
          type="button"
          onClick={() => {
            setActiveView('matrix');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeView === 'matrix'
              ? 'bg-blue-50 text-blue-800'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Grid3X3 className="w-4 h-4 shrink-0" aria-hidden="true" />
          Matriz de Polivalencia
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('audits');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeView === 'audits'
              ? 'bg-blue-50 text-blue-800'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />
            Historial de Auditorías
          </span>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {auditLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('studio');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeView === 'studio'
              ? 'bg-blue-50 text-blue-800'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ScanSearch className="w-4 h-4 shrink-0" aria-hidden="true" />
          Digitalizador IA (Boceto)
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('generator');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeView === 'generator'
              ? 'bg-blue-50 text-blue-800'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Code2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          Generador HTML y Prompt
        </button>
      </nav>

      <div className="mt-auto p-4 border-t border-slate-200 space-y-3">
        <div className="text-xs font-semibold text-slate-900">
          Escala técnica dinámica
        </div>
        <div className="space-y-2.5">
          {([4, 3, 2, 1, 0] as CompetencyLevel[]).map((lvl) => (
            <div key={lvl} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-700">
                <span className="font-medium">{COMPETENCY_LEVELS[lvl].label}</span>
              </div>
              <LevelIndicator level={lvl} mode={indicatorMode} compact />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[252px] shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[85vw] bg-white h-full border-r border-slate-200 z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Workspace Main Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir navegación"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                Planta Industrial Norte
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-bold text-slate-900 truncate">
                {breadcrumbLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('generator')}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Exportar tabla HTML
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto space-y-5">
          {activeView === 'matrix' && (
            <>
              {/* KPI Summary Strip */}
              <section
                aria-label="Indicadores clave de polivalencia"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
              >
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Polivalencia global de planta
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span
                      data-testid="kpi-global-polyvalence"
                      className="text-2xl font-bold font-mono tabular-nums text-slate-900"
                    >
                      {plantMetrics.globalPolyvalencePct}%
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {operators.length} op. · {stations.length} est.
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-200"
                      style={{ width: `${plantMetrics.globalPolyvalencePct}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Estaciones críticas en riesgo
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span
                      data-testid="kpi-critical-risk"
                      className={`text-2xl font-bold font-mono tabular-nums ${
                        plantMetrics.criticalStationsAtRisk > 0
                          ? 'text-red-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {plantMetrics.criticalStationsAtRisk}
                    </span>
                    <span className="text-xs text-slate-500">
                      {plantMetrics.criticalStationsAtRisk > 0
                        ? 'Cobertura menor al mínimo'
                        : 'Todas cubiertas'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Requieren al menos el mínimo de operadores en nivel N3–N4.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Certificaciones autónomas (N3–N4)
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span
                      data-testid="kpi-autonomous-certs"
                      className="text-2xl font-bold font-mono tabular-nums text-slate-900"
                    >
                      {plantMetrics.totalAutonomousCertifications}
                    </span>
                    <span className="text-xs text-emerald-700 font-medium">
                      Habilitados
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Operación independiente o instructor certificado en estación.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Brechas activas en línea asignada
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span
                      data-testid="kpi-active-gaps"
                      className="text-2xl font-bold font-mono tabular-nums text-amber-700"
                    >
                      {plantMetrics.totalActiveGaps}
                    </span>
                    <span className="text-xs text-slate-500">Plan de capacitación</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Celdas por debajo del nivel objetivo en la línea del operador.
                  </p>
                </div>
              </section>

              {/* Workspace Controls & Filters */}
              <section
                aria-label="Filtros y controles de matriz"
                className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative w-full sm:w-44 xl:w-48">
                    <Search
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar operador..."
                      aria-label="Buscar operador o código"
                      className="w-full pl-9 pr-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <select
                    value={lineFilter}
                    onChange={(e) => setLineFilter(e.target.value as 'ALL' | ProductionLine)}
                    aria-label="Filtrar por línea de producción"
                    className="w-full sm:w-auto px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="ALL">Todas las líneas</option>
                    {PRODUCTION_LINES.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>

                  <select
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value as 'ALL' | ShiftType)}
                    aria-label="Filtrar por turno"
                    className="w-full sm:w-auto px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="ALL">Todos los turnos</option>
                    {SHIFTS.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setOnlyRiskStations((prev) => !prev)}
                    aria-pressed={onlyRiskStations}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      onlyRiskStations
                        ? 'bg-red-50 border-red-300 text-red-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Solo en riesgo
                  </button>
                </div>

                <div className="w-full xl:w-auto flex flex-wrap items-center gap-2">
                  <div
                    className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                    role="group"
                    aria-label="Estilo de indicador visual"
                  >
                    <button
                      type="button"
                      onClick={() => setIndicatorMode('bars')}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        indicatorMode === 'bars'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Barras de progreso
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndicatorMode('icons')}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        indicatorMode === 'icons'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Iconos de nivel
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAddModalMode('operator')}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Operador
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddModalMode('station')}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Estación
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormatModalTab('manual')}
                    data-testid="open-format-manual-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0d2d5e] bg-[#e6f0ff] border border-[#93c5fd] rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Desde formato
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormatModalTab('attach')}
                    data-testid="open-format-attach-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0d2d5e] rounded-lg hover:bg-[#133b7a] transition-colors whitespace-nowrap"
                  >
                    <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                    Adjuntar formato físico
                    {attachments.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono tabular-nums">
                        {attachments.length}
                      </span>
                    )}
                  </button>
                </div>
              </section>

              <p className="text-xs text-slate-500">
                Haz clic en cualquier celda de la matriz para auditar o actualizar el nivel de competencia técnica del operador.
              </p>

              {/* Double-Entry Matrix Grid */}
              <MatrixGrid
                operators={filteredOperators}
                allOperators={operators}
                stations={filteredStations}
                recordsMap={recordsMap}
                indicatorMode={indicatorMode}
                selectedCell={selectedCell}
                activeLineLabel={lineFilter === 'ALL' ? metadata.area : lineFilter}
                metadata={metadata}
                onSelectCell={(operatorId, stationId) =>
                  setSelectedCell({ operatorId, stationId })
                }
                onClearFilters={clearFilters}
              />
            </>
          )}

          {activeView === 'audits' && <AuditLogView logs={auditLogs} />}

          {activeView === 'studio' && (
            <SketchStudioView
              onIntegrateMatrix={handleIntegrateFromStudio}
              onMergeMatrix={(payload) => {
                handleMergeFormatData({
                  operators: payload.operators,
                  stations: payload.stations,
                  levels: payload.levels,
                  mode: 'merge_all',
                  auditor: metadata.responsible || 'Digitalizador IA',
                  sourceLabel: payload.sourceTitle,
                });
                setActiveView('matrix');
              }}
              onOpenDynamicView={(capture) => {
                setDynamicCapture(capture);
                setActiveView('dynamic-view');
              }}
            />
          )}

          {activeView === 'dynamic-view' && dynamicCapture && (
            <section
              aria-label="Renderizado dinámico en espacio principal"
              className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col"
            >
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-blue-700 uppercase">
                    Renderizado dinámico · {dynamicCapture.detectedType.replace('_', ' ')}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    {dynamicCapture.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('studio')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Volver al Digitalizador IA
                </button>
              </div>
              <iframe
                title={`Vista principal de ${dynamicCapture.title}`}
                srcDoc={buildPreviewDocument(dynamicCapture.generatedHtml)}
                data-testid="workspace-dynamic-iframe"
                className="w-full h-[72vh] border-0 bg-slate-50"
                sandbox="allow-scripts"
              />
            </section>
          )}

          {activeView === 'generator' && (
            <HtmlGeneratorView
              operators={operators}
              stations={stations}
              recordsMap={recordsMap}
              indicatorMode={indicatorMode}
              onChangeIndicatorMode={setIndicatorMode}
              onApplyParsedMatrix={handleApplyParsedMatrix}
              onMergeParsedMatrix={handleMergeParsedCsv}
              onResetToBaseline={handleResetToBaseline}
            />
          )}
        </main>
      </div>

      {/* Audit & Edit Drawer */}
      <AuditCellDrawer
        operator={selectedOperator}
        station={selectedStation}
        record={selectedRecord}
        cellLogs={selectedCellLogs}
        onClose={() => setSelectedCell(null)}
        onSave={handleSaveAudit}
      />

      {/* Add Operator / Station Modal */}
      <AddEntityModal
        mode={addModalMode}
        onClose={() => setAddModalMode(null)}
        onAddOperator={handleAddOperator}
        onAddStation={handleAddStation}
      />

      {/* Add from Format & Attach Physical Format Modal */}
      <FormatImportModal
        open={formatModalTab !== null}
        initialTab={formatModalTab ?? 'attach'}
        operators={operators}
        stations={stations}
        metadata={metadata}
        attachments={attachments}
        onClose={() => setFormatModalTab(null)}
        onAttachmentCreated={(att) =>
          setAttachments((prev) => [att, ...prev.filter((p) => p.id !== att.id)])
        }
        onAttachmentDeleted={(id) =>
          setAttachments((prev) => prev.filter((a) => a.id !== id))
        }
        onMergeFormatData={handleMergeFormatData}
      />
    </div>
  );
}
