export const CLASSIC_FADE_SKINS = Object.freeze([
    { id: 'tide', value: 'tide', productId: 'slither:tide', name: 'Lagoon Fade', adminOnly: true, classic: true, baseColor: '#62cdbb', colors: ['#526db8', '#6e9fd2', '#78d5d0', '#a0e2bc'], description: 'Soft indigo fading into sea glass and mint, on the classic round segments.', badgeGradient: 'linear-gradient(110deg,#526db8,#78d5d0,#a0e2bc)' },
    { id: 'sorbet', value: 'sorbet', productId: 'slither:sorbet', name: 'Peach Fade', adminOnly: true, classic: true, baseColor: '#e8ad98', colors: ['#ae82ba', '#db9db9', '#f0b09a', '#f2d18e'], description: 'Muted lilac through rose to warm peach, with the original rounded body and eyes.', badgeGradient: 'linear-gradient(110deg,#ae82ba,#db9db9,#f2d18e)' },
]);

export function fadeColors(stops, count = 32) {
    return Array.from({ length: count }, (_, i) => {
        const p = i / (count - 1) * (stops.length - 1), n = Math.min(stops.length - 2, Math.floor(p)), t = p - n;
        return '#' + [1, 3, 5].map(k => Math.round(parseInt(stops[n].slice(k,k+2),16)*(1-t)+parseInt(stops[n+1].slice(k,k+2),16)*t).toString(16).padStart(2,'0')).join('');
    });
}
