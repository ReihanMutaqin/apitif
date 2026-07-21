import React, { useRef, useEffect, useState, useCallback } from 'react';

// Status color map matching the project's existing status badge colors
const STATUS_COLORS = {
  actcomp:  { stroke: 'rgba(52, 211, 153, 0.9)',  fill: 'rgba(16, 185, 129, 0.12)', label: '#34d399' },
  contwork: { stroke: 'rgba(251, 191, 36, 0.9)',  fill: 'rgba(245, 158, 11, 0.12)', label: '#fbbf24' },
  close:    { stroke: 'rgba(248, 113, 113, 0.9)', fill: 'rgba(239, 68, 68, 0.12)',  label: '#f87171' },
  wappr:    { stroke: 'rgba(196, 181, 253, 0.9)', fill: 'rgba(139, 92, 246, 0.12)', label: '#c4b5fd' },
  wmatl:    { stroke: 'rgba(56, 189, 248, 0.9)',  fill: 'rgba(14, 165, 233, 0.12)', label: '#38bdf8' },
  default:  { stroke: 'rgba(161, 161, 170, 0.75)',fill: 'rgba(161, 161, 170, 0.08)',label: '#a1a1aa' },
};

function getStatusColor(status) {
  if (!status) return STATUS_COLORS.default;
  return STATUS_COLORS[status.toLowerCase()] || STATUS_COLORS.default;
}

// Layout ESP boxes in a responsive grid from data rows
function buildESPEntities(data, columns, canvasW, canvasH) {
  if (!data || data.length === 0) return [];

  const woKey    = columns.find(c => c.trim().toUpperCase() === 'WORKORDER') || columns[0];
  const statKey  = columns.find(c => c.trim().toUpperCase() === 'STATUS');
  const witelKey = columns.find(c => c.trim().toUpperCase() === 'WITEL');
  const dateKey  = columns.find(c =>
    c.toUpperCase().includes('DATE') || c.toUpperCase().includes('TGL')
  );

  // Cap render count for performance
  const MAX = Math.min(data.length, 60);
  const slice = data.slice(0, MAX);

  // Grid layout
  const BOX_W = 180;
  const BOX_H = 90;
  const PAD_X = 28;
  const PAD_Y = 48;
  const cols  = Math.max(1, Math.floor((canvasW - PAD_X * 2) / (BOX_W + PAD_X)));
  const rows  = Math.ceil(slice.length / cols);

  const totalGridW = cols  * (BOX_W + PAD_X) - PAD_X;
  const totalGridH = rows * (BOX_H + PAD_Y);

  const startX = Math.max(PAD_X, (canvasW - totalGridW) / 2);
  const startY = 80;

  return slice.map((row, i) => {
    const col  = i % cols;
    const rowI = Math.floor(i / cols);
    const x    = startX + col * (BOX_W + PAD_X);
    const y    = startY + rowI * (BOX_H + PAD_Y);
    const status = statKey ? String(row[statKey] || '').toLowerCase() : '';

    return {
      x, y,
      w: BOX_W,
      h: BOX_H,
      label:  row[woKey]    ? String(row[woKey]).trim()    : `ROW ${i + 1}`,
      status: statKey       ? String(row[statKey] || '—')  : '—',
      witel:  witelKey      ? String(row[witelKey] || '—') : null,
      date:   dateKey       ? String(row[dateKey]  || '—') : null,
      color:  getStatusColor(status),
      index:  i + 1,
    };
  });
}

const ESPVisualizer = ({ data, columns, onClose }) => {
  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const tickRef    = useRef(0);
  const [entityCount, setEntityCount] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    tickRef.current += 1;
    const t = tickRef.current;

    // ── Background ──────────────────────────────
    ctx.clearRect(0, 0, W, H);

    // Subtle scanline grid
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.04)';
    ctx.lineWidth   = 1;
    const GRID = 40;
    for (let gx = 0; gx < W; gx += GRID) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += GRID) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Scrolling scan line
    const scanY = (t * 1.4) % H;
    const scanGrad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 4);
    scanGrad.addColorStop(0, 'rgba(59,130,246,0)');
    scanGrad.addColorStop(1, 'rgba(59,130,246,0.06)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY - 20, W, 24);

    // ── Header bar ──────────────────────────────
    ctx.fillStyle = 'rgba(9,9,11,0.85)';
    ctx.fillRect(0, 0, W, 52);

    // Header label
    ctx.font        = 'bold 13px "Inter", monospace';
    ctx.fillStyle   = '#3b82f6';
    ctx.textAlign   = 'left';
    ctx.fillText('◈ ESP OVERLAY', 20, 22);

    ctx.font      = '11px "Inter", monospace';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(`${entityCount} ENTITIES TRACKED`, 20, 40);

    // Pulsing indicator dot
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.08);
    ctx.beginPath();
    ctx.arc(W - 24, 26, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(52, 211, 153, ${0.5 + 0.5 * pulse})`;
    ctx.fill();
    ctx.font      = '10px "Inter", monospace';
    ctx.fillStyle = '#34d399';
    ctx.textAlign = 'right';
    ctx.fillText('LIVE', W - 34, 30);

    // Timestamp
    const now = new Date().toLocaleTimeString('id-ID');
    ctx.fillStyle = 'rgba(161,161,170,0.5)';
    ctx.font      = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(now, W - 18, 46);

    // ── Entity boxes ────────────────────────────
    const entities = buildESPEntities(data, columns, W, H);
    setEntityCount(entities.length);

    entities.forEach(ent => {
      const { x, y, w, h, color, label, status, witel, date, index } = ent;
      const pulseFactor = 0.6 + 0.4 * Math.sin(t * 0.05 + index * 0.7);

      // Box fill
      ctx.fillStyle = color.fill;
      ctx.fillRect(x, y, w, h);

      // Box border with pulse
      ctx.strokeStyle = color.stroke.replace(/[\d.]+\)$/, `${pulseFactor})`);
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(x, y, w, h);

      // Corner brackets (ESP aesthetic)
      const CL = 10; // corner length
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth   = 2;
      // TL
      ctx.beginPath(); ctx.moveTo(x, y + CL); ctx.lineTo(x, y); ctx.lineTo(x + CL, y); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(x + w - CL, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + CL); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(x, y + h - CL); ctx.lineTo(x, y + h); ctx.lineTo(x + CL, y + h); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(x + w - CL, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - CL); ctx.stroke();

      // Index badge (top-left corner)
      ctx.fillStyle = color.stroke;
      ctx.font      = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`#${String(index).padStart(2, '0')}`, x + 6, y + 12);

      // Divider line inside box
      ctx.strokeStyle = color.stroke.replace(/[\d.]+\)$/, '0.3)');
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(x + 4, y + 18); ctx.lineTo(x + w - 4, y + 18); ctx.stroke();

      // Workorder label
      const truncLabel = label.length > 22 ? label.slice(0, 20) + '…' : label;
      ctx.font      = 'bold 11px "Inter", monospace';
      ctx.fillStyle = color.label;
      ctx.textAlign = 'left';
      ctx.fillText(truncLabel, x + 6, y + 33);

      // Status
      ctx.font      = '9px "Inter", monospace';
      ctx.fillStyle = color.stroke;
      const statusText = `⬡ ${status.toUpperCase()}`;
      ctx.fillText(statusText, x + 6, y + 47);

      // Witel (if available)
      if (witel) {
        ctx.font      = '9px monospace';
        ctx.fillStyle = 'rgba(161,161,170,0.8)';
        const witelStr = witel.length > 20 ? witel.slice(0, 18) + '…' : witel;
        ctx.fillText(`📍 ${witelStr}`, x + 6, y + 61);
      }

      // Date (if available)
      if (date && date !== '—') {
        ctx.font      = '8px monospace';
        ctx.fillStyle = 'rgba(161,161,170,0.55)';
        const dateStr = date.length > 24 ? date.slice(0, 22) + '…' : date;
        ctx.fillText(dateStr, x + 6, y + 77);
      }

      // Distance bar (visual — proportional to index/total)
      const barW   = w - 12;
      const filled = (barW * (1 - (index - 1) / Math.max(entities.length - 1, 1)));
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 6, y + h - 10, barW, 4);
      ctx.fillStyle = color.stroke.replace(/[\d.]+\)$/, '0.5)');
      ctx.fillRect(x + 6, y + h - 10, filled, 4);
    });

    // ── Footer bar ──────────────────────────────
    ctx.fillStyle = 'rgba(9,9,11,0.7)';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.font      = '10px monospace';
    ctx.fillStyle = 'rgba(161,161,170,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('ESP OVERLAY — Data Importer Project | For Research & Educational Purpose Only', 16, H - 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(59,130,246,0.5)';
    ctx.fillText(`FRAME ${t}`, W - 16, H - 10);

    rafRef.current = requestAnimationFrame(draw);
  }, [data, columns, entityCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <div className="esp-overlay-panel">
      {/* Close / toggle button */}
      <button
        className="esp-close-btn"
        onClick={onClose}
        title="Tutup ESP View"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        Tutup ESP View
      </button>

      <canvas
        ref={canvasRef}
        className="esp-canvas"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};

export default ESPVisualizer;
