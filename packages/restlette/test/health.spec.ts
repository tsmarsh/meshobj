import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { Repository } from '@meshobj/common';
import { createHealthCheck } from '../src/index';

describe('Health Check Endpoints', () => {
    let app: express.Application;
    let mockRepo: Repository;
    let server: any;
    const port = 40500;

    beforeEach(() => {
        app = express();
        mockRepo = {
            list: vi.fn(),
            create: vi.fn(),
            read: vi.fn(),
            createMany: vi.fn(),
            readMany: vi.fn(),
            remove: vi.fn(),
        } as unknown as Repository;

        const { health, ready } = createHealthCheck(mockRepo);
        app.get('/health', health);
        app.get('/ready', ready);
        server = app.listen(port);
    });

    afterEach(() => {
        server.close();
    });

    describe('GET /health', () => {
        it('should return 200 OK with status ok', async () => {
            const response = await fetch(`http://localhost:${port}/health`);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ status: 'ok' });
        });
    });

    describe('GET /ready', () => {
        it('should return 200 OK when database is connected', async () => {
            vi.mocked(mockRepo.list).mockResolvedValueOnce([]);

            const response = await fetch(`http://localhost:${port}/ready`);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ status: 'ok' });
            expect(mockRepo.list).toHaveBeenCalledTimes(1);
        });

        it('should return 503 when database connection fails', async () => {
            vi.mocked(mockRepo.list).mockRejectedValueOnce(new Error('Database connection failed'));

            const response = await fetch(`http://localhost:${port}/ready`);

            expect(response.status).toBe(503);
            const body = await response.json();
            expect(body).toEqual({
                status: 'error',
                message: 'Database connection failed'
            });
            expect(mockRepo.list).toHaveBeenCalledTimes(1);
        });
    });
}); 