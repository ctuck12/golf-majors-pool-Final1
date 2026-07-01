'use client';

import { useEffect, useState } from 'react';

type Status = { active: boolean; count: number; updatedAt: string | null };
type SaveResp = {
  ok?: boolean; error?: string; count?: number; updatedAt?: string;
  matchedCount?: number; unmatchedCount?: number;
  unmatched?: { name: string; salary: number }[];
  skipped?: string[];
  preview?: { id: number; name: string; salary: number }[];
};

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#eef2f6', padding: '24px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' };
const card: React.CSSProperties = { maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e2e8ef', overflow: 'hidden', boxShadow: '0 8px 30px rgba(9,34,51,0.08)' };
const header: React.CSSProperties = { background: '#0f1720', padding: '18px 20px' };
const body: React.CSSProperties = { padding: 20, display: 'grid', gap: 16 };
const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' });

export default function CommissionerSalaryPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<SaveResp | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
        setMsg({ kind: 'ok', text: `Saved ${data.count} salaries. The pick sheet now uses this list.` });
        setText('');
        loadStatus();
      }
    } catch { setMsg({ kind: 'err', text: 'Network error while saving.' }); }
    setBusy(false);
  };

  const clear = async () => {
    if (!confirm('Clear the uploaded salaries and revert to the built-in list?')) return;
    setBusy(true); setMsg(null); setResp(null);
    try {
      const res = await fetch('/api/commissioner/salary-overrides', { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg({ kind: 'err', text: d.error ?? 'Clear failed.' }); }
      else { setMsg({ kind: 'ok', text: 'Reverted to the built-in salary list.' }); loadStatus(); }
    } catch { setMsg({ kind: 'err', text: 'Network error while clearing.' }); }
    setBusy(false);
  };

  const unmatched = resp?.unmatched ?? [];

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={header}>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 900 }}>Salary Pick List</div>
          <div style={{ color: '#8fa3b1', fontSize: 12, fontWeight: 500, marginTop: 2 }}>Commissioner tool · pick-sheet salaries</div>
        </div>

        {gateError ? (
          <div style={body}>
            <div style={{ background: '#fef2f2', color: '#b42318', border: '1px solid #fecdca', borderRadius: 8, padding: '12px 14px', fontSize: 14 }}>{gateError}</div>
          </div>
        ) : (
          <div style={body}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8ef', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#334155' }}>
              {status?.active
                ? <>Currently using an <b>uploaded list</b> of <b>{status.count}</b> salaries{status.updatedAt ? <> · updated {new Date(status.updatedAt).toLocaleString()}</> : null}.</>
                : <>Currently using the <b>built-in salary list</b>. Paste a new list below to override it.</>}
            </div>

            <div style={{ fontSize: 12.5, color: '#607282', lineHeight: 1.5 }}>
              Paste one player per line as <b>Name&nbsp;&nbsp;Salary</b>. The trailing number is the salary
              (<code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>$</code> and commas ok);
              a leading rank column is ignored. Example:<br />
              <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>Scottie Scheffler 11900</code>{' '}
              <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>Rory McIlroy $10,200</code><br />
              Names are matched to the pool — any that don&apos;t match are listed back to you so you can fix the spelling.
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Scottie Scheffler 11900\nRory McIlroy 10200\nJon Rahm 9900\n...'}
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
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: 13, background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #eef2f6' }}>
                      <span style={{ color: '#0f1720', fontWeight: 600 }}>{p.name}</span>
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
