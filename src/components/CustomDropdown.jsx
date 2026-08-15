import React, { useState, useRef, useEffect, useId } from 'react';

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
    const listboxId = useId();

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler, { passive: true });
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} className={`dropdown${open ? ' open' : ''}`}>
            <button
                className="dropdown-trigger"
                onClick={() => setOpen(v => !v)}
                type="button"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={listboxId}
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
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            <div id={listboxId} className="dropdown-panel" role="listbox" aria-hidden={!open}>
                {options.map(opt => (
                    <button
                        type="button"
                        role="option"
                        aria-selected={opt.value === value}
                        key={opt.value}
                        className={`dropdown-item${opt.value === value ? ' active' : ''}`}
                        onClick={() => { onChange(opt.value); setOpen(false); }}
                    >
                        {renderOption ? renderOption(opt) : opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
