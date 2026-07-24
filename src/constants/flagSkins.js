export const FLAG_SKINS = Object.freeze([
    { code: 'se', name: 'Sweden', emoji: '🇸🇪', colors: ['#006aa7', '#fecc02'] },
    { code: 'us', name: 'United States', emoji: '🇺🇸', colors: ['#b22234', '#ffffff', '#3c3b6e'] },
    { code: 'gb', name: 'United Kingdom', emoji: '🇬🇧', colors: ['#012169', '#ffffff', '#c8102e'] },
    { code: 'de', name: 'Germany', emoji: '🇩🇪', colors: ['#171717', '#dd0000', '#ffce00'] },
    { code: 'fr', name: 'France', emoji: '🇫🇷', colors: ['#0055a4', '#ffffff', '#ef4135'] },
    { code: 'es', name: 'Spain', emoji: '🇪🇸', colors: ['#aa151b', '#f1bf00', '#aa151b'] },
    { code: 'it', name: 'Italy', emoji: '🇮🇹', colors: ['#009246', '#ffffff', '#ce2b37'] },
    { code: 'br', name: 'Brazil', emoji: '🇧🇷', colors: ['#009c3b', '#ffdf00', '#002776'] },
    { code: 'ca', name: 'Canada', emoji: '🇨🇦', colors: ['#d80621', '#ffffff', '#d80621'] },
    { code: 'jp', name: 'Japan', emoji: '🇯🇵', colors: ['#ffffff', '#bc002d'] },
    { code: 'no', name: 'Norway', emoji: '🇳🇴', colors: ['#ba0c2f', '#ffffff', '#00205b'] },
    { code: 'fi', name: 'Finland', emoji: '🇫🇮', colors: ['#ffffff', '#003580'] },
    { code: 'dk', name: 'Denmark', emoji: '🇩🇰', colors: ['#c8102e', '#ffffff'] },
    { code: 'nl', name: 'Netherlands', emoji: '🇳🇱', colors: ['#ae1c28', '#ffffff', '#21468b'] },
    { code: 'pl', name: 'Poland', emoji: '🇵🇱', colors: ['#ffffff', '#dc143c'] },
    { code: 'ua', name: 'Ukraine', emoji: '🇺🇦', colors: ['#0057b7', '#ffd700'] },
]);

export const DEFAULT_FLAG_CODE = 'se';

export function parseFlagSkin(value) {
    if (typeof value !== 'string' || !value.startsWith('flag:')) return null;
    const code = value.slice(5).toLowerCase();
    return FLAG_SKINS.some((flag) => flag.code === code) ? code : null;
}

export function flagSkinValue(code) {
    return `flag:${FLAG_SKINS.some((flag) => flag.code === code) ? code : DEFAULT_FLAG_CODE}`;
}

export function getFlagSkin(code) {
    return FLAG_SKINS.find((flag) => flag.code === code) || FLAG_SKINS[0];
}

export function getFlagSegmentColors(code) {
    return getFlagSkin(code).colors;
}

export function getPremiumSkinId(value) {
    if (value === 'random') return 'rainbow';
    if (parseFlagSkin(value)) return 'flags';
    return 'free';
}

export function drawFlag(graph, code, x, y, width, height) {
    const left = x - width / 2;
    const top = y - height / 2;
    const stripeH = height / 3;
    const verticalStripe = (colors) => colors.forEach((color, index) => {
        graph.fillStyle = color;
        graph.fillRect(left + width * index / colors.length, top, width / colors.length + 1, height);
    });
    const horizontalStripe = (colors) => colors.forEach((color, index) => {
        graph.fillStyle = color;
        graph.fillRect(left, top + height * index / colors.length, width, height / colors.length + 1);
    });
    const nordicCross = (background, cross, inset = null) => {
        graph.fillStyle = background;
        graph.fillRect(left, top, width, height);
        if (inset) {
            graph.fillStyle = inset;
            graph.fillRect(left + width * 0.29, top, width * 0.16, height);
            graph.fillRect(left, top + height * 0.40, width, height * 0.20);
        }
        graph.fillStyle = cross;
        graph.fillRect(left + width * 0.33, top, width * 0.08, height);
        graph.fillRect(left, top + height * 0.45, width, height * 0.10);
    };

    switch (code) {
        case 'se': nordicCross('#006aa7', '#fecc02'); break;
        case 'no': nordicCross('#ba0c2f', '#00205b', '#ffffff'); break;
        case 'fi': nordicCross('#ffffff', '#003580'); break;
        case 'dk': nordicCross('#c8102e', '#ffffff'); break;
        case 'fr': verticalStripe(['#0055a4', '#ffffff', '#ef4135']); break;
        case 'it': verticalStripe(['#009246', '#ffffff', '#ce2b37']); break;
        case 'de': horizontalStripe(['#171717', '#dd0000', '#ffce00']); break;
        case 'nl': horizontalStripe(['#ae1c28', '#ffffff', '#21468b']); break;
        case 'pl': horizontalStripe(['#ffffff', '#dc143c']); break;
        case 'ua': horizontalStripe(['#0057b7', '#ffd700']); break;
        case 'es':
            graph.fillStyle = '#aa151b';
            graph.fillRect(left, top, width, height);
            graph.fillStyle = '#f1bf00';
            graph.fillRect(left, top + stripeH * 0.7, width, stripeH * 1.6);
            break;
        case 'jp':
            graph.fillStyle = '#ffffff';
            graph.fillRect(left, top, width, height);
            graph.fillStyle = '#bc002d';
            graph.beginPath();
            graph.arc(x, y, Math.min(width, height) * 0.24, 0, Math.PI * 2);
            graph.fill();
            break;
        case 'br':
            graph.fillStyle = '#009c3b';
            graph.fillRect(left, top, width, height);
            graph.fillStyle = '#ffdf00';
            graph.beginPath();
            graph.moveTo(x, top + height * 0.12);
            graph.lineTo(left + width * 0.88, y);
            graph.lineTo(x, top + height * 0.88);
            graph.lineTo(left + width * 0.12, y);
            graph.closePath();
            graph.fill();
            graph.fillStyle = '#002776';
            graph.beginPath();
            graph.arc(x, y, Math.min(width, height) * 0.20, 0, Math.PI * 2);
            graph.fill();
            break;
        case 'ca':
            verticalStripe(['#d80621', '#ffffff', '#d80621']);
            graph.fillStyle = '#d80621';
            graph.beginPath();
            graph.arc(x, y, Math.min(width, height) * 0.15, 0, Math.PI * 2);
            graph.fill();
            break;
        case 'gb':
            graph.fillStyle = '#012169';
            graph.fillRect(left, top, width, height);
            graph.strokeStyle = '#ffffff';
            graph.lineWidth = height * 0.18;
            graph.beginPath();
            graph.moveTo(left, top);
            graph.lineTo(left + width, top + height);
            graph.moveTo(left + width, top);
            graph.lineTo(left, top + height);
            graph.stroke();
            graph.fillStyle = '#ffffff';
            graph.fillRect(left + width * 0.42, top, width * 0.16, height);
            graph.fillRect(left, top + height * 0.39, width, height * 0.22);
            graph.fillStyle = '#c8102e';
            graph.fillRect(left + width * 0.46, top, width * 0.08, height);
            graph.fillRect(left, top + height * 0.45, width, height * 0.10);
            break;
        case 'us':
            horizontalStripe(['#b22234', '#ffffff', '#b22234', '#ffffff', '#b22234', '#ffffff', '#b22234']);
            graph.fillStyle = '#3c3b6e';
            graph.fillRect(left, top, width * 0.44, height * 0.56);
            break;
        default:
            horizontalStripe(getFlagSkin(code).colors);
    }
}
