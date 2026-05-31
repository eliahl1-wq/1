import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';

export default function Transactions() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [txs, setTxs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTx = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('no tx');
                const data = await res.json();
                // Visa endast insättningar och riktiga uttag till plånbok
                setTxs(data.filter(tx => tx.type !== 'game' && tx.meta?.reason !== 'Arena Cashout'));
            } catch (err) {
                setTxs([]);
            } finally {
                setLoading(false);
            }
        };
        fetchTx();
    }, [token]);

    return (
        <div style={{ 
            width: '100vw', minHeight: '100vh', 
            background: '#050505', color: 'white', 
            fontFamily: 'system-ui', display: 'flex', 
            flexDirection: 'column', alignItems: 'center',
            padding: '80px 20px'
        }}>
            <Background />
            
            <div style={{ width: '100%', maxWidth: '900px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                    <div>
                        <h1 style={{ fontSize: '3rem', fontWeight: '900', margin: 0, letterSpacing: '-2px' }}>History</h1>
                        <p style={{ opacity: 0.4, margin: '10px 0 0 0' }}>Transaction logs for deposits and arena results.</p>
                    </div>
                    <button 
                        onClick={() => navigate(-1)} 
                        style={{ 
                            padding: '12px 24px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: '700', cursor: 'pointer',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        Back to Arena
                    </button>
                </div>

                <div style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: '24px', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                    backdropFilter: 'blur(40px)'
                }}>
                    {loading ? (
                        <div style={{ padding: '100px', textAlign: 'center', opacity: 0.5 }}>Syncing with blockchain...</div>
                    ) : txs.length === 0 ? (
                        <div style={{ padding: '100px', textAlign: 'center', opacity: 0.3, fontWeight: '600' }}>No transactions found.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <th style={thStyle}>EVENT</th>
                                    <th style={thStyle}>AMOUNT</th>
                                    <th style={thStyle}>DATE</th>
                                    <th style={thStyle}>STATUS</th>
                                    <th style={thStyle}>DETAILS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {txs.map(tx => (
                                    <tr key={tx._id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ 
                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                    background: tx.type === 'deposit' ? '#34C759' : tx.type === 'withdraw' ? '#14F195' : '#FFD700'
                                                }} />
                                                <span style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '0.8rem' }}>{tx.type}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, fontWeight: '900' }}>
                                            <span style={{ color: tx.type === 'deposit' ? '#34C759' : '#fff' }}>
                                                {tx.type === 'deposit' ? '+' : ''}${tx.amount.toFixed(2)}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, opacity: 0.4, fontSize: '0.85rem' }}>
                                            {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ 
                                                padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900',
                                                background: 'rgba(52, 199, 89, 0.1)', color: '#34C759', textTransform: 'uppercase'
                                            }}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, opacity: 0.3, fontSize: '0.75rem', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {tx.meta?.signature || tx.meta?.reason || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div style={{ marginTop: '30px', textAlign: 'center', opacity: 0.2, fontSize: '0.8rem', fontWeight: '600' }}>
                    SECURE TERMINAL • AGARARENA SPACE
                </div>
            </div>
        </div>
    );
}

const thStyle = { padding: '20px', fontSize: '0.7rem', fontWeight: '800', opacity: 0.3, letterSpacing: '1px' };
const tdStyle = { padding: '20px' };
