import { readFile } from 'fs/promises';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function extractToJson(pdfPath){
  const data = new Uint8Array(await readFile(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableWorker: true });
  const pdfDoc = await loadingTask.promise;
  const pages = [];
  for(let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1){
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = textContent.items.map(item => {
      const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = transform[4];
      const y = transform[5];
      return {
        str: item.str.trim(),
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        fontSize: Number((item.height).toFixed(2))
      };
    }).filter(entry => entry.str.length > 0);
    pages.push({ page: pageNum, width: viewport.width, height: viewport.height, items });
  }
  return { file: path.basename(pdfPath), pages };
}

async function main(){
  const targets = process.argv.slice(2);
  if(targets.length === 0){
    console.error('Usage: node tools/extract-pdf-text.js <pdf> [pdf...]');
    process.exit(1);
  }
  const outputs = [];
  for(const target of targets){
    const absPath = path.resolve(__dirname, '..', target);
    console.log(`Processing ${absPath}`);
    outputs.push(await extractToJson(absPath));
  }
  const outDir = path.resolve(__dirname, '..', 'debug-output');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'pdf-text.json');
  await writeFile(outPath, JSON.stringify(outputs, null, 2));
  console.log(`Saved text data to ${outPath}`);
}

main().catch(err => {
  console.error('Failed to extract text:', err);
  process.exit(1);
});
