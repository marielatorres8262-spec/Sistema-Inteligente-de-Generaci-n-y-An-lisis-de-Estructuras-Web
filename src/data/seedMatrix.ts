import {
  AuditLogEntry,
  CompetencyLevel,
  CompetencyRecord,
  Operator,
  Workstation,
} from '../types/skillsMatrix';

export const SEED_OPERATORS: Operator[] = [
  {
    id: 'op-101',
    code: 'OP-101',
    name: 'Carlos Mendoza',
    role: 'Operador Senior',
    shift: 'Turno A',
    line: 'Línea 1 · Ensamble',
    hireDate: '2021-03-15',
  },
  {
    id: 'op-102',
    code: 'OP-102',
    name: 'Lucía Fernández',
    role: 'Líder de Célula',
    shift: 'Turno A',
    line: 'Línea 1 · Ensamble',
    hireDate: '2019-08-22',
  },
  {
    id: 'op-103',
    code: 'OP-103',
    name: 'Mateo Rojas',
    role: 'Operador CNC',
    shift: 'Turno B',
    line: 'Línea 2 · Mecanizado CNC',
    hireDate: '2022-01-10',
  },
  {
    id: 'op-104',
    code: 'OP-104',
    name: 'Valeria Castillo',
    role: 'Técnico de Calidad',
    shift: 'Turno A',
    line: 'Línea 3 · Control y Empaque',
    hireDate: '2020-11-04',
  },
  {
    id: 'op-105',
    code: 'OP-105',
    name: 'Diego Herrera',
    role: 'Operador Multifunción',
    shift: 'Turno B',
    line: 'Línea 1 · Ensamble',
    hireDate: '2023-04-18',
  },
  {
    id: 'op-106',
    code: 'OP-106',
    name: 'Elena Vargas',
    role: 'Especialista CNC',
    shift: 'Turno A',
    line: 'Línea 2 · Mecanizado CNC',
    hireDate: '2018-06-12',
  },
  {
    id: 'op-107',
    code: 'OP-107',
    name: 'Jorge Navarro',
    role: 'Operador de Línea',
    shift: 'Turno C',
    line: 'Línea 3 · Control y Empaque',
    hireDate: '2024-02-05',
  },
  {
    id: 'op-108',
    code: 'OP-108',
    name: 'Sofía Morales',
    role: 'Operadora de Ensamble',
    shift: 'Turno C',
    line: 'Línea 1 · Ensamble',
    hireDate: '2022-09-19',
  },
  {
    id: 'op-109',
    code: 'OP-109',
    name: 'Andrés Salazar',
    role: 'Operador CNC',
    shift: 'Turno C',
    line: 'Línea 2 · Mecanizado CNC',
    hireDate: '2023-10-02',
  },
];

export const SEED_STATIONS: Workstation[] = [
  {
    id: 'est-01',
    code: 'EST-01',
    name: 'Pre-ensamble Subchasis',
    line: 'Línea 1 · Ensamble',
    critical: true,
    minCertified: 3,
    targetLevel: 3,
  },
  {
    id: 'est-02',
    code: 'EST-02',
    name: 'Torque y Fijación Crítica',
    line: 'Línea 1 · Ensamble',
    critical: true,
    minCertified: 3,
    targetLevel: 3,
  },
  {
    id: 'est-03',
    code: 'EST-03',
    name: 'Soldadura Automatizada',
    line: 'Línea 1 · Ensamble',
    critical: true,
    minCertified: 2,
    targetLevel: 3,
  },
  {
    id: 'est-04',
    code: 'EST-04',
    name: 'Centro CNC 5 Ejes',
    line: 'Línea 2 · Mecanizado CNC',
    critical: true,
    minCertified: 3,
    targetLevel: 3,
  },
  {
    id: 'est-05',
    code: 'EST-05',
    name: 'Rectificado de Precisión',
    line: 'Línea 2 · Mecanizado CNC',
    critical: false,
    minCertified: 2,
    targetLevel: 3,
  },
  {
    id: 'est-06',
    code: 'EST-06',
    name: 'Metrología CMM',
    line: 'Línea 3 · Control y Empaque',
    critical: true,
    minCertified: 2,
    targetLevel: 3,
  },
  {
    id: 'est-07',
    code: 'EST-07',
    name: 'Prueba Estanqueidad',
    line: 'Línea 3 · Control y Empaque',
    critical: false,
    minCertified: 2,
    targetLevel: 3,
  },
  {
    id: 'est-08',
    code: 'EST-08',
    name: 'Embalaje y Trazabilidad',
    line: 'Línea 3 · Control y Empaque',
    critical: false,
    minCertified: 3,
    targetLevel: 3,
  },
];

const INITIAL_LEVEL_MATRIX: Record<string, CompetencyLevel[]> = {
  'op-101': [2, 4, 3, 1, 0, 2, 3, 4],
  'op-102': [4, 4, 4, 2, 1, 3, 3, 4],
  'op-103': [1, 1, 0, 4, 3, 2, 1, 2],
  'op-104': [2, 3, 1, 2, 2, 4, 4, 3],
  'op-105': [3, 2, 2, 1, 0, 1, 2, 3],
  'op-106': [1, 2, 2, 4, 4, 3, 2, 1],
  'op-107': [1, 0, 0, 0, 1, 1, 2, 3],
  'op-108': [3, 3, 2, 0, 0, 1, 2, 3],
  'op-109': [0, 1, 1, 2, 2, 1, 0, 1],
};

export function createSeedRecords(): Record<string, CompetencyRecord> {
  const records: Record<string, CompetencyRecord> = {};
  SEED_OPERATORS.forEach((op) => {
    const row = INITIAL_LEVEL_MATRIX[op.id] ?? [];
    SEED_STATIONS.forEach((station, idx) => {
      const level = row[idx] ?? 0;
      const key = `${op.id}::${station.id}`;
      records[key] = {
        operatorId: op.id,
        stationId: station.id,
        level,
        status:
          level === 0
            ? 'Pendiente'
            : op.id === 'op-105' && station.id === 'est-02'
              ? 'Por vencer'
              : 'Vigente',
        lastAuditedAt: level === 0 ? '2026-09-10' : '2026-10-28',
        auditor: level >= 3 ? 'Ing. Sofía Ramírez' : 'Sup. Ricardo Núñez',
        notes:
          level >= 4
            ? 'Habilitado para evaluación práctica y liberación de estándar.'
            : level === 3
              ? 'Evaluación de ciclo y criterios de calidad aprobada.'
              : level === 2
                ? 'Requiere verificación de torque al inicio de turno.'
                : level === 1
                  ? 'Inducción de seguridad completada; en seguimiento.'
                  : 'Sin asignación previa en estación.',
      };
    });
  });
  return records;
}

export const SEED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-901',
    timestamp: '2026-11-18T14:20:00',
    operatorId: 'op-102',
    operatorName: 'Lucía Fernández',
    operatorCode: 'OP-102',
    stationId: 'est-03',
    stationCode: 'EST-03',
    stationName: 'Soldadura Automatizada',
    previousLevel: 3,
    newLevel: 4,
    auditor: 'Ing. Sofía Ramírez',
    notes: 'Aprobó auditoría de parametrización y formación a nuevos ingresos.',
    status: 'Vigente',
  },
  {
    id: 'aud-902',
    timestamp: '2026-11-16T09:45:00',
    operatorId: 'op-108',
    operatorName: 'Sofía Morales',
    operatorCode: 'OP-108',
    stationId: 'est-02',
    stationCode: 'EST-02',
    stationName: 'Torque y Fijación Crítica',
    previousLevel: 2,
    newLevel: 3,
    auditor: 'Sup. Ricardo Núñez',
    notes: 'Cero desviaciones en 300 ciclos consecutivos de apriete.',
    status: 'Vigente',
  },
  {
    id: 'aud-903',
    timestamp: '2026-11-12T16:10:00',
    operatorId: 'op-105',
    operatorName: 'Diego Herrera',
    operatorCode: 'OP-105',
    stationId: 'est-02',
    stationCode: 'EST-02',
    stationName: 'Torque y Fijación Crítica',
    previousLevel: 2,
    newLevel: 2,
    auditor: 'Ing. Sofía Ramírez',
    notes: 'Recertificación anual programada para cierre de mes.',
    status: 'Por vencer',
  },
];

export const SAMPLE_CIRCLE_MATRIX_INPUT = `Operador,EST-01 Pre-ensamble,EST-02 Torque Crítico,EST-03 Soldadura,EST-04 Centro CNC,EST-05 Metrología CMM
Carlos Mendoza,◑,●,◕,◔,◑
Lucía Fernández,●,●,●,◑,◕
Mateo Rojas,◔,◔,○,●,◑
Valeria Castillo,◑,◕,◔,◑,●
Diego Herrera,◕,◑,◑,◔,○`;
