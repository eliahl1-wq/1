import React, { useState, useRef, useEffect } from 'react';

/**
 * CustomDropdown — axiom-style compact dropdown
 * Props:
 *  options: [{label, value}]
 *  value: current selected value
 *  onChange: (value) => void
 *  renderValue: (value) => ReactNode  — custom render for trigger label
 */
export default function CustomDropdown({ options, value, onChange, renderValue, renderOption }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [open]);

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} className={`dropdown${open ? ' open' : ''}`}>
            <button
                className="dropdown-trigger"
                onClick={() => setOpen(v => !v)}
                type="button"
                style={open ? { borderColor: 'var(--accent)', boxShadow: '0 0 12px var(--accent-border)' } : {}}
            >
                {renderValue ? renderValue(value) : (selected?.label ?? value)}
                <svg
                    className="dropdown-chevron"
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    style={{ flexShrink: 0 }}
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            <div className="dropdown-panel">
                {options.map(opt => (
                    <div
                        key={opt.value}
                        className={`dropdown-item${opt.value === value ? ' active' : ''}`}
                        onClick={() => { onChange(opt.value); setOpen(false); }}
                        style={opt.value === value ? { color: '#fff', background: 'var(--accent-dim)' } : {}}
                    >
                        {renderOption ? renderOption(opt) : opt.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
