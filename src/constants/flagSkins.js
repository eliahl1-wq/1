import { getSlitherSpecialSkin } from './slitherSpecialSkins.js';
import { getSignatureSkin } from './signatureSkins.js';
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

const FLAG_BORDER_COLORS = Object.freeze({
    se: '#004f7d',
    us: '#292852',
    gb: '#00184f',
    de: '#980000',
    fr: '#003c75',
    es: '#7a0f14',
    it: '#006b34',
    br: '#006b29',
    ca: '#9d0018',
    jp: '#8b0022',
    no: '#800820',
    fi: '#002563',
    dk: '#900b21',
    nl: '#173367',
    pl: '#9d0e2b',
    ua: '#004184',
});

export function getFlagBorderColor(code) {
    return FLAG_BORDER_COLORS[getFlagSkin(code).code] || '#303746';
}

export function getPremiumSkinId(value) {
    const signature = getSignatureSkin(value);
    if (signature) return signature.id;
    const specialSkin = getSlitherSpecialSkin(value);
    if (specialSkin) return specialSkin.id;
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
            // Simplified original shield motif, legible at snake scale.
            graph.fillStyle = '#aa151b'; graph.beginPath();
            graph.moveTo(left+width*0.28, y-height*0.16); graph.lineTo(left+width*0.39,y-height*0.16);
            graph.lineTo(left+width*0.39,y+height*0.08); graph.quadraticCurveTo(left+width*0.335,y+height*0.24,left+width*0.28,y+height*0.08); graph.closePath(); graph.fill();
            graph.fillStyle='#fff0bf'; graph.fillRect(left+width*0.325,y-height*0.12,width*0.025,height*0.22);
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
            graph.strokeStyle = '#ffffff'; graph.lineWidth = height * 0.035;
            graph.beginPath(); graph.moveTo(x-height*0.15,y-height*0.045); graph.quadraticCurveTo(x,y-height*0.1,x+height*0.16,y+height*0.04); graph.stroke();
            break;
        case 'ca':
            verticalStripe(['#d80621', '#ffffff', '#d80621']);
            graph.fillStyle = '#d80621';
            graph.save(); graph.translate(x,y); graph.scale(height*0.36,height*0.36);
            graph.beginPath();
            [[0,-0.9],[0.16,-0.5],[0.4,-0.65],[0.32,-0.15],[0.78,-0.36],[0.65,-0.02],[0.9,0.08],[0.32,0.46],[0.4,0.65],[0.07,0.6],[0.07,0.92],[-0.07,0.92],[-0.07,0.6],[-0.4,0.65],[-0.32,0.46],[-0.9,0.08],[-0.65,-0.02],[-0.78,-0.36],[-0.32,-0.15],[-0.4,-0.65],[-0.16,-0.5]].forEach(([a,b],i)=>i?graph.lineTo(a,b):graph.moveTo(a,b));
            graph.closePath(); graph.fill(); graph.restore();
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
            graph.strokeStyle = '#c8102e'; graph.lineWidth = height * 0.07; graph.stroke();
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
            graph.fillStyle = '#ffffff';
            for (let row=0;row<3;row++) for(let col=0;col<5;col++) {
                const sx=left+width*(0.045+col*0.078), sy=top+height*(0.09+row*0.18), r=height*0.047;
                graph.beginPath();
                for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2, q=k%2?r*0.42:r; const px=sx+Math.cos(a)*q,py=sy+Math.sin(a)*q; k?graph.lineTo(px,py):graph.moveTo(px,py);}
                graph.closePath(); graph.fill();
            }
            break;
        default:
            horizontalStripe(getFlagSkin(code).colors);
    }
}
