const express = require('express');
const client = require('prom-client'); // Pastikan library ini ada
const { Worker } = require('worker_threads');
const app = express();

// --- 1. SETUP PROMETHEUS METRICS (Sesuai Soal) ---

// A. CPU & Memory Utilization (Otomatis)
client.collectDefaultMetrics(); 

// B. Response Time Latency (Histogram)
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'code'], // Label untuk filter
    buckets: [0.1, 0.5, 1, 2, 5] // Buckets waktu
});

// C. Requests per Second & Error Rate (Counter)
const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'code'] // PENTING: Label 'code' untuk hitung Error Rate
});

// --- 2. ROUTE HANDLERS ---

// Endpoint Metrics
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

// Version A: Synchronous (Blocking)
app.get('/api/v1/analyze-sync', (req, res) => {
    // Mulai Timer Latency
    const end = httpRequestDuration.startTimer(); 
    
    const start = Date.now();
    let count = 0;
    // Simulasi CPU Bound
    for (let i = 0; i < 1e8; i++) { count += i; }

    // Rekam Metrik (Sukses = 200)
    end({ route: '/api/v1/analyze-sync', code: 200, method: 'GET' });
    httpRequestCounter.inc({ route: '/api/v1/analyze-sync', code: 200, method: 'GET' });

    res.json({ version: 'A (Blocking)', result: count, time: Date.now() - start });
});

// Version B: Asynchronous (Non-Blocking / Worker)
app.get('/api/v1/analyze-async', (req, res) => {
    const end = httpRequestDuration.startTimer(); // Mulai Timer

    const worker = new Worker('./worker.js');

    worker.on('message', (data) => {
        // Rekam Metrik saat selesai (Sukses = 200)
        end({ route: '/api/v1/analyze-async', code: 200, method: 'GET' });
        httpRequestCounter.inc({ route: '/api/v1/analyze-async', code: 200, method: 'GET' });

        res.json({ version: 'B (Async)', result: data });
    });

    worker.on('error', (err) => {
        // Rekam Metrik Error (Error = 500) -> Ini untuk poin Error Rate
        end({ route: '/api/v1/analyze-async', code: 500, method: 'GET' });
        httpRequestCounter.inc({ route: '/api/v1/analyze-async', code: 500, method: 'GET' });
        
        res.status(500).json({ error: err.message });
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});