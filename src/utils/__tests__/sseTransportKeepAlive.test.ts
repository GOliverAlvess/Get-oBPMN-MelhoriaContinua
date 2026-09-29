import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import http from 'http';

describe('SSE Transport & Keep-Alive Diagnostics & Verification', () => {
  it('deve incluir o cabeçalho X-Accel-Buffering: no e emitir : open\\n\\n', async () => {
    const app = express();
    const sseClients = new Set<express.Response>();

    app.get('/api/db-sync', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.write(': open\n\n');

      sseClients.add(res);

      const heartbeatTimer = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(heartbeatTimer);
          sseClients.delete(res);
        }
      }, 100);

      req.on('close', () => {
        clearInterval(heartbeatTimer);
        sseClients.delete(res);
      });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const response = await fetch(`http://localhost:${port}/api/db-sync`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('x-accel-buffering')).toBe('no');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    // Lê a primeira mensagem (: open\n\n)
    const firstChunk = await reader?.read();
    const firstText = new TextDecoder().decode(firstChunk?.value);
    expect(firstText).toContain(': open\n\n');

    // Lê o heartbeat (: ping\n\n)
    const secondChunk = await reader?.read();
    const secondText = new TextDecoder().decode(secondChunk?.value);
    expect(secondText).toContain(': ping\n\n');

    // Desconecta o leitor
    await reader?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Valida que o cliente foi limpo do Set
    expect(sseClients.size).toBe(0);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('deve realizar broadcast imediato para múltiplos clientes simultâneos sem perda de dados', async () => {
    const sseClients = new Set<express.Response>();

    const broadcastSync = (collection: string, id: string, type: 'set' | 'update' | 'delete', data: any) => {
      const payload = JSON.stringify({ collection, id, type, data });
      for (const client of sseClients) {
        client.write(`data: ${payload}\n\n`);
      }
    };

    const mockRes1 = {
      write: vi.fn(),
    } as unknown as express.Response;

    const mockRes2 = {
      write: vi.fn(),
    } as unknown as express.Response;

    sseClients.add(mockRes1);
    sseClients.add(mockRes2);

    broadcastSync('projects', 'proj_123', 'set', { id: 'proj_123', name: 'Projeto Teste' });

    expect(mockRes1.write).toHaveBeenCalledTimes(1);
    expect(mockRes2.write).toHaveBeenCalledTimes(1);

    const callArg1 = (mockRes1.write as any).mock.calls[0][0];
    expect(callArg1).toContain('proj_123');
    expect(callArg1).toContain('Projeto Teste');
  });
});
