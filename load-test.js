const http = require('http');

// Ganti endpoint sesuai kebutuhan eksperimen:
// const ENDPOINT = '/api/v1/analyze-sync';  // <-- Uji Coba 1: Pakai ini dulu (Versi A)
const ENDPOINT = '/api/v1/analyze-async'; // <-- Uji Coba 2: Ganti ke ini nanti (Versi B)

const TOTAL_REQUESTS = 50; // Jumlah request 'serangan'

console.log(`=== Memulai Load Test ke ${ENDPOINT} ===`);
let completed = 0;
const startTotal = Date.now();

for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const start = Date.now();
    http.get(`http://localhost:3000${ENDPOINT}`, (res) => {
        res.on('data', () => {}); // Consume body
        res.on('end', () => {
            const duration = Date.now() - start;
            console.log(`Request #${i + 1}: Selesai dalam ${duration}ms`);
            completed++;
            if (completed === TOTAL_REQUESTS) {
                console.log(`\n=== TEST SELESAI ===`);
                console.log(`Total Waktu: ${(Date.now() - startTotal) / 1000} detik`);
            }
        });
    }).on('error', (e) => console.error(e.message));
}