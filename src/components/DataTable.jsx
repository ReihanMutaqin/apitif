import React, { useState, useMemo } from 'react';

const ROWS_OPTIONS = [25, 50, 100, 200];

// Highlight matching text inside a cell value
const HighlightText = ({ text, tokens }) => {
  if (!text || !tokens || tokens.length === 0) return <>{text ?? '-'}</>;
  const str = String(text);
  const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
  const parts = str.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        tokens.some(t => part.toLowerCase() === t.toLowerCase()) ? (
          <mark key={i} className="highlight-match">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const SortIcon = ({ direction }) => {
  if (!direction) return (
    <span className="sort-icon sort-idle">
      <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
        <path d="M6 1L9 4H3L6 1Z" fill="currentColor" opacity="0.4"/>
        <path d="M6 13L3 10H9L6 13Z" fill="currentColor" opacity="0.4"/>
      </svg>
    </span>
  );
  return (
    <span className="sort-icon sort-active">
      {direction === 'asc' ? (
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
          <path d="M6 1L9 4H3L6 1Z" fill="currentColor"/>
          <path d="M6 13L3 10H9L6 13Z" fill="currentColor" opacity="0.25"/>
        </svg>
      ) : (
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
          <path d="M6 1L9 4H3L6 1Z" fill="currentColor" opacity="0.25"/>
          <path d="M6 13L3 10H9L6 13Z" fill="currentColor"/>
        </svg>
      )}
    </span>
  );
};

const DataTable = ({ data, columns, duplicatesReport }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [jumpPage, setJumpPage] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showSearchDetails, setShowSearchDetails] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);
  const [selectedDup, setSelectedDup] = useState(null);

  // Base categorical columns definition (limit to 150 unique values to include WITEL)
  const baseCategoricalCols = useMemo(() => {
    const cols = [];
    columns.forEach(col => {
      const uniqueValues = new Set();
      let hasTooMany = false;
      for (const row of data) {
        const val = row[col];
        if (val !== null && val !== undefined && val !== '') uniqueValues.add(val);
        if (uniqueValues.size > 150) {
          hasTooMany = true;
          break;
        }
      }
      if (!hasTooMany && uniqueValues.size > 0 && uniqueValues.size < data.length) {
        cols.push(col);
      }
    });
    return cols;
  }, [data, columns]);

  // Dynamic filter options based on OTHER active filters (Cascading Filters)
  const filterableColumns = useMemo(() => {
    return baseCategoricalCols.map(col => {
      // Data filtered by all filters EXCEPT this `col`
      const dataForThisCol = data.filter(row => {
        return Object.entries(activeFilters).every(([fCol, fVal]) => {
          if (fCol === col) return true; // ignore this column's own filter
          if (!fVal) return true;
          return String(row[fCol]) === String(fVal);
        });
      });
      
      const uniqueValues = new Set();
      for (const row of dataForThisCol) {
        const val = row[col];
        if (val !== null && val !== undefined && val !== '') {
          uniqueValues.add(val);
        }
      }
      
      // FIX: Always include the currently active filter value so it doesn't disappear when cascading
      if (activeFilters[col]) {
        uniqueValues.add(activeFilters[col]);
      }
      
      return { col, options: Array.from(uniqueValues).sort() };
    });
  }, [baseCategoricalCols, data, activeFilters]);

  const searchTokens = useMemo(() => {
    if (!searchTerm) return [];
    return searchTerm
      .split(/[\n,]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
  }, [searchTerm]);

  const { filteredData, foundTokens, notFoundTokens } = useMemo(() => {
    let result = data;

    // 1. Apply Categorical Filters
    if (Object.keys(activeFilters).length > 0) {
      result = result.filter(row => {
        return Object.entries(activeFilters).every(([col, val]) => {
          if (!val) return true; // Skip empty filters
          return String(row[col]) === String(val);
        });
      });
    }

    const found = new Set();
    const notFound = new Set(searchTokens);

    // 2. Apply Global Search
    if (searchTokens.length > 0) {
      result = result.filter(row => {
        let isRowMatch = false;
        searchTokens.forEach(token => {
          const matchInCol = columns.some(col => {
            const val = row[col];
            return val && String(val).toLowerCase().includes(token);
          });
          if (matchInCol) {
            isRowMatch = true;
            found.add(token);
            notFound.delete(token);
          }
        });
        return isRowMatch;
      });
    }
    
    return {
      filteredData: result,
      foundTokens: Array.from(found),
      notFoundTokens: Array.from(notFound)
    };
  }, [data, columns, searchTokens, activeFilters]);

  const filteredDuplicates = useMemo(() => {
    if (!duplicatesReport || duplicatesReport.length === 0) return [];
    
    // Quick lookup for workorders in filteredData
    const visibleWOs = new Set();
    filteredData.forEach(row => {
      const woKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'WORKORDER');
      if (woKey) {
         visibleWOs.add(String(row[woKey]).trim());
      }
    });
    
    return duplicatesReport.filter(dup => visibleWOs.has(dup.workorder));
  }, [filteredData, duplicatesReport]);

  const sortedData = useMemo(() => {
    if (!sortCol) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortCol] ?? '';
      const bVal = b[sortCol] ?? '';
      
      // Strict numeric check (prevents dates like 2026-05-20 from being parsed as just 2026)
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      const isNum = aVal !== '' && bVal !== '' && !isNaN(aNum) && !isNaN(bNum);
      
      let cmp = 0;
      if (isNum) {
        cmp = aNum - bNum;
      } else {
        cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      }
      
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortCol, sortDir]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(startIdx, startIdx + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const handleRowsPerPage = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleJumpPage = (e) => {
    e.preventDefault();
    const p = parseInt(jumpPage);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
    setJumpPage('');
  };

  const handleExportCSV = () => {
    const header = columns.join(',');
    const rows = sortedData.map(row =>
      columns.map(col => {
        const val = row[col] ?? '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusClass = (status) => {
    if (!status) return 'status-default';
    const s = status.toLowerCase();
    if (s === 'actcomp') return 'status-actcomp';
    if (s === 'contwork') return 'status-contwork';
    if (s === 'close') return 'status-close';
    if (s === 'wappr') return 'status-wappr';
    if (s === 'wmatl') return 'status-wmatl';
    return 'status-default';
  };

  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, sortedData.length);

  // Build visible page numbers
  const pageNumbers = useMemo(() => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  return (
    <div className="glass-panel dt-wrapper">
      {/* ── Duplicate Data Alert ── */}
      {filteredDuplicates.length > 0 && (
        <div style={{ 
          margin: '0.75rem 1.25rem 0 1.25rem', 
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
            <span>Ditemukan <strong>{filteredDuplicates.length}</strong> data duplikat yang digabungkan pada tampilan ini.</span>
          </div>
          <button 
            onClick={() => setShowDupModal(true)} 
            style={{ background: 'rgba(245, 158, 11, 0.2)', border: 'none', color: '#fcd34d', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
          >
            Lihat Detail
          </button>
        </div>
      )}

      {/* ── Duplicates Modal ── */}
      {showDupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {selectedDup ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => setSelectedDup(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }} title="Kembali">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Detail Duplikat</h3>
                </div>
              ) : (
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Data Duplikat</h3>
              )}
              <button onClick={() => { setShowDupModal(false); setSelectedDup(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selectedDup ? (
                <div>
                  <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {selectedDup.sources.map(src => {
                      let color = '#9ca3af', bg = 'rgba(156,163,175,0.1)';
                      if (src === 'wappr') { color = '#3b82f6'; bg = 'rgba(59,130,246,0.1)'; }
                      else if (src === 'workfail') { color = '#ef4444'; bg = 'rgba(239,68,68,0.1)'; }
                      else if (src === 'tif2so') { color = '#10b981'; bg = 'rgba(16,185,129,0.1)'; }
                      return (
                        <span key={src} style={{ fontSize: '0.65rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: bg, color: color, border: `1px solid ${bg}` }}>
                          Ditemukan di {src.toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(() => {
                      const versions = selectedDup.versions || [];
                      if (versions.length === 0) return null;
                      
                      const allKeys = Array.from(new Set(versions.flatMap(v => Object.keys(v))));
                      const displayKeys = allKeys.filter(k => k !== '_source' && k !== '_sources' && k !== '_versions');
                      
                      return (
                        <div style={{ overflowX: 'auto', borderRadius: '0.375rem', border: '1px solid var(--border-color)', background: 'var(--bg-dark)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 }}>Kolom</th>
                                {versions.map((v, i) => (
                                  <th key={i} style={{ padding: '0.5rem', borderRight: i < versions.length-1 ? '1px solid var(--border-color)' : 'none', color: 'var(--text-main)', fontWeight: 600 }}>
                                    {v._source ? v._source.toUpperCase() : `Versi ${i+1}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {displayKeys.map((k, rIdx) => {
                                const vals = versions.map(v => v[k] != null ? String(v[k]).trim() : '-');
                                const isDiff = new Set(vals).size > 1;
                                return (
                                  <tr key={k} style={{ borderBottom: rIdx < displayKeys.length-1 ? '1px solid var(--border-color)' : 'none', background: isDiff ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                                    <td style={{ padding: '0.5rem', borderRight: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{k}</td>
                                    {vals.map((val, i) => (
                                      <td key={i} style={{ padding: '0.5rem', borderRight: i < vals.length-1 ? '1px solid var(--border-color)' : 'none', color: isDiff ? '#fca5a5' : 'var(--text-main)', wordBreak: 'break-word', minWidth: '150px' }}>
                                        {val}
                                      </td>
                                    ))}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ) : (
                filteredDuplicates.map((dup, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setSelectedDup(dup);
                    }} 
                    style={{ background: 'var(--bg-dark)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{dup.workorder}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
                            Ditemukan di {src.toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Top toolbar ── */}
      <div className="dt-toolbar">
        <div className="dt-search-wrap">
          <div style={{ position: 'relative' }}>
            <span className="dt-search-icon">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </span>
            <textarea
              className="dt-search"
              placeholder="Cari… atau tempel beberapa ID dipisahkan enter / koma"
              value={searchTerm}
              onChange={handleSearch}
              rows={Math.max(1, Math.min(6, searchTerm.split('\n').length))}
            />
          </div>
          {searchTokens.length > 1 && (
            <div className="dt-search-summary">
              <span className="dt-search-summary-text">
                Mencari <strong>{searchTokens.length}</strong> item: 
                <span style={{ color: '#34d399', marginLeft: '0.5rem' }}>{foundTokens.length} ditemukan</span>, 
                <span style={{ color: '#fca5a5', marginLeft: '0.5rem' }}>{notFoundTokens.length} tidak ditemukan</span>
              </span>
              <button onClick={() => setShowSearchDetails(!showSearchDetails)} className="btn-link">
                {showSearchDetails ? 'Sembunyikan detail' : 'Lihat detail'}
              </button>
            </div>
          )}
          {showSearchDetails && searchTokens.length > 1 && (
            <div className="dt-search-details">
              {notFoundTokens.length > 0 && (
                <div className="dt-search-details-group">
                  <strong>Tidak Ditemukan ({notFoundTokens.length})</strong>
                  <div className="dt-search-details-tokens">
                    {notFoundTokens.map(t => <span key={t} className="dt-token dt-token-notfound">{t}</span>)}
                  </div>
                </div>
              )}
              {foundTokens.length > 0 && (
                <div className="dt-search-details-group">
                  <strong>Ditemukan ({foundTokens.length})</strong>
                  <div className="dt-search-details-tokens">
                    {foundTokens.map(t => <span key={t} className="dt-token dt-token-found">{t}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="dt-toolbar-actions">
          {searchTokens.length > 0 && (
            <div className="dt-results-count">
              <span>{filteredData.length}</span> baris
            </div>
          )}
          
          <select className="dt-rows-select" value={rowsPerPage} onChange={handleRowsPerPage} title="Baris per halaman">
            {ROWS_OPTIONS.map(n => <option key={n} value={n}>{n} baris</option>)}
          </select>

          <button className="dt-export-btn" onClick={handleExportCSV} title="Ekspor data yang tampil ke CSV">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* ── Active Filters Bar (Premium Scrollable Chips) ── */}
      {filterableColumns.length > 0 && (
        <div className="dt-filter-bar">
          <div className="dt-filter-label">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V19l-4 2v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
            </svg>
            FILTER
          </div>
          <div className="dt-filter-scroll">
            {filterableColumns.map(({ col, options }) => {
              const isActive = !!activeFilters[col];
              return (
                <div key={col} className={`dt-filter-item ${isActive ? 'dt-filter-item-active' : ''}`}>
                  <span className="dt-filter-name">{col}</span>
                  <select
                    className="dt-filter-select"
                    value={activeFilters[col] || ''}
                    onChange={(e) => {
                      setActiveFilters(prev => ({ ...prev, [col]: e.target.value }));
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">Semua</option>
                    {options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          {Object.values(activeFilters).some(v => v !== '') && (
            <button 
              className="dt-filter-clear"
              onClick={() => { setActiveFilters({}); setCurrentPage(1); }}
            >
              Hapus Semua
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="dt-table-container">
        <table className="dt-table">
          <thead>
            <tr>
              <th className="dt-th dt-th-no">#</th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`dt-th dt-th-sortable${sortCol === col ? ' dt-th-sorted' : ''}`}
                  onClick={() => handleSort(col)}
                >
                  <span className="dt-th-inner">
                    {col}
                    <SortIcon direction={sortCol === col ? sortDir : null} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'dt-row-even' : 'dt-row-odd'}>
                  <td className="dt-td dt-td-no">{startRow + idx}</td>
                  {columns.map((col, colIdx) => {
                    const val = row[col];
                    if (col === 'STATUS') {
                      return (
                        <td key={colIdx} className="dt-td">
                          <span className={`status-badge ${getStatusClass(val)}`}>{val ?? '-'}</span>
                        </td>
                      );
                    }
                    const displayVal = val !== null && val !== 'Null' && val !== undefined ? val : null;
                    return (
                      <td key={colIdx} className="dt-td">
                        {displayVal !== null
                          ? <HighlightText text={displayVal} tokens={searchTokens} />
                          : <span className="dt-null">—</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1} className="dt-empty">
                  <div className="dt-empty-content">
                    <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Tidak ada data ditemukan untuk <strong>"{searchTerm}"</strong></span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="dt-pagination">
          <div className="dt-page-info">
            Menampilkan <strong>{startRow.toLocaleString()}–{endRow.toLocaleString()}</strong> dari <strong>{sortedData.length.toLocaleString()}</strong> entri
          </div>

          <div className="dt-page-controls">
            <button
              className="dt-page-btn dt-page-arrow"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="Halaman pertama"
            >«</button>
            <button
              className="dt-page-btn dt-page-arrow"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Halaman sebelumnya"
            >‹</button>

            {pageNumbers.map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="dt-page-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`dt-page-btn${currentPage === p ? ' dt-page-active' : ''}`}
                  onClick={() => setCurrentPage(p)}
                >{p}</button>
              )
            )}

            <button
              className="dt-page-btn dt-page-arrow"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              title="Halaman selanjutnya"
            >›</button>
            <button
              className="dt-page-btn dt-page-arrow"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Halaman terakhir"
            >»</button>
          </div>

          <form className="dt-jump-form" onSubmit={handleJumpPage}>
            <span className="dt-jump-label">Pergi ke</span>
            <input
              className="dt-jump-input"
              type="number"
              min="1"
              max={totalPages}
              value={jumpPage}
              onChange={e => setJumpPage(e.target.value)}
              placeholder="—"
            />
            <button type="submit" className="dt-jump-btn">Go</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default DataTable;
