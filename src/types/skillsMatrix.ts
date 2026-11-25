export type CompetencyLevel = 0 | 1 | 2 | 3 | 4;

export type ShiftType = 'Turno A' | 'Turno B' | 'Turno C';

export type ProductionLine =
  | 'Línea 1 · Ensamble'
  | 'Línea 2 · Mecanizado CNC'
  | 'Línea 3 · Control y Empaque';

export type CertificationStatus = 'Vigente' | 'Por vencer' | 'Pendiente';

export type IndicatorMode = 'bars' | 'icons';

export type WorkspaceView = 'matrix' | 'audits' | 'generator' | 'studio' | 'dynamic-view';

export type CaptureStatus = 'Borrador' | 'Integrado' | 'Archivado';

export interface DetectedUiElement {
  category: string;
  label: string;
  count: number;
  confidence: string;
}

export interface ExtractedMatrixData {
  operators: string[];
  stations: string[];
  levels: number[][];
}

export interface CapturedInterfaceItem {
  id: string;
  title: string;
  detectedType: string;
  detectedElements: DetectedUiElement[];
  summary: string;
  stressTestNotes: string;
  generatedHtml: string;
  systemInstruction: string;
  focusMode: string;
  imagePreview: string;
  parsedMatrix: ExtractedMatrixData | null;
  status: CaptureStatus;
  createdAt: string;
}

export interface Operator {
  id: string;
  code: string;
  name: string;
  role: string;
  shift: ShiftType;
  line: ProductionLine;
  hireDate: string;
}

export interface Workstation {
  id: string;
  code: string;
  name: string;
  line: ProductionLine;
  critical: boolean;
  minCertified: number;
  targetLevel: CompetencyLevel;
}

export interface CompetencyRecord {
  operatorId: string;
  stationId: string;
  level: CompetencyLevel;
  status: CertificationStatus;
  lastAuditedAt: string;
  auditor: string;
  notes: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operatorId: string;
  operatorName: string;
  operatorCode: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  previousLevel: CompetencyLevel;
  newLevel: CompetencyLevel;
  auditor: string;
  notes: string;
  status: CertificationStatus;
}

export interface LevelDefinition {
  level: CompetencyLevel;
  shortCode: string;
  iluoCode: string;
  label: string;
  description: string;
  percentage: number;
  accentHex: string;
  bgClass: string;
  textClass: string;
  barClass: string;
  borderClass: string;
}

export const COMPETENCY_LEVELS: Record<CompetencyLevel, LevelDefinition> = {
  0: {
    level: 0,
    shortCode: 'N0',
    iluoCode: '—',
    label: 'Sin formación',
    description: 'No habilitado para operar la estación de forma independiente ni asistida.',
    percentage: 0,
    accentHex: '#94A3B8',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
    barClass: 'bg-slate-300',
    borderClass: 'border-slate-200',
  },
  1: {
    level: 1,
    shortCode: 'N1',
    iluoCode: 'I',
    label: 'En entrenamiento',
    description: 'Conoce estándares básicos de seguridad y ejecuta tareas bajo instrucción directa.',
    percentage: 25,
    accentHex: '#EA580C',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    barClass: 'bg-orange-500',
    borderClass: 'border-orange-200',
  },
  2: {
    level: 2,
    shortCode: 'N2',
    iluoCode: 'L',
    label: 'Operación asistida',
    description: 'Opera la estación siguiendo hoja de proceso; requiere validación en ajustes.',
    percentage: 50,
    accentHex: '#D97706',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    barClass: 'bg-amber-500',
    borderClass: 'border-amber-200',
  },
  3: {
    level: 3,
    shortCode: 'N3',
    iluoCode: 'U',
    label: 'Autónomo certificado',
    description: 'Cumple tiempo ciclo, calidad y seguridad sin supervisión; detecta anomalías.',
    percentage: 75,
    accentHex: '#2563EB',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    barClass: 'bg-blue-600',
    borderClass: 'border-blue-200',
  },
  4: {
    level: 4,
    shortCode: 'N4',
    iluoCode: 'O',
    label: 'Instructor / Auditor',
    description: 'Domina optimización y mantenimiento autónomo; habilitado para capacitar y auditar.',
    percentage: 100,
    accentHex: '#059669',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    barClass: 'bg-emerald-600',
    borderClass: 'border-emerald-200',
  },
};

export const PRODUCTION_LINES: ProductionLine[] = [
  'Línea 1 · Ensamble',
  'Línea 2 · Mecanizado CNC',
  'Línea 3 · Control y Empaque',
];

export const SHIFTS: ShiftType[] = ['Turno A', 'Turno B', 'Turno C'];
