export const CLASSIC_FADE_SKINS = Object.freeze([
    { id: 'onyx', value: 'onyx', productId: 'slither:onyx', name: 'Onyx', adminOnly: true, classic: true, material: 'onyx', baseColor: '#121419', colors: ['#0d1015', '#181b21', '#101318', '#1c1c24'], description: 'Polished charcoal-black scales, a soft silver reflection and a restrained violet sheen along the lower flank.', badgeGradient: 'linear-gradient(110deg,#090c10,#363b43,#211d2b)' },
    { id: 'sorbet', value: 'sorbet', productId: 'slither:sorbet', name: 'Peach Fade', adminOnly: true, classic: true, baseColor: '#e8ad98', colors: ['#ae82ba', '#db9db9', '#f0b09a', '#f2d18e'], description: 'Muted lilac through rose to warm peach, with the original rounded body and eyes.', badgeGradient: 'linear-gradient(110deg,#ae82ba,#db9db9,#f2d18e)' },
]);

export function fadeColors(stops, count = 32) {
    return Array.from({ length: count }, (_, i) => {
        const p = i / (count - 1) * (stops.length - 1), n = Math.min(stops.length - 2, Math.floor(p)), t = p - n;
        return '#' + [1, 3, 5].map(k => Math.round(parseInt(stops[n].slice(k,k+2),16)*(1-t)+parseInt(stops[n+1].slice(k,k+2),16)*t).toString(16).padStart(2,'0')).join('');
    });
}
