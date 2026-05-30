import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
                setTxs(data);
            } catch (err) {
                setTxs([]);
            } finally {
                setLoading(false);
            }
        };
        fetchTx();
    }, [token]);

    return (
        <div style={{ padding: 24 }}>
            <h2>Transactions</h2>
            <p style={{ opacity: 0.6 }}>Deposit, Withdrawal and Game transaction history.</p>
            <div style={{ marginTop: 16 }}>
                {loading ? (
                    <div>Loading…</div>
                ) : txs.length === 0 ? (
                    <div style={{ opacity: 0.6 }}>No transactions yet.</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ textAlign: 'left', opacity: 0.6 }}>
                            <tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th><th>Meta</th></tr>
                        </thead>
                        <tbody>
                            {txs.map(tx => (
                                <tr key={tx._id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                    <td style={{ padding: '8px 4px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                                    <td style={{ padding: '8px 4px', textTransform: 'capitalize' }}>{tx.type}</td>
                                    <td style={{ padding: '8px 4px' }}>{tx.amount} {tx.currency}</td>
                                    <td style={{ padding: '8px 4px' }}>{tx.status}</td>
                                    <td style={{ padding: '8px 4px', opacity: 0.7 }}>{JSON.stringify(tx.meta || {})}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div style={{ marginTop: 20 }}>
                <button onClick={() => navigate(-1)} style={{ padding: '10px 14px', borderRadius: 10 }}>Back</button>
            </div>
        </div>
    );
}
