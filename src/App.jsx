import React, { useState, useRef } from 'react';
import DataTable from './components/DataTable';
import './index.css'; // Make sure the premium styles are applied

function App() {
  const [data, setData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiUrl, setApiUrl] = useState('http://10.2.113.250/wappr/api/data');
  
  const fileInputRef = useRef(null);

  // Helper to deduplicate exact matching rows
  const deduplicateData = (dataArray) => {
    if (!Array.isArray(dataArray)) return dataArray;
    const uniqueMap = new Map();
    dataArray.forEach(row => {
      // Sort keys to ensure deterministic stringification
      const sortedKeys = Object.keys(row).sort();
      const obj = {};
      sortedKeys.forEach(k => { obj[k] = row[k]; });
      const rowStr = JSON.stringify(obj);
      if (!uniqueMap.has(rowStr)) {
        uniqueMap.set(rowStr, row);
      }
    });
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
        setData(deduplicateData(targetData.data));
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
      setData(deduplicateData(result.data));
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
      // Merge data
      const mergedData = [...res1.data, ...res2.data, ...res3.data];
      
      // Combine columns uniquely just in case
      const mergedColumns = Array.from(new Set([...res1.columns, ...res2.columns, ...res3.columns]));
      
      setColumns(mergedColumns);
      setData(deduplicateData(mergedData));
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
