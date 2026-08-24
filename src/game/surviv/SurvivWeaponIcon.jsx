import React from 'react';
import { getSurvivWeaponVisualProfile } from './weaponVisuals.js';

const outline = '#101617';

function Stock({ type, color }) {
    if (type === 'none' || type === 'grip' || type === 'tank') return null;
    if (type === 'wire' || type === 'skeleton') {
        return <path d="M14 10 4 7v8l10-3" fill="none" stroke={outline} strokeWidth="2.7" strokeLinejoin="round" />;
    }
    if (type === 'bullpup') return <path d="M5 7h15v8H5l-3-3V9Z" fill={color} stroke={outline} strokeWidth="1.35" />;
    return <path d="M4 7h13l5 3v4H8l-6-3Z" fill={color} stroke={outline} strokeWidth="1.35" strokeLinejoin="round" />;
}

function Magazine({ type, x = 27, color }) {
    if (type === 'none' || type === 'tube' || type === 'grip') return null;
    if (type === 'pan') return <ellipse cx={x} cy="8" rx="7" ry="3.7" fill={color} stroke={outline} strokeWidth="1.35" />;
    if (type === 'drum' || type === 'tank') return <circle cx={x} cy="16" r="4.2" fill={color} stroke={outline} strokeWidth="1.35" />;
    if (type === 'curved') return <path d={`M${x - 2} 13h6c.4 4 2.2 6.4 4.2 8-3.4-.3-7-2.4-8.2-8Z`} fill={color} stroke={outline} strokeWidth="1.35" />;
    return <path d={`M${x - 2} 13h6l1 7h-6Z`} fill={color} stroke={outline} strokeWidth="1.35" />;
}

function Firearm({ profile, color }) {
    const metal = color;
    const furniture = profile.accent || profile.furniture || color;
    const bodyStart = profile.stock === 'none' ? 9 : 14;
    const bodyEnd = profile.style === 'pistol' || profile.style === 'revolver' ? 39 : 39;
    const barrelEnd = Math.min(62, 43 + profile.barrel * 1.1);
    const magX = profile.bullpup ? 18 : 29;

    if (profile.style === 'bugle') {
        return <><path d="M7 12c9-8 22-7 33-2" fill="none" stroke={color} strokeWidth="3.8" strokeLinecap="round" /><path d="m39 6 20 6-20 6Z" fill={color} stroke={outline} strokeWidth="1.35" /></>;
    }

    if (profile.style === 'pistol' || profile.style === 'revolver') {
        const cylinder = profile.style === 'revolver';
        return <>
            <path d={`M9 8h${profile.length + 15}v7H9Z`} fill={metal} stroke={outline} strokeWidth="1.35" strokeLinejoin="round" />
            {cylinder && <circle cx="27" cy="12" r="5" fill={furniture} stroke={outline} strokeWidth="1.35" />}
            <path d="M14 14h9l-2 8h-7Z" fill={furniture} stroke={outline} strokeWidth="1.35" strokeLinejoin="round" />
            <rect x={36} y="9.5" width={Math.max(7, profile.barrel * 1.45)} height={cylinder ? 4 : 3} rx="1" fill={metal} stroke={outline} strokeWidth="1.2" />
            {profile.suppressor && <rect x="46" y="8.5" width="13" height="5" rx="1.5" fill={metal} stroke={outline} strokeWidth="1.2" />}
        </>;
    }

    return <>
        <Stock type={profile.stock} color={furniture} />
        <path d={`M${bodyStart} 8h${bodyEnd - bodyStart}l4 3v4H${bodyStart}Z`} fill={metal} stroke={outline} strokeWidth="1.35" strokeLinejoin="round" />
        {profile.style === 'shotgun' && <rect x="29" y="13.5" width="15" height="3.5" rx="1.5" fill={furniture} stroke={outline} strokeWidth="1.2" />}
        {profile.style === 'special' && <ellipse cx="27" cy="12" rx="7" ry="5.5" fill={furniture} stroke={outline} strokeWidth="1.35" />}
        <Magazine type={profile.magazine} x={magX} color={profile.dark} />
        <path d={`M40 10h${barrelEnd - 40}v4H40Z`} fill={metal} stroke={outline} strokeWidth="1.25" />
        {profile.barrelCount > 1 && <path d={`M42 15h${barrelEnd - 42}`} stroke={outline} strokeWidth="2" strokeLinecap="round" />}
        {profile.suppressor && <rect x={barrelEnd - 8} y="9" width="11" height="6" rx="2" fill={profile.dark} stroke={outline} strokeWidth="1.2" />}
        {profile.scope && <><rect x="22" y="4" width={profile.scope === 'long' ? 18 : 13} height="4" rx="2" fill={profile.dark} stroke={outline} strokeWidth="1.1" /><path d="M25 8v2m11-2v2" stroke={outline} strokeWidth="1.2" /></>}
        {profile.stock === 'tank' && <circle cx="12" cy="12" r="6" fill={furniture} stroke={outline} strokeWidth="1.35" />}
    </>;
}

export default function SurvivWeaponIcon({ weaponId, color = 'currentColor', width = 46, className = '' }) {
    const profile = getSurvivWeaponVisualProfile(weaponId);
    const height = Math.round(width * 0.42);
    if (profile.style === 'fists') {
        return <svg width={height} height={height} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className={`weapon-svg-icon ${className}`}><path d="M5 12V8a1.4 1.4 0 0 1 2.8 0v3-5a1.4 1.4 0 0 1 2.8 0v5-4a1.4 1.4 0 0 1 2.8 0v4-2a1.4 1.4 0 0 1 2.8 0v5c0 4-2.7 6-6 6S5 18 5 14Z" /></svg>;
    }
    if (profile.style === 'knife') {
        return <svg width={width} height={height} viewBox="0 0 64 24" fill="none" className={`weapon-svg-icon ${className}`}><path d="M5 14h20l25-8c3-1 6 1 7 3L27 17H5Z" fill={color} stroke={outline} strokeWidth="1.5" /><rect x="4" y="11" width="19" height="8" rx="2" fill="#313936" stroke={outline} strokeWidth="1.5" /></svg>;
    }
    return <svg width={width} height={height} viewBox="0 0 64 24" fill="none" className={`weapon-svg-icon ${className}`} aria-hidden="true">
        <g opacity={profile.dual ? 0.64 : 1} transform={profile.dual ? 'translate(0 -3) scale(.92)' : undefined}><Firearm profile={profile} color={color} /></g>
        {profile.dual && <g transform="translate(0 4) scale(.92)"><Firearm profile={profile} color={color} /></g>}
    </svg>;
}
