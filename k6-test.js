import http from 'k6/http';
import { sleep } from 'k6';

// KONFIGURASI TEST
export const options = {
  // Scenario A (Sync/Lambat): Gunakan vus: 10
  // Scenario B (Async/Cepat): Gunakan vus: 100
  vus: 10, 
  
  // Durasinya kita kunci 1 menit agar PASTI muncul di Grafana
  duration: '1m', 
};

export default function () {
  // Ganti endpoint di sini sesuai skenario:
  // 1. Version A: 'http://localhost:3000/api/v1/analyze-sync'
  // 2. Version B: 'http://localhost:3000/api/v1/analyze-async'
  
  const url = 'http://localhost:3000/api/v1/analyze-sync'; // <--- GANTI INI
  
  http.get(url);
  
  // sleep(0.1); // Opsional: istirahat 0.1 detik antar request
}