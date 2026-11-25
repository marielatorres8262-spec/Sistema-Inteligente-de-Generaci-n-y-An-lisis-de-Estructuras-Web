import {
  CompetencyLevel,
  CompetencyRecord,
  ExtractedMatrixData,
  Operator,
  Workstation,
} from '../types/skillsMatrix';
import { getCellKey } from './matrixLogic';

export const DEFAULT_SKETCH_SYSTEM_INSTRUCTION =
  'Eres un desarrollador web experto. Analiza la siguiente imagen de un boceto o documento, identifica la estructura web (formularios, tablas, barras de navegación, botones, tarjetas) y devuelve el código HTML/Tailwind exacto junto con la clasificación estructural. Si la imagen contiene una matriz de habilidades de doble entrada con círculos dibujados o símbolos de nivel, extrae también los operadores, estaciones y niveles (0 a 4) para reemplazar los círculos por barras de progreso dinámicas.';

export function extractJsonFromModelText(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }
  return trimmed;
}

export function sanitizeGeneratedHtml(rawHtml: string): string {
  let html = (rawHtml ?? '').trim();
  const fenced = html.match(/^```(?:html|xml)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    html = fenced[1].trim();
  }
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    html = bodyMatch[1].trim();
  }
  return html;
}

export function normalizeExtractedMatrix(
  raw: ExtractedMatrixData | null | undefined
): ExtractedMatrixData | null {
  if (
    !raw ||
    !Array.isArray(raw.operators) ||
    !Array.isArray(raw.stations) ||
    raw.operators.length === 0 ||
    raw.stations.length === 0
  ) {
    return null;
  }

  const operators = raw.operators.map((op, i) => String(op ?? '').trim() || `Operador ${i + 1}`);
  const stations = raw.stations.map((st, i) => String(st ?? '').trim() || `Estación ${i + 1}`);
  const levels = operators.map((_, rIdx) => {
    const sourceRow = Array.isArray(raw.levels?.[rIdx]) ? raw.levels[rIdx] : [];
    return stations.map((__, cIdx) => clampCompetencyLevel(sourceRow[cIdx] ?? 0));
  });

  return { operators, stations, levels };
}

export function buildPreviewDocument(generatedHtml: string): string {
  const cleaned = sanitizeGeneratedHtml(generatedHtml);
  const safeBody =
    cleaned ||
    '<p class="text-slate-500 text-sm">Sin contenido HTML generado.</p>';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 20px;
      margin: 0;
      line-height: 1.5;
    }
    table { width: 100%; border-collapse: collapse; background: #ffffff; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 13px; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
    input, select, textarea {
      font: inherit;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      background: #ffffff;
    }
    button { font: inherit; cursor: pointer; }
  </style>
</head>
<body>
  <div class="max-w-5xl mx-auto">
    ${safeBody}
  </div>
</body>
</html>`;
}

export function clampCompetencyLevel(raw: unknown): CompetencyLevel {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 4) return 4;
  return n as CompetencyLevel;
}

export function convertExtractedMatrixToDomain(
  matrixData: ExtractedMatrixData,
  sourceTitle: string
): {
  operators: Operator[];
  stations: Workstation[];
  records: Record<string, CompetencyRecord>;
} {
  if (!matrixData.operators.length || !matrixData.stations.length) {
    throw new Error('La matriz extraída no contiene operadores o estaciones válidas.');
  }

  const stations: Workstation[] = matrixData.stations.map((rawName, idx) => {
    const clean = rawName.trim() || `Estación ${idx + 1}`;
    const codeMatch = clean.match(/^([A-Z]{2,5}-\d{1,3})\s+(.+)$/i);
    return {
      id: `ai-est-${idx + 1}`,
      code: codeMatch ? codeMatch[1].toUpperCase() : `EST-${String(idx + 1).padStart(2, '0')}`,
      name: codeMatch ? codeMatch[2].trim() : clean,
      line: 'Línea 1 · Ensamble',
      critical: idx < 2,
      minCertified: 2,
      targetLevel: 3,
    };
  });

  const operators: Operator[] = [];
  const records: Record<string, CompetencyRecord> = {};
  const today = new Date().toISOString().slice(0, 10);

  matrixData.operators.forEach((rawOp, rIdx) => {
    const opName = rawOp.trim() || `Operador ${rIdx + 1}`;
    const opId = `ai-op-${rIdx + 1}`;
    operators.push({
      id: opId,
      code: `OP-${String(301 + rIdx)}`,
      name: opName,
      role: 'Operador de Planta',
      shift: rIdx % 3 === 0 ? 'Turno A' : rIdx % 3 === 1 ? 'Turno B' : 'Turno C',
      line: 'Línea 1 · Ensamble',
      hireDate: today,
    });

    const rowLevels = matrixData.levels[rIdx] ?? [];
    stations.forEach((station, sIdx) => {
      const level = clampCompetencyLevel(rowLevels[sIdx] ?? 0);
      records[getCellKey(opId, station.id)] = {
        operatorId: opId,
        stationId: station.id,
        level,
        status: level === 0 ? 'Pendiente' : 'Vigente',
        lastAuditedAt: today,
        auditor: 'Digitalización IA',
        notes: `Extraído automáticamente desde boceto "${sourceTitle}".`,
      };
    });
  });

  return { operators, stations, records };
}

export function renderSampleWireframeDataUrl(kind: 'matrix_table' | 'audit_form'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 460;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#0f172a';

  if (kind === 'matrix_table') {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('BOCETO: MATRIZ DE POLIVALENCIA (LÍNEA ENSAMBLE)', 32, 42);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Escala con círculos dibujados: ○ (0) · ◔ (1) · ◑ (2) · ◕ (3) · ● (4)', 32, 66);

    const cols = ['Operador', 'EST-01 Corte', 'EST-02 Torque', 'EST-03 Soldadura', 'EST-04 Calidad'];
    const rows = [
      ['Ana López', 4, 3, 2, 4],
      ['Luis Pérez', 2, 4, 3, 1],
      ['Marta Ruiz', 3, 2, 4, 3],
      ['Jorge Díaz', 1, 1, 0, 2],
    ];

    const startX = 32;
    const startY = 92;
    const colWidths = [160, 132, 132, 132, 132];
    const rowH = 62;

    // Header row
    let x = startX;
    cols.forEach((col, i) => {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(x, startY, colWidths[i], 44);
      ctx.strokeRect(x, startY, colWidths[i], 44);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(col, x + 10, startY + 27);
      x += colWidths[i];
    });

    // Data rows with hand-style Harvey circles
    rows.forEach((row, rIdx) => {
      const y = startY + 44 + rIdx * rowH;
      let cxPos = startX;
      ctx.strokeRect(cxPos, y, colWidths[0], rowH);
      ctx.fillStyle = '#0f172a';
      ctx.font = '14px sans-serif';
      ctx.fillText(String(row[0]), cxPos + 12, y + 36);
      cxPos += colWidths[0];

      for (let c = 1; c < row.length; c += 1) {
        ctx.strokeRect(cxPos, y, colWidths[c], rowH);
        const lvl = Number(row[c]);
        const centerX = cxPos + colWidths[c] / 2;
        const centerY = y + rowH / 2;
        const radius = 15;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#1e293b';
        ctx.stroke();

        if (lvl > 0) {
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * lvl) / 4);
          ctx.closePath();
          ctx.fillStyle = '#1e293b';
          ctx.fill();
        }
        cxPos += colWidths[c];
      }
    });
  } else {
    // Wireframe Audit Form
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('WIREFRAME: FORMULARIO DE AUDITORÍA EN ESTACIÓN', 32, 42);

    // Top navbar sketch
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(32, 62, 696, 38);
    ctx.strokeRect(32, 62, 696, 38);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('NAVBAR: Planta Norte   |   Inicio   |   Auditorías   |   [Guardar]', 48, 86);

    // Form card
    ctx.strokeRect(32, 118, 696, 310);
    ctx.font = '14px sans-serif';
    ctx.fillText('Nombre del operador:', 56, 155);
    ctx.strokeRect(56, 165, 300, 34);
    ctx.fillStyle = '#64748b';
    ctx.fillText('[ Input texto ]', 68, 187);

    ctx.fillStyle = '#0f172a';
    ctx.fillText('Estación de trabajo:', 390, 155);
    ctx.strokeRect(390, 165, 310, 34);
    ctx.fillStyle = '#64748b';
    ctx.fillText('[ Select ▼ ]', 402, 187);

    ctx.fillStyle = '#0f172a';
    ctx.fillText('Nivel evaluado (0 - 4):', 56, 232);
    ctx.strokeRect(56, 242, 644, 34);
    ctx.fillStyle = '#64748b';
    ctx.fillText('( ) N1   ( ) N2   (x) N3   ( ) N4', 68, 264);

    ctx.fillStyle = '#0f172a';
    ctx.fillText('Observaciones de auditoría:', 56, 305);
    ctx.strokeRect(56, 315, 644, 54);

    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(540, 382, 160, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Guardar Auditoría', 563, 404);
  }

  return canvas.toDataURL('image/png');
}
