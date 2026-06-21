const CDN_URL =
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

let loading = null;

function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('SheetJS CDN load failed'));
    document.head.appendChild(script);
  });

  return loading;
}

export async function exportToExcel(rows, filename = 'export.xlsx') {
  const XLSX = await loadSheetJS();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

export async function importFromExcel(file) {
  const XLSX = await loadSheetJS();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}
