const express = require('express');
const { Worker } = require('worker_threads');
const client = require('prom-client');
const app = express();

// --- LO 3: Monitoring Setup ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const requestCounter = new client.Counter({
    name: 'calendar_requests_total',
    help: 'Total requests',
    labelNames: ['method', 'version']
});
register.registerMetric(requestCounter);

// Shared Resource Simulation (untuk analisis Race Condition)
let globalEventCount = 0; 

// --- LO 2: Version A (Blocking / Single Thread) ---
// Ini akan membuat server "hang" dan tidak bisa menerima request lain selama proses
app.get('/api/v1/analyze-sync', (req, res) => {
    requestCounter.inc({ method: 'GET', version: 'A' });
    
    const start = Date.now();
    
    // CPU Bound task dilakukan langsung di Main Thread (Event Loop)
    let count = 0;
    for (let i = 0; i < 2e9; i++) { 
        count += i;
    }
    globalEventCount += 1; // Unsafe modification (simplified)
    
    res.json({ 
        version: 'A (Blocking)', 
        result: count, 
        time: Date.now() - start,
        total_processed: globalEventCount 
    });
});

// --- LO 2: Version B (Non-Blocking / Multi-threaded) ---
// Menggunakan Worker Threads untuk offload tugas berat
app.get('/api/v1/analyze-async', (req, res) => {
    requestCounter.inc({ method: 'GET', version: 'B' });
    const start = Date.now();

    // Spawn thread baru (OS Thread)
    const worker = new Worker('./worker.js');

    worker.on('message', (data) => {
        globalEventCount += 1; // Masih di main thread, jadi aman di JS (karena single threaded event loop callback)
        res.json({ 
            version: 'B (Worker Thread)', 
            result: data, 
            time: Date.now() - start,
            total_processed: globalEventCount 
        });
    });

    worker.on('error', (err) => {
        res.status(500).send(err.message);
    });
});

// Metrics Endpoint untuk Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

app.listen(3000, () => {
    console.log('Calendar OS Service running on port 3000');
});