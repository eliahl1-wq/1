import React, { useMemo } from 'react';

const Background = () => {
    const blobs = useMemo(() => [
        { color: 'rgba(153, 69, 255, 0.10)', x: 15, y: 20, size: 500, dur: 55, delay: 0 },
        { color: 'rgba(20, 241, 149, 0.06)',  x: 70, y: 65, size: 420, dur: 70, delay: -20 },
        { color: 'rgba(77, 140, 255, 0.08)',  x: 55, y: 10, size: 380, dur: 60, delay: -10 },
        { color: 'rgba(255, 59, 48, 0.04)',   x: 85, y: 80, size: 350, dur: 80, delay: -35 },
    ], []);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#08090D',
            zIndex: -2,
            overflow: 'hidden',
        }}>
            {/* Subtle dot grid */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
                backgroundSize: '32px 32px',
                opacity: 0.4,
                maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, transparent 75%)',
            }} />

            {/* Glow blobs */}
            {blobs.map((b, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        width: b.size,
                        height: b.size,
                        top: `${b.y}%`,
                        left: `${b.x}%`,
                        transform: 'translate(-50%, -50%)',
                        background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
                        borderRadius: '50%',
                        filter: 'blur(48px)',
                        animation: `blobWobble ${b.dur / 3}s ease-in-out infinite, blobDrift ${b.dur}s ease-in-out infinite alternate`,
                        animationDelay: `${b.delay}s`,
                        pointerEvents: 'none',
                        willChange: 'transform',
                    }}
                />
            ))}

            {/* Subtle vignette overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(8,9,13,0.6) 100%)',
                pointerEvents: 'none',
            }} />
        </div>
    );
};

export default Background;