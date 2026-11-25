import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPreviewDocument,
  clampCompetencyLevel,
  convertExtractedMatrixToDomain,
  extractJsonFromModelText,
  normalizeExtractedMatrix,
  sanitizeGeneratedHtml,
} from './sketchHelpers';
import { getCellKey } from './matrixLogic';

test('clampCompetencyLevel normalizes out-of-range numeric levels', () => {
  assert.equal(clampCompetencyLevel(-2), 0);
  assert.equal(clampCompetencyLevel(2.6), 3);
  assert.equal(clampCompetencyLevel(7), 4);
  assert.equal(clampCompetencyLevel('invalid'), 0);
});

test('convertExtractedMatrixToDomain converts Gemini parsed matrix into operators, stations, and records', () => {
  const converted = convertExtractedMatrixToDomain(
    {
      operators: ['Ana López', 'Luis Pérez'],
      stations: ['EST-01 Corte', 'EST-02 Torque'],
      levels: [
        [4, 3],
        [1, 0],
      ],
    },
    'Boceto Línea 1'
  );

  assert.equal(converted.operators.length, 2);
  assert.equal(converted.stations.length, 2);
  assert.equal(converted.stations[0].code, 'EST-01');
  assert.equal(converted.stations[0].name, 'Corte');
  assert.equal(
    converted.records[getCellKey(converted.operators[0].id, converted.stations[0].id)].level,
    4
  );
  assert.equal(
    converted.records[getCellKey(converted.operators[1].id, converted.stations[1].id)].status,
    'Pendiente'
  );
});

test('buildPreviewDocument wraps generated HTML with Tailwind runtime and Spanish lang attribute', () => {
  const doc = buildPreviewDocument('<table class="w-full"><tr><td>Dato</td></tr></table>');
  assert.match(doc, /lang="es"/);
  assert.match(doc, /cdn\.tailwindcss\.com/);
  assert.match(doc, /<table class="w-full">/);
});

test('extractJsonFromModelText strips markdown json code fences', () => {
  const raw = '```json\n{"title":"Tabla"}\n```';
  assert.equal(extractJsonFromModelText(raw), '{"title":"Tabla"}');
  assert.equal(extractJsonFromModelText('  {"ok":true}  '), '{"ok":true}');
});

test('sanitizeGeneratedHtml unwraps markdown html fences and full body wrappers', () => {
  const fenced = '```html\n<!doctype html><html><body><section>Hola</section></body></html>\n```';
  assert.equal(sanitizeGeneratedHtml(fenced), '<section>Hola</section>');
});

test('normalizeExtractedMatrix pads missing rows/columns and clamps out-of-range levels', () => {
  const normalized = normalizeExtractedMatrix({
    operators: ['Op 1', 'Op 2'],
    stations: ['EST-01', 'EST-02', 'EST-03'],
    levels: [[5, -1]],
  });
  assert.ok(normalized);
  assert.deepEqual(normalized.levels, [
    [4, 0, 0],
    [0, 0, 0],
  ]);
  assert.equal(normalizeExtractedMatrix({ operators: [], stations: ['A'], levels: [] }), null);
});
