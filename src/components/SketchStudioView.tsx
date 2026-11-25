import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Code2,
  Columns2,
  Copy,
  Database,
  Download,
  Eye,
  FileImage,
  Loader2,
  Maximize2,
  Monitor,
  ScanSearch,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CapturedInterfaceItem,
  CaptureStatus,
  CompetencyRecord,
  Operator,
  Workstation,
} from '../types/skillsMatrix';
import {
  buildPreviewDocument,
  convertExtractedMatrixToDomain,
  DEFAULT_SKETCH_SYSTEM_INSTRUCTION,
  renderSampleWireframeDataUrl,
} from '../utils/sketchHelpers';

interface SketchStudioViewProps {
  onIntegrateMatrix: (payload: {
    operators: Operator[];
    stations: Workstation[];
    records: Record<string, CompetencyRecord>;
    sourceTitle: string;
  }) => void;
  onOpenDynamicView?: (capture: CapturedInterfaceItem) => void;
}

type PreviewTab = 'split' | 'render' | 'html' | 'elements';
type ViewportSize = 'desktop' | 'mobile';

async function fileToOptimizedDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer la imagen seleccionada.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });

  if (file.size <= 2.5 * 1024 * 1024) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1800;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export const SketchStudioView: React.FC<SketchStudioViewProps> = ({
  onIntegrateMatrix,
  onOpenDynamicView,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageLabel, setImageLabel] = useState<string>('Ninguna imagen cargada');
  const [systemInstruction, setSystemInstruction] = useState<string>(
    DEFAULT_SKETCH_SYSTEM_INSTRUCTION
  );
  const [focusMode, setFocusMode] = useState<'auto' | 'table' | 'form'>('auto');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  const [captures, setCaptures] = useState<CapturedInterfaceItem[]>([]);
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(true);
  const [activeCaptureId, setActiveCaptureId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('split');
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [editableHtml, setEditableHtml] = useState<string>('');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [dbFeedback, setDbFeedback] = useState('');

  const activeCapture = useMemo(
    () => captures.find((c) => c.id === activeCaptureId) ?? captures[0] ?? null,
    [captures, activeCaptureId]
  );

  useEffect(() => {
    if (activeCapture) {
      setEditableHtml(activeCapture.generatedHtml);
    } else {
      setEditableHtml('');
    }
  }, [activeCapture?.id]);

  const fetchCaptures = async () => {
    setIsLoadingCaptures(true);
    try {
      const res = await fetch('/api/captures');
      if (!res.ok) {
        throw new Error('No se pudieron consultar las capturas guardadas.');
      }
      const data = (await res.json()) as { captures: CapturedInterfaceItem[] };
      setCaptures(data.captures);
      if (data.captures.length > 0 && !activeCaptureId) {
        setActiveCaptureId(data.captures[0].id);
      }
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Error al cargar la base de datos.'
      );
    } finally {
      setIsLoadingCaptures(false);
    }
  };

  useEffect(() => {
    void fetchCaptures();
  }, []);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAnalysisError('Selecciona un archivo de imagen válido (PNG, JPG, WEBP o GIF).');
      return;
    }
    try {
      const optimized = await fileToOptimizedDataUrl(file);
      setImageDataUrl(optimized);
      setImageLabel(file.name || 'imagen_portapapeles.png');
      setAnalysisError('');
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'No se pudo procesar la imagen seleccionada.'
      );
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imgItem = items.find((item) => item.type.startsWith('image/'));
    if (imgItem) {
      const file = imgItem.getAsFile();
      if (file) {
        void handleFileChange(file);
      }
    }
  };

  const handleLoadSampleWireframe = (kind: 'matrix_table' | 'audit_form') => {
    const dataUrl = renderSampleWireframeDataUrl(kind);
    setImageDataUrl(dataUrl);
    setImageLabel(
      kind === 'matrix_table'
        ? 'boceto_matriz_circulos.png'
        : 'wireframe_formulario_auditoria.png'
    );
    setFocusMode(kind === 'matrix_table' ? 'table' : 'form');
    setAnalysisError('');
  };

  const handleAnalyzeWithGemini = async () => {
    if (!imageDataUrl) {
      setAnalysisError(
        'Carga primero una imagen de boceto o documento, o selecciona uno de los bocetos de prueba.'
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');
    setDbFeedback('');

    try {
      const response = await fetch('/api/ai/analyze-sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          systemInstruction,
          focusMode,
        }),
      });

      const payload = (await response.json()) as {
        capture?: CapturedInterfaceItem;
        error?: string;
      };

      if (!response.ok || !payload.capture) {
        throw new Error(
          payload.error || 'Error al analizar la imagen en el servidor.'
        );
      }

      const saved = payload.capture;
      setCaptures((prev) => [saved, ...prev]);
      setActiveCaptureId(saved.id);
      setEditableHtml(saved.generatedHtml);
      setPreviewTab('split');
      setDbFeedback(
        `Estructura HTML generada por Gemini y guardada en SQLite como "${saved.title}".`
      );
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Fallo al comunicarse con Gemini.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateCapture = async (
    id: string,
    updates: Partial<Pick<CapturedInterfaceItem, 'status' | 'generatedHtml' | 'title'>>
  ) => {
    try {
      const res = await fetch(`/api/captures/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = (await res.json()) as {
        capture?: CapturedInterfaceItem;
        error?: string;
      };
      if (!res.ok || !data.capture) {
        throw new Error(data.error || 'No se pudo actualizar el registro.');
      }
      setCaptures((prev) =>
        prev.map((item) => (item.id === id ? data.capture! : item))
      );
      setDbFeedback('Cambios guardados en la base de datos.');
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Error al actualizar registro.'
      );
    }
  };

  const handleDeleteCapture = async (id: string) => {
    try {
      const res = await fetch(`/api/captures/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('No se pudo eliminar la captura.');
      }
      setCaptures((prev) => {
        const remaining = prev.filter((item) => item.id !== id);
        if (activeCaptureId === id) {
          setActiveCaptureId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
      setDbFeedback('Registro eliminado de la base de datos.');
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Error al eliminar registro.'
      );
    }
  };

  const handleIntegrateIntoMatrix = async (capture: CapturedInterfaceItem) => {
    if (!capture.parsedMatrix) return;
    try {
      const converted = convertExtractedMatrixToDomain(
        capture.parsedMatrix,
        capture.title
      );
      await handleUpdateCapture(capture.id, { status: 'Integrado' });
      onIntegrateMatrix({
        ...converted,
        sourceTitle: capture.title,
      });
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'No se pudo integrar la matriz.'
      );
    }
  };

  const handleCopyHtml = async () => {
    if (!editableHtml) return;
    try {
      await navigator.clipboard.writeText(editableHtml);
      setCopiedHtml(true);
      window.setTimeout(() => setCopiedHtml(false), 2000);
    } catch {
      setCopiedHtml(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!activeCapture) return;
    const fullDoc = buildPreviewDocument(editableHtml);
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSlug = activeCapture.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'estructura-web';
    link.href = url;
    link.download = `${safeSlug}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const previewSrcDoc = useMemo(
    () => buildPreviewDocument(editableHtml),
    [editableHtml]
  );

  const codeStats = useMemo(() => {
    const lines = editableHtml ? editableHtml.split('\n').length : 0;
    return { lines, chars: editableHtml.length };
  }, [editableHtml]);

  const renderCodePanel = (compactHeight: boolean) => (
    <div className="p-4 space-y-3 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Vista previa de código HTML/Tailwind</span>
          <span className="font-mono tabular-nums text-[11px] text-slate-400">
            ({codeStats.lines} líneas · {codeStats.chars} car.)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyHtml}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            {copiedHtml ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                Copiar código
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Descargar .html
          </button>
          <button
            type="button"
            onClick={() =>
              activeCapture &&
              handleUpdateCapture(activeCapture.id, {
                generatedHtml: editableHtml,
              })
            }
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
          >
            Guardar edición en BD
          </button>
        </div>
      </div>
      <textarea
        value={editableHtml}
        onChange={(e) => setEditableHtml(e.target.value)}
        rows={compactHeight ? 11 : 18}
        aria-label="Código HTML y Tailwind generado"
        data-testid="generated-html-preview"
        className="w-full p-3.5 text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
      />
    </div>
  );

  const renderDynamicPreviewFrame = (heightClass: string) => (
    <div className="bg-slate-100 p-3 flex flex-col items-center">
      <div
        className={`w-full transition-all duration-200 bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm ${
          viewportSize === 'mobile' ? 'max-w-[390px]' : 'max-w-full'
        }`}
      >
        <iframe
          title={`Renderizado dinámico de ${activeCapture?.title ?? 'estructura'}`}
          srcDoc={previewSrcDoc}
          data-testid="dynamic-render-iframe"
          className={`w-full ${heightClass} border-0 bg-slate-50`}
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      {/* Top 2-Column Multimodal Studio */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column: Image Upload + System Instruction + Stress Mode */}
        <section
          aria-label="Carga de boceto y configuración multimodal"
          className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Carga de boceto o documento e IA multimodal
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sube o pega una imagen de un boceto o documento para enviarla a Gemini, generar su estructura HTML/Tailwind, guardarla en SQLite y renderizarla dinámicamente.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="sketch-file-input"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFileChange(e.dataTransfer.files?.[0]);
              }}
              className="flex flex-col items-center justify-center gap-2 p-5 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100/70 hover:border-blue-500 cursor-pointer transition-colors text-center"
            >
              <Upload className="w-5 h-5 text-slate-500" aria-hidden="true" />
              <div className="text-xs font-semibold text-slate-800">
                Haz clic, arrastra o pega (Ctrl+V) un boceto o documento (PNG, JPG, WEBP)
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate max-w-full">
                {imageLabel}
              </div>
              <input
                id="sketch-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => void handleFileChange(e.target.files?.[0])}
                className="sr-only"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleLoadSampleWireframe('matrix_table')}
                data-testid="load-sample-matrix-sketch"
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Prueba: Boceto tabla con círculos
              </button>
              <button
                type="button"
                onClick={() => handleLoadSampleWireframe('audit_form')}
                data-testid="load-sample-form-sketch"
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Prueba: Wireframe formulario
              </button>
            </div>
          </div>

          {imageDataUrl && (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                <span>Imagen cargada: {imageLabel}</span>
                <button
                  type="button"
                  onClick={() => {
                    setImageDataUrl('');
                    setImageLabel('Ninguna imagen cargada');
                  }}
                  className="text-slate-500 hover:text-red-700 font-medium"
                >
                  Quitar
                </button>
              </div>
              <img
                src={imageDataUrl}
                alt={`Vista previa de ${imageLabel}`}
                className="w-full max-h-56 object-contain bg-white"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="system-instruction-input"
                className="text-xs font-semibold text-slate-800"
              >
                System Instructions (Gemini)
              </label>
              <button
                type="button"
                onClick={() => setSystemInstruction(DEFAULT_SKETCH_SYSTEM_INSTRUCTION)}
                className="text-[11px] font-medium text-blue-700 hover:underline"
              >
                Restaurar base
              </button>
            </div>
            <textarea
              id="system-instruction-input"
              rows={4}
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-800 mb-1.5">
              Enfoque de análisis estructural
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: 'auto', label: 'Automático' },
                { id: 'table', label: 'Tabla / Matriz' },
                { id: 'form', label: 'Formulario' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFocusMode(opt.id as 'auto' | 'table' | 'form')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    focusMode === opt.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {analysisError && (
            <div
              role="alert"
              className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
            >
              {analysisError}
            </div>
          )}

          {dbFeedback && (
            <div
              role="status"
              className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5"
            >
              {dbFeedback}
            </div>
          )}

          <button
            type="button"
            disabled={isAnalyzing}
            onClick={handleAnalyzeWithGemini}
            data-testid="analyze-sketch-button"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Analizando imagen con Gemini...
              </>
            ) : (
              <>
                <ScanSearch className="w-4 h-4" aria-hidden="true" />
                Analizar imagen con Gemini y guardar
              </>
            )}
          </button>
        </section>

        {/* Right Column: Dynamic Render + Code Preview + Elements */}
        <section
          aria-label="Vista previa del código y renderizado dinámico"
          className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden"
        >
          {!activeCapture ? (
            <div className="p-12 text-center space-y-2">
              <FileImage className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-900">
                Aún no hay una estructura seleccionada
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Carga un boceto o documento en el panel izquierdo para que Gemini genere el código HTML, lo guarde en la base de datos y lo renderice dinámicamente aquí.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-blue-700 uppercase">
                      {activeCapture.detectedType.replace('_', ' ')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Estado: {activeCapture.status}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {activeCapture.detectedElements.length} componentes
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5 truncate">
                    {activeCapture.title}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeCapture.parsedMatrix && (
                    <button
                      type="button"
                      onClick={() => handleIntegrateIntoMatrix(activeCapture)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
                    >
                      Integrar en Matriz
                    </button>
                  )}

                  {onOpenDynamicView && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDynamicView({
                          ...activeCapture,
                          generatedHtml: editableHtml,
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                      Vista principal
                    </button>
                  )}

                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('split')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        previewTab === 'split'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Dividida
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('render')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        previewTab === 'render'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      Render
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('html')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        previewTab === 'html'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Código HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('elements')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        previewTab === 'elements'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Elementos ({activeCapture.detectedElements.length})
                    </button>
                  </div>
                </div>
              </div>

              {(previewTab === 'split' || previewTab === 'render') && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-600">
                    Renderizado dinámico en vivo
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5 p-0.5 bg-slate-200/70 rounded-md">
                      <button
                        type="button"
                        onClick={() => setViewportSize('desktop')}
                        aria-label="Vista escritorio"
                        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                          viewportSize === 'desktop'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Monitor className="w-3 h-3" aria-hidden="true" />
                        Escritorio
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewportSize('mobile')}
                        aria-label="Vista móvil"
                        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                          viewportSize === 'mobile'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Smartphone className="w-3 h-3" aria-hidden="true" />
                        Móvil
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFullscreenOpen(true)}
                      aria-label="Ampliar renderizado dinámico"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                    >
                      <Maximize2 className="w-3 h-3" aria-hidden="true" />
                      Ampliar
                    </button>
                  </div>
                </div>
              )}

              {previewTab === 'split' && (
                <div className="flex flex-col divide-y divide-slate-200">
                  {renderDynamicPreviewFrame('h-[320px]')}
                  {renderCodePanel(true)}
                  <div className="px-5 py-3 bg-slate-50 text-xs text-slate-600">
                    <strong className="text-slate-900">Evaluación de precisión:</strong>{' '}
                    {activeCapture.stressTestNotes}
                  </div>
                </div>
              )}

              {previewTab === 'render' && (
                <div className="flex flex-col">
                  {renderDynamicPreviewFrame('h-[480px]')}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                    <strong className="text-slate-900">Evaluación de precisión:</strong>{' '}
                    {activeCapture.stressTestNotes}
                  </div>
                </div>
              )}

              {previewTab === 'html' && renderCodePanel(false)}

              {previewTab === 'elements' && (
                <div className="p-5 space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeCapture.summary}
                  </p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                          <th scope="col" className="px-3.5 py-2.5">Categoría</th>
                          <th scope="col" className="px-3.5 py-2.5">Elemento identificado</th>
                          <th scope="col" className="px-3.5 py-2.5 text-right">Cantidad</th>
                          <th scope="col" className="px-3.5 py-2.5">Certeza</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activeCapture.detectedElements.map((el, idx) => (
                          <tr key={`${el.category}-${idx}`}>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                              {el.category}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">{el.label}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                              {el.count}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-slate-700">
                              {el.confidence}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Saved Captures Database Manager */}
      <section
        aria-label="Base de datos de interfaces generadas"
        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">
              Repositorio persistente en base de datos ({captures.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            SQLite · Estructuras HTML generadas y listas para renderizar
          </span>
        </div>

        {isLoadingCaptures ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Cargando registros desde la base de datos...
          </div>
        ) : captures.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No existen estructuras guardadas todavía. Analiza una imagen arriba para crear el primer registro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" data-testid="captures-db-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th scope="col" className="px-4 py-3">Boceto</th>
                  <th scope="col" className="px-4 py-3">Título y clasificación</th>
                  <th scope="col" className="px-4 py-3">Componentes</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {captures.map((cap) => (
                  <tr
                    key={cap.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      activeCapture?.id === cap.id ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <img
                        src={cap.imagePreview}
                        alt={`Miniatura de ${cap.title}`}
                        className="w-16 h-11 object-cover rounded border border-slate-200 bg-white"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{cap.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Tipo: {cap.detectedType.replace('_', ' ')} · Modo: {cap.focusMode}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-700">
                      {cap.detectedElements.length} detectados
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={cap.status}
                        aria-label={`Estado de ${cap.title}`}
                        onChange={(e) =>
                          handleUpdateCapture(cap.id, {
                            status: e.target.value as CaptureStatus,
                          })
                        }
                        className="px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="Borrador">Borrador</option>
                        <option value="Integrado">Integrado</option>
                        <option value="Archivado">Archivado</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {new Date(cap.createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCaptureId(cap.id);
                            setEditableHtml(cap.generatedHtml);
                            setPreviewTab('split');
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          Renderizar
                        </button>
                        {onOpenDynamicView && (
                          <button
                            type="button"
                            onClick={() => onOpenDynamicView(cap)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                          >
                            Vista completa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCapture(cap.id)}
                          aria-label={`Eliminar ${cap.title}`}
                          className="p-1.5 text-slate-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Fullscreen Dynamic Render Modal */}
      {fullscreenOpen && activeCapture && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vista ampliada de ${activeCapture.title}`}
          className="fixed inset-0 z-50 bg-slate-900/60 p-4 sm:p-6 flex items-center justify-center"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {activeCapture.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Renderizado dinámico aislado desde SQLite
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFullscreenOpen(false)}
                aria-label="Cerrar vista ampliada"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              title={`Renderizado ampliado de ${activeCapture.title}`}
              srcDoc={previewSrcDoc}
              className="w-full flex-1 border-0 bg-slate-50"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      )}
    </div>
  );
};
