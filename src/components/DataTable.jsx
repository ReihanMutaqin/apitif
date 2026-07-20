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

const DataTable = ({ data, columns }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [jumpPage, setJumpPage] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  // Auto-detect categorical columns (columns with 1 to 20 unique values) for filtering
  const filterableColumns = useMemo(() => {
    const candidates = [];
    columns.forEach(col => {
      const uniqueValues = new Set();
      let hasTooMany = false;
      for (const row of data) {
        const val = row[col];
        if (val !== null && val !== undefined && val !== '') {
          uniqueValues.add(val);
        }
        if (uniqueValues.size > 20) {
          hasTooMany = true;
          break;
        }
      }
      // If it has between 1 and 20 unique values, it's a good categorical filter candidate
      if (!hasTooMany && uniqueValues.size > 0 && uniqueValues.size < data.length) {
        candidates.push({ col, options: Array.from(uniqueValues).sort() });
      }
    });
    return candidates;
  }, [data, columns]);

  const searchTokens = useMemo(() => {
    if (!searchTerm) return [];
    return searchTerm
      .split(/[\n,]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
  }, [searchTerm]);

  const filteredData = useMemo(() => {
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

    // 2. Apply Global Search
    if (searchTokens.length > 0) {
      result = result.filter(row =>
        searchTokens.some(token =>
          columns.some(col => {
            const val = row[col];
            return val && String(val).toLowerCase().includes(token);
          })
        )
      );
    }
    
    return result;
  }, [data, columns, searchTokens, activeFilters]);

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
      {/* ── Top toolbar ── */}
      <div className="dt-toolbar">
        <div className="dt-search-wrap">
          <span className="dt-search-icon">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </span>
          <textarea
            className="dt-search"
            placeholder="Search… or paste multiple IDs separated by newline / comma"
            value={searchTerm}
            onChange={handleSearch}
            rows={1}
          />
        </div>

        <div className="dt-toolbar-right">
          <div className="dt-stats">
            {searchTokens.length > 0
              ? <><strong>{filteredData.length.toLocaleString()}</strong> match</>
              : <><strong>{data.length.toLocaleString()}</strong> records</>
            }
          </div>

          <select className="dt-rows-select" value={rowsPerPage} onChange={handleRowsPerPage} title="Rows per page">
            {ROWS_OPTIONS.map(n => <option key={n} value={n}>{n} rows</option>)}
          </select>

          <button className="dt-export-btn" onClick={handleExportCSV} title="Export visible data to CSV">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Active Filters Bar (Auto-detected categorical columns) ── */}
      {filterableColumns.length > 0 && (
        <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(15, 23, 42, 0.3)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>FILTER BY:</span>
          {filterableColumns.map(({ col, options }) => (
            <select
              key={col}
              className="dt-rows-select"
              style={{ padding: '0.3rem 1.8rem 0.3rem 0.6rem', fontSize: '0.75rem' }}
              value={activeFilters[col] || ''}
              onChange={(e) => {
                setActiveFilters(prev => ({ ...prev, [col]: e.target.value }));
                setCurrentPage(1);
              }}
            >
              <option value="">All {col}</option>
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ))}
          {Object.values(activeFilters).some(v => v !== '') && (
            <button 
              onClick={() => { setActiveFilters({}); setCurrentPage(1); }}
              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear Filters
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
                  <div className="dt-empty-inner">
                    <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <span>No records found for <strong>"{searchTerm}"</strong></span>
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
            Showing <strong>{startRow.toLocaleString()}–{endRow.toLocaleString()}</strong> of <strong>{sortedData.length.toLocaleString()}</strong>
          </div>

          <div className="dt-page-controls">
            <button
              className="dt-page-btn dt-page-arrow"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="First page"
            >«</button>
            <button
              className="dt-page-btn dt-page-arrow"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Previous page"
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
              title="Next page"
            >›</button>
            <button
              className="dt-page-btn dt-page-arrow"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Last page"
            >»</button>
          </div>

          <form className="dt-jump-form" onSubmit={handleJumpPage}>
            <span className="dt-jump-label">Go to</span>
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
