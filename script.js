/**
 * Sieve Analysis Calculator
 * A client-side tool for performing and reporting sieve analysis for different materials.
 *
 * @version 2.0.0
 * @author Jules
 */

// --- 1. GLOBAL STATE & CONFIGURATION ---

const PREDEFINED_SIEVES = {
    "default": [
        { label: '4 inch', size: 101600 }, { label: '2 inch', size: 50800 },
        { label: '1 inch', size: 25400 }, { label: '3/4 inch', size: 19000 },
        { label: '1/2 inch', size: 12700 }, { label: 'No. 4', size: 4750 },
        { label: 'No. 8', size: 2360 }, { label: 'No. 16', size: 1180 },
        { label: 'No. 30', size: 600 }, { label: 'No. 50', size: 300 },
        { label: 'No. 100', size: 150 }, { label: 'No. 200', size: 75 },
        { label: 'Pan', size: null },
    ],
    "concrete": [
        { label: '1.5 inch', size: 37500 }, { label: '1 inch', size: 25000 },
        { label: '3/4 inch', size: 19000 }, { label: '1/2 inch', size: 12500 },
        { label: '3/8 inch', size: 9500 }, { label: 'No. 4', size: 4750 },
        { label: 'No. 8', size: 2360 }, { label: 'No. 16', size: 1180 },
        { label: 'No. 30', size: 600 }, { label: 'No. 50', size: 300 },
        { label: 'No. 100', size: 150 }, { label: 'Pan', size: null },
    ],
    "crusher": [
        { label: '6 inch', size: 152400 }, { label: '4 inch', size: 101600 },
        { label: '2 inch', size: 50800 }, { label: '1 inch', size: 25400 },
        { label: '3/4 inch', size: 19000 }, { label: '1/2 inch', size: 12700 },
        { label: '3/8 inch', size: 9525 }, { label: 'No. 4', size: 4750 },
        { label: 'No. 10', size: 2000 }, { label: 'No. 40', size: 425 },
        { label: 'No. 100', size: 150 }, { label: 'No. 200', size: 75 },
        { label: 'Pan', size: null },
    ],
    "clay": [
        { label: 'No. 10', size: 2000 }, { label: 'No. 20', size: 850 },
        { label: 'No. 40', size: 425 }, { label: 'No. 60', size: 250 },
        { label: 'No. 80', size: 180 }, { label: 'No. 100', size: 150 },
        { label: 'No. 140', size: 106 }, { label: 'No. 200', size: 75 },
        { label: 'Pan', size: null },
    ]
};

let currentSieves = [...PREDEFINED_SIEVES.default];
let currentSieveSet = 'default';
let latestAnalysis = null;
let chartInstances = {};

// --- 2. DOM ELEMENT CACHING ---

const dom = {
    // Input and controls
    sieveInputsContainer: document.getElementById('sieve-inputs'),
    calculateBtn: document.getElementById('calculate-btn'),
    resetBtn: document.getElementById('reset-btn'),

    // Preset buttons
    loadConcreteBtn: document.getElementById('load-concrete-btn'),
    loadCrusherBtn: document.getElementById('load-crusher-btn'),
    loadClayBtn: document.getElementById('load-clay-btn'),

    // Results display
    resultsContainer: document.getElementById('results-container'),
    welcomeContainer: document.getElementById('welcome-container'),
    summaryStatsContainer: document.getElementById('summary-stats'),

    // Charts
    passingChart: document.getElementById('passing-chart'),
    retainedChart: document.getElementById('retained-chart'),
    weightChart: document.getElementById('weight-chart'),

    // Analysis text
    analysisHelpContainer: document.getElementById('analysis-help-container'),
    generalAnalysisContainer: document.getElementById('general-analysis'),
    specificAnalysisContainer: document.getElementById('specific-analysis'),

    // FAB and Exports
    fab: document.getElementById('fab'),
    fabOptions: document.getElementById('fab-options'),
    exportExcelBtn: document.getElementById('export-excel-btn'),
    exportPdfFaBtn: document.getElementById('export-pdf-fa-btn'),
    exportPdfEnBtn: document.getElementById('export-pdf-en-btn'),

    // Modal
    manageSievesBtn: document.getElementById('manage-sieves-btn'),
    sieveModal: document.getElementById('sieve-modal'),
    sieveModalContent: document.querySelector('#sieve-modal .bg-white'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    addSieveBtn: document.getElementById('add-sieve-btn'),
    modalSieveList: document.getElementById('modal-sieve-list'),
    newSieveLabelInput: document.getElementById('new-sieve-label'),
    newSieveSizeInput: document.getElementById('new-sieve-size'),
};

// --- 3. CORE LOGIC & CALCULATIONS ---

function linearInterpolate(x, x_points, y_points) {
    if (!x_points || x_points.length < 2) return null;
    let i = 1;
    while (i < x_points.length && x_points[i] < x) i++;
    if (i === 0 || i === x_points.length) return null; // x is out of range
    const x1 = x_points[i - 1], y1 = y_points[i - 1];
    const x2 = x_points[i], y2 = y_points[i];
    if (x1 === x2) return y1;
    return y1 + (x - x1) * (y2 - y1) / (x2 - x1);
};

function performAnalysis(sieveData) {
    const totalWeight = sieveData.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight === 0) {
        alert("Total weight cannot be zero.");
        return null;
    }

    let cumulativeRetained = 0;
    const table = sieveData.map(sieve => {
        const percent_retained = (sieve.weight / totalWeight) * 100;
        cumulativeRetained += percent_retained;
        return { ...sieve, percent_retained, cumulative_retained };
    }).map(sieve => ({
        ...sieve,
        percent_passing: Math.max(0, 100 - sieve.cumulative_retained)
    }));

    const interpPoints = table.filter(s => s.size !== null).map(s => ({ x: s.percent_passing, y: Math.log(s.size) })).sort((a, b) => a.x - b.x);
    const known_percents = interpPoints.map(p => p.x);
    const known_log_sizes = interpPoints.map(p => p.y);

    const dValues = {};
    const TARGET_D_VALUES = { d10: 10, d16: 16, d30: 30, d50: 50, d60: 60, d80: 80, d84: 84 };
    for (const key in TARGET_D_VALUES) {
        const percent = TARGET_D_VALUES[key];
        const log_d = linearInterpolate(percent, known_percents, known_log_sizes);
        dValues[key] = log_d ? Math.exp(log_d) : null;
    }

    const { d10, d16, d30, d60, d84 } = dValues;
    const Cu = (d10 && d60 && d10 > 0) ? d60 / d10 : null;
    const Cc = (d10 && d30 && d60 && d10 > 0) ? (Math.pow(d30, 2) / (d10 * d60)) : null;
    const std_dev = (d16 && d84) ? (d84 - d16) / 2 : null;

    const fmSieveSizes = [9500, 4750, 2360, 1180, 600, 300, 150];
    const relevantSieves = table.filter(s => fmSieveSizes.includes(s.size));
    const sumOfCumulativeRetained = relevantSieves.reduce((sum, s) => sum + s.cumulative_retained, 0);
    const fm = sumOfCumulativeRetained > 0 ? sumOfCumulativeRetained / 100 : null;

    const analysisText = generateAnalysisText({ dValues, Cu, Cc, fm, std_dev }, table);

    const results = {
        table,
        summary: { dValues, Cu, Cc, fm, std_dev, totalWeight, analysisText }
    };

    latestAnalysis = results;
    return results;
}

function generateAnalysisText(summary, table) {
    let generalText = "";
    let specificText = "";
    const { dValues, Cu, Cc, fm } = summary;
    const no200Sieve = table.find(s => s.size === 75);
    const percentFines = no200Sieve ? no200Sieve.percent_passing : 0;

    if (percentFines < 50) {
        generalText += "<strong>Soil Classification (USCS - Coarse Grained):</strong>";
        const no4Sieve = table.find(s => s.size === 4750);
        const percentCoarse = 100 - percentFines;
        const percentGravel = no4Sieve ? no4Sieve.cumulative_retained : 0;
        const percentSand = percentCoarse - percentGravel;

        if (percentGravel > percentSand) {
            if (Cu >= 4 && (Cc >= 1 && Cc <= 3)) generalText += "<li>Classification: <strong>GW (Well-Graded Gravel)</strong></li>";
            else generalText += "<li>Classification: <strong>GP (Poorly-Graded Gravel)</strong></li>";
        } else {
            if (Cu >= 6 && (Cc >= 1 && Cc <= 3)) generalText += "<li>Classification: <strong>SW (Well-Graded Sand)</strong></li>";
            else generalText += "<li>Classification: <strong>SP (Poorly-Graded Sand)</strong></li>";
        }
        generalText += `<li>Coefficient of Uniformity (Cu): <strong>${Cu?.toFixed(2) ?? 'N/A'}</strong></li>`;
        generalText += `<li>Coefficient of Curvature (Cc): <strong>${Cc?.toFixed(2) ?? 'N/A'}</strong></li>`;
        if (percentFines > 12) generalText += "<li class='mt-2 text-sm'>Note: High fines content (>12%). Full classification requires Atterberg limits.</li>";
    } else {
        generalText = "<strong>Soil Classification:</strong> This is a <strong>Fine-Grained Soil</strong>. Classification requires Atterberg limits.";
    }

    if (currentSieveSet === 'concrete') {
        specificText = "<strong>Concrete Aggregate Analysis:</strong>";
        if (fm) {
            specificText += `<li>Fineness Modulus (FM) is <strong>${fm.toFixed(2)}</strong>.</li>`;
            if (fm >= 2.3 && fm <= 3.1) specificText += "<li>This is within the typical range (2.3-3.1) for fine aggregate (ASTM C33).</li>";
            else if (fm < 2.3) specificText += "<li>This indicates a fine sand.</li>";
            else specificText += "<li>This indicates a coarse sand.</li>";
        }
    } else if (currentSieveSet === 'crusher') {
        specificText = "<strong>Heap Leaching Analysis:</strong>";
        if (dValues.d80) {
            const d80_mm = dValues.d80 / 1000;
            specificText += `<li>D80 is <strong>${d80_mm.toFixed(1)} mm</strong>.</li>`;
            if (d80_mm > 5 && d80_mm < 25) specificText += "<li>This size is generally optimal, balancing permeability and recovery.</li>";
            else if (d80_mm <= 5) specificText += "<li>Fine particle size may risk reducing heap permeability.</li>";
            else specificText += "<li>Coarse particle size may reduce recovery rates.</li>";
        }
    }
    return { general: generalText, specific: specificText };
}


// --- 4. UI RENDERING & UPDATES ---

function renderSieveInputs() {
    dom.sieveInputsContainer.innerHTML = '';
    currentSieves.sort((a, b) => (b.size ?? -1) - (a.size ?? -1)).forEach(sieve => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-4 animate-fade-in';
        div.innerHTML = `
            <label for="sieve-${sieve.label}" class="w-2/3 text-right text-gray-700">${sieve.label} (${sieve.size ?? 'Pan'} µm):</label>
            <input type="number" id="sieve-${sieve.label}" class="w-1/3 p-2 border rounded-md text-left focus:ring-2 focus:ring-purple-500" placeholder="0.0" value="0">
        `;
        dom.sieveInputsContainer.appendChild(div);
    });
}

function updateUI() {
    if (!latestAnalysis) return;
    renderSummaryStats();
    renderAnalysisText();
    renderCharts();
    dom.resultsContainer.classList.remove('hidden');
    dom.welcomeContainer.classList.add('hidden');
    dom.fab.style.display = 'flex';
}

function renderSummaryStats() {
    const { dValues, Cu, Cc, fm, totalWeight } = latestAnalysis.summary;
    const stats = [
        { label: 'D10', value: dValues.d10?.toFixed(2) }, { label: 'D30', value: dValues.d30?.toFixed(2) },
        { label: 'D60', value: dValues.d60?.toFixed(2) }, { label: 'D80', value: dValues.d80?.toFixed(2) },
        { label: 'Cu', value: Cu?.toFixed(2) }, { label: 'Cc', value: Cc?.toFixed(2) },
        { label: 'FM', value: fm?.toFixed(2) }, { label: 'Total Wt (g)', value: totalWeight?.toFixed(2) }
    ];
    dom.summaryStatsContainer.innerHTML = stats.map(stat => `
        <div class="bg-gray-100 p-3 rounded-lg">
            <p class="text-sm text-gray-500">${stat.label}</p>
            <p class="text-xl font-bold text-gray-800">${stat.value ?? 'N/A'}</p>
        </div>
    `).join('');
}

function renderAnalysisText() {
    const { general, specific } = latestAnalysis.summary.analysisText;
    dom.generalAnalysisContainer.innerHTML = general;
    if (specific) {
        dom.specificAnalysisContainer.innerHTML = specific;
        dom.specificAnalysisContainer.classList.remove('hidden');
    } else {
        dom.specificAnalysisContainer.classList.add('hidden');
    }
    dom.analysisHelpContainer.classList.remove('hidden');
}

function renderCharts() {
    const createOrUpdateChart = (id, config) => {
        const ctx = document.getElementById(id).getContext('2d');
        if (chartInstances[id]) {
            chartInstances[id].destroy();
        }
        chartInstances[id] = new Chart(ctx, config);
    };

    const table = latestAnalysis.table;
    const passingData = table.filter(d => d.size !== null).map(d => ({ x: d.size, y: d.percent_passing })).sort((a,b) => a.x - b.x);
    const retainedData = table.filter(d => d.size !== null).map(d => ({ x: d.size, y: d.cumulative_retained })).sort((a,b) => a.x - b.x);
    const weightData = table.filter(d => d.size !== null);

    createOrUpdateChart('passing-chart', {
        type: 'line',
        data: { datasets: [{ label: 'Percent Passing', data: passingData, borderColor: '#673ab7', backgroundColor: 'rgba(103, 58, 183, 0.2)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'logarithmic', title: { display: true, text: 'Sieve Size (µm)' } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percent (%)' } } } }
    });

    createOrUpdateChart('retained-chart', {
        type: 'line',
        data: { datasets: [{ label: 'Cumulative Retained', data: retainedData, borderColor: '#c2185b', backgroundColor: 'rgba(233, 30, 99, 0.2)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'logarithmic', title: { display: true, text: 'Sieve Size (µm)' } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percent (%)' } } } }
    });

    createOrUpdateChart('weight-chart', {
        type: 'bar',
        data: { labels: weightData.map(d => d.label), datasets: [{ label: 'Weight Retained (g)', data: weightData.map(d => d.weight), backgroundColor: 'rgba(255, 152, 0, 0.8)' }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function resetUI() {
    dom.resultsContainer.classList.add('hidden');
    dom.welcomeContainer.classList.remove('hidden');
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};
    latestAnalysis = null;
    dom.fab.style.display = 'none';
    dom.fabOptions.classList.remove('active');
}

// --- 5. MODAL & EXPORT LOGIC ---

function renderModalSieveList() {
    dom.modalSieveList.innerHTML = '';
    currentSieves.sort((a, b) => (b.size ?? -1) - (a.size ?? -1)).forEach(sieve => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-2 border-b';
        item.innerHTML = `
            <span>${sieve.label} (${sieve.size ?? 'Pan'} µm)</span>
            ${sieve.size !== null ? `<button data-label="${sieve.label}" class="delete-sieve-btn text-red-500 hover:text-red-700">Delete</button>` : ''}
        `;
        dom.modalSieveList.appendChild(item);
    });
}

async function exportToExcel() {
    if (!latestAnalysis) {
        alert("Please perform analysis before exporting.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sieve Analysis Web App';
    workbook.created = new Date();
    workbook.views = [{ rtl: true }];

    // --- Summary Sheet ---
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.views = [{ rtl: true }];

    const { summary, table } = latestAnalysis;
    const { dValues, Cu, Cc, fm, totalWeight, analysisText } = summary;

    summarySheet.mergeCells('A1:D1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'Sieve Analysis Report';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };
    summarySheet.addRow([]);

    const summaryData = [
        ['D10 (µm)', dValues.d10], ['D30 (µm)', dValues.d30],
        ['D60 (µm)', dValues.d60], ['D80 (µm)', dValues.d80],
        ['Cu', Cu], ['Cc', Cc],
        ['Fineness Modulus (FM)', fm], ['Total Weight (g)', totalWeight]
    ];

    summaryData.forEach(row => {
        if(row[1] !== null && typeof row[1] !== 'undefined') {
            const addedRow = summarySheet.addRow(row);
            if(typeof row[1] === 'number') {
                addedRow.getCell(2).numFmt = '0.00';
            }
        }
    });
    summarySheet.addRow([]);

    const cleanText = (html) => html.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '').trim();
    summarySheet.addRow(['Analysis Interpretation']).getCell(1).font = { bold: true };
    const generalCell = summarySheet.addRow([cleanText(analysisText.general)]);
    generalCell.getCell(1).alignment = { wrapText: true };
    if(analysisText.specific) {
        const specificCell = summarySheet.addRow([cleanText(analysisText.specific)]);
        specificCell.getCell(1).alignment = { wrapText: true };
    }

    const chartImage = chartInstances['passing-chart'].toBase64Image();
    const imageId = workbook.addImage({ base64: chartImage, extension: 'png' });
    summarySheet.addImage(imageId, 'F2:M20');

    // --- Raw Data Sheet ---
    const dataSheet = workbook.addWorksheet('Raw Data');
    dataSheet.views = [{ rtl: true }];
    dataSheet.columns = [
        { header: 'Sieve', key: 'label', width: 20 },
        { header: 'Size (µm)', key: 'size', width: 15 },
        { header: 'Weight Retained (g)', key: 'weight', width: 20, style: { numFmt: '0.00' } },
        { header: 'Percent Retained (%)', key: 'percent_retained', width: 20, style: { numFmt: '0.00' } },
        { header: 'Cumulative Retained (%)', key: 'cumulative_retained', width: 25, style: { numFmt: '0.00' } },
        { header: 'Percent Passing (%)', key: 'percent_passing', width: 20, style: { numFmt: '0.00' } },
    ];
    dataSheet.addRows(table);

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Sieve-Analysis-Report.xlsx');
}

async function exportToPDF(lang = 'fa') {
    if (!latestAnalysis) {
        alert("Please perform analysis before exporting.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const { summary, table } = latestAnalysis;
    const { dValues, Cu, Cc, fm, totalWeight, analysisText } = summary;

    // --- Font Loading ---
    try {
        const fontURL = 'http://talashmotorcycle.com/css/fonts/nazanin/BNAZANIN.TTF';
        const fontResponse = await fetch(fontURL);
        if (!fontResponse.ok) throw new Error('Font file could not be downloaded.');
        const fontBuffer = await fontResponse.arrayBuffer();

        let binary = '';
        const bytes = new Uint8Array(fontBuffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const fontBase64 = btoa(binary);

        doc.addFileToVFS('BNazanin.ttf', fontBase64);
        doc.addFont('BNazanin.ttf', 'BNazanin', 'normal');
        doc.setFont('BNazanin');
    } catch (error) {
        console.error("Font loading failed, falling back to default font:", error);
        alert("Font could not be loaded. PDF will be generated with a default font.");
    }

    // --- Content ---
    doc.setR2L(true);
    doc.setFontSize(18);
    doc.text('Sieve Analysis Report', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });

    // Charts
    doc.addImage(chartInstances['passing-chart'].toBase64Image(), 'PNG', 15, 40, 180, 80);
    doc.addImage(chartInstances['retained-chart'].toBase64Image(), 'PNG', 15, 125, 180, 80);
    doc.addImage(chartInstances['weight-chart'].toBase64Image(), 'PNG', 15, 210, 180, 80);

    doc.addPage();

    // Analysis Text
    doc.setFontSize(14);
    doc.text('Analysis Interpretation', 105, 20, { align: 'center' });
    const cleanText = (html) => html.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '').trim();
    doc.setFontSize(10);
    doc.text(cleanText(analysisText.general), 20, 30);
    if(analysisText.specific) {
        doc.text(cleanText(analysisText.specific), 20, 60);
    }

    // Summary Table
    doc.autoTable({
        startY: 90,
        head: [['Parameter', 'Value']],
        body: Object.entries(summary.dValues).map(([key, value]) => [key.toUpperCase(), value?.toFixed(2) ?? 'N/A'])
            .concat([
                ['Cu', Cu?.toFixed(2) ?? 'N/A'],
                ['Cc', Cc?.toFixed(2) ?? 'N/A'],
                ['FM', fm?.toFixed(2) ?? 'N/A'],
                ['Total Weight (g)', totalWeight?.toFixed(2) ?? 'N/A']
            ]),
        styles: { font: 'BNazanin', halign: 'center' },
        headStyles: { fillColor: [41, 128, 185] },
    });

    // Raw Data Table
    doc.addPage();
    doc.text('Raw Data Table', 105, 20, { align: 'center' });
    doc.autoTable({
        startY: 30,
        head: [['Sieve', 'Size (µm)', 'Weight (g)', 'Retained %', 'Cum. Retained %', 'Passing %']],
        body: table.map(row => [
            row.label,
            row.size,
            row.weight.toFixed(2),
            row.percent_retained.toFixed(2),
            row.cumulative_retained.toFixed(2),
            row.percent_passing.toFixed(2)
        ]),
        styles: { font: 'BNazanin', halign: 'center' },
    });

    doc.save(`Sieve-Analysis-Report-${new Date().toISOString().slice(0,10)}.pdf`);
}

function exportToPDF_EN() {
    if (!latestAnalysis) {
        alert("Please perform analysis before exporting.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const { summary, table } = latestAnalysis;
    const { dValues, Cu, Cc, fm, totalWeight, analysisText } = summary;

    doc.setFontSize(18);
    doc.text('Sieve Analysis Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });

    doc.addImage(chartInstances['passing-chart'].toBase64Image(), 'PNG', 15, 40, 180, 80);
    doc.addImage(chartInstances['retained-chart'].toBase64Image(), 'PNG', 15, 125, 180, 80);
    doc.addImage(chartInstances['weight-chart'].toBase64Image(), 'PNG', 15, 210, 180, 80);

    doc.addPage();
    doc.setFontSize(14);
    doc.text('Analysis Interpretation', 105, 20, { align: 'center' });
    const cleanText = (html) => html.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '').trim();
    doc.setFontSize(10);
    doc.text(cleanText(analysisText.general), 20, 30, { lang: 'en' });
     if(analysisText.specific) {
        doc.text(cleanText(analysisText.specific), 20, 60, { lang: 'en' });
    }

    doc.autoTable({
        startY: 90,
        head: [['Parameter', 'Value']],
        body: Object.entries(summary.dValues).map(([key, value]) => [key.toUpperCase(), value?.toFixed(2) ?? 'N/A'])
            .concat([
                ['Cu', Cu?.toFixed(2) ?? 'N/A'],
                ['Cc', Cc?.toFixed(2) ?? 'N/A'],
                ['FM', fm?.toFixed(2) ?? 'N/A'],
                ['Total Weight (g)', totalWeight?.toFixed(2) ?? 'N/A']
            ]),
        headStyles: { fillColor: [41, 128, 185] },
    });

    doc.addPage();
    doc.text('Raw Data Table', 105, 20, { align: 'center' });
    doc.autoTable({
        startY: 30,
        head: [['Sieve', 'Size (µm)', 'Weight (g)', 'Retained %', 'Cum. Retained %', 'Passing %']],
        body: table.map(row => [
            row.label, row.size, row.weight.toFixed(2),
            row.percent_retained.toFixed(2), row.cumulative_retained.toFixed(2), row.percent_passing.toFixed(2)
        ]),
    });

    doc.save(`Sieve-Analysis-Report-EN-${new Date().toISOString().slice(0,10)}.pdf`);
}


// --- 6. EVENT LISTENERS ---

function setupEventListeners() {
    dom.calculateBtn.addEventListener('click', () => {
        const weights = currentSieves.map(sieve => {
            const input = document.getElementById(`sieve-${sieve.label}`);
            return parseFloat(input.value) || 0;
        });
        const analysisInput = currentSieves.map((sieve, i) => ({ ...sieve, weight: weights[i] }));

        if (performAnalysis(analysisInput)) {
            updateUI();
        }
    });

    dom.resetBtn.addEventListener('click', () => loadSieveSet('default'));
    dom.loadConcreteBtn.addEventListener('click', () => loadSieveSet('concrete'));
    dom.loadCrusherBtn.addEventListener('click', () => loadSieveSet('crusher'));
    dom.loadClayBtn.addEventListener('click', () => loadSieveSet('clay'));

    dom.fab.addEventListener('click', () => {
        if (latestAnalysis) dom.fabOptions.classList.toggle('active');
        else alert('Please perform analysis before exporting.');
    });
    dom.exportExcelBtn.addEventListener('click', exportToExcel);
    dom.exportPdfFaBtn.addEventListener('click', () => exportToPDF('fa'));
    dom.exportPdfEnBtn.addEventListener('click', () => exportToPDF('en'));

    // Modal Listeners
    dom.manageSievesBtn.addEventListener('click', () => {
        renderModalSieveList();
        dom.sieveModal.classList.add('active');
        setTimeout(() => dom.sieveModalContent.classList.remove('scale-95', 'opacity-0'), 10);
    });

    dom.closeModalBtn.addEventListener('click', () => {
        dom.sieveModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => dom.sieveModal.classList.remove('active'), 300);
    });

    dom.addSieveBtn.addEventListener('click', () => {
        const label = dom.newSieveLabelInput.value.trim();
        const size = dom.newSieveSizeInput.value.trim();
        if (!label) { alert('Please enter a sieve name.'); return; }
        if (currentSieves.find(s => s.label === label)) { alert('A sieve with this name already exists.'); return; }

        const sizeValue = size === '' ? null : parseFloat(size);
        currentSieves.push({ label, size: sizeValue });

        dom.newSieveLabelInput.value = '';
        dom.newSieveSizeInput.value = '';

        renderModalSieveList();
        renderSieveInputs();
    });

    dom.modalSieveList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-sieve-btn')) {
            const labelToDelete = e.target.dataset.label;
            currentSieves = currentSieves.filter(s => s.label !== labelToDelete);
            renderModalSieveList();
            renderSieveInputs();
        }
    });
}

function loadSieveSet(setName) {
    currentSieveSet = setName;
    currentSieves = [...PREDEFINED_SIEVES[setName]];
    resetUI();
    renderSieveInputs();
}

// --- 7. INITIALIZATION ---

window.onload = () => {
    renderSieveInputs();
    setupEventListeners();
};
