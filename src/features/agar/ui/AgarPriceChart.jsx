import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../../../utils/apiBase';

const RANGES = ['1H', '6H', '24H', '7D'];
const PAD_X = 12;
const PAD_Y = 24;

function formatPrice(value) {
    if (!Number.isFinite(value)) return '--';
    if (value < 0.0001) return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 5 })}`;
    if (value < 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}`;
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function buildGeometry(points, width, height) {
    if (points.length < 2) return null;
    const values = points.map((point) => point.close);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
        const spread = Math.max(min * 0.02, Number.EPSILON);
        min -= spread;
        max += spread;
    }
    const innerWidth = width - PAD_X * 2;
    const innerHeight = height - PAD_Y * 2;
    const coordinates = points.map((point, index) => ({
        ...point,
        x: PAD_X + (index / (points.length - 1)) * innerWidth,
        y: PAD_Y + ((max - point.close) / (max - min)) * innerHeight,
    }));
    const line = coordinates.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const area = `${PAD_X},${height - PAD_Y} ${line} ${width - PAD_X},${height - PAD_Y}`;
    return { min, max, coordinates, line, area };
}

export default function AgarPriceChart({ launchReady, authToken = '', symbol = 'ARC' }) {
    const canvasRef = useRef(null);
    const [size, setSize] = useState({ width: 700, height: 292 });
    const [range, setRange] = useState('24H');
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hoveredIndex, setHoveredIndex] = useState(null);

    useEffect(() => {
        if (!launchReady) {
            setPoints([]);
            setError('');
            return undefined;
        }
        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${API_URL}/api/agar/candles?range=${range}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload?.message || 'Chart data unavailable');
                setPoints(Array.isArray(payload?.points) ? payload.points : []);
                setError('');
            } catch (requestError) {
                if (requestError?.name !== 'AbortError') setError(requestError.message || 'Chart data unavailable');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        load();
        const interval = window.setInterval(load, 30_000);
        return () => {
            controller.abort();
            window.clearInterval(interval);
        };
    }, [authToken, launchReady, range]);

    useEffect(() => {
        const element = canvasRef.current;
        if (!element) return undefined;
        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setSize({
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                });
            }
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const geometry = useMemo(
        () => buildGeometry(points, size.width, size.height),
        [points, size.height, size.width],
    );
    const activePoint = geometry?.coordinates[hoveredIndex ?? geometry.coordinates.length - 1] || null;
    const firstPrice = points[0]?.close;
    const lastPrice = points.at(-1)?.close;
    const change = Number.isFinite(firstPrice) && firstPrice > 0 && Number.isFinite(lastPrice)
        ? ((lastPrice - firstPrice) / firstPrice) * 100
        : null;

    const handlePointer = (event) => {
        if (!geometry) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const relative = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        setHoveredIndex(Math.round(relative * (geometry.coordinates.length - 1)));
    };

    return (
        <div className="agar-price-chart">
            <div className="agar-price-chart__toolbar">
                <div>
                    <strong>{formatPrice(activePoint?.close)}</strong>
                    {Number.isFinite(change) && (
                        <span className={change >= 0 ? 'is-positive' : 'is-negative'}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                        </span>
                    )}
                </div>
                <nav aria-label="Chart range">
                    {RANGES.map((item) => (
                        <button
                            type="button"
                            className={range === item ? 'active' : ''}
                            key={item}
                            onClick={() => setRange(item)}
                        >
                            {item}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="agar-price-chart__canvas" ref={canvasRef}>
                {!launchReady ? (
                    <div className="agar-price-chart__state"><strong>Coming Soon</strong><span>{symbol} / USD</span></div>
                ) : loading && !geometry ? (
                    <div className="agar-price-chart__state"><strong>Loading chart…</strong></div>
                ) : error && !geometry ? (
                    <div className="agar-price-chart__state"><strong>Chart unavailable</strong><span>{error}</span></div>
                ) : !geometry ? (
                    <div className="agar-price-chart__state"><strong>Waiting for trades</strong><span>Price history will appear here.</span></div>
                ) : (
                    <svg
                        viewBox={`0 0 ${size.width} ${size.height}`}

                        role="img"
                        aria-label={`${symbol} ${range} price chart`}
                        onPointerMove={handlePointer}
                        onPointerLeave={() => setHoveredIndex(null)}
                    >
                        <defs>
                            <linearGradient id="agar-chart-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#9d6bff" stopOpacity="0.38" />
                                <stop offset="100%" stopColor="#6175ff" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="agar-chart-line" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#b046ff" />
                                <stop offset="100%" stopColor="#6687ff" />
                            </linearGradient>
                        </defs>
                        <g className="agar-price-chart__grid">
                            {[0.2, 0.4, 0.6, 0.8].map((ratio) => <line key={`h${ratio}`} x1="0" x2={size.width} y1={size.height * ratio} y2={size.height * ratio} />)}
                            {[0.2, 0.4, 0.6, 0.8].map((ratio) => <line key={`v${ratio}`} y1="0" y2={size.height} x1={size.width * ratio} x2={size.width * ratio} />)}
                        </g>
                        <polygon points={geometry.area} fill="url(#agar-chart-fill)" />
                        <polyline points={geometry.line} fill="none" stroke="url(#agar-chart-line)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                        {activePoint && hoveredIndex !== null && (
                            <g className="agar-price-chart__cursor">
                                <line x1={activePoint.x} x2={activePoint.x} y1="0" y2={size.height} />
                                <circle cx={activePoint.x} cy={activePoint.y} r="5" />
                            </g>
                        )}
                    </svg>
                )}
                {activePoint && geometry && (
                    <div className="agar-price-chart__labels" aria-hidden="true">
                        <span>{formatPrice(geometry.max)}</span>
                        <span>{formatPrice(geometry.min)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
