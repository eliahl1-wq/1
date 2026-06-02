import React, { useState, useRef, useEffect } from 'react';
import '../styles/ui.css';

export default function CustomDropdown({ options = [], value, onChange, renderValue }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        const onDoc = (e) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    useEffect(() => {
        if (!open) return;
        // focus first item
        const first = listRef.current?.querySelector('[data-index]');
        first?.focus();
    }, [open]);

    const handleKeyDown = (e) => {
        const items = Array.from(listRef.current?.querySelectorAll('[data-index]') || []);
        const idx = items.findIndex(i => i === document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = items[Math.min(items.length - 1, Math.max(0, idx + 1))];
            next?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = items[Math.max(0, idx - 1)];
            prev?.focus();
        } else if (e.key === 'Escape') {
            setOpen(false);
        } else if (e.key === 'Enter') {
            const el = document.activeElement;
            if (el && el.dataset && el.dataset.value) onChange(el.dataset.value);
        }
    };

    return (
        <div className={`dropdown ${open ? 'open' : ''}`} ref={ref}>
            <div className="dropdown-trigger" role="button" tabIndex={0} onClick={() => setOpen(s => !s)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(s => !s); }}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>{renderValue ? renderValue(value) : value}</div>
                <svg style={{transform: open ? 'rotate(180deg)' : 'rotate(0deg)',transition:'transform .18s'}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
            </div>

            <div className="dropdown-panel" role="menu" ref={listRef} onKeyDown={handleKeyDown}>
                {options.map((opt, i) => (
                    <div
                        key={i}
                        role="menuitem"
                        tabIndex={0}
                        data-index={i}
                        data-value={opt.value}
                        className={`dropdown-item ${opt.value === value ? 'active' : ''}`}
                        onClick={() => { onChange(opt.value); setOpen(false); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { onChange(opt.value); setOpen(false); } }}
                    >
                        {opt.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
