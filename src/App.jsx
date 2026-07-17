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
        setData(targetData.data);
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

  // Handle URL fetch
  const handleFetchData = async () => {
    setLoading(true);
    setError('');
    
    // Use the URL provided by the user via state
    const targetUrl = apiUrl;

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      const jsonData = await response.json();
      processData(jsonData);
    } catch (err) {
      // Usually CORS or network issues will land here
      let errorMsg = `Failed to fetch data from ${targetUrl}. `;
      if (err.message === 'Failed to fetch') {
        errorMsg += 'This might be due to a CORS issue or the server being unreachable. Check your network or server CORS policy.';
      } else {
        errorMsg += err.message;
      }
      setError(errorMsg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="glass-panel">
        <h1>Data Importer Dashboard</h1>
        <p>Import JSON data via local upload or fetch from the API link to view and search.</p>
        
        <div className="controls-wrapper" style={{ marginTop: '1.5rem', alignItems: 'flex-start' }}>
          <div className="input-group">
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Local File Upload
            </label>
            <input 
              type="file" 
              accept=".json"
              onChange={handleFileUpload}
              ref={fileInputRef}
            />
          </div>
          
          <div className="input-group" style={{ display: 'flex', justifyContent: 'flex-end', height: '100%', paddingTop: '1.25rem' }}>
            <span style={{ margin: 'auto 1rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>OR</span>
          </div>

          <div className="input-group" style={{ flex: 1, minWidth: '300px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Fetch from API Link</span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                  onClick={() => setApiUrl('https://10.2.113.250/tif2so/api/data')}
                >Use tif2so</button>
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                  onClick={() => setApiUrl('http://10.2.113.250/wappr/api/data')}
                >Use wappr</button>
              </div>
            </label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <input 
                type="text" 
                value={apiUrl} 
                onChange={(e) => setApiUrl(e.target.value)}
                style={{ flex: 1 }}
                title="API URL"
                placeholder="Enter API URL"
              />
              <button className="btn" onClick={handleFetchData} disabled={loading}>
                {loading ? 'Fetching...' : 'Fetch Data'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            color: '#f87171'
          }}>
            <strong>Error: </strong> {error}
          </div>
        )}
      </div>

      {loading && !data && (
        <div className="glass-panel loader-container">
          <div className="loader"></div>
          <p>Processing data, please wait...</p>
        </div>
      )}

      {!loading && data && columns.length > 0 && (
        <DataTable data={data} columns={columns} />
      )}
    </div>
  );
}

export default App;
