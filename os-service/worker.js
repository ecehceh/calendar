const { parentPort, workerData } = require('worker_threads');

// Simulasi CPU Bound Task
function heavyCalculation() {
    let count = 0;
    // Loop untuk membebani CPU Core
    for (let i = 0; i < 1e8; i++) { 
        count += i;
    }
    return count;
}

const result = heavyCalculation();
parentPort.postMessage(result);

