import React, { useId } from 'react';
import { getSurvivWeaponSideArt, getSurvivWeaponVisualProfile } from './weaponVisuals.js';

const roleColor = (profile, role, primary) => {
    if (role === 'dark') return profile.dark || '#151d1f';
    if (role === 'furniture') return profile.furniture || '#48504c';
    if (role === 'accent') return profile.accent || profile.furniture || primary;
    return primary;
};

function FirearmSilhouette({ weaponId, color, monochrome, maskId }) {
    const art = getSurvivWeaponSideArt(weaponId);
    const profile = art.profile;
    return <>
        {art.cuts.length > 0 && <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="44">
                <rect x="0" y="0" width="100" height="44" fill="#fff" />
                {art.instances.flatMap((instance, instanceIndex) => art.cuts.map((d, cutIndex) => (
                    <path
                        key={`${instanceIndex}-${cutIndex}`}
                        d={d}
                        fill="#000"
                        transform={`translate(${instance.x} ${instance.y}) scale(${instance.scaleX} ${instance.scaleY})`}
                    />
                )))}
            </mask>
        </defs>}
        <g mask={art.cuts.length > 0 ? `url(#${maskId})` : undefined}>
            {art.instances.flatMap((instance, instanceIndex) => art.parts.map((part, partIndex) => {
                const fill = monochrome ? color : roleColor(profile, part.role, color);
                return <path
                    key={`${instanceIndex}-${partIndex}`}
                    d={part.d}
                    fill={part.strokeWidth ? 'none' : fill}
                    stroke={part.strokeWidth ? fill : 'none'}
                    strokeWidth={part.strokeWidth || undefined}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    transform={`translate(${instance.x} ${instance.y}) scale(${instance.scaleX} ${instance.scaleY})`}
                />;
            }))}
        </g>
    </>;
}

export default function SurvivWeaponIcon({ weaponId, color = 'currentColor', width = 46, className = '', monochrome = false }) {
    const profile = getSurvivWeaponVisualProfile(weaponId);
    const height = Math.round(width * 0.44);
    const rawId = useId();
    const maskId = `surviv-weapon-mask-${rawId.replace(/:/g, '')}`;

    if (profile.style === 'fists') {
        return <svg width={height} height={height} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className={`weapon-svg-icon ${className}`}><path d="M5 12V8a1.4 1.4 0 0 1 2.8 0v3-5a1.4 1.4 0 0 1 2.8 0v5-4a1.4 1.4 0 0 1 2.8 0v4-2a1.4 1.4 0 0 1 2.8 0v5c0 4-2.7 6-6 6S5 18 5 14Z" /></svg>;
    }
    if (profile.style === 'knife') {
        return <svg width={width} height={height} viewBox="0 0 100 44" className={`weapon-svg-icon ${className}`} aria-hidden="true">
            <FirearmSilhouette weaponId={weaponId} color={color} monochrome={monochrome} maskId={maskId} />
        </svg>;
    }
    return <svg width={width} height={height} viewBox="0 0 100 44" className={`weapon-svg-icon ${className}`} aria-hidden="true">
        <FirearmSilhouette weaponId={weaponId} color={color} monochrome={monochrome} maskId={maskId} />
    </svg>;
}
