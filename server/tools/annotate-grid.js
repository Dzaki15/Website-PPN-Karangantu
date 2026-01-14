import { readFile, writeFile } from 'fs/promises';
import { basename } from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function annotate(inputPath, outputPath){
  const bytes = await readFile(inputPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  pdfDoc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const step = 40;
    const labelEvery = 80;

    for(let x = 0; x <= width; x += step){
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: height },
        color: rgb(0.9, 0.1, 0.1),
        opacity: 0.25,
        thickness: 0.5
      });
      if(x % labelEvery === 0){
        page.drawText(`${Math.round(x)}`, {
          x: x + 2,
          y: 4,
          size: 8,
          font,
          color: rgb(0.8, 0.1, 0.1)
        });
      }
    }

    for(let y = 0; y <= height; y += step){
      page.drawLine({
        start: { x: 0, y },
        end: { x: width, y },
        color: rgb(0.1, 0.1, 0.9),
        opacity: 0.25,
        thickness: 0.5
      });
      if(y % labelEvery === 0){
        page.drawText(`${Math.round(y)}`, {
          x: 4,
          y: y + 2,
          size: 8,
          font,
          color: rgb(0.1, 0.1, 0.8)
        });
      }
    }
  });

  await writeFile(outputPath, await pdfDoc.save());
  console.log(`Grid anotasi tersimpan di ${outputPath}`);
}

const [,, inputPath, outputPath] = process.argv;
if(!inputPath || !outputPath){
  console.error('Gunakan: node tools/annotate-grid.js <input.pdf> <output.pdf>');
  process.exit(1);
}

annotate(inputPath, outputPath).catch(err => {
  console.error('Gagal membuat grid:', err);
  process.exit(1);
});
