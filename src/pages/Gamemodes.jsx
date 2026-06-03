import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import '../styles/ui.css';

export default function Gamemodes() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('agar');

    return (
        <div style={{ width: '100vw', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflowX: 'hidden' }}>
            <Background />

            {/* ── Top Bar ── */}
            <nav className="topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/pre-game')}>
                        <div style={{ width: 7, height: 7, background: '#007AFF', borderRadius: '50%', boxShadow: '0 0 10px #007AFF' }} />
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>
                            AGAR<span style={{ color: '#007AFF' }}>STAKE</span>
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
            <div style={{ zIndex: 1, width: '100%', maxWidth: '1200px', padding: '100px 40px 40px', animation: 'fadeUp 0.3s ease-out', boxSizing: 'border-box' }}>
                <h1 style={{ textAlign: 'left', marginBottom: '32px', fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-2px', color: 'var(--text-h)' }}>
                    Select Gamemode
                </h1>

                {/* Underlined Tabs */}
                <div style={{ display: 'flex', gap: '32px', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <button 
                        onClick={() => setActiveTab('agar')}
                        style={{ 
                            background: 'none', border: 'none', padding: '0 0 12px 0', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s',
                            color: activeTab === 'agar' ? '#fff' : 'var(--text-3)',
                            borderBottom: activeTab === 'agar' ? '2px solid #007AFF' : '2px solid transparent'
                        }}
                    >
                        AGAR
                    </button>
                    <button 
                        onClick={() => setActiveTab('slither')}
                        style={{ 
                            background: 'none', border: 'none', padding: '0 0 12px 0', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s',
                            color: activeTab === 'slither' ? '#fff' : 'var(--text-3)',
                            borderBottom: activeTab === 'slither' ? '2px solid #007AFF' : '2px solid transparent'
                        }}
                    >
                        SLITHER
                    </button>
                </div>

                {activeTab === 'agar' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                        <div className="mode-option active">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                                <div>
                                    <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.25rem' }}>Normal Arena</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: '6px' }}>The classic high-stakes experience.</div>
                                </div>
                                <button className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.8rem' }} onClick={() => navigate('/pre-game')}>PLAY</button>
                            </div>
                        </div>
                        <div className="mode-option disabled">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                                <div>
                                    <div style={{ fontWeight: 800, color: 'var(--text-3)', fontSize: '1.25rem' }}>Speed Arena</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: '6px' }}>Faster movement, higher risk.</div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px' }}>COMING SOON</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'left', padding: '60px 0', maxWidth: '600px' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '24px' }}>🐍</div>
                        <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '12px', fontWeight: 800 }}>Slither Mode</h2>
                        <p style={{ color: 'var(--text-3)', fontSize: '1.1rem', lineHeight: '1.6' }}>
                            We are bringing high-stakes snake combat to AgarStake. Compete with other players in a growing arena where every move counts.
                        </p>
                        <div style={{ marginTop: '32px', display: 'inline-block', padding: '8px 16px', background: 'rgba(0, 122, 255, 0.1)', color: '#007AFF', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                            UNDER DEVELOPMENT
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .mode-option {
                    padding: 32px;
                    border-radius: 16px;
                    background: #0f1118;
                    border: 1px solid var(--border);
                    transition: 0.2s;
                    box-shadow: var(--shadow-lg);
                }
                .mode-option.active {
                    border-color: rgba(0, 122, 255, 0.3);
                    background: linear-gradient(135deg, #0f1118 0%, #161922 100%);
                }
                .mode-option.disabled { opacity: 0.6; }
                .nav-link:hover { color: #fff !important; }
            `}</style>
        </div>
    );
}
