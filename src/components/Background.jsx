import React, { useMemo } from 'react';

const Background = () => {
    // Generera blobs en gång för att spara prestanda
    const blobs = useMemo(() => {
        const colors = ['#007AFF', '#5856D6', '#AF52DE', '#5AC8FA', '#FF2D55'];
        return [...Array(6)].map((_, i) => ({
            size: Math.random() * 100 + 150, // Lite mindre för renare look
            x: Math.random() * 100,
            y: Math.random() * 100,
            color: colors[i % colors.length],
            duration: Math.random() * 15 + 20, // Något snabbare drift för "direction"
            delay: Math.random() * -30
        }));
    }, []);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000', // Svart bottenplatta
            backgroundImage: `
                linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            zIndex: -1, // Ligger bakom allt
            overflow: 'hidden',
        }}>
            {blobs.map((blob, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        width: blob.size,
                        height: blob.size,
                        backgroundColor: blob.color,
                        top: `${blob.y}%`,
                        left: `${blob.x}%`,
                        filter: 'blur(20px)', // Mindre blurriga för en fastare look
                        opacity: 0.35, 
                        borderRadius: '50%',
                        animation: `
                            blobWobble ${blob.duration / 4}s infinite ease-in-out,
                            blobDrift ${blob.duration}s infinite ease-in-out alternate
                        `,
                        animationDelay: `${blob.delay}s`
                    }}
                />
            ))}
        </div>
    );
};

export default Background;