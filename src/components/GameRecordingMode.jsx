import React, { useEffect, useState } from 'react';
import { getRecordingMode, setRecordingMode, RECORDING_MODE_EVENT } from '../game/renderBudget.js';
import './gameRecordingMode.css';

export default function GameRecordingMode({ inline = false, disabled = false }) {
    const [enabled, setEnabled] = useState(getRecordingMode);
    useEffect(() => {
        const sync = () => setEnabled(getRecordingMode());
        window.addEventListener(RECORDING_MODE_EVENT, sync);
        return () => window.removeEventListener(RECORDING_MODE_EVENT, sync);
    }, []);
    return <button type="button" disabled={disabled} aria-pressed={enabled}
        className={`game-recording-mode${inline ? ' game-recording-mode--inline' : ''}${enabled ? ' is-active' : ''}`}
        title="Recording mode: 60 FPS and a smaller render surface to leave room for screen recording. Controls and game speed stay unchanged."
        onClick={event => { setRecordingMode(!enabled); event.currentTarget.blur(); }}>
        <span aria-hidden="true" className="game-recording-mode__dot" />
        Recording mode{enabled ? ' · 60 FPS' : ''}
    </button>;
}
