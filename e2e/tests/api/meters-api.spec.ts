import { test, expect } from '@playwright/test';

test.describe('API Contract & Business Rules · EnergIA', () => {
    let token: string;

    test.beforeAll(async ({ request }) => {
        const res = await request.post('/api/v1/auth/login', {
            data: { email: 'admin@energia.local', password: 'admin123' },
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        token = body.access_token;
    });

    test('GET /health debe responder 200 con status ok', { tag: ['@api', '@smoke'] }, async ({ request }) => {
        const res = await request.get('/health');
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('ok');
    });

    test('POST /meter/getAll filtra correctamente por estado CRITICAL', { tag: ['@api', '@regression'] }, async ({ request }) => {
        const res = await request.post('/api/v1/meter/getAll', {
            headers: { Authorization: `Bearer ${token}` },
            data: { filter: { status: 'CRITICAL' } },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.rows).toHaveLength(2);
        expect(body.rows.map((m: { meter_id: string }) => m.meter_id)).toEqual(['M-109', 'M-112']);
    });

    test('DEF-03: POST /meter/getAll debe admitir búsqueda en minúsculas (case-insensitive)', { tag: ['@api', '@defect'] }, async ({ request }) => {
        test.fail(true, 'DEF-03: meter/getAll falla con minúsculas a pesar de estar documentado en Swagger');

        const res = await request.post('/api/v1/meter/getAll', {
            headers: { Authorization: `Bearer ${token}` },
            data: { filter: { meter_id: 'm-109' } },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0].meter_id).toBe('M-109');
    });

    test('DEF-02: POST /meter/getAll debe devolver status NORMAL para M-106 (Falso Positivo)', { tag: ['@api', '@defect'] }, async ({ request }) => {
        test.fail(true, 'DEF-02: StatusOf en enums.go clasifica M-106 como ALERT en vez de NORMAL');

        const res = await request.post('/api/v1/meter/getAll', {
            headers: { Authorization: `Bearer ${token}` },
            data: { filter: { meter_id: 'M-106' } },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0].status).toBe('NORMAL');
    });

    test('DEF-04: POST /meter/getAll debe responder 400 o normalizar y no colapsar con 500 ante page negativo', { tag: ['@api', '@defect'] }, async ({ request }) => {
        test.fail(true, 'DEF-04: page < 1 causa pánico por slice bounds out of range y responde HTTP 500');

        const res = await request.post('/api/v1/meter/getAll', {
            headers: { Authorization: `Bearer ${token}` },
            data: { pagination: { page: -1, size: 10 } },
        });

        expect(res.status()).not.toBe(500);
        expect([200, 400]).toContain(res.status());
    });
});
