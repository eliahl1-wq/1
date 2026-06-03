import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import '../styles/ui.css';

export default function Gamemodes() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('agar');

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <Background />

            {/* ── Top Bar ── */}
            <nav className="topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/pre-game')}>
                        <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent)' }} />
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>
                            AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>
                        </span>
                    </div>
                    <button 
                        className="nav-link active"
                        style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Gamemodes
                    </button>
                </div>
            </nav>

            {/* ── Content ── */}
            <div style={{ zIndex: 1, width: '100%', maxWidth: '600px', padding: '0 20px', animation: 'fadeUp 0.3s ease-out' }}>
                <h1 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text-h)' }}>
                    Select Gamemode
                </h1>

                <div className="game-card" style={{ padding: '24px' }}>
                    {/* Custom Tabs for Gamemodes */}
                    <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '14px', marginBottom: '24px', border: '1px solid var(--border)' }}>
                        <button 
                            onClick={() => setActiveTab('agar')}
                            style={{ 
                                flex: 1, padding: '12px', borderRadius: '10px', border: 'none', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s',
                                background: activeTab === 'agar' ? 'var(--accent)' : 'transparent',
                                color: activeTab === 'agar' ? '#fff' : 'var(--text-3)'
                            }}
                        >
                            AGAR
                        </button>
                        <button 
                            onClick={() => setActiveTab('slither')}
                            style={{ 
                                flex: 1, padding: '12px', borderRadius: '10px', border: 'none', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s',
                                background: activeTab === 'slither' ? 'var(--accent)' : 'transparent',
                                color: activeTab === 'slither' ? '#fff' : 'var(--text-3)'
                            }}
                        >
                            SLITHER
                        </button>
                    </div>

                    {activeTab === 'agar' ? (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            <div className="mode-option active">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.1rem' }}>Normal Arena</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '2px' }}>The classic high-stakes experience.</div>
                                    </div>
                                    <button className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.75rem' }} onClick={() => navigate('/pre-game')}>PLAY</button>
                                </div>
                            </div>
                            <div className="mode-option disabled">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 800, color: 'var(--text-3)', fontSize: '1.1rem' }}>Speed Arena</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '2px' }}>Faster movement, higher risk.</div>
                                    </div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>COMING SOON</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🐍</div>
                            <h2 style={{ color: '#fff', marginBottom: '8px' }}>Slither Mode</h2>
                            <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>High-stakes snake combat is currently under development.</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .mode-option {
                    padding: 20px;
                    border-radius: 16px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid var(--border);
                    transition: 0.2s;
                }
                .mode-option.active {
                    background: rgba(124, 58, 255, 0.05);
                    border-color: rgba(124, 58, 255, 0.3);
                }
                .mode-option.disabled { opacity: 0.6; }
                .nav-link:hover { color: #fff !important; }
            `}</style>
        </div>
    );
}
