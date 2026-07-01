// Dependency-free spreadsheet reader for the commissioner upload tools (runs in the browser only).
// Parses .xlsx (ZIP + inline/shared-string XML, inflated via the built-in DecompressionStream) and
// .csv into rows, then flattens to the tab-separated text our save endpoints parse. No npm dependency.

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = new (window as any).DecompressionStream('deflate-raw');
  const stream = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds));
  return new Uint8Array(await stream.arrayBuffer());
}

const unesc = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d));

function colIdx(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buf);
  const dv = new DataView(buf);
  const u16 = (o: number) => dv.getUint16(o, true);
  const u32 = (o: number) => dv.getUint32(o, true);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) { if (u32(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('That doesn’t look like a valid .xlsx file.');
  const cdOffset = u32(eocd + 16), cdCount = u16(eocd + 10);
  const dec = new TextDecoder();
  const files: Record<string, string> = {};
  let p = cdOffset;
  for (let n = 0; n < cdCount; n++) {
    if (u32(p) !== 0x02014b50) break;
    const method = u16(p + 10), compSize = u32(p + 20), nameLen = u16(p + 28), extraLen = u16(p + 30), commentLen = u16(p + 32), localOffset = u32(p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === 'xl/worksheets/sheet1.xml' || name === 'xl/sharedStrings.xml') {
      const lhNameLen = u16(localOffset + 26), lhExtraLen = u16(localOffset + 28);
      const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
      const comp = bytes.subarray(dataStart, dataStart + compSize);
      const data = method === 0 ? comp : await inflateRaw(comp);
      files[name] = dec.decode(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  const shared: string[] = [];
  const ss = files['xl/sharedStrings.xml'] || '';
  for (const m of ss.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
    const txt = [...m[1].matchAll(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((x) => x[1]).join('');
    shared.push(unesc(txt));
  }
  const sheet = files['xl/worksheets/sheet1.xml'] || '';
  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const cells: string[] = [];
    for (const cm of rm[1].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const attrs = cm[1] || '', inner = cm[2];
      const t = (/\bt="([^"]*)"/.exec(attrs) || [])[1];
      const r = (/\br="([^"]*)"/.exec(attrs) || [])[1];
      let val = '';
      if (inner) {
        const vm = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
        const im = /<(?:\w+:)?is>[\s\S]*?<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/.exec(inner);
        if (vm) val = vm[1]; else if (im) val = im[1];
      }
      if (t === 's') val = shared[parseInt(val, 10)] || ''; else val = unesc(val);
      const ci = r ? colIdx(r) : cells.length;
      cells[ci] = val;
    }
    rows.push(cells);
  }
  return rows;
}

// Read a File (.xlsx or .csv) into rows.
export async function parseSpreadsheetFile(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) {
    return (await file.text()).split(/\r?\n/).map((l) => l.split(','));
  }
  if (/\.xlsx$/i.test(file.name)) {
    return parseXlsx(await file.arrayBuffer());
  }
  throw new Error('Please choose a .xlsx or .csv file (or paste below).');
}

// Flatten rows into tab-separated text (blank cells dropped, empty rows removed).
export function rowsToText(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (c ?? '').toString().trim()).filter((c) => c !== '').join('\t'))
    .filter((line) => line.length > 0)
    .join('\n');
}
