import { Controller, Get, Logger, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scan } from './scan.entity.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { scanProgressStore } from '../scan-engine/scan-progress.store.js';

@Controller('scans')
export class ScanProgressController {
  private readonly logger = new Logger(ScanProgressController.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
  ) {}

  @Get(':id/progress')
  @Public()
  async streamProgress(
    @Param('id', ParseUUIDPipe) scanId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    // Verify JWT token from query param (SSE can't use headers)
    if (!token) {
      res.status(401).json({ message: 'Token required' });
      return;
    }

    try {
      this.jwtService.verify(token);
    } catch {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    // Set SSE headers - disable all buffering
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Helper to write and flush
    const sendEvent = (event: string, data: unknown) => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        if (typeof (res as unknown as { flush: () => void }).flush === 'function') {
          (res as unknown as { flush: () => void }).flush();
        }
      } catch {
        // Connection may have closed
      }
    };

    // Check scan exists
    const scan = await this.scanRepo.findOne({ where: { id: scanId } });
    if (!scan) {
      sendEvent('error', { message: 'Scan not found' });
      res.end();
      return;
    }

    // If scan already completed, send final status
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(scan.status)) {
      sendEvent('progress', {
        progress: scan.status === 'COMPLETED' ? 100 : -1,
        phase: scan.status === 'COMPLETED' ? 'Scan completed' : `Scan ${scan.status.toLowerCase()}`,
        status: scan.status,
      });
      sendEvent('complete', { status: scan.status });
      res.end();
      return;
    }

    // Send initial status
    sendEvent('progress', {
      progress: 0,
      phase: 'Connected — waiting for scan updates...',
      status: 'RUNNING',
    });

    let cleaned = false;
    let lastProgress = -1;
    let lastPhase = '';

    this.logger.log(`[SSE] Client connected for scan ${scanId}`);

    // Poll the in-memory progress store every 2 seconds
    // This is reliable because it reads directly from the same process memory
    const progressPoll = setInterval(() => {
      try {
        const data = scanProgressStore.get(scanId);
        if (data && (data.progress !== lastProgress || data.phase !== lastPhase)) {
          lastProgress = data.progress;
          lastPhase = data.phase;

          const status = data.progress >= 100 ? 'COMPLETED' : data.progress < 0 ? 'FAILED' : 'RUNNING';

          sendEvent('progress', {
            progress: data.progress,
            phase: data.phase,
            status,
          });

          if (status === 'COMPLETED' || status === 'FAILED') {
            sendEvent('complete', { status });
            cleanup();
          }
        }
      } catch {
        // Ignore errors
      }
    }, 2000);

    // Also poll DB every 8s as ultimate fallback for terminal states
    const dbPoll = setInterval(async () => {
      try {
        const currentScan = await this.scanRepo.findOne({ where: { id: scanId } });
        if (currentScan && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(currentScan.status)) {
          sendEvent('progress', {
            progress: currentScan.status === 'COMPLETED' ? 100 : -1,
            phase: currentScan.status === 'COMPLETED' ? 'Scan completed' : `Scan ${currentScan.status.toLowerCase()}`,
            status: currentScan.status,
          });
          sendEvent('complete', { status: currentScan.status });
          cleanup();
        }
      } catch {
        // Ignore polling errors
      }
    }, 8000);

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      try {
        res.write(`:heartbeat\n\n`);
        if (typeof (res as unknown as { flush: () => void }).flush === 'function') {
          (res as unknown as { flush: () => void }).flush();
        }
      } catch {
        cleanup();
      }
    }, 15000);

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(progressPoll);
      clearInterval(dbPoll);
      clearInterval(heartbeat);
      scanProgressStore.cleanup();
      this.logger.log(`[SSE] Client disconnected for scan ${scanId}`);
      try {
        res.end();
      } catch {
        // Already closed
      }
    };

    // Clean up on client disconnect
    res.on('close', cleanup);
  }
}
