import { GoogleGenAI, Type } from '@google/genai';
import type { DetectedUiElement, ExtractedMatrixData } from './database.ts';
import {
  extractJsonFromModelText,
  normalizeExtractedMatrix,
  sanitizeGeneratedHtml,
} from '../utils/sketchHelpers.ts';

export interface AnalyzeSketchInput {
  imageBase64: string;
  mimeType: string;
  systemInstruction: string;
  focusMode: 'auto' | 'table' | 'form';
}

export interface AnalyzeSketchOutput {
  title: string;
  detectedType: string;
  detectedElements: DetectedUiElement[];
  summary: string;
  stressTestNotes: string;
  generatedHtml: string;
  parsedMatrix: ExtractedMatrixData | null;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY no está configurada en el entorno del servidor. Configúrala en el panel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function analyzeSketchWithGemini(
  input: AnalyzeSketchInput
): Promise<AnalyzeSketchOutput> {
  const ai = getGeminiClient();

  const focusDirective =
    input.focusMode === 'table'
      ? 'Modo de prueba de estrés: Evalúa rigurosamente si la estructura es una tabla de datos o matriz de doble entrada frente a un formulario.'
      : input.focusMode === 'form'
        ? 'Modo de prueba de estrés: Evalúa rigurosamente si la estructura es un formulario de captura con campos e inputs frente a una tabla.'
        : 'Clasifica con precisión si la imagen corresponde principalmente a una tabla, un formulario, una matriz de polivalencia, una barra de navegación o un diseño mixto.';

  const userPrompt = `Analiza la imagen adjunta de un boceto, wireframe o tabla impresa/manuscrita.
${focusDirective}

Requisitos de salida:
1. Identifica todos los elementos web presentes (formularios, inputs, selectores, tablas, encabezados de columna, barras de navegación, botones, tarjetas o indicadores).
2. Genera código HTML5 semántico con clases de Tailwind CSS responsivo y limpio, listo para renderizarse dinámicamente.
3. Si la imagen es una Matriz de Habilidades y Polivalencia (doble entrada con círculos dibujados ○ ◔ ◑ ◕ ●, X o números), reemplaza los círculos en el HTML generado por barras de progreso dinámicas (0%, 25%, 50%, 75%, 100%) y completa además el objeto parsedMatrix con operators, stations y levels (enteros del 0 al 4). Si NO es una matriz de habilidades, deja parsedMatrix con arreglos vacíos.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.imageBase64,
            },
          },
          {
            text: userPrompt,
          },
        ],
      },
      config: {
        systemInstruction: input.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Título descriptivo breve de la interfaz o tabla detectada.',
            },
            detectedType: {
              type: Type.STRING,
              description:
                'Clasificación principal: tabla, formulario, matriz_polivalencia, navegacion o mixto.',
            },
            detectedElements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description:
                      'Categoría del componente: Tabla, Formulario, Barra de navegación, Botón, Input, Indicador.',
                  },
                  label: {
                    type: Type.STRING,
                    description: 'Descripción concreta del elemento encontrado en el boceto.',
                  },
                  count: {
                    type: Type.INTEGER,
                    description: 'Cantidad aproximada de instancias detectadas.',
                  },
                  confidence: {
                    type: Type.STRING,
                    description: 'Nivel de certeza: Alta, Media o Baja.',
                  },
                },
                required: ['category', 'label', 'count', 'confidence'],
              },
            },
            summary: {
              type: Type.STRING,
              description: 'Resumen técnico en español de la arquitectura identificada.',
            },
            stressTestNotes: {
              type: Type.STRING,
              description:
                'Análisis de precisión: justificación de por qué se clasificó como tabla frente a formulario u otros patrones.',
            },
            generatedHtml: {
              type: Type.STRING,
              description:
                'Código HTML completo del componente o sección usando clases de Tailwind CSS (sin etiquetas <html> ni <head>, listo para incrustar).',
            },
            parsedMatrix: {
              type: Type.OBJECT,
              properties: {
                operators: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                stations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                levels: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                  },
                },
              },
              required: ['operators', 'stations', 'levels'],
            },
          },
          required: [
            'title',
            'detectedType',
            'detectedElements',
            'summary',
            'stressTestNotes',
            'generatedHtml',
            'parsedMatrix',
          ],
        },
      },
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('free tier')) {
      throw new Error(
        'La API de Gemini devolvió 403 (acceso/facturación requerida en este proyecto). Verifica tu clave API y facturación en el panel Settings > Secrets.'
      );
    }
    if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        'Cuota de la API de Gemini excedida (429). Verifica tu cuota o plan en Settings > Secrets.'
      );
    }
    if (rawMsg.includes('404') || rawMsg.includes('NOT_FOUND')) {
      throw new Error(
        'El modelo de Gemini solicitado no está disponible (404). Verifica la configuración del modelo en el servidor.'
      );
    }
    if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('400')) {
      throw new Error(
        'La clave GEMINI_API_KEY es inválida o la solicitud no es válida. Revisa tu configuración en Settings > Secrets.'
      );
    }
    throw new Error(`Error al invocar Gemini: ${rawMsg}`);
  }

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Gemini devolvió una respuesta vacía al analizar la imagen.');
  }

  let parsed: AnalyzeSketchOutput;
  try {
    parsed = JSON.parse(extractJsonFromModelText(rawText)) as AnalyzeSketchOutput;
  } catch {
    throw new Error(
      'La respuesta de Gemini no tuvo formato JSON válido. Intenta analizar nuevamente la imagen.'
    );
  }

  const cleanedHtml = sanitizeGeneratedHtml(parsed.generatedHtml ?? '');
  const normalizedMatrix = normalizeExtractedMatrix(parsed.parsedMatrix);

  return {
    title: (parsed.title ?? '').trim() || 'Estructura web generada',
    detectedType: (parsed.detectedType ?? '').trim() || 'mixto',
    detectedElements: Array.isArray(parsed.detectedElements) ? parsed.detectedElements : [],
    summary: (parsed.summary ?? '').trim() || 'Estructura analizada mediante Gemini.',
    stressTestNotes:
      (parsed.stressTestNotes ?? '').trim() || 'Clasificación estructural generada por Gemini.',
    generatedHtml: cleanedHtml,
    parsedMatrix: normalizedMatrix,
  };
}
