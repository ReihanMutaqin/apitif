import React, { useState, useRef } from 'react';
import DataTable from './components/DataTable';
import './index.css'; // Make sure the premium styles are applied

function App() {
  const [data, setData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiUrl, setApiUrl] = useState('http://10.2.113.250/wappr/api/data');
  const [duplicatesReport, setDuplicatesReport] = useState(null);
  const [showDupModal, setShowDupModal] = useState(false);
  
  const fileInputRef = useRef(null);

  // Helper to deduplicate exact matching rows
  const deduplicateData = (dataArray, onReport) => {
    if (!Array.isArray(dataArray)) return dataArray;
    const uniqueMap = new Map();
    const dupMap = new Map();

    dataArray.forEach(row => {
      // Find the workorder key regardless of exact case/spacing
      const woKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'WORKORDER');
      const workorder = woKey ? String(row[woKey]).trim() : null;
      
      const key = workorder || JSON.stringify(Object.keys(row).sort().reduce((acc, k) => ({...acc, [k]: row[k]}), {}));
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...row, _sources: [row._source || 'Unknown'] });
      } else {
        // Duplicate found!
        const original = uniqueMap.get(key);
        const newSource = row._source || 'Unknown';
        if (!original._sources.includes(newSource)) {
          original._sources.push(newSource);
        }
        dupMap.set(key, {
          workorder: workorder || 'Unknown WO',
          sources: original._sources
        });
      }
    });

    if (onReport) {
      const dupes = Array.from(dupMap.values());
      onReport(dupes.length > 0 ? dupes : null);
    }
    
    return Array.from(uniqueMap.values());
  };

  // Process the JSON format based on the sample data
  const processData = (jsonData) => {
    try {
      // Check if it has the nested format: { status, data: { status, count, columns, data } }
      let targetData = jsonData;
      if (targetData.data && targetData.data.columns && targetData.data.data) {
        targetData = targetData.data;
      }
      
      if (targetData.columns && targetData.data) {
        setColumns(targetData.columns);
        const taggedData = targetData.data.map(r => ({ ...r, _source: 'Local File' }));
        setData(deduplicateData(taggedData, setDuplicatesReport));
        setError('');
      } else {
        throw new Error('Invalid JSON format. Expected an object containing "columns" and "data" arrays.');
      }
    } catch (err) {
      setError(err.message);
      setData(null);
    }
  };

  // Handle local file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        processData(parsed);
      } catch (err) {
        setError('Error parsing JSON file. Please ensure it is valid JSON.');
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Error reading file.');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  // Helper for fetching and extracting
  const fetchAndExtract = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} from ${url}`);
    }
    const jsonData = await response.json();
    let targetData = jsonData;
    if (targetData.data && targetData.data.columns && targetData.data.data) {
      targetData = targetData.data;
    }
    if (targetData.columns && targetData.data) {
      return targetData;
    }
    throw new Error(`Invalid JSON format from ${url}`);
  };

  // Handle URL fetch (single)
  const handleFetchData = async () => {
    setLoading(true);
    setError('');
    
    const targetUrl = apiUrl;

    try {
      const result = await fetchAndExtract(targetUrl);
      setColumns(result.columns);
      const taggedData = result.data.map(r => ({ ...r, _source: targetUrl.split('/')[3] || 'API' }));
      setData(deduplicateData(taggedData, setDuplicatesReport));
    } catch (err) {
      setError(`Failed to fetch data from ${targetUrl}. ${err.message}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle Fetch All (Extreme Mode)
  const handleFetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [res1, res2, res3] = await Promise.all([
        fetchAndExtract('https://10.2.113.250/tif2so/api/data'),
        fetchAndExtract('http://10.2.113.250/wappr/api/data'),
        fetchAndExtract('http://10.2.113.250/workfail/api/data')
      ]);
      // Tag data before merge
      const res1Data = res1.data.map(r => ({ ...r, _source: 'tif2so' }));
      const res2Data = res2.data.map(r => ({ ...r, _source: 'wappr' }));
      const res3Data = res3.data.map(r => ({ ...r, _source: 'workfail' }));
      const mergedData = [...res1Data, ...res2Data, ...res3Data];
      
      // Combine columns uniquely just in case
      const mergedColumns = Array.from(new Set([...res1.columns, ...res2.columns, ...res3.columns]));
      
      setColumns(mergedColumns);
      setData(deduplicateData(mergedData, setDuplicatesReport));
    } catch (err) {
      setError(`Failed to fetch both APIs. ${err.message}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* ── Top Header ── */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-color)' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          Data Importer
        </h1>
        <p>Import JSON data via local file upload or fetch from remote API links</p>
      </header>

      {/* ── Control Panel ── */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="controls-wrapper" style={{ border: 'none', borderRadius: '0', background: 'transparent' }}>
          
          {/* File Upload Section */}
          <div className="input-group" style={{ flex: '1 1 300px' }}>
            <label className="input-label">Local File Upload</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type="file" 
                accept=".json"
                onChange={handleFileUpload}
                ref={fileInputRef}
                style={{ width: '100%', padding: '0.75rem', borderStyle: 'dashed' }}
              />
            </div>
          </div>
          
          <div style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>OR</div>

          {/* API Fetch Section */}
          <div className="input-group" style={{ flex: '2 1 500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label className="input-label">Fetch from API</label>
              <div className="api-tabs">
                <button 
                  type="button" 
                  className={`api-tab ${apiUrl.includes('tif2so') ? 'active' : ''}`}
                  onClick={() => setApiUrl('https://10.2.113.250/tif2so/api/data')}
                >tif2so</button>
                <button 
                  type="button" 
                  className={`api-tab ${apiUrl.includes('wappr') ? 'active' : ''}`}
                  onClick={() => setApiUrl('http://10.2.113.250/wappr/api/data')}
                >wappr</button>
                <button 
                  type="button" 
                  className={`api-tab ${apiUrl.includes('workfail') ? 'active' : ''}`}
                  onClick={() => setApiUrl('http://10.2.113.250/workfail/api/data')}
                >workfail</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </div>
                <input 
                  type="text" 
                  value={apiUrl} 
                  onChange={(e) => setApiUrl(e.target.value)}
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                  title="API URL"
                  placeholder="https://..."
                />
              </div>
              <button className="btn btn-primary" onClick={handleFetchData} disabled={loading} style={{ padding: '0 1.5rem' }}>
                {loading ? 'Fetching...' : 'Fetch'}
              </button>
              <button className="btn" onClick={handleFetchAll} disabled={loading} style={{ background: 'var(--bg-hover)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                Fetch All
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ 
            margin: '0 1.5rem 1.5rem 1.5rem', 
            padding: '1rem 1.25rem', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '0.5rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Duplicate Data Alert ── */}
      {duplicatesReport && duplicatesReport.length > 0 && (
        <div style={{ 
          margin: '0 1.5rem 1.5rem 1.5rem', 
          padding: '0.75rem 1.25rem', 
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '0.5rem',
          color: '#fbbf24',
          fontSize: '0.875rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Deduplication automatically merged <strong>{duplicatesReport.length}</strong> identical records.</span>
          </div>
          <button 
            onClick={() => setShowDupModal(true)} 
            style={{ background: 'rgba(245, 158, 11, 0.2)', border: 'none', color: '#fcd34d', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
          >
            View Details
          </button>
        </div>
      )}

      {/* ── Duplicates Modal ── */}
      {showDupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Duplicate Records</h3>
              <button onClick={() => setShowDupModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {duplicatesReport.map((dup, idx) => (
                <div key={idx} style={{ background: 'var(--bg-dark)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 500 }}>
                    {dup.workorder}
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {dup.sources.map(src => {
                      let color = '#9ca3af';
                      let bg = 'rgba(156,163,175,0.1)';
                      if (src === 'wappr') { color = '#3b82f6'; bg = 'rgba(59,130,246,0.1)'; }
                      else if (src === 'workfail') { color = '#ef4444'; bg = 'rgba(239,68,68,0.1)'; }
                      else if (src === 'tif2so') { color = '#10b981'; bg = 'rgba(16,185,129,0.1)'; }
                      return (
                        <span key={src} style={{ fontSize: '0.65rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: bg, color: color, border: `1px solid ${bg}` }}>
                          Found in {src.toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && !data && (
        <div className="glass-panel loader-container">
          <div className="loader"></div>
          <p style={{ fontWeight: 500 }}>Processing data, please wait...</p>
        </div>
      )}

      {/* ── Data Table ── */}
      {!loading && data && columns.length > 0 && (
        <DataTable data={data} columns={columns} />
      )}
    </div>
  );
}

export default App;
