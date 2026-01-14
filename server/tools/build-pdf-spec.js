import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const dataPath = path.resolve('server', 'debug-output', 'pdf-text.json');
const docs = JSON.parse(readFileSync(dataPath, 'utf-8'));

function findItem(page, predicate){
  return page.items.find(predicate);
}

function findLabelField(page, label){
  const entry = findItem(page, item => item.str === label);
  if(!entry) return null;
  const colon = findItem(page, item => item.str === ':' && Math.abs(item.y - entry.y) < 0.2);
  const valueX = colon ? colon.x + 8 : entry.x + 80;
  return { x: Number(valueX.toFixed(2)), y: entry.y, fontSize: entry.fontSize };
}

function captureTable(page){
  const headers = {};
  ['No', 'Tahapan', 'Waktu', 'Mulai', 'Selesai', 'Keterangan'].forEach(label => {
    const entry = findItem(page, item => item.str === label);
    if(entry) headers[label.toLowerCase()] = { x: entry.x, y: entry.y };
  });
  const rowYs = page.items
    .filter(item => ['1','2','3','4','5','6','7','8','9','10'].includes(item.str.trim()) && item.x < (headers.tahapan?.x || 120))
    .map(item => Number(item.y.toFixed(2)))
    .sort((a,b) => a - b);
  return { headers, rowYs };
}

const spec = docs.map(doc => {
  const page1 = doc.pages[0];
  const infoFields = {};
  ['Pengguna', 'Alamat', 'Persyaratan', 'Nama Pengguna', 'Nama Kapal', 'Nakhoda', 'Nomor HP'].forEach(label => {
    const field = findLabelField(page1, label);
    if(field) infoFields[label] = { page: 1, ...field };
  });
  const table = captureTable(page1);
  const page2 = doc.pages[1];
  let signature = null;
  if(page2){
    const dateAnchor = findItem(page2, item => item.str === 'Serang,');
    const penerima = findItem(page2, item => item.str === 'Penerima Layanan');
    const pemberi = findItem(page2, item => item.str === 'Pemberi Layanan');
    const penerimaLine = findItem(page2, item => item.str.startsWith('(') && item.x < (pemberi ? pemberi.x : 200));
    const pemberiLine = findItem(page2, item => item.str.startsWith('(') && item.x > (pemberi ? pemberi.x - 20 : 200));
    signature = {
      date: dateAnchor ? { page: 2, x: dateAnchor.x + 70, y: dateAnchor.y } : null,
      penerimaLabel: penerima ? { page: 2, x: penerima.x, y: penerima.y } : null,
      penerimaLine: penerimaLine ? { page: 2, x: penerimaLine.x + 20, y: penerimaLine.y + 12 } : null,
      pemberiLabel: pemberi ? { page: 2, x: pemberi.x, y: pemberi.y } : null,
      pemberiLine: pemberiLine ? { page: 2, x: pemberiLine.x + 20, y: pemberiLine.y + 12 } : null
    };
  }
  return {
    file: doc.file,
    pageSize: { width: page1.width, height: page1.height },
    infoFields,
    table,
    signature
  };
});

const outPath = path.resolve('server', 'debug-output', 'pdf-spec.json');
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`Saved spec to ${outPath}`);
