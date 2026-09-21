import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, Tag } from 'lucide-react';

/**
 * SearchableSelect - Komponen Dropdown Searchable ala Select2
 *
 * Mendukung:
 * - Opsi flat: [{ value: 1, label: 'Nama', sublabel: 'Ket', badge: 'Tag' }] atau ['Item 1', 'Item 2']
 * - Opsi ber-group: [{ group: 'Kategori A', items: [...] }, { group: 'Kategori B', items: [...] }]
 * - Render via React Portal ke document.body (bebas terpotong oleh overflow-x / table-wrap)
 * - Auto-fokus kolom pencarian saat dibuka
 * - Navigasi keyboard (Arrow Up/Down, Enter, Escape)
 * - Tombol clear (jika clearable)
 * - Tema dark glassmorphism modern
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = '-- Pilih Opsi --',
  searchPlaceholder = 'Ketik untuk mencari...',
  disabled = false,
  clearable = false,
  minDropdownWidth = 280,
  maxDropdownHeight = 320,
  style = {},
  className = '',
  size = 'md', // 'sm' | 'md'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 280, openUp: false });

  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const portalRef = useRef(null);

  // Normalisasi options menjadi format terstruktur
  // Tiap item: { value, label, sublabel, badge, group, code, raw }
  const normalizedGroups = useMemo(() => {
    if (!options || !Array.isArray(options)) return [];

    // Cek apakah format bertingkat group: [{ group: '...', items: [...] }]
    const hasGroups = options.length > 0 && options[0] && typeof options[0] === 'object' && 'group' in options[0] && Array.isArray(options[0].items);

    if (hasGroups) {
      return options.map(grp => ({
        group: grp.group || '',
        items: (grp.items || []).map(it => {
          if (typeof it === 'object' && it !== null) {
            return {
              value: it.value ?? it.id,
              label: it.label ?? it.name ?? String(it.value ?? it.id),
              sublabel: it.sublabel,
              badge: it.badge,
              code: it.code,
              category: it.category,
              group: grp.group || it.group || '',
              disabled: Boolean(it.disabled),
              raw: it.raw ?? it,
            };
          }
          return {
            value: it,
            label: String(it),
            sublabel: null,
            badge: null,
            group: grp.group || '',
            disabled: false,
            raw: it,
          };
        }),
      }));
    }

    // Format flat
    const flatItems = options.map(it => {
      if (typeof it === 'object' && it !== null) {
        return {
          value: it.value ?? it.id,
          label: it.label ?? it.name ?? String(it.value ?? it.id),
          sublabel: it.sublabel,
          badge: it.badge,
          code: it.code,
          category: it.category,
          group: it.group || '',
          disabled: Boolean(it.disabled),
          raw: it.raw ?? it,
        };
      }
      return {
        value: it,
        label: String(it),
        sublabel: null,
        badge: null,
        group: '',
        disabled: false,
        raw: it,
      };
    });

    // Jika ada item yang punya property group
    const groupsMap = new Map();
    for (const it of flatItems) {
      const gName = it.group || '';
      if (!groupsMap.has(gName)) {
        groupsMap.set(gName, []);
      }
      groupsMap.get(gName).push(it);
    }

    if (groupsMap.size === 1 && groupsMap.has('')) {
      return [{ group: '', items: flatItems }];
    }

    return Array.from(groupsMap.entries()).map(([group, items]) => ({ group, items }));
  }, [options]);

  // Flattened all items untuk pencarian cepat & lookup nilai terpilih
  const allItems = useMemo(() => {
    const list = [];
    for (const g of normalizedGroups) {
      for (const it of g.items) {
        list.push(it);
      }
    }
    return list;
  }, [normalizedGroups]);

  // Item yang sedang terpilih
  const selectedItem = useMemo(() => {
    if (value === null || value === undefined || value === '') return null;
    return allItems.find(it => String(it.value) === String(value)) || null;
  }, [allItems, value]);

  // Filter kelompok berdasarkan pencarian
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return normalizedGroups;
    const q = search.toLowerCase();

    return normalizedGroups
      .map(grp => {
        const matchingItems = grp.items.filter(it => {
          const matchLabel = it.label?.toLowerCase().includes(q);
          const matchSub = it.sublabel?.toLowerCase().includes(q);
          const matchCode = it.code?.toLowerCase().includes(q);
          const matchCat = it.category?.toLowerCase().includes(q);
          const matchBadge = it.badge?.toLowerCase().includes(q);
          const matchVal = String(it.value)?.toLowerCase().includes(q);
          return matchLabel || matchSub || matchCode || matchCat || matchBadge || matchVal;
        });
        return {
          group: grp.group,
          items: matchingItems,
        };
      })
      .filter(grp => grp.items.length > 0);
  }, [normalizedGroups, search]);

  // Flattened filtered items untuk keyboard navigation
  const filteredFlatItems = useMemo(() => {
    const list = [];
    for (const g of filteredGroups) {
      for (const it of g.items) {
        if (!it.disabled) list.push(it);
      }
    }
    return list;
  }, [filteredGroups]);

  // Hitung posisi popover dropdown
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > 280;

    setCoords({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - (minDropdownWidth || 280) - 8)),
      width: Math.max(rect.width, minDropdownWidth || 280),
      openUp,
    });
  };

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setSearch('');
    setHighlightedIndex(0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearch('');
  };

  // Auto-focus search input saat dropdown terbuka
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Listener resize & scroll agar dropdown menempel di trigger
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        portalRef.current?.contains(e.target)
      ) {
        return;
      }
      handleClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % Math.max(filteredFlatItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredFlatItems.length) % Math.max(filteredFlatItems.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredFlatItems[highlightedIndex]) {
        handleSelect(filteredFlatItems[highlightedIndex]);
      }
    }
  };

  const handleSelect = (item) => {
    if (item.disabled) return;
    onChange(item.value, item);
    handleClose();
    triggerRef.current?.focus();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    handleClose();
  };

  const isSmall = size === 'sm';

  return (
    <div
      className={`searchable-select-container ${className}`}
      style={{ position: 'relative', display: 'inline-block', width: '100%', minWidth: 160, ...style }}
    >
      {/* Trigger Button (Tampilan Select2) */}
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: isSmall ? '5px 10px' : '7px 12px',
          fontSize: isSmall ? 12 : 12.5,
          fontWeight: selectedItem ? 600 : 400,
          borderRadius: 8,
          background: 'var(--bg-card)',
          color: selectedItem ? 'var(--text-primary)' : 'var(--text-muted)',
          border: isOpen ? '1px solid var(--accent-bright)' : '1px solid var(--border-strong)',
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.18s ease',
          userSelect: 'none',
          minHeight: isSmall ? 32 : 36,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {selectedItem ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedItem.badge && (
                <span
                  style={{
                    fontSize: 9.5,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: selectedItem.badge === 'Perlengkapan'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : selectedItem.badge === 'Olahan'
                      ? 'rgba(168, 85, 247, 0.15)'
                      : 'rgba(99, 102, 241, 0.15)',
                    color: selectedItem.badge === 'Perlengkapan'
                      ? '#34d399'
                      : selectedItem.badge === 'Olahan'
                      ? '#c084fc'
                      : 'var(--accent-bright)',
                    border: '1px solid currentColor',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {selectedItem.badge}
                </span>
              )}
              <span style={{ color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedItem.label}
              </span>
              {selectedItem.sublabel && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  ({selectedItem.sublabel})
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {clearable && selectedItem && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 4,
              }}
              title="Hapus Pilihan"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* Popover Portal Menu (Select2 Dropdown) */}
      {isOpen &&
        createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'fixed',
              top: coords.openUp ? 'auto' : coords.top,
              bottom: coords.openUp ? window.innerHeight - coords.top : 'auto',
              left: coords.left,
              width: coords.width,
              zIndex: 99999,
              background: '#0e1329',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: 10,
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Search Box Header */}
            <div
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(255, 255, 255, 0.02)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 20,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                style={{
                  paddingLeft: 34,
                  paddingRight: search ? 28 : 10,
                  fontSize: 12,
                  height: 32,
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  borderRadius: 6,
                  color: '#ffffff',
                }}
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    searchInputRef.current?.focus();
                  }}
                  style={{
                    position: 'absolute',
                    right: 18,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* List of Options / Groups */}
            <div
              ref={listRef}
              style={{
                maxHeight: maxDropdownHeight,
                overflowY: 'auto',
                padding: '4px 0',
              }}
            >
              {filteredGroups.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                  }}
                >
                  Tidak ada hasil untuk "{search}"
                </div>
              ) : (
                filteredGroups.map((grp, gIdx) => (
                  <div key={grp.group || gIdx}>
                    {grp.group && (
                      <div
                        style={{
                          padding: '6px 12px 4px',
                          fontSize: 10.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--accent-bright)',
                          background: 'rgba(99, 102, 241, 0.06)',
                          borderTop: gIdx > 0 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Tag size={10} />
                        {grp.group}
                      </div>
                    )}
                    {grp.items.map(it => {
                      const isSelected = String(it.value) === String(value);
                      const flatIndex = filteredFlatItems.findIndex(x => x.value === it.value);
                      const isHighlighted = flatIndex === highlightedIndex;

                      return (
                        <div
                          key={it.value}
                          onClick={() => handleSelect(it)}
                          onMouseEnter={() => setHighlightedIndex(flatIndex)}
                          style={{
                            padding: '7px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            cursor: it.disabled ? 'not-allowed' : 'pointer',
                            opacity: it.disabled ? 0.5 : 1,
                            background: isSelected
                              ? 'rgba(99, 102, 241, 0.2)'
                              : isHighlighted
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'transparent',
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                            fontSize: 12,
                            transition: 'background 0.1s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                            {it.badge && (
                              <span
                                style={{
                                  fontSize: 9,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: it.badge === 'Perlengkapan'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : it.badge === 'Olahan'
                                    ? 'rgba(168, 85, 247, 0.15)'
                                    : 'rgba(99, 102, 241, 0.15)',
                                  color: it.badge === 'Perlengkapan'
                                    ? '#34d399'
                                    : it.badge === 'Olahan'
                                    ? '#c084fc'
                                    : 'var(--accent-bright)',
                                  border: '1px solid currentColor',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {it.badge}
                              </span>
                            )}
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                              <div
                                style={{
                                  fontWeight: isSelected ? 700 : 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: isSelected ? 'var(--accent-bright)' : '#ffffff',
                                }}
                              >
                                {it.label}
                              </div>
                              {it.code && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                  {it.code} {it.category ? `• ${it.category}` : ''}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {it.sublabel && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-secondary)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {it.sublabel}
                              </span>
                            )}
                            {isSelected && (
                              <Check size={14} style={{ color: 'var(--accent-bright)' }} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Quick summary footer */}
            <div
              style={{
                padding: '5px 12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: 10.5,
                color: 'var(--text-muted)',
                background: 'rgba(0, 0, 0, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{filteredFlatItems.length} pilihan ditemukan</span>
              <span style={{ fontSize: 9.5 }}>Gunakan ↑↓ dan Enter</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
