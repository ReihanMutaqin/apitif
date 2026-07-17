import React, { useState, useMemo } from 'react';

const DataTable = ({ data, columns }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const rowsPerPage = 50;

  // Filter data based on search term (supports mass search via newlines/commas)
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    // Split search term by newline or comma, filter out empty, and lowercase
    const searchTokens = searchTerm
      .split(/[\n,]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    if (searchTokens.length === 0) return data;
    
    return data.filter(row => {
      // For mass search, a row matches if ANY of its columns contains ANY of the search tokens
      return searchTokens.some(token => {
        return columns.some(col => {
          const val = row[col];
          return val && String(val).toLowerCase().includes(token);
        });
      });
    });
  }, [data, columns, searchTerm]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredData, currentPage]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const getStatusClass = (status) => {
    if (!status) return 'status-default';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'actcomp') return 'status-actcomp';
    if (lowerStatus === 'contwork') return 'status-contwork';
    return 'status-default';
  };

  return (
    <div className="glass-panel">
      <div className="controls-wrapper" style={{ marginBottom: '1.5rem' }}>
        <div className="search-bar">
          <textarea
            placeholder="Search any data... Or paste multiple IDs separated by newline/comma for mass search"
            value={searchTerm}
            onChange={handleSearch}
            style={{ 
              width: '100%', 
              background: 'rgba(15, 23, 42, 0.6)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-main)', 
              padding: '0.75rem 1rem', 
              borderRadius: '0.5rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: '45px',
              maxHeight: '200px',
              outline: 'none',
              transition: 'all 0.3s ease'
            }}
            rows={2}
          />
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Showing {filteredData.length} of {data.length} records
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col, colIdx) => {
                    const val = row[col];
                    // Add special styling for STATUS column
                    if (col === 'STATUS') {
                      return (
                        <td key={colIdx}>
                          <span className={`status-badge ${getStatusClass(val)}`}>
                            {val}
                          </span>
                        </td>
                      );
                    }
                    return <td key={colIdx}>{val !== null && val !== 'Null' ? val : '-'}</td>;
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>
                  No records found matching "{searchTerm}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
