import { readFile } from 'fs/promises';
import { basename } from 'path';
import { PDFDocument } from 'pdf-lib';

async function inspectFile(path){
  try {
    const bytes = await readFile(path);
    const pdfDoc = await PDFDocument.load(bytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    const summary = fields.map(field => ({
      type: field.constructor.name,
      name: field.getName()
    }));
    console.log(`\n=== ${basename(path)} ===`);
    if(summary.length === 0){
      console.log('Tidak ada field isian (kemungkinan bukan PDF form).');
      return;
    }
    summary.forEach(({ type, name }, idx) => {
      console.log(`${idx + 1}. [${type}] ${name}`);
    });
  } catch (error){
    console.error(`Gagal membaca ${path}:`, error.message);
  }
}

async function main(){
  const targets = process.argv.slice(2);
  if(targets.length === 0){
    console.error('Gunakan: node tools/list-pdf-fields.js <file1.pdf> <file2.pdf> ...');
    process.exit(1);
  }
  for(const target of targets){
    await inspectFile(target);
  }
}

main();
