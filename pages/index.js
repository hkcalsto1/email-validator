import { useState, useRef } from 'react';
import Head from 'next/head';
import Papa from 'papaparse';

const STATUS = {
  valid:         { label: 'Valid',          bg: 'bg-green-100 text-green-800 border-green-200' },
  invalid:       { label: 'Invalid',        bg: 'bg-red-100 text-red-800 border-red-200' },
  'no-mx':       { label: 'No MX',          bg: 'bg-red-100 text-red-800 border-red-200' },
  disposable:    { label: 'Disposable',     bg: 'bg-orange-100 text-orange-800 border-orange-200' },
  role:          { label: 'Role',           bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  unverifiable:  { label: 'Unverifiable',   bg: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function Badge({ status }) {
  const s = STATUS[status] || { label: status, bg: 'bg-gray-100 text-gray-700 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg}`}>
      {s.label}
    </span>
  );
}

export default function Home() {
  const [tab, setTab] = useState('single');

  // Single check
  const [singleEmail, setSingleEmail] = useState('');
  const [singleResult, setSingleResult] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);

  // Bulk check
  const [csvFile, setCsvFile] = useState(null);
  const [emailColumn, setEmailColumn] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [parsedEmails, setParsedEmails] = useState([]);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef(null);

  // Single email check
  const checkSingle = async () => {
    if (!singleEmail.trim()) return;
    setSingleLoading(true);
    setSingleResult(null);
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: singleEmail.trim() }),
      });
      setSingleResult(await res.json());
    } catch {
      setSingleResult({ status: 'invalid', email: singleEmail, reason: 'Request failed — try again' });
    }
    setSingleLoading(false);
  };

  // Parse CSV when a file is selected
  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) return;
    setCsvFile(file);
    setBulkResults(null);
    setBulkError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields || [];
        setCsvHeaders(headers);
        // Auto-detect email column
        const autoCol = headers.find(h =>
          /email|e-mail|mail/i.test(h)
        ) || headers[0];
        setEmailColumn(autoCol);

        const emails = result.data
          .map(row => (row[autoCol] || '').trim())
          .filter(e => e.includes('@'));
        setParsedEmails(emails);
      },
    });
  };

  const handleColumnChange = (col) => {
    setEmailColumn(col);
    // Re-extract emails from already-parsed data
    if (!csvFile) return;
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const emails = result.data
          .map(row => (row[col] || '').trim())
          .filter(e => e.includes('@'));
        setParsedEmails(emails);
      },
    });
  };

  // Bulk validation — chunked to avoid Vercel timeouts on large lists
  const CHUNK_SIZE = 100;

  const handleBulkValidate = async () => {
    if (!parsedEmails.length) return;
    setBulkLoading(true);
    setBulkResults(null);
    setBulkError(null);
    setProgress({ done: 0, total: parsedEmails.length });

    const allResults = [];
    try {
      for (let i = 0; i < parsedEmails.length; i += CHUNK_SIZE) {
        const chunk = parsedEmails.slice(i, i + CHUNK_SIZE);
        const res = await fetch('/api/bulk-validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: chunk }),
        });
        if (!res.ok) {
          const text = await res.text();
          setBulkError(`Server error (${res.status}) — try again`);
          setBulkLoading(false);
          return;
        }
        const data = await res.json();
        if (data.error) {
          setBulkError(data.error);
          setBulkLoading(false);
          return;
        }
        allResults.push(...data.results);
        setProgress({ done: Math.min(i + CHUNK_SIZE, parsedEmails.length), total: parsedEmails.length });
      }

      const summary = {};
      for (const r of allResults) {
        summary[r.status] = (summary[r.status] || 0) + 1;
      }
      setBulkResults({ total: allResults.length, summary, results: allResults });
    } catch (err) {
      setBulkError('Request failed — check your connection and try again');
    }
    setBulkLoading(false);
  };

  // Download results
  const downloadResults = () => {
    if (!bulkResults?.results) return;
    const rows = [
      'Email,Status,Reason',
      ...bulkResults.results.map(r => `${r.email},${r.status},"${r.reason}"`),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validation-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetBulk = () => {
    setCsvFile(null);
    setCsvHeaders([]);
    setEmailColumn(null);
    setParsedEmails([]);
    setBulkResults(null);
    setBulkError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <Head>
        <title>Email Validator — SmartFlow HK</title>
        <meta name="description" content="Validate email lists — syntax check, MX records, disposable and role-based detection" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <span className="text-base font-semibold text-gray-900">Email Validator</span>
              <span className="ml-2 text-xs text-gray-400 font-normal">by SmartFlow HK</span>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 w-fit">
            {['single', 'bulk'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                  tab === t
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t === 'single' ? 'Single Check' : 'Bulk Check (CSV)'}
              </button>
            ))}
          </div>

          {/* ── SINGLE CHECK ── */}
          {tab === 'single' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-medium text-gray-900 mb-4">Check a single email address</h2>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="name@company.com"
                    value={singleEmail}
                    onChange={e => setSingleEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && checkSingle()}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={checkSingle}
                    disabled={singleLoading || !singleEmail.trim()}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {singleLoading ? 'Checking…' : 'Check'}
                  </button>
                </div>

                {singleResult && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <Badge status={singleResult.status} />
                      <span className="text-sm text-gray-600">{singleResult.reason}</span>
                    </div>
                    <p className="mt-2 text-sm font-mono text-gray-700">{singleResult.email}</p>
                  </div>
                )}
              </div>

              {/* Status legend */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(STATUS).map(([key, { label, bg }]) => (
                  <div key={key} className="bg-white rounded-lg border border-gray-200 p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${bg}`}>{label}</span>
                    <p className="mt-1.5 text-xs text-gray-400">
                      {key === 'valid' && 'Deliverable mailbox confirmed'}
                      {key === 'invalid' && 'Bad format or mailbox not found'}
                      {key === 'no-mx' && 'Domain can\'t receive email'}
                      {key === 'disposable' && 'Throwaway domain'}
                      {key === 'role' && 'Generic team address'}
                      {key === 'unverifiable' && 'Domain valid, server blocked probe'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BULK CHECK ── */}
          {tab === 'bulk' && (
            <div className="space-y-6">
              {!bulkResults && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-base font-medium text-gray-900 mb-1">Upload your email list</h2>
                  <p className="text-sm text-gray-500 mb-5">
                    Accepts any CSV — we auto-detect the email column. Up to 5,000 emails, processed in batches with a progress bar.
                  </p>

                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleFile(e.dataTransfer.files[0]);
                    }}
                    onClick={() => !csvFile && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                      isDragging
                        ? 'border-blue-400 bg-blue-50'
                        : csvFile
                        ? 'border-green-300 bg-green-50 cursor-default'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => handleFile(e.target.files[0])}
                    />

                    {csvFile ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">{csvFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {parsedEmails.length} email{parsedEmails.length !== 1 ? 's' : ''} found
                          {emailColumn && ` in column "${emailColumn}"`}
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); resetBulk(); }}
                          className="mt-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div>
                        <svg className="mx-auto mb-3 h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-600">
                          Drop your CSV here, or <span className="text-blue-600 font-medium">browse</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">.csv files only</p>
                      </div>
                    )}
                  </div>

                  {/* Column picker — shown if multiple columns detected */}
                  {csvFile && csvHeaders.length > 1 && (
                    <div className="mt-4 flex items-center gap-3">
                      <label className="text-sm text-gray-600">Email column:</label>
                      <select
                        value={emailColumn || ''}
                        onChange={e => handleColumnChange(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {bulkError && (
                    <p className="mt-3 text-sm text-red-600">{bulkError}</p>
                  )}

                  {csvFile && parsedEmails.length > 0 && (
                    <div className="mt-5">
                      <button
                        onClick={handleBulkValidate}
                        disabled={bulkLoading}
                        className="w-full py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {bulkLoading
                          ? `Validating ${progress.done} / ${progress.total}…`
                          : `Validate ${parsedEmails.length} email${parsedEmails.length !== 1 ? 's' : ''}`}
                      </button>
                      {bulkLoading && progress.total > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{Math.round((progress.done / progress.total) * 100)}% complete</span>
                            <span>{progress.done} / {progress.total}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Results panel */}
              {bulkResults && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-medium text-gray-900">Results</h3>
                      <p className="text-sm text-gray-500">{bulkResults.total} emails validated</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={downloadResults}
                        className="px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                      >
                        Download CSV
                      </button>
                      <button
                        onClick={resetBulk}
                        className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        New upload
                      </button>
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-5 gap-3 mb-6">
                    {Object.entries(bulkResults.summary).map(([status, count]) => (
                      <div key={status} className="text-center py-3 px-2 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">{count}</p>
                        <div className="mt-1">
                          <Badge status={status} />
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                          {bulkResults.total > 0
                            ? `${Math.round((count / bulkResults.total) * 100)}%`
                            : '0%'}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bulkResults.results.slice(0, 1000).map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-800 max-w-xs truncate">{r.email}</td>
                            <td className="px-4 py-2.5"><Badge status={r.status} /></td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {bulkResults.results.length > 1000 && (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center bg-gray-50 border-t border-gray-200">
                        Showing first 1,000 of {bulkResults.results.length} results. Download CSV for complete list.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
