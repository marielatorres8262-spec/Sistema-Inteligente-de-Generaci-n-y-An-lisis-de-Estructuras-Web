import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  createCapture,
  deleteCapture,
  getCaptureById,
  getMatrixState,
  listCaptures,
  MatrixStatePayload,
  saveMatrixState,
  updateCapture,
} from './src/server/database.ts';
import { analyzeSketchWithGemini } from './src/server/geminiSketchAnalyzer.ts';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/matrix', (_req, res) => {
    try {
      const state = getMatrixState();
      res.json(state);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al leer la matriz de la base de datos.',
      });
    }
  });

  app.put('/api/matrix', (req, res) => {
    try {
      const body = req.body as MatrixStatePayload;
      if (
        !body ||
        !Array.isArray(body.operators) ||
        !Array.isArray(body.stations) ||
        !body.recordsMap ||
        !Array.isArray(body.auditLogs)
      ) {
        res.status(400).json({ error: 'Estructura de matriz inválida.' });
        return;
      }
      const saved = saveMatrixState(body);
      res.json(saved);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al guardar la matriz en la base de datos.',
      });
    }
  });

  app.get('/api/captures', (_req, res) => {
    try {
      const captures = listCaptures();
      res.json({ captures });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al consultar capturas guardadas.',
      });
    }
  });

  app.get('/api/captures/:id', (req, res) => {
    try {
      const capture = getCaptureById(req.params.id);
      if (!capture) {
        res.status(404).json({ error: 'Captura no encontrada en la base de datos.' });
        return;
      }
      res.json({ capture });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al consultar la captura.',
      });
    }
  });

  app.post('/api/ai/analyze-sketch', async (req, res) => {
    try {
      const { imageDataUrl, systemInstruction, focusMode } = req.body as {
        imageDataUrl?: string;
        systemInstruction?: string;
        focusMode?: 'auto' | 'table' | 'form';
      };

      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        res.status(400).json({ error: 'Debes adjuntar una imagen en formato válido.' });
        return;
      }

      const dataUrlMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!dataUrlMatch) {
        res.status(400).json({ error: 'Formato Data URL de imagen inválido (usa PNG, JPG o WEBP).' });
        return;
      }

      const mimeType = dataUrlMatch[1];
      const imageBase64 = dataUrlMatch[2];
      const effectiveInstruction =
        (systemInstruction ?? '').trim() ||
        'Eres un desarrollador web experto. Analiza la siguiente imagen, identifica la estructura web y devuelve el código HTML/Tailwind exacto.';

      const analysis = await analyzeSketchWithGemini({
        imageBase64,
        mimeType,
        systemInstruction: effectiveInstruction,
        focusMode: focusMode ?? 'auto',
      });

      const savedRecord = createCapture({
        title: analysis.title,
        detectedType: analysis.detectedType,
        detectedElements: analysis.detectedElements,
        summary: analysis.summary,
        stressTestNotes: analysis.stressTestNotes,
        generatedHtml: analysis.generatedHtml,
        systemInstruction: effectiveInstruction,
        focusMode: focusMode ?? 'auto',
        imagePreview: imageDataUrl,
        parsedMatrix: analysis.parsedMatrix,
        status: 'Borrador',
      });

      res.status(201).json({ capture: savedRecord });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al analizar la imagen con Gemini.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/captures/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { title, status, generatedHtml } = req.body as {
        title?: string;
        status?: 'Borrador' | 'Integrado' | 'Archivado';
        generatedHtml?: string;
      };
      const updated = updateCapture(id, { title, status, generatedHtml });
      if (!updated) {
        res.status(404).json({ error: 'Captura no encontrada en la base de datos.' });
        return;
      }
      res.json({ capture: updated });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al actualizar la captura.',
      });
    }
  });

  app.delete('/api/captures/:id', (req, res) => {
    try {
      const deleted = deleteCapture(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Captura no encontrada.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Error al eliminar la captura.',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MatriPol server listening on http://localhost:${PORT}`);
  });
}

startServer();
