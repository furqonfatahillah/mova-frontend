import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Check, RotateCcw } from 'lucide-react';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN',
  'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'
];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateString(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function parseDateStr(str) {
  if (!str) return null;
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDisplayDate(str) {
  const d = parseDateStr(str);
  if (!d) return str || '—';
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export default function DateRangePicker({
  from,
  to,
  onChange,
  label = 'Periode',
  align = 'left',
  style = {},
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current date strings
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateString(today.getFullYear(), today.getMonth(), today.getDate()), [today]);

  const initialFrom = from || todayStr;
  const initialTo = to || todayStr;

  // Internal draft states for picking
  const [draftFrom, setDraftFrom] = useState(initialFrom);
  const [draftTo, setDraftTo] = useState(initialTo);
  const [hoverDate, setHoverDate] = useState(null);
  const [selectingStep, setSelectingStep] = useState(0); // 0 = ready for start date, 1 = selecting end date

  // Calendar View Month/Year
  const fromDateObj = useMemo(() => parseDateStr(draftFrom) || today, [draftFrom, today]);
  const [viewYear, setViewYear] = useState(fromDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(fromDateObj.getMonth());
  const [showMonthSelect, setShowMonthSelect] = useState(false);

  // Sync external props to internal draft when popover opens or props change
  useEffect(() => {
    setDraftFrom(from || todayStr);
    setDraftTo(to || todayStr);
  }, [from, to, todayStr]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSelectingStep(0);
        setShowMonthSelect(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Month navigation
  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  }

  // Days in current view month
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  }, [viewYear, viewMonth]);

  // Handle day cell click
  function handleDayClick(dayNum) {
    const clickedStr = toDateString(viewYear, viewMonth, dayNum);

    if (selectingStep === 0) {
      // First click: set start date, reset end date
      setDraftFrom(clickedStr);
      setDraftTo(clickedStr);
      setSelectingStep(1);
    } else {
      // Second click: set end date
      let newFrom = draftFrom;
      let newTo = clickedStr;

      if (clickedStr < draftFrom) {
        newFrom = clickedStr;
        newTo = draftFrom;
      }

      setDraftFrom(newFrom);
      setDraftTo(newTo);
      setSelectingStep(0);

      // Auto-apply on range completion
      if (onChange) {
        onChange({ from: newFrom, to: newTo });
      }
      setIsOpen(false);
    }
  }

  // Presets handlers
  function applyPreset(presetType) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (presetType === 'TODAY') {
      start = now;
      end = now;
    } else if (presetType === 'YESTERDAY') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end = start;
    } else if (presetType === 'LAST_7') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      end = now;
    } else if (presetType === 'LAST_30') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      end = now;
    } else if (presetType === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (presetType === 'LAST_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const startStr = toDateString(start.getFullYear(), start.getMonth(), start.getDate());
    const endStr = toDateString(end.getFullYear(), end.getMonth(), end.getDate());

    setDraftFrom(startStr);
    setDraftTo(endStr);
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
    setSelectingStep(0);

    if (onChange) {
      onChange({ from: startStr, to: endStr });
    }
    setIsOpen(false);
  }

  // Determine active effective range for visual highlight
  const effectiveFrom = draftFrom;
  const effectiveTo = selectingStep === 1 && hoverDate
    ? (hoverDate < draftFrom ? hoverDate : hoverDate)
    : draftTo;

  const rangeMin = effectiveFrom <= effectiveTo ? effectiveFrom : effectiveTo;
  const rangeMax = effectiveFrom <= effectiveTo ? effectiveTo : effectiveFrom;

  const displayFrom = formatDisplayDate(from);
  const displayTo = formatDisplayDate(to);
  const isSameDate = from === to;

  return (
    <div className={`date-range-picker-wrap ${className}`} ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      {/* Trigger Button */}
      <button
        type="button"
        className="btn btn-secondary date-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          fontSize: 12.5,
          fontWeight: 600,
          background: 'var(--bg-card)',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border-strong)',
          color: 'var(--text-primary)',
          borderRadius: 8,
          boxShadow: isOpen ? '0 0 0 2px rgba(99, 102, 241, 0.25)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <Calendar size={14} color="var(--accent-bright)" />
        {label && <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}:</span>}
        <span style={{ color: 'var(--accent-bright)', fontWeight: 700, fontFamily: 'monospace' }}>
          {isSameDate ? displayFrom : `${displayFrom} – ${displayTo}`}
        </span>
        <ChevronDown size={13} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--text-muted)' }} />
      </button>

      {/* Calendar Popover Dropdown */}
      {isOpen && (
        <div
          className="date-picker-popover fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            [align]: 0,
            zIndex: 99999,
            width: 320,
            padding: 16,
            background: '#13182e',
            color: '#f8fafc',
            borderRadius: 14,
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(99, 102, 241, 0.25)',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}
        >
          {/* Header Navigation Bar (e.g., SEP 2026  <  >) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowMonthSelect(!showMonthSelect)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 6px',
                  borderRadius: 6
                }}
              >
                <span>{MONTH_SHORT[viewMonth]} {viewYear}</span>
                <ChevronDown size={14} color="#a5b4fc" />
              </button>

              {/* Month/Year Quick Selector Dropdown */}
              {showMonthSelect && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  background: '#11162d',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: 8,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.85)',
                  padding: 8,
                  zIndex: 100000,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 4,
                  width: 200
                }}>
                  {MONTH_SHORT.map((m, idx) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setViewMonth(idx);
                        setShowMonthSelect(false);
                      }}
                      style={{
                        padding: '6px 4px',
                        fontSize: 11,
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 4,
                        background: viewMonth === idx ? '#6366f1' : 'rgba(255, 255, 255, 0.06)',
                        color: viewMonth === idx ? '#ffffff' : '#cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Arrows Prev / Next */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#ffffff'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#ffffff'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekdays Row (S M T W T F S) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#94a3b8',
            marginBottom: 8
          }}>
            {WEEKDAYS.map((w, i) => (
              <div key={i} style={{ padding: '4px 0' }}>{w}</div>
            ))}
          </div>

          {/* Month Subtitle (e.g. SEP) */}
          <div style={{ fontSize: 11, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>
            {MONTH_SHORT[viewMonth]}
          </div>

          {/* Calendar Grid (Days 1 to DaysInMonth) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4, columnGap: 0, marginBottom: 12 }}>
            {/* Leading empty slots */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = toDateString(viewYear, viewMonth, dayNum);

              const isStart = dateStr === rangeMin;
              const isEnd = dateStr === rangeMax;
              const isSingleSelected = rangeMin === rangeMax && isStart;
              const isBetween = dateStr > rangeMin && dateStr < rangeMax;
              const isToday = dateStr === todayStr;

              // Background bar styling for continuous range
              let cellBg = 'transparent';
              if (isBetween) {
                cellBg = 'rgba(99, 102, 241, 0.22)';
              } else if (isStart && !isSingleSelected) {
                cellBg = 'linear-gradient(to right, transparent 50%, rgba(99, 102, 241, 0.22) 50%)';
              } else if (isEnd && !isSingleSelected) {
                cellBg = 'linear-gradient(to left, transparent 50%, rgba(99, 102, 241, 0.22) 50%)';
              }

              return (
                <div
                  key={dayNum}
                  style={{
                    background: cellBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    position: 'relative'
                  }}
                  onMouseEnter={() => setHoverDate(dateStr)}
                >
                  <button
                    type="button"
                    onClick={() => handleDayClick(dayNum)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      border: isToday ? '1.5px solid #818cf8' : 'none',
                      background: (isStart || isEnd) ? '#6366f1' : 'transparent',
                      color: (isStart || isEnd) ? '#ffffff' : (isBetween ? '#c7d2fe' : '#f1f5f9'),
                      fontWeight: (isStart || isEnd || isToday) ? 800 : 500,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.1s ease',
                      zIndex: 2,
                      padding: 0,
                      boxShadow: (isStart || isEnd) ? '0 2px 8px rgba(99, 102, 241, 0.5)' : 'none'
                    }}
                  >
                    {dayNum}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Presets Shortcuts Panel */}
          <div style={{
            borderTop: '1px solid rgba(165, 180, 252, 0.15)',
            paddingTop: 10,
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {[
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'LAST_7', label: '7 Hari' },
              { id: 'THIS_MONTH', label: 'Bulan Ini' },
              { id: 'LAST_MONTH', label: 'Bulan Lalu' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#e2e8f0',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Status Instructions Subtext */}
          <div style={{ fontSize: 10.5, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
            {selectingStep === 1 ? '👉 Klik tanggal kedua untuk mengakhiri rentang' : 'Pilih rentang tanggal pada kalender'}
          </div>
        </div>
      )}
    </div>
  );
}
