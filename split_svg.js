const fs = require('fs');
const path = require('path');

// Target paths
const svgPath = path.join(__dirname, 'turkey.svg');
const outputDir = path.join(__dirname, 'cities');

// Read the original SVG file
console.log('Reading turkey.svg...');
if (!fs.existsSync(svgPath)) {
    console.error('Error: turkey.svg not found!');
    process.exit(1);
}

const svgContent = fs.readFileSync(svgPath, 'utf8');

// Clean and recreate output directory to remove old files
if (fs.existsSync(outputDir)) {
    console.log('Cleaning old files in cities directory...');
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
        if (file.endsWith('.svg')) {
            fs.unlinkSync(path.join(outputDir, file));
        }
    }
} else {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
}

// Regex to capture the root <svg> tag attributes
const svgTagRegex = /<svg([^>]+)>/i;
const svgTagMatch = svgContent.match(svgTagRegex);
if (!svgTagMatch) {
    console.error('Error: Could not find root <svg> tag in turkey.svg');
    process.exit(1);
}

const svgAttributes = svgTagMatch[1].trim();

// Tokenizer for SVG path data d="..."
function tokenize(d) {
    const tokens = [];
    const regex = /([a-zA-Z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g;
    let match;
    while ((match = regex.exec(d)) !== null) {
        if (match[1]) {
            tokens.push({ type: 'command', value: match[1] });
        } else if (match[2]) {
            tokens.push({ type: 'number', value: parseFloat(match[2]) });
        }
    }
    return tokens;
}

// Parse coordinates along the path
function getPathPoints(d) {
    const tokens = tokenize(d);
    let x = 0;
    let y = 0;
    const points = [];

    let i = 0;
    let currentCommand = '';

    while (i < tokens.length) {
        const token = tokens[i];
        if (token.type === 'command') {
            currentCommand = token.value;
            i++;
        } else {
            const cmd = currentCommand;
            if (cmd === 'M' || cmd === 'L') {
                x = tokens[i].value;
                y = tokens[i+1].value;
                points.push({ x, y });
                i += 2;
                if (cmd === 'M') currentCommand = 'L';
            } else if (cmd === 'm' || cmd === 'l') {
                x += tokens[i].value;
                y += tokens[i+1].value;
                points.push({ x, y });
                i += 2;
                if (cmd === 'm') currentCommand = 'l';
            } else if (cmd === 'H') {
                x = tokens[i].value;
                points.push({ x, y });
                i += 1;
            } else if (cmd === 'h') {
                x += tokens[i].value;
                points.push({ x, y });
                i += 1;
            } else if (cmd === 'V') {
                y = tokens[i].value;
                points.push({ x, y });
                i += 1;
            } else if (cmd === 'v') {
                y += tokens[i].value;
                points.push({ x, y });
                i += 1;
            } else if (cmd === 'C') {
                const x1 = tokens[i].value;
                const y1 = tokens[i+1].value;
                const x2 = tokens[i+2].value;
                const y2 = tokens[i+3].value;
                x = tokens[i+4].value;
                y = tokens[i+5].value;
                points.push({ x: x1, y: y1 }, { x: x2, y: y2 }, { x, y });
                i += 6;
            } else if (cmd === 'c') {
                const x1 = x + tokens[i].value;
                const y1 = y + tokens[i+1].value;
                const x2 = x + tokens[i+2].value;
                const y2 = y + tokens[i+3].value;
                x += tokens[i+4].value;
                y += tokens[i+5].value;
                points.push({ x: x1, y: y1 }, { x: x2, y: y2 }, { x, y });
                i += 6;
            } else if (cmd === 'S') {
                const x2 = tokens[i].value;
                const y2 = tokens[i+1].value;
                x = tokens[i+2].value;
                y = tokens[i+3].value;
                points.push({ x: x2, y: y2 }, { x, y });
                i += 4;
            } else if (cmd === 's') {
                const x2 = x + tokens[i].value;
                const y2 = y + tokens[i+1].value;
                x += tokens[i+2].value;
                y += tokens[i+3].value;
                points.push({ x: x2, y: y2 }, { x, y });
                i += 4;
            } else if (cmd === 'Q') {
                const x1 = tokens[i].value;
                const y1 = tokens[i+1].value;
                x = tokens[i+2].value;
                y = tokens[i+3].value;
                points.push({ x: x1, y: y1 }, { x, y });
                i += 4;
            } else if (cmd === 'q') {
                const x1 = x + tokens[i].value;
                const y1 = y + tokens[i+1].value;
                x += tokens[i+2].value;
                y += tokens[i+3].value;
                points.push({ x: x1, y: y1 }, { x, y });
                i += 4;
            } else if (cmd === 'T') {
                x = tokens[i].value;
                y = tokens[i+1].value;
                points.push({ x, y });
                i += 2;
            } else if (cmd === 't') {
                x += tokens[i].value;
                y += tokens[i+1].value;
                points.push({ x, y });
                i += 2;
            } else if (cmd === 'A') {
                x = tokens[i+5].value;
                y = tokens[i+6].value;
                points.push({ x, y });
                i += 7;
            } else if (cmd === 'a') {
                x += tokens[i+5].value;
                y += tokens[i+6].value;
                points.push({ x, y });
                i += 7;
            } else if (cmd === 'Z' || cmd === 'z') {
                i++;
            } else {
                i++;
            }
        }
    }
    return points;
}

// Bounding box of a list of points
function getPointsBBox(points) {
    if (points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }

    return { minX, minY, maxX, maxY };
}

// Standardized mapping from city code to english id, turkish name and phone code
const codeToId = {
    '01': 'adana', '02': 'adiyaman', '03': 'afyonkarahisar', '04': 'agri', '05': 'amasya',
    '06': 'ankara', '07': 'antalya', '08': 'artvin', '09': 'aydin', '10': 'balikesir',
    '11': 'bilecik', '12': 'bingol', '13': 'bitlis', '14': 'bolu', '15': 'burdur',
    '16': 'bursa', '17': 'canakkale', '18': 'cankiri', '19': 'corum', '20': 'denizli',
    '21': 'diyarbakir', '22': 'edirne', '23': 'elazig', '24': 'erzincan', '25': 'erzurum',
    '26': 'eskisehir', '27': 'gaziantep', '28': 'giresun', '29': 'gumushane', '30': 'hakkari',
    '31': 'hatay', '32': 'isparta', '33': 'mersin', '34': 'istanbul', '35': 'izmir',
    '36': 'kars', '37': 'kastamonu', '38': 'kayseri', '39': 'kirklareli', '40': 'kirsehir',
    '41': 'kocaeli', '42': 'konya', '43': 'kutahya', '44': 'malatya', '45': 'manisa',
    '46': 'kahramanmaras', '47': 'mardin', '48': 'mugla', '49': 'mus', '50': 'nevsehir',
    '51': 'nigde', '52': 'ordu', '53': 'rize', '54': 'sakarya', '55': 'samsun',
    '56': 'siirt', '57': 'sinop', '58': 'sivas', '59': 'tekirdag', '60': 'tokat',
    '61': 'trabzon', '62': 'tunceli', '63': 'sanliurfa', '64': 'usak', '65': 'van',
    '66': 'yozgat', '67': 'zonguldak', '68': 'aksaray', '69': 'bayburt', '70': 'karaman',
    '71': 'kirikkale', '72': 'batman', '73': 'sirnak', '74': 'bartin', '75': 'ardahan',
    '76': 'igdir', '77': 'yalova', '78': 'karabuk', '79': 'kilis', '80': 'osmaniye',
    '81': 'duzce'
};

const codeToName = {
    '01': 'Adana', '02': 'Adıyaman', '03': 'Afyonkarahisar', '04': 'Ağrı', '05': 'Amasya',
    '06': 'Ankara', '07': 'Antalya', '08': 'Artvin', '09': 'Aydın', '10': 'Balıkesir',
    '11': 'Bilecik', '12': 'Bingöl', '13': 'Bitlis', '14': 'Bolu', '15': 'Burdur',
    '16': 'Bursa', '17': 'Çanakkale', '18': 'Çankırı', '19': 'Çorum', '20': 'Denizli',
    '21': 'Diyarbakır', '22': 'Edirne', '23': 'Elazığ', '24': 'Erzincan', '25': 'Erzurum',
    '26': 'Eskişehir', '27': 'Gaziantep', '28': 'Giresun', '29': 'Gümüşhane', '30': 'Hakkari',
    '31': 'Hatay', '32': 'Isparta', '33': 'Mersin', '34': 'İstanbul', '35': 'İzmir',
    '36': 'Kars', '37': 'Kastamonu', '38': 'Kayseri', '39': 'Kırklareli', '40': 'Kırşehir',
    '41': 'Kocaeli', '42': 'Konya', '43': 'Kütahya', '44': 'Malatya', '45': 'Manisa',
    '46': 'Kahramanmaraş', '47': 'Mardin', '48': 'Muğla', '49': 'Muş', '50': 'Nevşehir',
    '51': 'Niğde', '52': 'Ordu', '53': 'Rize', '54': 'Sakarya', '55': 'Samsun',
    '56': 'Siirt', '57': 'Sinop', '58': 'Sivas', '59': 'Tekirdağ', '60': 'Tokat',
    '61': 'Trabzon', '62': 'Tunceli', '63': 'Şanlıurfa', '64': 'Uşak', '65': 'Van',
    '66': 'Yozgat', '67': 'Zonguldak', '68': 'Aksaray', '69': 'Bayburt', '70': 'Karaman',
    '71': 'Kırıkkale', '72': 'Batman', '73': 'Şırnak', '74': 'Bartın', '75': 'Ardahan',
    '76': 'Iğdır', '77': 'Yalova', '78': 'Karabük', '79': 'Kilis', '80': 'Osmaniye',
    '81': 'Düzce'
};

const codeToPhone = {
    '01': '322', '02': '416', '03': '272', '04': '472', '05': '358', '06': '312', '07': '242', '08': '466', '09': '256', '10': '266',
    '11': '228', '12': '426', '13': '434', '14': '374', '15': '248', '16': '224', '17': '286', '18': '376', '19': '364', '20': '258',
    '21': '412', '22': '284', '23': '424', '24': '446', '25': '442', '26': '222', '27': '342', '28': '454', '29': '456', '30': '438',
    '31': '326', '32': '246', '33': '324', '34': '212', '35': '232', '36': '474', '37': '366', '38': '352', '39': '288', '40': '386',
    '41': '262', '42': '332', '43': '274', '44': '422', '45': '236', '46': '344', '47': '482', '48': '252', '49': '436', '50': '384',
    '51': '388', '52': '452', '53': '464', '54': '264', '55': '362', '56': '484', '57': '368', '58': '346', '59': '282', '60': '356',
    '61': '462', '62': '428', '63': '414', '64': '276', '65': '432', '66': '354', '67': '372', '68': '382', '69': '458', '70': '338',
    '71': '318', '72': '488', '73': '486', '74': '378', '75': '478', '76': '476', '77': '226', '78': '370', '79': '348', '80': '328',
    '81': '380'
};

// Match all path elements (including their closing tags) and group them by city code.
console.log('Extracting paths and grouping by city code...');

const pathRegex = /<path[\s\S]*?<\/path>/gi;
let match;
const cityPaths = {}; // cityCode -> array of path tags

while ((match = pathRegex.exec(svgContent)) !== null) {
    const pathTag = match[0];
    const pathIndex = match.index;
    
    // Find the nearest <g tag before this path
    const beforeText = svgContent.substring(0, pathIndex);
    const gIndex = beforeText.lastIndexOf('<g ');
    if (gIndex === -1) continue;
    
    const nextClosingBracket = beforeText.indexOf('>', gIndex);
    if (nextClosingBracket === -1) continue;
    
    const gTag = beforeText.substring(gIndex, nextClosingBracket + 1);
    
    // Extract data-city-code
    const codeMatch = gTag.match(/data-city-code="([^"]+)"/);
    if (!codeMatch) continue;
    
    const cityCode = codeMatch[1];
    if (!cityPaths[cityCode]) {
        cityPaths[cityCode] = [];
    }
    cityPaths[cityCode].push(pathTag);
}

// Now generate a cropped standalone SVG for each unique city code
console.log('Generating standalone cropped SVG files...');
let count = 0;

for (const cityCode in cityPaths) {
    const paths = cityPaths[cityCode];
    const cityId = codeToId[cityCode];
    const cityName = codeToName[cityCode];
    const phoneCode = codeToPhone[cityCode];

    if (!cityId) {
        console.warn(`Warning: Unknown city code ${cityCode}. Skipping.`);
        continue;
    }

    // Calculate combined bounding box of all paths in this city
    let allPoints = [];
    for (const pathTag of paths) {
        const dMatch = pathTag.match(/d="([^"]+)"/i);
        if (dMatch) {
            const points = getPathPoints(dMatch[1]);
            allPoints = allPoints.concat(points);
        }
    }

    const bbox = getPointsBBox(allPoints);
    let viewBoxStr;
    if (bbox) {
        const width = bbox.maxX - bbox.minX;
        const height = bbox.maxY - bbox.minY;
        // Adding a 5px padding around the city boundary to prevent stroke clipping
        const padding = 5;
        const minX = bbox.minX - padding;
        const minY = bbox.minY - padding;
        const finalWidth = width + padding * 2;
        const finalHeight = height + padding * 2;
        viewBoxStr = `${minX} ${minY} ${finalWidth} ${finalHeight}`;
    } else {
        // Fallback to original viewBox
        viewBoxStr = svgAttributes.match(/viewBox="([^"]+)"/i)?.[1] || "0 0 1005 490";
    }

    // Construct SVG content
    // Clean original viewBox attributes from root svg attributes
    const cleanedSvgAttributes = svgAttributes.replace(/viewBox="[^"]*"\s*/i, '');
    
    const standaloneSvg = `<?xml version="1.0" encoding="utf-8"?>
<svg ${cleanedSvgAttributes} viewBox="${viewBoxStr}">
    <g id="${cityId}" data-city-code="${cityCode}" data-phone-code="${phoneCode}" data-city-name="${cityName}">
        ${paths.join('\n        ')}
    </g>
</svg>
`;

    const fileName = `${cityId}.svg`;
    const fileOutputPath = path.join(outputDir, fileName);

    fs.writeFileSync(fileOutputPath, standaloneSvg, 'utf8');
    console.log(`- Created ${fileName} (Code: ${cityCode}, Paths: ${paths.length}, ViewBox: [${viewBoxStr}])`);
    count++;
}

console.log(`\nSuccess! Separated and cropped ${count} cities into ${outputDir}`);
