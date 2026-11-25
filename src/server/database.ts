import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  AuditLogEntry,
  CompetencyRecord,
  Operator,
  Workstation,
} from '../types/skillsMatrix.ts';
import {
  createSeedRecords,
  SEED_AUDIT_LOGS,
  SEED_OPERATORS,
  SEED_STATIONS,
} from '../data/seedMatrix.ts';

export interface MatrixStatePayload {
  operators: Operator[];
  stations: Workstation[];
  recordsMap: Record<string, CompetencyRecord>;
  auditLogs: AuditLogEntry[];
}

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

export type CaptureStatus = 'Borrador' | 'Integrado' | 'Archivado';

export interface CapturedInterfaceRecord {
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

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'matripol.db');

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS matrix_state (
      key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS captured_interfaces (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      detected_type TEXT NOT NULL,
      detected_elements_json TEXT NOT NULL,
      summary TEXT NOT NULL,
      stress_test_notes TEXT NOT NULL,
      generated_html TEXT NOT NULL,
      system_instruction TEXT NOT NULL,
      focus_mode TEXT NOT NULL,
      image_preview TEXT NOT NULL,
      parsed_matrix_json TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  dbInstance = db;
  return db;
}

export function getMatrixState(): MatrixStatePayload {
  const db = getDb();
  const row = db
    .prepare('SELECT payload FROM matrix_state WHERE key = ?')
    .get('plant_matrix') as { payload: string } | undefined;

  if (row) {
    try {
      return JSON.parse(row.payload) as MatrixStatePayload;
    } catch {
      // Fall through to re-seed if corrupted
    }
  }

  const seed: MatrixStatePayload = {
    operators: SEED_OPERATORS,
    stations: SEED_STATIONS,
    recordsMap: createSeedRecords(),
    auditLogs: SEED_AUDIT_LOGS,
  };
  saveMatrixState(seed);
  return seed;
}

export function saveMatrixState(payload: MatrixStatePayload): MatrixStatePayload {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO matrix_state (key, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
  ).run('plant_matrix', JSON.stringify(payload), now);
  return payload;
}

function mapCaptureRow(row: Record<string, unknown>): CapturedInterfaceRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    detectedType: String(row.detected_type),
    detectedElements: JSON.parse(String(row.detected_elements_json)) as DetectedUiElement[],
    summary: String(row.summary),
    stressTestNotes: String(row.stress_test_notes),
    generatedHtml: String(row.generated_html),
    systemInstruction: String(row.system_instruction),
    focusMode: String(row.focus_mode),
    imagePreview: String(row.image_preview),
    parsedMatrix: row.parsed_matrix_json
      ? (JSON.parse(String(row.parsed_matrix_json)) as ExtractedMatrixData)
      : null,
    status: String(row.status) as CaptureStatus,
    createdAt: String(row.created_at),
  };
}

const SAMPLE_SEED_SVG_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220">
      <rect width="360" height="220" fill="#ffffff"/>
      <rect x="14" y="14" width="332" height="30" fill="#f1f5f9" stroke="#334155" stroke-width="1.5"/>
      <text x="24" y="34" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">BOCETO: MATRIZ LÍNEA 1</text>
      <rect x="14" y="54" width="332" height="150" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>
      <line x1="14" y1="88" x2="346" y2="88" stroke="#cbd5e1" stroke-width="1.5"/>
      <line x1="14" y1="126" x2="346" y2="126" stroke="#cbd5e1" stroke-width="1.5"/>
      <line x1="14" y1="164" x2="346" y2="164" stroke="#cbd5e1" stroke-width="1.5"/>
      <line x1="130" y1="54" x2="130" y2="204" stroke="#cbd5e1" stroke-width="1.5"/>
      <line x1="238" y1="54" x2="238" y2="204" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="24" y="76" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155">Operador</text>
      <text x="144" y="76" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155">EST-01 Corte</text>
      <text x="252" y="76" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155">EST-02 Torque</text>
      <text x="24" y="112" font-family="sans-serif" font-size="11" fill="#0f172a">Ana López</text>
      <circle cx="184" cy="107" r="10" fill="#1e293b"/>
      <path d="M292,107 L292,97 A10,10 0 1,1 282,107 Z" fill="#1e293b"/>
      <circle cx="292" cy="107" r="10" fill="none" stroke="#1e293b" stroke-width="1.5"/>
      <text x="24" y="150" font-family="sans-serif" font-size="11" fill="#0f172a">Luis Pérez</text>
      <path d="M184,145 L184,135 A10,10 0 0,1 184,155 Z" fill="#1e293b"/>
      <circle cx="184" cy="145" r="10" fill="none" stroke="#1e293b" stroke-width="1.5"/>
      <circle cx="292" cy="145" r="10" fill="#1e293b"/>
    </svg>`
  );

function ensureSeedCapture(db: DatabaseSync): void {
  const seededFlag = db
    .prepare('SELECT key FROM matrix_state WHERE key = ?')
    .get('captures_seeded') as { key: string } | undefined;
  if (seededFlag) return;

  const existingCount = db
    .prepare('SELECT COUNT(*) as total FROM captured_interfaces')
    .get() as { total: number };

  if (existingCount.total === 0) {
    const sampleHtml = `<section class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
  <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
    <div>
      <h2 class="text-base font-bold text-slate-900">Matriz de Habilidades · Línea 1 Ensamble</h2>
      <p class="text-xs text-slate-500 mt-0.5">Estructura digitalizada con barras dinámicas de progreso</p>
    </div>
    <span class="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">Referencia SQLite</span>
  </header>
  <div class="overflow-x-auto">
    <table class="w-full text-left border-collapse text-sm">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
          <th class="px-4 py-3">Operador</th>
          <th class="px-4 py-3">EST-01 Corte</th>
          <th class="px-4 py-3">EST-02 Torque</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-200">
        <tr>
          <td class="px-4 py-3 font-medium text-slate-900">Ana López</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-between text-xs mb-1"><span class="font-semibold text-emerald-700">N4</span><span class="font-mono text-slate-500">100%</span></div>
            <div class="h-2 bg-slate-100 rounded overflow-hidden"><div class="h-full bg-emerald-600" style="width:100%"></div></div>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-between text-xs mb-1"><span class="font-semibold text-blue-700">N3</span><span class="font-mono text-slate-500">75%</span></div>
            <div class="h-2 bg-slate-100 rounded overflow-hidden"><div class="h-full bg-blue-600" style="width:75%"></div></div>
          </td>
        </tr>
        <tr>
          <td class="px-4 py-3 font-medium text-slate-900">Luis Pérez</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-between text-xs mb-1"><span class="font-semibold text-amber-700">N2</span><span class="font-mono text-slate-500">50%</span></div>
            <div class="h-2 bg-slate-100 rounded overflow-hidden"><div class="h-full bg-amber-500" style="width:50%"></div></div>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-between text-xs mb-1"><span class="font-semibold text-emerald-700">N4</span><span class="font-mono text-slate-500">100%</span></div>
            <div class="h-2 bg-slate-100 rounded overflow-hidden"><div class="h-full bg-emerald-600" style="width:100%"></div></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</section>`;

    db.prepare(
      `INSERT INTO captured_interfaces (
        id, title, detected_type, detected_elements_json, summary,
        stress_test_notes, generated_html, system_instruction, focus_mode,
        image_preview, parsed_matrix_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'cap-seed-matrix-01',
      'Ejemplo inicial · Matriz de Polivalencia Línea 1',
      'matriz_polivalencia',
      JSON.stringify([
        { category: 'Tabla', label: 'Matriz de doble entrada (operadores x estaciones)', count: 1, confidence: 'Alta' },
        { category: 'Indicador', label: 'Barras de progreso técnico (N0–N4)', count: 4, confidence: 'Alta' },
      ]),
      'Estructura base almacenada en SQLite para previsualizar código HTML/Tailwind y renderizado dinámico.',
      'Clasificado como matriz de doble entrada con conversión de círculos dibujados a barras de progreso dinámicas.',
      sampleHtml,
      'Estructura base de demostración en SQLite.',
      'table',
      SAMPLE_SEED_SVG_DATA_URL,
      JSON.stringify({
        operators: ['Ana López', 'Luis Pérez'],
        stations: ['EST-01 Corte', 'EST-02 Torque'],
        levels: [
          [4, 3],
          [2, 4],
        ],
      }),
      'Borrador',
      new Date().toISOString()
    );
  }

  db.prepare(
    `INSERT INTO matrix_state (key, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO NOTHING`
  ).run('captures_seeded', 'true', new Date().toISOString());
}

export function listCaptures(): CapturedInterfaceRecord[] {
  const db = getDb();
  ensureSeedCapture(db);
  const rows = db
    .prepare('SELECT * FROM captured_interfaces ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map(mapCaptureRow);
}

export function getCaptureById(id: string): CapturedInterfaceRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM captured_interfaces WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapCaptureRow(row) : null;
}

export function createCapture(
  input: Omit<CapturedInterfaceRecord, 'id' | 'createdAt'>
): CapturedInterfaceRecord {
  const db = getDb();
  const record: CapturedInterfaceRecord = {
    ...input,
    id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO captured_interfaces (
      id, title, detected_type, detected_elements_json, summary,
      stress_test_notes, generated_html, system_instruction, focus_mode,
      image_preview, parsed_matrix_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.title,
    record.detectedType,
    JSON.stringify(record.detectedElements),
    record.summary,
    record.stressTestNotes,
    record.generatedHtml,
    record.systemInstruction,
    record.focusMode,
    record.imagePreview,
    record.parsedMatrix ? JSON.stringify(record.parsedMatrix) : null,
    record.status,
    record.createdAt
  );

  return record;
}

export function updateCapture(
  id: string,
  updates: Partial<Pick<CapturedInterfaceRecord, 'title' | 'status' | 'generatedHtml'>>
): CapturedInterfaceRecord | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM captured_interfaces WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;

  if (!existing) return null;

  const current = mapCaptureRow(existing);
  const nextTitle = updates.title !== undefined ? updates.title : current.title;
  const nextStatus = updates.status !== undefined ? updates.status : current.status;
  const nextHtml =
    updates.generatedHtml !== undefined ? updates.generatedHtml : current.generatedHtml;

  db.prepare(
    `UPDATE captured_interfaces
     SET title = ?, status = ?, generated_html = ?
     WHERE id = ?`
  ).run(nextTitle, nextStatus, nextHtml, id);

  return {
    ...current,
    title: nextTitle,
    status: nextStatus,
    generatedHtml: nextHtml,
  };
}

export function deleteCapture(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM captured_interfaces WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}
