const fs = require('fs');
const pdf = require('pdf-parse');

async function readPdf(filePath) {
  try {
    let dataBuffer = fs.readFileSync(filePath);
    let data = await pdf(dataBuffer);
    console.log(`\n=== File: ${filePath} ===\n`);
    console.log(data.text);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
}

async function main() {
  await readPdf('c:/Users/ccor1/OneDrive/Desktop/Marine guard project/웨어러블 디바이스 PCB 도면.pdf');
  await readPdf('c:/Users/ccor1/OneDrive/Desktop/Marine guard project/웨어러블 디바이스 수신기 PCB 도면.pdf');
}

main();
