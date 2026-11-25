import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOperatorPolyvalence,
  calculatePlantMetrics,
  calculateStationCoverage,
  generateInteractiveHtmlTable,
  generatePrintablePhysicalFormatHtml,
  getCellKey,
  getPolyvalenceTier,
  getTrainingPlanItems,
  mergeExtractedMatrixIntoCurrent,
  parseDoubleEntryMatrix,
  parseSymbolToLevel,
} from './matrixLogic';
import { DEFAULT_MATRIX_METADATA } from '../types/skillsMatrix';
import { createSeedRecords, SEED_OPERATORS, SEED_STATIONS } from '../data/seedMatrix';

test('calculateOperatorPolyvalence computes exact percentage and certified count', () => {
  const records = createSeedRecords();
  const lucia = calculateOperatorPolyvalence('op-102', SEED_STATIONS, records);
  // op-102 row: [4, 4, 4, 2, 1, 3, 3, 4] -> sum = 25 / 32 = 78%, certified (>=3) = 6
  assert.equal(lucia.certifiedCount, 6);
  assert.equal(lucia.totalStations, 8);
  assert.equal(lucia.polyvalencePct, 78);
});

test('calculateStationCoverage flags station risk when below minCertified', () => {
  const records = createSeedRecords();
  const est03 = SEED_STATIONS.find((s) => s.id === 'est-03')!; // minCertified = 2
  const coverage = calculateStationCoverage(est03, SEED_OPERATORS, records);
  // est-03 levels across 9 operators: op-101(3), op-102(4) => 2 autonomous -> not at risk
  assert.equal(coverage.autonomousCount, 2);
  assert.equal(coverage.atRisk, false);

  const est04 = SEED_STATIONS.find((s) => s.id === 'est-04')!; // minCertified = 3
  const coverage04 = calculateStationCoverage(est04, SEED_OPERATORS, records);
  // est-04 autonomous (>=3): op-103(4), op-106(4) => 2 < 3 -> atRisk = true
  assert.equal(coverage04.autonomousCount, 2);
  assert.equal(coverage04.atRisk, true);
});

test('calculatePlantMetrics aggregates global polyvalence and critical risks', () => {
  const records = createSeedRecords();
  const summary = calculatePlantMetrics(SEED_OPERATORS, SEED_STATIONS, records);
  assert.ok(summary.globalPolyvalencePct > 0 && summary.globalPolyvalencePct <= 100);
  assert.equal(summary.criticalStationsAtRisk, 1); // est-04
  assert.ok(summary.totalAutonomousCertifications > 0);
});

test('parseSymbolToLevel maps Harvey ball circles, ILUO, percentages, and numbers', () => {
  assert.equal(parseSymbolToLevel('○'), 0);
  assert.equal(parseSymbolToLevel('◔'), 1);
  assert.equal(parseSymbolToLevel('◑'), 2);
  assert.equal(parseSymbolToLevel('◕'), 3);
  assert.equal(parseSymbolToLevel('●'), 4);
  assert.equal(parseSymbolToLevel('I'), 1);
  assert.equal(parseSymbolToLevel('L'), 2);
  assert.equal(parseSymbolToLevel('U'), 3);
  assert.equal(parseSymbolToLevel('O'), 4);
  assert.equal(parseSymbolToLevel('75%'), 3);
  assert.equal(parseSymbolToLevel('4'), 4);
});

test('parseDoubleEntryMatrix interprets circle-based CSV into structured operators and records', () => {
  const csv = `Operador,EST-01 Pre-ensamble,EST-02 Torque\nAna Ruiz,●,◑\nLuis Vega,◔,○`;
  const parsed = parseDoubleEntryMatrix(csv);

  assert.equal(parsed.operators.length, 2);
  assert.equal(parsed.stations.length, 2);
  assert.equal(parsed.stations[0].code, 'EST-01');
  assert.equal(parsed.convertedSymbolsCount, 4);
  assert.equal(parsed.records[getCellKey(parsed.operators[0].id, parsed.stations[0].id)].level, 4);
  assert.equal(parsed.records[getCellKey(parsed.operators[0].id, parsed.stations[1].id)].level, 2);
  assert.equal(parsed.records[getCellKey(parsed.operators[1].id, parsed.stations[0].id)].level, 1);
  assert.equal(parsed.records[getCellKey(parsed.operators[1].id, parsed.stations[1].id)].level, 0);
});

test('generateInteractiveHtmlTable generates bars or icons without drawn Harvey circles', () => {
  const records = createSeedRecords();
  const barsHtml = generateInteractiveHtmlTable(SEED_OPERATORS, SEED_STATIONS, records, 'bars');
  assert.match(barsHtml, /class="bar-track"/);
  assert.match(barsHtml, /Carlos Mendoza/);
  assert.doesNotMatch(barsHtml, /[○◔◑◕●]/);

  const iconsHtml = generateInteractiveHtmlTable(SEED_OPERATORS, SEED_STATIONS, records, 'icons');
  assert.match(iconsHtml, /class="icon-wrap"/);
  assert.match(iconsHtml, /<svg/);
  assert.doesNotMatch(iconsHtml, /[○◔◑◕●]/);
});

test('getPolyvalenceTier assigns expected label for each threshold', () => {
  assert.equal(getPolyvalenceTier(100).label, 'Experto');
  assert.equal(getPolyvalenceTier(80).label, 'Experto');
  assert.equal(getPolyvalenceTier(66).label, 'Competente');
  assert.equal(getPolyvalenceTier(44).label, 'En capacitación');
  assert.equal(getPolyvalenceTier(25).label, 'Inicial');
});

test('getTrainingPlanItems prioritizes largest gaps on operator assigned line', () => {
  const records = createSeedRecords();
  const items = getTrainingPlanItems(SEED_OPERATORS, SEED_STATIONS, records, 4);
  assert.equal(items.length, 4);
  assert.ok(items.every((item) => item.currentLevel < item.targetLevel));
  assert.ok(items[0].currentLevel <= items[items.length - 1].currentLevel);
});

test('mergeExtractedMatrixIntoCurrent appends new operators and stations while updating changed cells in merge_all mode', () => {
  const records = createSeedRecords();
  const merged = mergeExtractedMatrixIntoCurrent({
    currentOperators: SEED_OPERATORS,
    currentStations: SEED_STATIONS,
    currentRecordsMap: records,
    extracted: {
      operators: ['Carlos Mendoza', 'Laura Domínguez'],
      stations: ['EST-01 Pre-ensamble Subchasis', 'Calibración Láser'],
      levels: [
        [4, 3], // Carlos Mendoza updated on EST-01 (from 2 -> 4) + new station level 3
        [3, 4], // Laura Domínguez is brand new operator
      ],
    },
    mode: 'merge_all',
    auditor: 'Ing. Ana Torres',
    sourceLabel: 'Formato turno A',
    attachmentId: 'att-123',
    attachmentName: 'hoja_firmada.jpg',
  });

  assert.equal(merged.operators.length, SEED_OPERATORS.length + 1);
  assert.equal(merged.stations.length, SEED_STATIONS.length + 1);
  assert.equal(merged.stats.newOperatorsCount, 1);
  assert.equal(merged.stats.newStationsCount, 1);

  const carlosEst01 = merged.recordsMap[getCellKey('op-101', 'est-01')];
  assert.equal(carlosEst01.level, 4);

  const laura = merged.operators.find((o) => o.name === 'Laura Domínguez')!;
  const newStation = merged.stations.find((s) => s.name === 'Calibración Láser')!;
  assert.equal(merged.recordsMap[getCellKey(laura.id, 'est-01')].level, 3);
  assert.equal(merged.recordsMap[getCellKey(laura.id, newStation.id)].level, 4);
  assert.ok(merged.addedAuditLogs.length >= 3);
  assert.equal(merged.addedAuditLogs[0].attachmentName, 'hoja_firmada.jpg');
});

test('mergeExtractedMatrixIntoCurrent preserves existing non-zero certifications in append_only mode', () => {
  const records = createSeedRecords();
  const initialLevel = records[getCellKey('op-101', 'est-01')].level; // 2
  const merged = mergeExtractedMatrixIntoCurrent({
    currentOperators: SEED_OPERATORS,
    currentStations: SEED_STATIONS,
    currentRecordsMap: records,
    extracted: {
      operators: ['Carlos Mendoza', 'Nuevo Operador'],
      stations: ['EST-01 Pre-ensamble Subchasis'],
      levels: [[4], [3]],
    },
    mode: 'append_only',
    auditor: 'Supervisor',
    sourceLabel: 'Formato físico',
  });

  // Carlos already had level 2 on EST-01 -> preserved in append_only mode
  assert.equal(merged.recordsMap[getCellKey('op-101', 'est-01')].level, initialLevel);
  // New operator added with level 3
  assert.equal(merged.stats.newOperatorsCount, 1);
  const newOp = merged.operators.find((o) => o.name === 'Nuevo Operador')!;
  assert.equal(merged.recordsMap[getCellKey(newOp.id, 'est-01')].level, 3);
});

test('generatePrintablePhysicalFormatHtml includes metadata, stations, and print controls', () => {
  const html = generatePrintablePhysicalFormatHtml(SEED_STATIONS, {
    ...DEFAULT_MATRIX_METADATA,
    area: 'Línea Automotriz B',
    responsible: 'Ing. Roberto Gil',
  });
  assert.match(html, /Línea Automotriz B/);
  assert.match(html, /Ing\. Roberto Gil/);
  assert.match(html, /Pre-ensamble Subchasis/);
  assert.match(html, /window\.print\(\)/);
});
