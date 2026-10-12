const chatLayouts = new Map();

export function getChatBubbleLayout(ctx, text, size) {
    const value = String(text);
    const key = `${ctx.font}:${size}:${globalThis.document?.fonts?.status || 'loaded'}:${value}`;
    if (chatLayouts.has(key)) return chatLayouts.get(key);
    const maxTextWidth = size * 18;
    const maxLines = 3;
    const lines = [];
    let current = '';
    for (const character of value) {
        const candidate = current + character;
        if (current && ctx.measureText(candidate).width > maxTextWidth) {
            lines.push(current.trim());
            current = character.trimStart();
            if (lines.length === maxLines) break;
        } else {
            current = candidate;
        }
    }
    if (lines.length < maxLines && current.trim()) lines.push(current.trim());
    const consumed = lines.join('').replace(/\s/g, '').length;
    const original = value.replace(/\s/g, '');
    if (consumed < original.length && lines.length) {
        const last = lines.length - 1;
        while (lines[last] && ctx.measureText(`${lines[last]}…`).width > maxTextWidth) {
            lines[last] = lines[last].slice(0, -1);
        }
        lines[last] = `${lines[last]}…`;
    }
    const lineHeight = size * 1.22;
    const textWidth = lines.length ? Math.max(...lines.map(line => ctx.measureText(line).width)) : 0;
    const paddingX = Math.max(3, size * 0.77);
    const paddingY = Math.max(2, size * 0.61);
    const layout = { lines, lineHeight, bubbleWidth: textWidth + paddingX * 2,
        bubbleHeight: lines.length * lineHeight + paddingY * 2 };
    if (chatLayouts.size >= 128) chatLayouts.delete(chatLayouts.keys().next().value);
    chatLayouts.set(key, layout);
    return layout;
}
