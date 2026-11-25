import {
  AuditLogEntry,
  COMPETENCY_LEVELS,
  CompetencyLevel,
  CompetencyRecord,
  IndicatorMode,
  MatrixMetadata,
  MergeFormatMode,
  Operator,
  ProductionLine,
  ShiftType,
  Workstation,
} from '../types/skillsMatrix';

export function getCellKey(operatorId: string, stationId: string): string {
  return `${operatorId}::${stationId}`;
}

export interface OperatorPolyvalenceSummary {
  certifiedCount: number;
  totalStations: number;
  averageLevel: number;
  polyvalencePct: number;
}

export function calculateOperatorPolyvalence(
  operatorId: string,
  stations: Workstation[],
  recordsMap: Record<string, CompetencyRecord>
): OperatorPolyvalenceSummary {
  if (stations.length === 0) {
    return {
      certifiedCount: 0,
      totalStations: 0,
      averageLevel: 0,
      polyvalencePct: 0,
    };
  }

  let levelSum = 0;
  let certifiedCount = 0;

  for (const station of stations) {
    const rec = recordsMap[getCellKey(operatorId, station.id)];
    const level = rec ? rec.level : 0;
    levelSum += level;
    if (level >= 3) {
      certifiedCount += 1;
    }
  }

  const maxPoints = stations.length * 4;
  return {
    certifiedCount,
    totalStations: stations.length,
    averageLevel: Number((levelSum / stations.length).toFixed(1)),
    polyvalencePct: Math.round((levelSum / maxPoints) * 100),
  };
}

export interface StationCoverageSummary {
  autonomousCount: number;
  assistedCount: number;
  trainingCount: number;
  coveragePct: number;
  atRisk: boolean;
}

export function calculateStationCoverage(
  station: Workstation,
  operators: Operator[],
  recordsMap: Record<string, CompetencyRecord>
): StationCoverageSummary {
  if (operators.length === 0) {
    return {
      autonomousCount: 0,
      assistedCount: 0,
      trainingCount: 0,
      coveragePct: 0,
      atRisk: true,
    };
  }

  let autonomousCount = 0;
  let assistedCount = 0;
  let trainingCount = 0;

  for (const op of operators) {
    const rec = recordsMap[getCellKey(op.id, station.id)];
    const level = rec ? rec.level : 0;
    if (level >= 3) {
      autonomousCount += 1;
    } else if (level === 2) {
      assistedCount += 1;
    } else if (level === 1) {
      trainingCount += 1;
    }
  }

  const targetDenominator = Math.max(station.minCertified, 1);
  const rawCoverage = Math.round((autonomousCount / targetDenominator) * 100);
  const coveragePct = Math.min(rawCoverage, 100);
  const atRisk = autonomousCount < station.minCertified;

  return {
    autonomousCount,
    assistedCount,
    trainingCount,
    coveragePct,
    atRisk,
  };
}

export interface PlantMetricsSummary {
  globalPolyvalencePct: number;
  criticalStationsAtRisk: number;
  totalAutonomousCertifications: number;
  totalActiveGaps: number;
}

export function calculatePlantMetrics(
  operators: Operator[],
  stations: Workstation[],
  recordsMap: Record<string, CompetencyRecord>
): PlantMetricsSummary {
  if (operators.length === 0 || stations.length === 0) {
    return {
      globalPolyvalencePct: 0,
      criticalStationsAtRisk: 0,
      totalAutonomousCertifications: 0,
      totalActiveGaps: 0,
    };
  }

  let totalLevelPoints = 0;
  let totalAutonomousCertifications = 0;
  let totalActiveGaps = 0;

  for (const op of operators) {
    for (const station of stations) {
      const rec = recordsMap[getCellKey(op.id, station.id)];
      const level = rec ? rec.level : 0;
      totalLevelPoints += level;
      if (level >= 3) {
        totalAutonomousCertifications += 1;
      }
      if (level < station.targetLevel && op.line === station.line) {
        totalActiveGaps += 1;
      }
    }
  }

  let criticalStationsAtRisk = 0;
  for (const station of stations) {
    if (station.critical) {
      const coverage = calculateStationCoverage(station, operators, recordsMap);
      if (coverage.atRisk) {
        criticalStationsAtRisk += 1;
      }
    }
  }

  const maxPoints = operators.length * stations.length * 4;
  return {
    globalPolyvalencePct: Math.round((totalLevelPoints / maxPoints) * 100),
    criticalStationsAtRisk,
    totalAutonomousCertifications,
    totalActiveGaps,
  };
}

export interface PolyvalenceTierInfo {
  label: 'Experto' | 'Competente' | 'En capacitación' | 'Inicial';
  badgeClass: string;
  barColorClass: string;
}

export function getPolyvalenceTier(polyvalencePct: number): PolyvalenceTierInfo {
  if (polyvalencePct >= 80) {
    return {
      label: 'Experto',
      badgeClass: 'bg-[#0b841f] text-white border-[#086617]',
      barColorClass: 'bg-[#0b841f]',
    };
  }
  if (polyvalencePct >= 60) {
    return {
      label: 'Competente',
      badgeClass: 'bg-[#9be242] text-slate-900 border-[#65a30d]',
      barColorClass: 'bg-[#84cc16]',
    };
  }
  if (polyvalencePct >= 40) {
    return {
      label: 'En capacitación',
      badgeClass: 'bg-[#ffd447] text-slate-900 border-[#d97706]',
      barColorClass: 'bg-[#f59e0b]',
    };
  }
  return {
    label: 'Inicial',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
    barColorClass: 'bg-rose-500',
  };
}

export interface TrainingPlanItem {
  operatorId: string;
  operatorName: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  currentLevel: CompetencyLevel;
  targetLevel: CompetencyLevel;
  suggestedDate: string;
}

export function getTrainingPlanItems(
  operators: Operator[],
  stations: Workstation[],
  recordsMap: Record<string, CompetencyRecord>,
  limit = 5
): TrainingPlanItem[] {
  const candidates: TrainingPlanItem[] = [];

  operators.forEach((op) => {
    stations.forEach((st) => {
      if (op.line !== st.line) return;
      const rec = recordsMap[getCellKey(op.id, st.id)];
      const currentLevel: CompetencyLevel = rec ? rec.level : 0;
      if (currentLevel < st.targetLevel) {
        candidates.push({
          operatorId: op.id,
          operatorName: op.name,
          stationId: st.id,
          stationCode: st.code,
          stationName: st.name,
          currentLevel,
          targetLevel: st.targetLevel,
          suggestedDate: '',
        });
      }
    });
  });

  candidates.sort((a, b) => {
    const gapA = (a.targetLevel - a.currentLevel) * 10 - a.currentLevel;
    const gapB = (b.targetLevel - b.currentLevel) * 10 - b.currentLevel;
    return gapB - gapA;
  });

  const baseDates = ['30/11/2026', '05/12/2026', '10/12/2026', '15/12/2026', '20/12/2026'];
  return candidates.slice(0, limit).map((item, idx) => ({
    ...item,
    suggestedDate: baseDates[idx % baseDates.length],
  }));
}

export function parseSymbolToLevel(rawToken: string): CompetencyLevel {
  const token = rawToken.trim().toUpperCase();
  if (!token || token === '-' || token === '—' || token === '0' || token === '0%' || token === 'N0' || token === '○') {
    return 0;
  }
  if (token === '1' || token === '25%' || token === 'N1' || token === 'I' || token === '◔' || token === '1/4') {
    return 1;
  }
  if (token === '2' || token === '50%' || token === 'N2' || token === 'L' || token === '◑' || token === '2/4' || token === '1/2') {
    return 2;
  }
  if (token === '3' || token === '75%' || token === 'N3' || token === 'U' || token === '◕' || token === '3/4') {
    return 3;
  }
  if (token === '4' || token === '100%' || token === 'N4' || token === 'O' || token === '●' || token === '4/4') {
    return 4;
  }

  const numericMatch = token.match(/^(\d+)%?$/);
  if (numericMatch) {
    const val = Number(numericMatch[1]);
    if (val >= 90) return 4;
    if (val >= 70) return 3;
    if (val >= 45) return 2;
    if (val >= 15) return 1;
    if (val >= 0 && val <= 4) return val as CompetencyLevel;
  }

  return 0;
}

export interface ParsedMatrixResult {
  operators: Operator[];
  stations: Workstation[];
  records: Record<string, CompetencyRecord>;
  convertedSymbolsCount: number;
}

export function parseDoubleEntryMatrix(rawText: string): ParsedMatrixResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('Ingresa al menos una fila de encabezados de estaciones y una fila de operador.');
  }

  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const splitRow = (row: string) =>
    row.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, ''));

  const headers = splitRow(lines[0]);
  if (headers.length < 2) {
    throw new Error('La matriz debe incluir al menos una columna de operador y una estación.');
  }

  const stationHeaders = headers.slice(1);
  const stations: Workstation[] = stationHeaders.map((header, idx) => {
    const codeMatch = header.match(/^([A-Z]{2,5}-\d{1,3})\s+(.+)$/i);
    const code = codeMatch ? codeMatch[1].toUpperCase() : `EST-${String(idx + 1).padStart(2, '0')}`;
    const name = codeMatch ? codeMatch[2].trim() : header;
    return {
      id: `imp-est-${idx + 1}`,
      code,
      name: name || `Estación ${idx + 1}`,
      line: 'Línea 1 · Ensamble',
      critical: idx < 2,
      minCertified: 2,
      targetLevel: 3,
    };
  });

  const operators: Operator[] = [];
  const records: Record<string, CompetencyRecord> = {};
  let convertedSymbolsCount = 0;

  for (let r = 1; r < lines.length; r += 1) {
    const cols = splitRow(lines[r]);
    const opName = cols[0];
    if (!opName) continue;

    const opId = `imp-op-${r}`;
    const opCode = `OP-${String(200 + r)}`;
    operators.push({
      id: opId,
      code: opCode,
      name: opName,
      role: 'Operador de Planta',
      shift: r % 3 === 1 ? 'Turno A' : r % 3 === 2 ? 'Turno B' : 'Turno C',
      line: 'Línea 1 · Ensamble',
      hireDate: '2024-01-15',
    });

    stations.forEach((station, sIdx) => {
      const rawCell = cols[sIdx + 1] ?? '0';
      if (/[○◔◑◕●ILUO]/i.test(rawCell)) {
        convertedSymbolsCount += 1;
      }
      const level = parseSymbolToLevel(rawCell);
      records[getCellKey(opId, station.id)] = {
        operatorId: opId,
        stationId: station.id,
        level,
        status: level === 0 ? 'Pendiente' : 'Vigente',
        lastAuditedAt: '2026-11-19',
        auditor: 'Importación de Matriz',
        notes: `Interpretado desde símbolo origen "${rawCell || '0'}".`,
      };
    });
  }

  if (operators.length === 0) {
    throw new Error('No se encontraron filas válidas de operadores para interpretar.');
  }

  return {
    operators,
    stations,
    records,
    convertedSymbolsCount,
  };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderStaticSvgIconHtml(level: CompetencyLevel): string {
  const color = COMPETENCY_LEVELS[level].accentHex;
  if (level === 0) {
    return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="9" width="14" height="2" rx="1" fill="${color}"/></svg>`;
  }
  if (level === 1) {
    return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="13" width="3" height="4" rx="1" fill="${color}"/><rect x="8.5" y="9" width="3" height="8" rx="1" fill="#E2E8F0"/><rect x="14" y="5" width="3" height="12" rx="1" fill="#E2E8F0"/></svg>`;
  }
  if (level === 2) {
    return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="13" width="3" height="4" rx="1" fill="${color}"/><rect x="8.5" y="9" width="3" height="8" rx="1" fill="${color}"/><rect x="14" y="5" width="3" height="12" rx="1" fill="#E2E8F0"/></svg>`;
  }
  if (level === 3) {
    return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="13" width="3" height="4" rx="1" fill="${color}"/><rect x="8.5" y="9" width="3" height="8" rx="1" fill="${color}"/><rect x="14" y="5" width="3" height="12" rx="1" fill="${color}"/></svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2L16 5.5V10.5C16 14.3 13.4 17.6 10 18.5C6.6 17.6 4 14.3 4 10.5V5.5L10 2Z" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.6"/><path d="M7.5 10.3L9.3 12.1L12.8 8.3" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function generateInteractiveHtmlTable(
  operators: Operator[],
  stations: Workstation[],
  recordsMap: Record<string, CompetencyRecord>,
  indicatorMode: IndicatorMode
): string {
  const headerCells = stations
    .map(
      (st) =>
        `<th scope="col" data-station="${escapeHtml(st.code)}"><div class="st-code">${escapeHtml(st.code)}</div><div class="st-name">${escapeHtml(st.name)}</div></th>`
    )
    .join('\n          ');

  const bodyRows = operators
    .map((op, opIdx) => {
      const opSummary = calculateOperatorPolyvalence(op.id, stations, recordsMap);
      const tier = getPolyvalenceTier(opSummary.polyvalencePct);
      const cells = stations
        .map((st) => {
          const rec = recordsMap[getCellKey(op.id, st.id)];
          const level: CompetencyLevel = rec ? rec.level : 0;
          const def = COMPETENCY_LEVELS[level];

          const visualHtml =
            indicatorMode === 'bars'
              ? `<div class="bar-wrap" aria-hidden="true">
                  <div class="bar-track"><div class="bar-fill lvl-${level}" style="width:${def.percentage}%"></div></div>
                  <div class="bar-meta"><span class="lvl-code">${def.shortCode}</span><span class="lvl-pct">${def.percentage}%</span></div>
                </div>`
              : `<div class="icon-wrap" aria-hidden="true">
                  ${renderStaticSvgIconHtml(level)}
                  <div class="icon-meta"><span class="lvl-code">${def.shortCode}</span><span class="lvl-pct">${def.percentage}%</span></div>
                </div>`;

          return `<td class="skill-cell cell-lvl-${level}" data-level="${level}" data-operator="${escapeHtml(op.name)}" data-station="${escapeHtml(st.code)} · ${escapeHtml(st.name)}">
              <button type="button" class="cell-btn" onclick="inspectCell(this)" title="${escapeHtml(op.name)} · ${escapeHtml(st.name)}: ${def.label} (${def.percentage}%)">
                ${visualHtml}
              </button>
            </td>`;
        })
        .join('\n            ');

      return `<tr data-operator-name="${escapeHtml(op.name.toLowerCase())}">
            <td class="num-col">${opIdx + 1}</td>
            <th scope="row" class="op-col">
              <div class="op-name">${escapeHtml(op.name)}</div>
              <div class="op-meta">${escapeHtml(op.code)} · ${escapeHtml(op.shift)}</div>
            </th>
            ${cells}
            <td class="poly-col">
              <strong>${opSummary.polyvalencePct}%</strong>
            </td>
            <td class="tier-col">
              <span class="tier-badge tier-${tier.label.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(tier.label)}</span>
            </td>
          </tr>`;
    })
    .join('\n          ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Matriz de Habilidades y Polivalencia</title>
  <style>
    :root { --bg: #f1f5f9; --card: #ffffff; --navy: #0d2d5e; --border: #cbd5e1; --ink: #0f172a; --muted: #64748b; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--ink); }
    .matrix-shell { max-width: 1280px; margin: 0 auto; background: var(--card); border: 1.5px solid #0d2d5e; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(13,45,94,0.08); }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; background: #e6f0ff; border-bottom: 1px solid #93c5fd; }
    .toolbar h1 { margin: 0; font-size: 16px; font-weight: 700; color: #0d2d5e; }
    .toolbar input { padding: 7px 12px; border: 1px solid #93c5fd; border-radius: 8px; font-size: 13px; min-width: 240px; background: #ffffff; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1; padding: 9px 11px; text-align: left; }
    thead th { background: var(--navy); color: #ffffff; font-weight: 700; vertical-align: middle; text-align: center; border-right: 1px solid rgba(255,255,255,0.22); }
    .st-code { font-family: ui-monospace, monospace; font-size: 10px; color: #bfdbfe; }
    .st-name { font-size: 12px; color: #ffffff; margin-top: 2px; min-width: 110px; }
    .num-col { text-align: center; font-weight: 700; width: 44px; background: #ffffff; }
    .op-col { position: sticky; left: 0; background: #ffffff; z-index: 2; min-width: 185px; }
    thead .op-col { background: var(--navy); color: #ffffff; text-align: left; }
    .op-name { font-weight: 600; color: var(--ink); }
    .op-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .cell-lvl-4, .cell-lvl-3 { background: #c8efc4; }
    .cell-lvl-2 { background: #fef3c7; }
    .cell-lvl-1 { background: #fde2e4; }
    .cell-lvl-0 { background: #f1f5f9; }
    .cell-btn { width: 100%; background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 4px 6px; cursor: pointer; text-align: left; transition: filter .15s; }
    .cell-btn:hover { filter: brightness(0.96); }
    .bar-wrap { display: flex; flex-direction: column; gap: 5px; min-width: 82px; }
    .bar-track { height: 7px; width: 100%; background: rgba(255,255,255,0.8); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; transition: width .2s ease; }
    .lvl-0 { background: #94a3b8; } .lvl-1 { background: #ea580c; } .lvl-2 { background: #d97706; } .lvl-3 { background: #16a34a; } .lvl-4 { background: #0b841f; }
    .bar-meta, .icon-meta { display: flex; justify-content: space-between; font-size: 11px; font-variant-numeric: tabular-nums; }
    .icon-wrap { display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 78px; }
    .icon-meta { flex: 1; }
    .lvl-code { font-weight: 700; color: var(--ink); }
    .lvl-pct { color: #334155; font-family: ui-monospace, monospace; }
    .poly-col { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: center; font-weight: 700; }
    .tier-col { text-align: center; white-space: nowrap; }
    .tier-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid transparent; }
    .tier-experto { background: #0b841f; color: #ffffff; }
    .tier-competente { background: #9be242; color: #0f172a; border-color: #65a30d; }
    .tier-en-capacitación { background: #ffd447; color: #0f172a; border-color: #d97706; }
    .tier-inicial { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    .inspector { padding: 12px 20px; background: #f8fafc; border-top: 1px solid var(--border); font-size: 13px; color: var(--muted); }
  </style>
</head>
<body>
  <section class="matrix-shell" aria-label="Matriz de Habilidades y Polivalencia">
    <div class="toolbar">
      <h1>Matriz de Habilidades y Polivalencia</h1>
      <input type="search" id="opFilter" placeholder="Filtrar operador..." oninput="filterRows(this.value)" />
    </div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">No.</th>
            <th scope="col" class="op-col">Nombre del Trabajador</th>
            ${headerCells}
            <th scope="col">% Polivalencia</th>
            <th scope="col">Nivel</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
    <div class="inspector" id="cellInspector">Haz clic en una celda para inspeccionar el nivel de competencia técnica.</div>
  </section>
  <script>
    const LEVELS = { 0: 'N0 · Sin formación (0%)', 1: 'N1 · En entrenamiento (25%)', 2: 'N2 · Operación asistida (50%)', 3: 'N3 · Autónomo certificado (75%)', 4: 'N4 · Instructor / Auditor (100%)' };
    function filterRows(query) {
      const q = query.trim().toLowerCase();
      document.querySelectorAll('tbody tr').forEach((tr) => {
        const name = tr.getAttribute('data-operator-name') || '';
        tr.style.display = name.includes(q) ? '' : 'none';
      });
    }
    function inspectCell(btn) {
      const td = btn.closest('td');
      const lvl = Number(td.getAttribute('data-level'));
      const op = td.getAttribute('data-operator');
      const st = td.getAttribute('data-station');
      document.getElementById('cellInspector').textContent = op + ' — ' + st + ': ' + (LEVELS[lvl] || '');
    }
  </script>
</body>
</html>`;
}

export function generateFrontendArchitecturePrompt(): string {
  return `Actúa como Arquitecto Frontend Senior especializado en sistemas industriales (MES / Lean Manufacturing). Diseña y construye la plataforma web "Matriz de Habilidades y Polivalencia (Skills Matrix)" siguiendo esta especificación:

1. Objetivo del sistema
Plataforma interactiva de planta para visualizar, actualizar y auditar el nivel de competencia técnica (escala 0–4 / ILUO) de cada operador en las distintas estaciones de trabajo, sustituyendo los círculos estáticos dibujados (Harvey balls) por indicadores visuales dinámicos de progreso (barras segmentadas de estado e iconos vectoriales de nivel con porcentaje tabular).

2. Arquitectura de Layout y Jerarquía Visual
- Sidebar lateral fijo (248px) con navegación por módulos: Matriz de Polivalencia, Registro de Auditorías y Generador HTML.
- Barra superior contextual con ruta de planta, filtro rápido y acción primaria única ("Exportar HTML Interactivo" / "Nuevo Operador").
- Franja superior de 4 KPIs numéricos tabulares: Polivalencia Global (%), Estaciones Críticas en Riesgo, Certificaciones Autónomas (N3–N4) y Brechas Activas.
- Tabla de doble entrada con primera columna fija (Operadores) y columnas por Estación de Trabajo con indicador de criticidad y fila resumen de cobertura mínima requerida.

3. Reglas de Indicadores Dinámicos (Sin círculos dibujados)
- Modo Barras de Progreso: barra horizontal rellena al 0%, 25%, 50%, 75% o 100%, acompañada de código de nivel (N0–N4) y porcentaje tabular.
- Modo Iconos de Nivel: iconos SVG escalonados (sin formación, barras crecientes N1–N3, escudo certificado N4) + etiqueta explícita para accesibilidad daltónica.

4. Flujo de Actualización y Auditoría
- Clic en cualquier celda de la matriz abre un panel lateral (Drawer) para editar el nivel (0–4), estado de vigencia, nombre del auditor y evidencia técnica.
- Cada guardado registra una entrada inmutable en el historial cronológico (Nivel anterior -> Nivel nuevo) y recalcula en tiempo real la cobertura por estación y la polivalencia por operador.

5. Intérprete de Matriz y Exportación
- Módulo capaz de interpretar texto CSV/TSV con símbolos tradicionales (○ ◔ ◑ ◕ ●, I/L/U/O o 0–4) y generar el código HTML5 + CSS + JS autónomo de la tabla interactiva resultante.`;
}

function normalizeMatchToken(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function parseLeadingCodeAndName(raw: string): { code: string | null; name: string } {
  const clean = raw.trim();
  const match = clean.match(/^([A-Z]{2,5}-\d{1,4})\s*(?:[-·:]\s*|\s+)(.+)$/i);
  if (match) {
    return { code: match[1].toUpperCase(), name: match[2].trim() };
  }
  const codeOnly = clean.match(/^([A-Z]{2,5}-\d{1,4})$/i);
  if (codeOnly) {
    return { code: codeOnly[1].toUpperCase(), name: clean };
  }
  return { code: null, name: clean };
}

function nextSequentialCode(existingCodes: string[], prefix: string, startNum: number): string {
  const used = new Set(existingCodes.map((c) => c.toUpperCase()));
  let num = startNum;
  while (used.has(`${prefix}-${String(num).padStart(prefix === 'EST' ? 2 : 3, '0')}`)) {
    num += 1;
  }
  return `${prefix}-${String(num).padStart(prefix === 'EST' ? 2 : 3, '0')}`;
}

export interface MergeMatrixInput {
  currentOperators: Operator[];
  currentStations: Workstation[];
  currentRecordsMap: Record<string, CompetencyRecord>;
  extracted: {
    operators: string[];
    stations: string[];
    levels: number[][];
    operatorShifts?: ShiftType[];
    operatorLines?: ProductionLine[];
  };
  mode: MergeFormatMode;
  auditor: string;
  sourceLabel: string;
  defaultLine?: ProductionLine;
  defaultShift?: ShiftType;
  attachmentId?: string;
  attachmentName?: string;
}

export interface MergeMatrixOutput {
  operators: Operator[];
  stations: Workstation[];
  recordsMap: Record<string, CompetencyRecord>;
  addedAuditLogs: AuditLogEntry[];
  stats: {
    newOperatorsCount: number;
    newStationsCount: number;
    updatedCellsCount: number;
  };
}

export function mergeExtractedMatrixIntoCurrent(input: MergeMatrixInput): MergeMatrixOutput {
  const nextOperators = [...input.currentOperators];
  const nextStations = [...input.currentStations];
  const nextRecords: Record<string, CompetencyRecord> = { ...input.currentRecordsMap };
  const addedAuditLogs: AuditLogEntry[] = [];

  const today = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toISOString();
  const defaultLine: ProductionLine = input.defaultLine ?? 'Línea 1 · Ensamble';
  const defaultShift: ShiftType = input.defaultShift ?? 'Turno A';
  const auditorName = input.auditor.trim() || 'Registro desde formato';

  let newStationsCount = 0;
  let newOperatorsCount = 0;
  let updatedCellsCount = 0;

  // 1. Resolve / append stations
  const resolvedStations: Workstation[] = input.extracted.stations.map((rawSt, sIdx) => {
    const { code, name } = parseLeadingCodeAndName(rawSt);
    const normName = normalizeMatchToken(name);
    const existing = nextStations.find(
      (st) =>
        (code && st.code.toUpperCase() === code) ||
        normalizeMatchToken(st.name) === normName ||
        normalizeMatchToken(`${st.code} ${st.name}`) === normalizeMatchToken(rawSt)
    );
    if (existing) {
      return existing;
    }

    const generatedCode =
      code ??
      nextSequentialCode(
        nextStations.map((s) => s.code),
        'EST',
        nextStations.length + 1
      );
    const created: Workstation = {
      id: `fmt-est-${Date.now()}-${sIdx}`,
      code: generatedCode,
      name: name || `Estación ${nextStations.length + 1}`,
      line: defaultLine,
      critical: false,
      minCertified: 2,
      targetLevel: 3,
    };
    nextStations.push(created);
    newStationsCount += 1;

    // Initialize baseline 0 records for all pre-existing operators on this newly added station
    for (const op of input.currentOperators) {
      const k = getCellKey(op.id, created.id);
      if (!nextRecords[k]) {
        nextRecords[k] = {
          operatorId: op.id,
          stationId: created.id,
          level: 0,
          status: 'Pendiente',
          lastAuditedAt: today,
          auditor: auditorName,
          notes: `Estación agregada desde formato (${input.sourceLabel}).`,
        };
      }
    }
    return created;
  });

  // 2. Resolve / append operators & apply extracted levels
  input.extracted.operators.forEach((rawOp, rIdx) => {
    const { code, name } = parseLeadingCodeAndName(rawOp);
    const normName = normalizeMatchToken(name);
    let operator = nextOperators.find(
      (op) =>
        (code && op.code.toUpperCase() === code) ||
        normalizeMatchToken(op.name) === normName
    );
    const isNewOperator = !operator;

    if (!operator) {
      const generatedCode =
        code ??
        nextSequentialCode(
          nextOperators.map((o) => o.code),
          'OP',
          101 + nextOperators.length
        );
      operator = {
        id: `fmt-op-${Date.now()}-${rIdx}`,
        code: generatedCode,
        name: name || `Trabajador ${nextOperators.length + 1}`,
        role: 'Operador de Planta',
        shift: input.extracted.operatorShifts?.[rIdx] ?? defaultShift,
        line: input.extracted.operatorLines?.[rIdx] ?? defaultLine,
        hireDate: today,
      };
      nextOperators.push(operator);
      newOperatorsCount += 1;

      // Initialize baseline 0 records for existing stations not covered by this format
      for (const st of nextStations) {
        const k = getCellKey(operator.id, st.id);
        if (!nextRecords[k]) {
          nextRecords[k] = {
            operatorId: operator.id,
            stationId: st.id,
            level: 0,
            status: 'Pendiente',
            lastAuditedAt: today,
            auditor: auditorName,
            notes: `Alta desde formato (${input.sourceLabel}).`,
          };
        }
      }
    }

    const rowLevels = input.extracted.levels[rIdx] ?? [];
    resolvedStations.forEach((station, sIdx) => {
      const rawVal = Math.round(Number(rowLevels[sIdx] ?? 0));
      const newLevel = (Math.max(0, Math.min(4, Number.isFinite(rawVal) ? rawVal : 0))) as CompetencyLevel;
      const cellKey = getCellKey(operator!.id, station.id);
      const prevRecord = nextRecords[cellKey];
      const previousLevel: CompetencyLevel = prevRecord ? prevRecord.level : 0;

      if (input.mode === 'append_only' && !isNewOperator && previousLevel > 0) {
        return;
      }

      if (isNewOperator || !prevRecord || previousLevel !== newLevel) {
        const nextStatus = newLevel === 0 ? 'Pendiente' : 'Vigente';
        const noteText = input.attachmentName
          ? `Cargado desde formato "${input.sourceLabel}" (adjunto: ${input.attachmentName}).`
          : `Cargado desde formato "${input.sourceLabel}".`;

        nextRecords[cellKey] = {
          operatorId: operator!.id,
          stationId: station.id,
          level: newLevel,
          status: nextStatus,
          lastAuditedAt: today,
          auditor: auditorName,
          notes: noteText,
        };

        if (previousLevel !== newLevel || (isNewOperator && newLevel > 0)) {
          updatedCellsCount += 1;
          addedAuditLogs.push({
            id: `aud-fmt-${Date.now()}-${rIdx}-${sIdx}`,
            timestamp,
            operatorId: operator!.id,
            operatorName: operator!.name,
            operatorCode: operator!.code,
            stationId: station.id,
            stationCode: station.code,
            stationName: station.name,
            previousLevel,
            newLevel,
            auditor: auditorName,
            notes: noteText,
            status: nextStatus,
            attachmentId: input.attachmentId,
            attachmentName: input.attachmentName,
          });
        }
      }
    });
  });

  return {
    operators: nextOperators,
    stations: nextStations,
    recordsMap: nextRecords,
    addedAuditLogs,
    stats: {
      newOperatorsCount,
      newStationsCount,
      updatedCellsCount,
    },
  };
}

export function generatePrintablePhysicalFormatHtml(
  stations: Workstation[],
  metadata: MatrixMetadata
): string {
  const displayDate =
    metadata.date.trim() ||
    new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const stationHeaders = stations
    .map(
      (st) =>
        `<th><div class="st-code">${escapeHtml(st.code)}</div><div class="st-name">${escapeHtml(st.name)}</div></th>`
    )
    .join('');

  const blankRows = Array.from({ length: 8 }, (_, idx) => {
    const blankCells = stations
      .map(
        () =>
          `<td class="eval-cell"><div class="circle-guide" aria-hidden="true"></div><div class="lvl-hint">0 · 1 · 2 · 3 · 4</div></td>`
      )
      .join('');
    return `<tr>
      <td class="num-col">${idx + 1}</td>
      <td class="name-col"></td>
      ${blankCells}
      <td class="extra-col"><div class="circle-guide"></div></td>
      <td class="poly-col">_____ %</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Formato Físico · Matriz de Habilidades y Polivalencia</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; background: #ffffff; }
    .sheet { max-width: 1120px; margin: 0 auto; }
    .ctx-banner { display: grid; grid-template-columns: 1.2fr 1fr 1.6fr; gap: 12px; background: #e6f0ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; font-size: 12px; }
    .ctx-banner strong { color: #0d2d5e; }
    table { width: 100%; border-collapse: collapse; border: 2px solid #0d2d5e; }
    th, td { border: 1px solid #94a3b8; padding: 8px 6px; text-align: center; }
    thead th { background: #0d2d5e; color: #ffffff; font-size: 11px; border-color: rgba(255,255,255,0.25); }
    .st-code { font-family: ui-monospace, monospace; font-size: 9px; color: #bfdbfe; }
    .st-name { font-weight: 700; margin-top: 2px; }
    .num-col { width: 36px; font-weight: 700; font-size: 12px; }
    .name-col { min-width: 180px; text-align: left; }
    .eval-cell, .extra-col { height: 48px; vertical-align: middle; }
    .circle-guide { width: 22px; height: 22px; border: 1.5px solid #475569; border-radius: 50%; margin: 0 auto 3px; }
    .lvl-hint { font-size: 8px; color: #64748b; }
    .poly-col { width: 76px; font-size: 11px; color: #475569; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 16px; font-size: 11px; color: #334155; }
    .sig { border-top: 1px solid #475569; padding-top: 4px; min-width: 220px; text-align: center; }
    .print-bar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
    .print-btn { padding: 7px 14px; background: #0d2d5e; color: #ffffff; border: 0; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
    @media print { .print-bar { display: none; } body { padding: 8px; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="print-bar">
      <button class="print-btn" onclick="window.print()">Imprimir formato físico</button>
    </div>
    <div class="ctx-banner">
      <div><strong>Área:</strong> ${escapeHtml(metadata.area)}<br /><strong>Fecha:</strong> ${escapeHtml(displayDate)}</div>
      <div><strong>Responsable:</strong> ${escapeHtml(metadata.responsible)}<br /><strong>Registro:</strong> Formato físico para captura</div>
      <div><strong>Objetivo:</strong> ${escapeHtml(metadata.objective)}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>No.</th>
          <th class="name-col">Nombre del Trabajador (Nuevo / Actualizar)</th>
          ${stationHeaders}
          <th>Nueva estación:<br />_____________</th>
          <th>% Poliv.</th>
        </tr>
      </thead>
      <tbody>
        ${blankRows}
      </tbody>
    </table>
    <div class="footer">
      <div><strong>Instrucciones:</strong> Rellena cada círculo o anota el nivel (0 = Sin formación, 1 = 25%, 2 = 50%, 3 = 75%, 4 = 100%) y adjunta fotografía o PDF en MatriPol para agregar los datos.</div>
      <div class="sig">Firma del Supervisor / Responsable</div>
    </div>
  </div>
</body>
</html>`;
}
