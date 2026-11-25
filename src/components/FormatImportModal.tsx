import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Printer,
  ScanSearch,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CompetencyLevel,
  FormatExtractionResult,
  MatrixMetadata,
  MergeFormatMode,
  Operator,
  PhysicalFormatAttachment,
  PRODUCTION_LINES,
  ProductionLine,
  SHIFTS,
  ShiftType,
  Workstation,
} from '../types/skillsMatrix';
import {
  generatePrintablePhysicalFormatHtml,
  parseDoubleEntryMatrix,
} from '../utils/matrixLogic';
import { LevelIconSvg } from './LevelIndicator';

interface FormatImportModalProps {
  open: boolean;
  initialTab?: 'attach' | 'manual' | 'history';
  operators: Operator[];
  stations: Workstation[];
  metadata: MatrixMetadata;
  attachments: PhysicalFormatAttachment[];
  onClose: () => void;
  onAttachmentCreated: (attachment: PhysicalFormatAttachment) => void;
  onAttachmentDeleted: (id: string) => void;
  onMergeFormatData: (payload: {
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
    newOperatorsCount: number;
    newStationsCount: number;
    updatedCellsCount: number;
  };
}

interface DraftOperatorRow {
  id: string;
  name: string;
  shift: ShiftType;
  line: ProductionLine;
  levels: CompetencyLevel[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function readFileAsOptimizedDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer el archivo seleccionado.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo adjunto.'));
    reader.readAsDataURL(file);
  });

  if (!file.type.startsWith('image/') || file.size <= 2.5 * 1024 * 1024) {
    return raw;
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
        resolve(raw);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(raw);
    img.src = raw;
  });
}

export const FormatImportModal: React.FC<FormatImportModalProps> = ({
  open,
  initialTab = 'attach',
  operators,
  stations,
  metadata,
  attachments,
  onClose,
  onAttachmentCreated,
  onAttachmentDeleted,
  onMergeFormatData,
}) => {
  const [activeTab, setActiveTab] = useState<'attach' | 'manual' | 'history'>(initialTab);

  // Physical attachment draft state
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingMimeType, setPendingMimeType] = useState('');
  const [pendingFileSize, setPendingFileSize] = useState(0);
  const [pendingDataUrl, setPendingDataUrl] = useState('');
  const [pendingNotes, setPendingNotes] = useState('');
  const [linkedAttachment, setLinkedAttachment] = useState<PhysicalFormatAttachment | null>(null);

  // Extraction & error feedback
  const [isSavingAttachment, setIsSavingAttachment] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<PhysicalFormatAttachment | null>(null);

  // Editable format grid state (used for both AI extraction review and manual format entry)
  const [draftMetadata, setDraftMetadata] = useState<MatrixMetadata>(metadata);
  const [applyMetadataUpdate, setApplyMetadataUpdate] = useState(true);
  const [draftStations, setDraftStations] = useState<string[]>(() =>
    stations.map((s) => `${s.code} ${s.name}`)
  );
  const [newStationInput, setNewStationInput] = useState('');
  const [draftRows, setDraftRows] = useState<DraftOperatorRow[]>(() => [
    {
      id: 'row-1',
      name: '',
      shift: 'Turno A',
      line: PRODUCTION_LINES[0],
      levels: stations.map(() => 0),
    },
  ]);
  const [mergeMode, setMergeMode] = useState<MergeFormatMode>('merge_all');
  const [showCsvPaste, setShowCsvPaste] = useState(false);
  const [csvPasteText, setCsvPasteText] = useState('');

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setDraftMetadata(metadata);
      setErrorMsg('');
      setStatusMsg('');
      if (draftStations.length === 0 && stations.length > 0) {
        const stLabels = stations.map((s) => `${s.code} ${s.name}`);
        setDraftStations(stLabels);
        setDraftRows([
          {
            id: `row-${Date.now()}`,
            name: '',
            shift: 'Turno A',
            line: PRODUCTION_LINES[0],
            levels: stLabels.map(() => 0),
          },
        ]);
      }
    }
  }, [open, initialTab]);

  if (!open) return null;

  const resetDraftGridToCurrentStations = () => {
    const stLabels = stations.map((s) => `${s.code} ${s.name}`);
    setDraftStations(stLabels);
    setDraftRows([
      {
        id: `row-${Date.now()}`,
        name: '',
        shift: 'Turno A',
        line: PRODUCTION_LINES[0],
        levels: stLabels.map(() => 0),
      },
    ]);
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    const isValid =
      file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isValid) {
      setErrorMsg('Adjunta un archivo de imagen (PNG, JPG, WEBP) o un documento PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('El archivo supera el límite de 10 MB.');
      return;
    }

    try {
      const dataUrl = await readFileAsOptimizedDataUrl(file);
      setPendingFileName(file.name || 'formato-fisico.png');
      setPendingMimeType(file.type || 'image/png');
      setPendingFileSize(file.size);
      setPendingDataUrl(dataUrl);
      setLinkedAttachment(null);
      setErrorMsg('');
      setStatusMsg('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cargar el archivo.');
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const fileItem = items.find(
      (item) => item.type.startsWith('image/') || item.type === 'application/pdf'
    );
    if (fileItem) {
      const file = fileItem.getAsFile();
      if (file) {
        void handleFileSelected(file);
      }
    }
  };

  const persistPendingAttachment = async (): Promise<PhysicalFormatAttachment | null> => {
    if (linkedAttachment) return linkedAttachment;
    if (!pendingDataUrl) return null;

    setIsSavingAttachment(true);
    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: pendingFileName || 'formato-fisico',
          mimeType: pendingMimeType,
          fileSize: pendingFileSize,
          dataUrl: pendingDataUrl,
          notes: pendingNotes,
        }),
      });
      const data = (await res.json()) as {
        attachment?: PhysicalFormatAttachment;
        error?: string;
      };
      if (!res.ok || !data.attachment) {
        throw new Error(data.error || 'No se pudo guardar el archivo adjunto en la base de datos.');
      }
      setLinkedAttachment(data.attachment);
      onAttachmentCreated(data.attachment);
      return data.attachment;
    } finally {
      setIsSavingAttachment(false);
    }
  };

  const handleSaveAttachmentOnly = async () => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      const saved = await persistPendingAttachment();
      if (!saved) {
        setErrorMsg('Selecciona primero un archivo de formato físico.');
        return;
      }
      setStatusMsg(
        `Formato físico "${saved.fileName}" guardado y vinculado. Completa los datos nuevos a continuación para agregarlos a la matriz.`
      );
      if (draftStations.length === 0) {
        resetDraftGridToCurrentStations();
      }
      setActiveTab('manual');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el adjunto.');
    }
  };

  const handleExtractWithGemini = async () => {
    if (!pendingDataUrl) {
      setErrorMsg('Adjunta primero una imagen o PDF del formato físico.');
      return;
    }
    setErrorMsg('');
    setStatusMsg('');
    setIsExtracting(true);

    try {
      const savedAttachment = await persistPendingAttachment();

      const res = await fetch('/api/ai/extract-format-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileDataUrl: pendingDataUrl,
          existingStations: stations.map((s) => `${s.code} ${s.name}`),
          existingOperators: operators.map((o) => `${o.code} ${o.name}`),
        }),
      });
      const payload = (await res.json()) as {
        extraction?: FormatExtractionResult;
        error?: string;
      };
      if (!res.ok || !payload.extraction) {
        throw new Error(
          payload.error || 'No se pudo extraer información del formato físico.'
        );
      }

      const ext = payload.extraction;
      if (ext.metadata) {
        setDraftMetadata((prev) => ({
          area: ext.metadata?.area || prev.area,
          date: ext.metadata?.date || prev.date,
          responsible: ext.metadata?.responsible || prev.responsible,
          objective: ext.metadata?.objective || prev.objective,
        }));
      }
      setDraftStations(ext.stations);
      setDraftRows(
        ext.operators.map((opName, rIdx) => ({
          id: `ext-${Date.now()}-${rIdx}`,
          name: opName,
          shift: 'Turno A',
          line: PRODUCTION_LINES[0],
          levels: ext.stations.map((_, cIdx) => {
            const val = Math.round(Number(ext.levels[rIdx]?.[cIdx] ?? 0));
            return Math.max(0, Math.min(4, val)) as CompetencyLevel;
          }),
        }))
      );
      setStatusMsg(
        `Formato "${savedAttachment?.fileName ?? pendingFileName}" analizado: ${ext.summary} Revisa o ajusta los valores antes de agregarlos.`
      );
      setActiveTab('manual');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar el formato.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownloadPrintableFormat = () => {
    const html = generatePrintablePhysicalFormatHtml(stations, draftMetadata);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'formato-fisico-matriz-polivalencia.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddStationColumn = () => {
    const clean = newStationInput.trim();
    if (!clean) return;
    setDraftStations((prev) => [...prev, clean]);
    setDraftRows((prev) =>
      prev.map((row) => ({ ...row, levels: [...row.levels, 0] }))
    );
    setNewStationInput('');
  };

  const handleAddDraftRow = () => {
    setDraftRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${prev.length}`,
        name: '',
        shift: 'Turno A',
        line: PRODUCTION_LINES[0],
        levels: draftStations.map(() => 0),
      },
    ]);
  };

  const handleCycleCellLevel = (rowId: string, colIdx: number) => {
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextLevels = [...row.levels];
        const curr = nextLevels[colIdx] ?? 0;
        nextLevels[colIdx] = ((curr + 1) % 5) as CompetencyLevel;
        return { ...row, levels: nextLevels };
      })
    );
  };

  const handleLoadFromCsvText = () => {
    try {
      setErrorMsg('');
      const parsed = parseDoubleEntryMatrix(csvPasteText);
      const stLabels = parsed.stations.map((s) => `${s.code} ${s.name}`);
      setDraftStations(stLabels);
      setDraftRows(
        parsed.operators.map((op, idx) => ({
          id: `csv-${Date.now()}-${idx}`,
          name: op.name,
          shift: op.shift,
          line: op.line,
          levels: parsed.stations.map((st) => {
            const rec = parsed.records[`${op.id}::${st.id}`];
            return rec ? rec.level : 0;
          }),
        }))
      );
      setShowCsvPaste(false);
      setStatusMsg(
        `Se cargaron ${parsed.operators.length} filas y ${parsed.stations.length} estaciones desde el texto.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al interpretar el texto.');
    }
  };

  const handleConfirmMerge = async () => {
    setErrorMsg('');
    const validRows = draftRows.filter((r) => r.name.trim().length > 0);
    if (validRows.length === 0) {
      setErrorMsg('Ingresa al menos el nombre de un trabajador nuevo o por actualizar.');
      return;
    }
    if (draftStations.length === 0) {
      setErrorMsg('Incluye al menos una estación en el formato.');
      return;
    }

    let attachmentToLink = linkedAttachment;
    if (!attachmentToLink && pendingDataUrl) {
      try {
        attachmentToLink = await persistPendingAttachment();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el archivo adjunto.');
        return;
      }
    }

    const result = onMergeFormatData({
      operators: validRows.map((r) => r.name.trim()),
      stations: draftStations,
      levels: validRows.map((r) => r.levels),
      operatorShifts: validRows.map((r) => r.shift),
      operatorLines: validRows.map((r) => r.line),
      mode: mergeMode,
      auditor: draftMetadata.responsible || 'Registro desde formato',
      sourceLabel: attachmentToLink
        ? `Formato físico (${attachmentToLink.fileName})`
        : 'Captura desde formato',
      updateMetadata: applyMetadataUpdate ? draftMetadata : undefined,
      attachment: attachmentToLink,
    });

    setStatusMsg(
      `Información agregada: ${result.newOperatorsCount} trabajador(es) nuevo(s), ${result.newStationsCount} estación(es) nueva(s) y ${result.updatedCellsCount} evaluaciones registradas.`
    );
    window.setTimeout(() => {
      onClose();
    }, 650);
  };

  const handleDeleteAttachment = async (id: string) => {
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar el archivo adjunto.');
      onAttachmentDeleted(id);
      if (linkedAttachment?.id === id) setLinkedAttachment(null);
      if (previewAttachment?.id === id) setPreviewAttachment(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar adjunto.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="format-import-title"
      onPaste={handlePaste}
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#0d2d5e] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h2 id="format-import-title" className="text-base font-bold">
              Agregar información a partir del formato
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Captura nuevos registros respetando la estructura de la matriz o adjunta el formato físico con información nueva.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPrintableFormat}
              data-testid="download-printable-format-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0d2d5e] bg-[#e6f0ff] rounded-lg hover:bg-white transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Descargar formato físico
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana de formato"
              className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('attach')}
            data-testid="tab-attach-physical"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'attach'
                ? 'bg-[#0d2d5e] text-white'
                : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
            Adjuntar formato físico
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            data-testid="tab-manual-format"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'manual'
                ? 'bg-[#0d2d5e] text-white'
                : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Agregar datos desde formato
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            data-testid="tab-attachments-history"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'history'
                ? 'bg-[#0d2d5e] text-white'
                : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
            Formatos adjuntos ({attachments.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div
              role="status"
              className="flex items-start gap-2 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{statusMsg}</span>
            </div>
          )}

          {activeTab === 'attach' && (
            <div className="space-y-4">
              <label
                htmlFor="physical-format-file"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleFileSelected(e.dataTransfer.files?.[0]);
                }}
                className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-[#93c5fd] rounded-xl bg-[#e6f0ff]/40 hover:bg-[#e6f0ff]/70 cursor-pointer transition-colors text-center"
              >
                <Upload className="w-6 h-6 text-[#0d2d5e]" aria-hidden="true" />
                <div className="text-sm font-semibold text-slate-900">
                  Adjunta el formato físico con información nueva (PNG, JPG, WEBP o PDF)
                </div>
                <p className="text-xs text-slate-600 max-w-lg">
                  Puedes subir una fotografía de la hoja impresa llenada a mano, un escaneo PDF o pegar una captura con Ctrl+V.
                </p>
                <input
                  id="physical-format-file"
                  data-testid="physical-format-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(e) => void handleFileSelected(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>

              {pendingDataUrl && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <Paperclip className="w-3.5 h-3.5 text-[#0d2d5e]" aria-hidden="true" />
                      <span>{pendingFileName}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        ({formatBytes(pendingFileSize)})
                      </span>
                      {linkedAttachment && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px]">
                          Guardado en BD
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDataUrl('');
                        setPendingFileName('');
                        setLinkedAttachment(null);
                      }}
                      className="text-slate-600 hover:text-red-700 font-medium"
                    >
                      Quitar archivo
                    </button>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="md:col-span-5 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center min-h-[160px]">
                      {pendingMimeType === 'application/pdf' ? (
                        <div className="text-center p-4 space-y-2">
                          <FileText className="w-10 h-10 text-red-600 mx-auto" aria-hidden="true" />
                          <div className="text-xs font-semibold text-slate-800">
                            Documento PDF adjunto
                          </div>
                          <div className="text-[11px] text-slate-500">{pendingFileName}</div>
                        </div>
                      ) : (
                        <img
                          src={pendingDataUrl}
                          alt={`Vista previa de ${pendingFileName}`}
                          className="max-h-52 w-full object-contain rounded"
                        />
                      )}
                    </div>

                    <div className="md:col-span-7 space-y-3">
                      <div>
                        <label
                          htmlFor="attachment-notes"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Notas del formato físico (turno, folio, supervisor)
                        </label>
                        <textarea
                          id="attachment-notes"
                          rows={2}
                          value={pendingNotes}
                          onChange={(e) => setPendingNotes(e.target.value)}
                          placeholder="Ej. Hoja firmada Turno A · Ingreso de 2 operadores nuevos y actualización de Torque"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={isExtracting || isSavingAttachment}
                          onClick={handleExtractWithGemini}
                          data-testid="extract-physical-format-ai-btn"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
                        >
                          {isExtracting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              Extrayendo con Gemini...
                            </>
                          ) : (
                            <>
                              <ScanSearch className="w-3.5 h-3.5" aria-hidden="true" />
                              Guardar adjunto y extraer con IA
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isSavingAttachment || isExtracting}
                          onClick={handleSaveAttachmentOnly}
                          data-testid="save-attachment-and-fill-btn"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0d2d5e] bg-[#e6f0ff] border border-[#93c5fd] rounded-lg hover:bg-blue-100 disabled:opacity-60 transition-colors"
                        >
                          {isSavingAttachment ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Adjuntar y capturar datos manuales
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-4">
              {/* Linked or inline physical backup bar */}
              <div className="bg-[#e6f0ff]/60 border border-[#93c5fd] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs">
                  <Paperclip className="w-4 h-4 text-[#0d2d5e] shrink-0" aria-hidden="true" />
                  {linkedAttachment || pendingDataUrl ? (
                    <span className="text-slate-800">
                      <strong className="text-[#0d2d5e]">Respaldo físico adjunto:</strong>{' '}
                      {linkedAttachment?.fileName ?? pendingFileName}{' '}
                      <span className="text-emerald-700 font-semibold">
                        ({linkedAttachment ? 'Guardado en BD' : 'Listo para guardar al agregar'})
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-700">
                      Opcional: adjunta el formato físico firmado junto con estos nuevos registros.
                    </span>
                  )}
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0d2d5e] bg-white border border-[#93c5fd] rounded-lg hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  {linkedAttachment || pendingDataUrl ? 'Cambiar archivo' : 'Adjuntar archivo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(e) => void handleFileSelected(e.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Context Metadata Section */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[#0d2d5e] uppercase tracking-wide">
                    Encabezado del formato (Área, Fecha, Responsable, Objetivo)
                  </h3>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={applyMetadataUpdate}
                      onChange={(e) => setApplyMetadataUpdate(e.target.checked)}
                      className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                    Actualizar encabezado de la matriz
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="fmt-area" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Área
                    </label>
                    <input
                      id="fmt-area"
                      type="text"
                      value={draftMetadata.area}
                      onChange={(e) =>
                        setDraftMetadata((p) => ({ ...p, area: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="fmt-responsible" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Responsable
                    </label>
                    <input
                      id="fmt-responsible"
                      type="text"
                      value={draftMetadata.responsible}
                      onChange={(e) =>
                        setDraftMetadata((p) => ({ ...p, responsible: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="fmt-date" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Fecha del formato
                    </label>
                    <input
                      id="fmt-date"
                      type="text"
                      value={draftMetadata.date}
                      onChange={(e) =>
                        setDraftMetadata((p) => ({ ...p, date: e.target.value }))
                      }
                      placeholder={new Date().toLocaleDateString('es-MX')}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="fmt-objective" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Objetivo
                    </label>
                    <input
                      id="fmt-objective"
                      type="text"
                      value={draftMetadata.objective}
                      onChange={(e) =>
                        setDraftMetadata((p) => ({ ...p, objective: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Format Table Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddDraftRow}
                    data-testid="add-format-row-btn"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0d2d5e] rounded-lg hover:bg-[#133b7a]"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Agregar fila de trabajador
                  </button>

                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newStationInput}
                      onChange={(e) => setNewStationInput(e.target.value)}
                      placeholder="Nueva estación (ej. EST-09 Pintura)"
                      aria-label="Nombre de nueva estación para el formato"
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 w-52"
                    />
                    <button
                      type="button"
                      onClick={handleAddStationColumn}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                    >
                      + Estación
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCsvPaste((v) => !v)}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  {showCsvPaste ? 'Ocultar pegado CSV' : 'Pegar tabla CSV / círculos'}
                </button>
              </div>

              {showCsvPaste && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <textarea
                    rows={4}
                    value={csvPasteText}
                    onChange={(e) => setCsvPasteText(e.target.value)}
                    placeholder={`Operador, EST-01 Pre-ensamble Subchasis, EST-02 Torque y Fijación Crítica\nLaura Domínguez, ●, ◕`}
                    className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleLoadFromCsvText}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                    >
                      Cargar filas en la vista previa
                    </button>
                  </div>
                </div>
              )}

              {/* Interactive Format Grid */}
              <div className="border-2 border-[#0d2d5e] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#0d2d5e] text-white">
                        <th className="px-2.5 py-2 border-r border-white/20 text-center w-9">No.</th>
                        <th className="px-3 py-2 border-r border-white/20 min-w-[180px]">
                          Trabajador (Nuevo o existente)
                        </th>
                        <th className="px-2 py-2 border-r border-white/20 min-w-[100px]">Turno</th>
                        {draftStations.map((st, idx) => (
                          <th
                            key={`${st}-${idx}`}
                            className="px-2 py-2 border-r border-white/20 text-center min-w-[92px]"
                          >
                            <div className="font-bold leading-tight">{st}</div>
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center w-10">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {draftRows.map((row, rIdx) => (
                        <tr key={row.id} className="bg-white">
                          <td className="px-2 py-2 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                            {rIdx + 1}
                          </td>
                          <td className="px-2 py-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) =>
                                setDraftRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id ? { ...r, name: e.target.value } : r
                                  )
                                )
                              }
                              placeholder="Nombre completo..."
                              data-testid={`format-row-name-${rIdx}`}
                              className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </td>
                          <td className="px-2 py-1.5 border-r border-slate-200">
                            <select
                              value={row.shift}
                              onChange={(e) =>
                                setDraftRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, shift: e.target.value as ShiftType }
                                      : r
                                  )
                                )
                              }
                              className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                            >
                              {SHIFTS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          {draftStations.map((_, colIdx) => {
                            const lvl = row.levels[colIdx] ?? 0;
                            return (
                              <td
                                key={colIdx}
                                className="p-1 border-r border-slate-200 text-center align-middle"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleCycleCellLevel(row.id, colIdx)}
                                  data-testid={`format-cell-${rIdx}-${colIdx}`}
                                  title="Clic para cambiar nivel (N0 a N4)"
                                  className="inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                                >
                                  <LevelIconSvg level={lvl} className="w-6 h-6" />
                                  <span className="font-mono text-[10px] font-bold text-slate-700">
                                    N{lvl}
                                  </span>
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              disabled={draftRows.length <= 1}
                              onClick={() =>
                                setDraftRows((prev) => prev.filter((r) => r.id !== row.id))
                              }
                              aria-label="Eliminar fila"
                              className="p-1 text-slate-400 hover:text-red-700 disabled:opacity-30"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Haz clic en los círculos de cada estación para alternar el nivel de competencia: N0 (0%) → N1 (25%) → N2 (50%) → N3 (75%) → N4 (100%).
              </p>

              {/* Merge mode selection */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                    <input
                      type="radio"
                      name="merge-mode"
                      checked={mergeMode === 'merge_all'}
                      onChange={() => setMergeMode('merge_all')}
                    />
                    Agregar nuevos y actualizar evaluaciones
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                    <input
                      type="radio"
                      name="merge-mode"
                      checked={mergeMode === 'append_only'}
                      onChange={() => setMergeMode('append_only')}
                    />
                    Solo agregar nuevos (sin sobrescribir existentes)
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {attachments.length === 0 ? (
                <div className="p-10 text-center border border-dashed border-slate-300 rounded-xl space-y-2">
                  <Paperclip className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-900">
                    Aún no hay formatos físicos adjuntos
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Sube la fotografía o PDF de un formato físico llenado en planta desde la pestaña «Adjuntar formato físico».
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      data-testid={`attachment-card-${att.id}`}
                      className="border border-slate-200 rounded-xl p-3 bg-white flex items-start gap-3"
                    >
                      <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {att.mimeType === 'application/pdf' ? (
                          <FileText className="w-7 h-7 text-red-600" aria-hidden="true" />
                        ) : (
                          <img
                            src={att.dataUrl}
                            alt={att.fileName}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="font-bold text-slate-900 truncate">{att.fileName}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                          {formatBytes(att.fileSize)} ·{' '}
                          {new Date(att.uploadedAt).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {att.notes && (
                          <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                            {att.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(att)}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkedAttachment(att);
                              setActiveTab('manual');
                            }}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 rounded hover:bg-emerald-100"
                          >
                            Agregar datos con este adjunto
                          </button>
                          <a
                            href={att.dataUrl}
                            download={att.fileName}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
                          >
                            <Download className="w-3 h-3" aria-hidden="true" />
                            Descargar
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            aria-label={`Eliminar ${att.fileName}`}
                            className="p-1 text-slate-400 hover:text-red-700 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {previewAttachment && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>Vista previa: {previewAttachment.fileName}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(null)}
                      className="text-slate-500 hover:text-slate-900"
                    >
                      Cerrar vista previa
                    </button>
                  </div>
                  <div className="p-3 bg-white">
                    {previewAttachment.mimeType === 'application/pdf' ? (
                      <iframe
                        title={previewAttachment.fileName}
                        src={previewAttachment.dataUrl}
                        className="w-full h-80 border border-slate-200 rounded"
                      />
                    ) : (
                      <img
                        src={previewAttachment.dataUrl}
                        alt={previewAttachment.fileName}
                        className="max-h-96 mx-auto object-contain rounded"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            Cerrar
          </button>
          {activeTab === 'manual' && (
            <button
              type="button"
              onClick={handleConfirmMerge}
              data-testid="confirm-merge-format-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Agregar información a la matriz
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
