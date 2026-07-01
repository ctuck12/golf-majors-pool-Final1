'use client';

import { useEffect, useRef, useState } from 'react';

type Status = { active: boolean; count: number; updatedAt: string | null };
type SaveResp = {
  ok?: boolean; error?: string; count?: number; updatedAt?: string;
  matchedCount?: number; worldRankCount?: number; unmatchedCount?: number;
  unmatched?: { name: string; salary: number }[];
  skipped?: string[];
  preview?: { id: number; name: string; salary: number; worldRank: number | null }[];
};

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#eef2f6', padding: '24px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' };
const card: React.CSSProperties = { maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e2e8ef', overflow: 'hidden', boxShadow: '0 8px 30px rgba(9,34,51,0.08)' };
const header: React.CSSProperties = { background: '#0f1720', padding: '18px 20px' };
const body: React.CSSProperties = { padding: 20, display: 'grid', gap: 16 };
const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' });

// ── Dependency-free .xlsx reader (ZIP + inline/shared-string XML) ─────────────────────────────────
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = new (window as any).DecompressionStream('deflate-raw');
  const stream = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds));
  return new Uint8Array(await stream.arrayBuffer());
}
const unesc = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d));
function colIdx(ref: string): number { const m = /^([A-Z]+)/.exec(ref); if (!m) return 0; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
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

// Turn parsed spreadsheet rows into the tab-separated text our save endpoint parses.
function rowsToText(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (c ?? '').toString().trim()).filter((c) => c !== '').join('\t'))
    .filter((line) => line.length > 0)
    .join('\n');
}

export default function CommissionerSalaryPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<SaveResp | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/commissioner/salary-overrides', { cache: 'no-store' });
      if (res.status === 401) { setGateError('Sign in to the pool as the commissioner (in the main app), then reload this page.'); return; }
      if (res.status === 403) { setGateError('This account is not the commissioner.'); return; }
      if (!res.ok) { setGateError('Could not load current salaries.'); return; }
      setGateError(null);
      setStatus(await res.json());
    } catch { setGateError('Network error loading current salaries.'); }
  };
  useEffect(() => { loadStatus(); }, []);

  const onFile = async (file: File) => {
    setMsg(null); setResp(null);
    try {
      let rows: string[][];
      if (/\.csv$/i.test(file.name)) {
        rows = (await file.text()).split(/\r?\n/).map((l) => l.split(','));
      } else if (/\.xlsx$/i.test(file.name)) {
        rows = await parseXlsx(await file.arrayBuffer());
      } else {
        setMsg({ kind: 'err', text: 'Please choose a .xlsx or .csv file (or paste below).' }); return;
      }
      const asText = rowsToText(rows);
      if (!asText) { setMsg({ kind: 'err', text: 'Couldn’t read any rows from that file.' }); return; }
      setText(asText);
      setMsg({ kind: 'ok', text: `Loaded ${rows.length} rows from ${file.name}. Review below, then Save & Apply.` });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not read that file.' });
    }
  };

  const save = async () => {
    setBusy(true); setMsg(null); setResp(null);
    try {
      const res = await fetch('/api/commissioner/salary-overrides', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as SaveResp;
      setResp(data);
      if (!res.ok) setMsg({ kind: 'err', text: data.error ?? 'Save failed.' });
      else {
        setMsg({ kind: 'ok', text: `Saved ${data.count} players — salaries${data.worldRankCount ? ` and ${data.worldRankCount} world ranks` : ''} applied to the pick sheet.` });
        setText('');
        if (fileRef.current) fileRef.current.value = '';
        loadStatus();
      }
    } catch { setMsg({ kind: 'err', text: 'Network error while saving.' }); }
    setBusy(false);
  };

  const clear = async () => {
    if (!confirm('Clear the uploaded list and revert to the built-in salaries + world ranks?')) return;
    setBusy(true); setMsg(null); setResp(null);
    try {
      const res = await fetch('/api/commissioner/salary-overrides', { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg({ kind: 'err', text: d.error ?? 'Clear failed.' }); }
      else { setMsg({ kind: 'ok', text: 'Reverted to the built-in list.' }); loadStatus(); }
    } catch { setMsg({ kind: 'err', text: 'Network error while clearing.' }); }
    setBusy(false);
  };

  const unmatched = resp?.unmatched ?? [];

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={header}>
          <button
            onClick={() => { window.location.href = '/?tab=commissioner'; }}
            style={{ display: 'inline-block', background: 'transparent', border: '1px solid #6b7b88', borderRadius: 999, color: '#8fa3b1', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '6px 14px', marginBottom: 10 }}
          >
            Back to Commissioner Hub
          </button>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 900 }}>Salary Pick List</div>
          <div style={{ color: '#8fa3b1', fontSize: 12, fontWeight: 500, marginTop: 2 }}>Commissioner tool · salaries + world ranks</div>
        </div>

        {gateError ? (
          <div style={body}>
            <div style={{ background: '#fef2f2', color: '#b42318', border: '1px solid #fecdca', borderRadius: 8, padding: '12px 14px', fontSize: 14 }}>{gateError}</div>
          </div>
        ) : (
          <div style={body}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8ef', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#334155' }}>
              {status?.active
                ? <>Currently using an <b>uploaded list</b> of <b>{status.count}</b> players{status.updatedAt ? <> · updated {new Date(status.updatedAt).toLocaleString()}</> : null}.</>
                : <>Currently using the <b>built-in salaries + world ranks</b>. Upload or paste a new list to override them.</>}
            </div>

            <div style={{ fontSize: 12.5, color: '#607282', lineHeight: 1.5 }}>
              Columns: <b>World Golf Rank</b>, <b>Player Name</b>, <b>Salary</b> (a header row is fine — it&apos;s skipped).
              Upload the <b>.xlsx</b>/<b>.csv</b> file, or paste the rows. Salary is the trailing number
              (<code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>$</code>/commas ok);
              the leading number is the world rank. Unmatched names are listed back so you can fix spelling.
            </div>

            {/* File upload */}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                style={{ fontSize: 13 }}
              />
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'1\tScottie Scheffler\t11900\n2\tRory McIlroy\t10200\n8\tJon Rahm\t9900\n...'}
              rows={12}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={save} disabled={busy || !text.trim()} style={{ ...btn('#2c6449'), opacity: busy || !text.trim() ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save & Apply'}</button>
              {status?.active && <button onClick={clear} disabled={busy} style={{ ...btn('#64748b'), opacity: busy ? 0.5 : 1 }}>Clear (use built-in list)</button>}
            </div>

            {msg && (
              <div style={{ background: msg.kind === 'ok' ? '#ecfdf3' : '#fef2f2', color: msg.kind === 'ok' ? '#027a48' : '#b42318', border: `1px solid ${msg.kind === 'ok' ? '#a6f4c5' : '#fecdca'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg.text}</div>
            )}

            {unmatched.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
                <b>{resp?.unmatchedCount ?? unmatched.length} name(s) didn&apos;t match the pool</b> and were skipped — check spelling and re-save:
                <div style={{ marginTop: 6, fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
                  {unmatched.map((u) => `${u.name} (${u.salary})`).join(', ')}
                </div>
              </div>
            )}

            {resp?.preview && resp.preview.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#607282', marginBottom: 6 }}>TOP SALARIES SAVED</div>
                <div style={{ border: '1px solid #e2e8ef', borderRadius: 8, overflow: 'hidden' }}>
                  {resp.preview.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 12px', fontSize: 13, background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #eef2f6' }}>
                      <span style={{ color: '#0f1720', fontWeight: 600 }}>{p.worldRank != null && <span style={{ color: '#94a3b8', fontWeight: 700, marginRight: 8 }}>#{p.worldRank}</span>}{p.name}</span>
                      <span style={{ color: '#2c6449', fontWeight: 800 }}>${p.salary.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
