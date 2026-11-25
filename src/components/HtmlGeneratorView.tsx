import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy, Download, FileSpreadsheet, FileText, RotateCcw } from 'lucide-react';
import {
  CompetencyRecord,
  IndicatorMode,
  Operator,
  Workstation,
} from '../types/skillsMatrix';
import {
  generateFrontendArchitecturePrompt,
  generateInteractiveHtmlTable,
  parseDoubleEntryMatrix,
} from '../utils/matrixLogic';
import { SAMPLE_CIRCLE_MATRIX_INPUT } from '../data/seedMatrix';

interface HtmlGeneratorViewProps {
  operators: Operator[];
  stations: Workstation[];
  recordsMap: Record<string, CompetencyRecord>;
  indicatorMode: IndicatorMode;
  onChangeIndicatorMode: (mode: IndicatorMode) => void;
  onApplyParsedMatrix: (parsed: {
    operators: Operator[];
    stations: Workstation[];
    records: Record<string, CompetencyRecord>;
    convertedSymbolsCount: number;
  }) => void;
  onResetToBaseline: () => void;
}

type GeneratorTab = 'html' | 'interpreter' | 'prompt';

export const HtmlGeneratorView: React.FC<HtmlGeneratorViewProps> = ({
  operators,
  stations,
  recordsMap,
  indicatorMode,
  onChangeIndicatorMode,
  onApplyParsedMatrix,
  onResetToBaseline,
}) => {
  const [activeTab, setActiveTab] = useState<GeneratorTab>('html');
  const [copiedKey, setCopiedKey] = useState<'html' | 'prompt' | null>(null);
  const [rawMatrixText, setRawMatrixText] = useState<string>(SAMPLE_CIRCLE_MATRIX_INPUT);
  const [parseError, setParseError] = useState<string>('');
  const [parseFeedback, setParseFeedback] = useState<string>('');

  const generatedHtml = useMemo(
    () => generateInteractiveHtmlTable(operators, stations, recordsMap, indicatorMode),
    [operators, stations, recordsMap, indicatorMode]
  );

  const promptBlueprint = useMemo(() => generateFrontendArchitecturePrompt(), []);

  const handleCopy = async (text: string, key: 'html' | 'prompt') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'matriz-habilidades-interactiva.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleInterpretMatrix = () => {
    try {
      setParseError('');
      const parsed = parseDoubleEntryMatrix(rawMatrixText);
      onApplyParsedMatrix(parsed);
      setParseFeedback(
        `Matriz interpretada: ${parsed.operators.length} operadores, ${parsed.stations.length} estaciones y ${parsed.convertedSymbolsCount} símbolos convertidos a indicadores dinámicos.`
      );
      setActiveTab('html');
    } catch (err) {
      setParseFeedback('');
      setParseError(err instanceof Error ? err.message : 'No se pudo interpretar el texto ingresado.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('html')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'html'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            Tabla HTML Interactiva
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('interpreter')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'interpreter'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            Interpretar Matriz (Círculos / CSV)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'prompt'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            Prompt de Arquitectura
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => onChangeIndicatorMode('bars')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                indicatorMode === 'bars'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Barras de progreso
            </button>
            <button
              type="button"
              onClick={() => onChangeIndicatorMode('icons')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                indicatorMode === 'icons'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Iconos de nivel
            </button>
          </div>
        </div>
      </div>

      {parseFeedback && (
        <div
          className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900"
          role="status"
        >
          <span>{parseFeedback}</span>
          <button
            type="button"
            onClick={() => {
              onResetToBaseline();
              setParseFeedback('');
            }}
            className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Restaurar matriz de planta
          </button>
        </div>
      )}

      {activeTab === 'html' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Vista previa en vivo (HTML autónomo)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reemplaza los círculos dibujados por {indicatorMode === 'bars' ? 'barras de estado' : 'iconos vectoriales de nivel'}.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {operators.length} × {stations.length}
              </span>
            </div>
            <iframe
              title="Vista previa de tabla HTML interactiva"
              srcDoc={generatedHtml}
              className="w-full h-[480px] bg-slate-50 border-0"
              sandbox="allow-scripts"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Código HTML5 + CSS + JS generado
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Listo para incrustar en portales internos o tableros de piso.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(generatedHtml, 'html')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  {copiedKey === 'html' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      Copiar HTML
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Descargar .html
                </button>
              </div>
            </div>
            <pre
              data-testid="generated-html-code"
              className="p-4 text-xs font-mono text-slate-800 bg-slate-50 overflow-auto h-[480px] leading-relaxed"
            >
              <code>{generatedHtml}</code>
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'interpreter' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Intérprete de matriz de doble entrada
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Pega una matriz en formato CSV o tabulado con círculos dibujados (
                <span className="font-mono">○ ◔ ◑ ◕ ●</span>), escala ILUO (
                <span className="font-mono">I L U O</span>) o niveles numéricos (
                <span className="font-mono">0–4</span>) para transformarla en indicadores visuales dinámicos y generar su HTML interactivo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRawMatrixText(SAMPLE_CIRCLE_MATRIX_INPUT)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              Cargar ejemplo con círculos
            </button>
          </div>

          <textarea
            value={rawMatrixText}
            onChange={(e) => setRawMatrixText(e.target.value)}
            rows={9}
            aria-label="Texto CSV de matriz de doble entrada"
            data-testid="matrix-interpreter-input"
            className="w-full p-3.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
          />

          {parseError && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {parseError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-500">
              Equivalencias admitidas: ○ / 0 (0%) · ◔ / I / 1 (25%) · ◑ / L / 2 (50%) · ◕ / U / 3 (75%) · ● / O / 4 (100%)
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onResetToBaseline}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Restaurar planta base
              </button>
              <button
                type="button"
                onClick={handleInterpretMatrix}
                data-testid="interpret-matrix-button"
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
              >
                Interpretar y convertir a barras dinámicas
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'prompt' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Prompt estructurado de arquitectura frontend
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Especificación técnica reutilizable para estructurar sitios web de Matriz de Habilidades y Polivalencia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(promptBlueprint, 'prompt')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              {copiedKey === 'prompt' ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  Prompt copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  Copiar prompt
                </>
              )}
            </button>
          </div>
          <pre className="p-6 text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50">
            {promptBlueprint}
          </pre>
        </div>
      )}
    </div>
  );
};
