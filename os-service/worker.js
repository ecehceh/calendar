const { parentPort, workerData } = require('worker_threads');

// Simulasi CPU Bound Task: Hitung recurrence event yang kompleks
function heavyCalculation() {
    let count = 0;
    // Loop besar untuk membebani CPU Core
    for (let i = 0; i < 1e8; i++) { 
        count += i;
    }
    return count;
}

const result = heavyCalculation();
parentPort.postMessage(result);