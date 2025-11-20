// editor.js - Logic for the ArticleQuote canvas editor

// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT REFERENCES ---
    const canvas = document.getElementById('quoteCanvas');
    const ctx = canvas.getContext('2d');

    // --- INITIAL DATA & STATE ---
    const params = new URLSearchParams(window.location.search);
    const quoteData = {
        text: params.get('text') || 'Your selected text will appear here. Highlight text on any page and use the context menu to begin.',
        url: params.get('url') || '',
        title: params.get('title') || 'Untitled Page'
    };

    const settings = {
        bgColor: 'linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)', // Soft Purple
        bgScale: 1.0,
        cardWidth: 0.90,
        cardHeight: 0.85,
        borderRadius: 30,
        fontFamily: 'Times New Roman',
        fontSize: 48,
        lineSpacing: 1.5,
        italic: false,
        highlightText: '',
        highlightColor: '#FFD700',
        highlightAll: true,
        boldText: '',
        underlineText: '',
        citationStyle: 'mla', // 'mla', 'url', 'none'
        showTimestamp: false,
    };

    // --- CONTROLS MAPPING ---
    const controls = {
        bgSelect: document.getElementById('bgSelect'),
        bgScale: document.getElementById('bgScale'),
        cardWidth: document.getElementById('cardWidth'),
        cardHeight: document.getElementById('cardHeight'),
        borderRadius: document.getElementById('borderRadius'),
        fontSelect: document.getElementById('fontSelect'),
        fontSize: document.getElementById('fontSize'),
        lineSpacing: document.getElementById('lineSpacing'),
        italicsToggle: document.getElementById('italicsToggle'),

        highlightText: document.getElementById('highlightText'),
        highlightAllToggle: document.getElementById('highlightAllToggle'),
        boldText: document.getElementById('boldText'),
        underlineText: document.getElementById('underlineText'),

        citationStyle: document.getElementById('citationStyle'),
        timestampToggle: document.getElementById('timestampToggle'),

        downloadBtn: document.getElementById('downloadBtn'),
        copyImageBtn: document.getElementById('copyImageBtn'),
        copyTextBtn: document.getElementById('copyTextBtn'),
    };

    const valueSpans = {
        bgScaleVal: document.getElementById('bgScaleVal'),
        cardWidthVal: document.getElementById('cardWidthVal'),
        cardHeightVal: document.getElementById('cardHeightVal'),
        borderRadiusVal: document.getElementById('borderRadiusVal'),
        fontSizeVal: document.getElementById('fontSizeVal'),
        lineSpacingVal: document.getElementById('lineSpacingVal'),
    };

    // --- CORE DRAWING FUNCTION ---
    function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Background
        ctx.save();
        if (settings.bgColor === 'transparent') {
            // Do nothing, canvas is already clear
        } else if (settings.bgColor.startsWith('linear-gradient')) {
            const colors = settings.bgColor.match(/#([0-9a-f]{6}|[0-9a-f]{3})/gi);
            const scale = settings.bgScale;
            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;

            let x0 = 0, y0 = 0, x1 = 0, y1 = h;
            if (settings.bgColor.includes('45deg')) {
                x1 = w;
            } else if (settings.bgColor.includes('to right')) {
                x1 = w; y1 = 0;
            }

            x0 = cx + (x0 - cx) * scale;
            y0 = cy + (y0 - cy) * scale;
            x1 = cx + (x1 - cx) * scale;
            y1 = cy + (y1 - cy) * scale;

            const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
            gradient.addColorStop(0, colors[0] || '#000');
            gradient.addColorStop(1, colors[1] || '#fff');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = settings.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        // 2. Draw Card
        const cardPadding = 80;
        const cardWidth = canvas.width * settings.cardWidth;
        const cardHeight = canvas.height * settings.cardHeight;
        const cardX = (canvas.width - cardWidth) / 2;
        const cardY = (canvas.height - cardHeight) / 2;

        // If background is transparent, card should probably still be white? 
        // Or maybe user wants transparent card too? Usually card is white.
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, settings.borderRadius);
        ctx.fill();

        // 3. Text Processing
        const textMaxWidth = cardWidth - (cardPadding * 2);
        const lineHeight = settings.fontSize * settings.lineSpacing;

        // Analyze text for styles
        const styleMap = analyzeTextStyles(quoteData.text);

        // Wrap text keeping track of indices
        const lines = wrapTextWithIndices(quoteData.text, textMaxWidth, settings.fontSize, settings.fontFamily, settings.italic);
        const textBlockHeight = lines.length * lineHeight;
        let textY = cardY + (cardHeight / 2) - (textBlockHeight / 2) + (lineHeight / 2);

        // 4. Draw Text & Styles
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        lines.forEach((line, lineIndex) => {
            const currentY = textY + (lineIndex * lineHeight);

            // We need to draw word by word to handle styling
            // First, calculate total width to center the line
            let totalLineWidth = 0;
            const wordMetrics = line.words.map(word => {
                // Check if this word is bold
                const isBold = isIndexInRanges(word.index, styleMap.bold);
                const fontStyle = settings.italic ? 'italic' : 'normal';
                const fontWeight = isBold ? 'bold' : 'normal';
                ctx.font = `${fontStyle} ${fontWeight} ${settings.fontSize}px "${settings.fontFamily}", sans-serif`;
                const width = ctx.measureText(word.text).width;
                return { width, isBold };
            });

            // Add spaces
            const spaceWidth = ctx.measureText(' ').width;
            totalLineWidth = wordMetrics.reduce((acc, m) => acc + m.width, 0) + (line.words.length - 1) * spaceWidth;

            let currentX = (canvas.width / 2) - (totalLineWidth / 2);

            line.words.forEach((word, wordIndex) => {
                const metrics = wordMetrics[wordIndex];

                // Check styles
                const isHighlight = isIndexInRanges(word.index, styleMap.highlight);
                const isUnderline = isIndexInRanges(word.index, styleMap.underline);
                const isBold = metrics.isBold;

                // Draw Highlight
                if (isHighlight) {
                    ctx.fillStyle = settings.highlightColor;
                    // Add a bit of padding to connect adjacent words
                    // If next word is also highlighted, extend to right
                    let extendRight = 0;
                    if (wordIndex < line.words.length - 1) {
                        const nextWord = line.words[wordIndex + 1];
                        if (isIndexInRanges(nextWord.index, styleMap.highlight)) {
                            extendRight = spaceWidth + 2; // Cover the space
                        }
                    }

                    // If previous word was highlighted, extend to left (already covered by previous word's extendRight? No, we draw rects)
                    // Actually, simpler: just draw rect for word + half space on each side?
                    // Let's draw rect for word width + space width if not last word

                    const rectWidth = metrics.width + (wordIndex < line.words.length - 1 ? spaceWidth : 0);
                    // Adjust height for better look
                    const rectHeight = lineHeight * 0.85;
                    const rectY = currentY - (lineHeight / 2) + (lineHeight - rectHeight) / 2;

                    // Refined logic for continuous look:
                    // If we are highlighting a phrase, we want it to look like one block.
                    // We draw a rect from currentX to currentX + metrics.width.
                    // If the NEXT word is also highlighted, we draw a rect over the space too.

                    ctx.fillRect(currentX - 2, rectY, metrics.width + 4, rectHeight);

                    if (wordIndex < line.words.length - 1) {
                        const nextWord = line.words[wordIndex + 1];
                        if (isIndexInRanges(nextWord.index, styleMap.highlight)) {
                            ctx.fillRect(currentX + metrics.width, rectY, spaceWidth, rectHeight);
                        }
                    }
                }

                // Draw Text
                ctx.fillStyle = '#1c1e21';
                const fontStyle = settings.italic ? 'italic' : 'normal';
                const fontWeight = isBold ? 'bold' : 'normal';
                ctx.font = `${fontStyle} ${fontWeight} ${settings.fontSize}px "${settings.fontFamily}", sans-serif`;
                ctx.fillText(word.text, currentX + metrics.width / 2, currentY);

                // Draw Underline
                if (isUnderline) {
                    ctx.beginPath();
                    ctx.strokeStyle = '#1c1e21';
                    ctx.lineWidth = 2;
                    const underlineY = currentY + (settings.fontSize / 2) + 4;
                    ctx.moveTo(currentX, underlineY);
                    ctx.lineTo(currentX + metrics.width, underlineY);
                    ctx.stroke();

                    // Underline space if next word is underlined
                    if (wordIndex < line.words.length - 1) {
                        const nextWord = line.words[wordIndex + 1];
                        if (isIndexInRanges(nextWord.index, styleMap.underline)) {
                            ctx.beginPath();
                            ctx.moveTo(currentX + metrics.width, underlineY);
                            ctx.lineTo(currentX + metrics.width + spaceWidth, underlineY);
                            ctx.stroke();
                        }
                    }
                }

                currentX += metrics.width + spaceWidth;
            });
        });

        // 5. Draw Citation
        if (settings.citationStyle !== 'none') {
            const citationText = getCitation();
            ctx.font = `italic 24px "${settings.fontFamily}", sans-serif`;
            ctx.fillStyle = '#606770';
            const citationY = cardY + cardHeight - 50;
            ctx.fillText(citationText, canvas.width / 2, citationY);

            // 6. Draw Timestamp
            if (settings.showTimestamp) {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const timestamp = `${dateStr} • ${timeStr}`;

                ctx.font = `18px "${settings.fontFamily}", sans-serif`;
                ctx.fillStyle = '#90949c';
                ctx.fillText(timestamp, canvas.width / 2, citationY + 30);
            }
        }
    }

    // --- HELPER FUNCTIONS ---

    function analyzeTextStyles(fullText) {
        const lowerText = fullText.toLowerCase();
        const map = { highlight: [], bold: [], underline: [] };

        function addRanges(phrases, targetArray, findAll) {
            if (!phrases) return;
            phrases.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).forEach(phrase => {
                let startIndex = 0;
                while ((index = lowerText.indexOf(phrase, startIndex)) > -1) {
                    targetArray.push({ start: index, end: index + phrase.length });
                    if (!findAll) break; // Only first instance
                    startIndex = index + 1;
                }
            });
        }

        addRanges(settings.highlightText, map.highlight, settings.highlightAll);
        addRanges(settings.boldText, map.bold, true);
        addRanges(settings.underlineText, map.underline, true);

        return map;
    }

    function isIndexInRanges(index, ranges) {
        return ranges.some(range => index >= range.start && index < range.end);
    }

    function wrapTextWithIndices(text, maxWidth, fontSize, fontFamily, italic) {
        // We need to split by words but keep track of their original indices
        // A simple split(' ') loses indices.
        // Regex match is better.

        const words = [];
        let match;
        const regex = /\S+/g;
        while ((match = regex.exec(text)) !== null) {
            words.push({
                text: match[0],
                index: match.index,
                endIndex: match.index + match[0].length
            });
        }

        const fontStyle = italic ? 'italic' : 'normal';
        ctx.font = `${fontStyle} ${fontSize}px "${fontFamily}", sans-serif`;
        const spaceWidth = ctx.measureText(' ').width;

        let lines = [];
        let currentLine = [];
        let currentLineWidth = 0;

        words.forEach(word => {
            const wordWidth = ctx.measureText(word.text).width;
            if (currentLine.length > 0 && currentLineWidth + spaceWidth + wordWidth > maxWidth) {
                lines.push({ words: currentLine });
                currentLine = [word];
                currentLineWidth = wordWidth;
            } else {
                if (currentLine.length > 0) currentLineWidth += spaceWidth;
                currentLine.push(word);
                currentLineWidth += wordWidth;
            }
        });
        if (currentLine.length > 0) lines.push({ words: currentLine });

        return lines;
    }

    function getCitation() {
        if (!quoteData.url) return '';
        try {
            const url = new URL(quoteData.url);
            const siteName = url.hostname.replace('www.', '');

            if (settings.citationStyle === 'mla') {
                const today = new Date();
                const accessDate = `${today.getDate()} ${today.toLocaleString('default', { month: 'short' })}. ${today.getFullYear()}`;
                return `"${quoteData.title}." ${siteName}, ${accessDate}.`;
            } else if (settings.citationStyle === 'url') {
                return `${siteName} (${url.origin})`;
            }
            return '';
        } catch (e) {
            return quoteData.url;
        }
    }

    function updateAll() {
        settings.bgColor = controls.bgSelect.value;
        settings.bgScale = parseInt(controls.bgScale.value, 10) / 100;
        valueSpans.bgScaleVal.textContent = controls.bgScale.value;

        settings.cardWidth = parseInt(controls.cardWidth.value, 10) / 100;
        valueSpans.cardWidthVal.textContent = controls.cardWidth.value;

        settings.cardHeight = parseInt(controls.cardHeight.value, 10) / 100;
        valueSpans.cardHeightVal.textContent = controls.cardHeight.value;

        settings.borderRadius = parseInt(controls.borderRadius.value, 10);
        valueSpans.borderRadiusVal.textContent = settings.borderRadius;

        settings.fontFamily = controls.fontSelect.value;
        settings.fontSize = parseInt(controls.fontSize.value, 10);
        valueSpans.fontSizeVal.textContent = settings.fontSize;

        settings.lineSpacing = parseFloat(controls.lineSpacing.value);
        valueSpans.lineSpacingVal.textContent = settings.lineSpacing;

        settings.italic = controls.italicsToggle.checked;

        settings.highlightText = controls.highlightText.value;
        settings.highlightAll = controls.highlightAllToggle.checked;
        settings.highlightColor = document.querySelector('input[name="highlightColor"]:checked').value;

        settings.boldText = controls.boldText.value;
        settings.underlineText = controls.underlineText.value;

        settings.citationStyle = controls.citationStyle.value;
        settings.showTimestamp = controls.timestampToggle.checked;

        drawCanvas();
    }

    // --- EVENT LISTENERS ---
    Object.values(controls).forEach(control => {
        if (control) {
            if (control.tagName === 'SELECT' || control.type === 'checkbox' || control.type === 'range' || control.type === 'text') {
                control.addEventListener('input', updateAll);
                control.addEventListener('change', updateAll);
            }
        }
    });

    document.querySelectorAll('input[name="highlightColor"]').forEach(radio => {
        radio.addEventListener('change', updateAll);
    });

    controls.downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'ArticleQuote.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    controls.copyImageBtn.addEventListener('click', () => {
        canvas.toBlob(blob => {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                .then(() => alert('Image copied to clipboard!'))
                .catch(err => console.error('Could not copy image: ', err));
        });
    });

    controls.copyTextBtn.addEventListener('click', () => {
        const fullText = `"${quoteData.text}"\n\n${getCitation()}`;
        navigator.clipboard.writeText(fullText)
            .then(() => alert('Quote text copied to clipboard!'))
            .catch(err => console.error('Could not copy text: ', err));
    });

    // --- INITIALIZATION ---
    updateAll(); // Initial draw
});
