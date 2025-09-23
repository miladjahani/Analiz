// --- CONFIG & GLOBAL STATE ---
const API_BASE_URL = ''; // No longer used, but kept for consistency
const PREDEFINED_SIEVES = {
    "default": [
        { label: 'سرند 15', size: 150000 }, { label: '10 سانت', size: 100000 },
        { label: '7.5 سانت', size: 75000 }, { label: '2 اینچ', size: 50800 },
        { label: '1اینچ', size: 25400 }, { label: '3/4 اینچ', size: 19000 },
        { label: '1/2 اینچ', size: 12700 }, { label: '4 مش', size: 4760 },
        { label: '8 مش', size: 2380 }, { label: '16 مش', size: 1190 },
        { label: '30 مش', size: 595 }, { label: '100 مش', size: 149 },
        { label: 'سینی', size: null },
    ],
    "crusher": [
        { label: '6 اینچ', size: 152400 }, { label: '4 اینچ', size: 101600 },
        { label: '2 اینچ', size: 50800 }, { label: '1 اینچ', size: 25400 },
        { label: '3/4 اینچ', size: 19000 }, { label: '1/2 اینچ', size: 12700 },
        { label: '3/8 اینچ', size: 9525 }, { label: '4 مش', size: 4750 },
        { label: '10 مش', size: 2000 }, { label: '40 مش', size: 425 },
        { label: '100 مش', size: 150 }, { label: '200 مش', size: 75 },
        { label: 'سینی', size: null },
    ],
    "clay": [
        { label: '20 مش', size: 850 }, { label: '40 مش', size: 425 },
        { label: '60 مش', size: 250 }, { label: '80 مش', size: 180 },
        { label: '100 مش', size: 150 }, { label: '120 مش', size: 125 },
        { label: '140 مش', size: 106 }, { label: '170 مش', size: 90 },
        { label: '200 مش', size: 75 }, { label: '270 مش', size: 53 },
        { label: '400 مش', size: 38 }, { label: '500 مش', size: 25 },
        { label: 'سینی', size: null },
    ],
    "concrete": [
        { label: '1.5 اینچ', size: 37500 }, { label: '1 اینچ', size: 25000 },
        { label: '3/4 اینچ', size: 19000 }, { label: '1/2 اینچ', size: 12500 },
        { label: '3/8 اینچ', size: 9500 }, { label: 'No. 4', size: 4750 },
        { label: 'No. 8', size: 2360 }, { label: 'No. 16', size: 1180 },
        { label: 'No. 30', size: 600 }, { label: 'No. 50', size: 300 },
        { label: 'No. 100', size: 150 }, { label: 'سینی', size: null },
    ]
};
let sieves = [...PREDEFINED_SIEVES.default];
let currentSieveSet = 'default';
let latestAnalysis = null;
let passingChartInstance = null;
let weightChartInstance = null;
let retainedChartInstance = null;

// --- DOM ELEMENTS ---
const sieveInputsContainer = document.getElementById('sieve-inputs');
const calculateBtn = document.getElementById('calculate-btn');
const resetBtn = document.getElementById('reset-btn');
const resultsContainer = document.getElementById('results-container');
const welcomeContainer = document.getElementById('welcome-container');
const summaryStatsContainer = document.getElementById('summary-stats');
const analysisHelpContainer = document.getElementById('analysis-help-container');
const generalAnalysisContainer = document.getElementById('general-analysis');
const specificAnalysisContainer = document.getElementById('specific-analysis');
const fab = document.getElementById('fab');
const fabOptions = document.getElementById('fab-options');
const exportExcelBtn = document.getElementById('export-excel-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const loadCrusherBtn = document.getElementById('load-crusher-btn');
const loadClayBtn = document.getElementById('load-clay-btn');
const loadConcreteBtn = document.getElementById('load-concrete-btn');
const manageSievesBtn = document.getElementById('manage-sieves-btn');
const sieveModal = document.getElementById('sieve-modal');
const sieveModalContent = sieveModal.querySelector('.bg-white');
const closeModalBtn = document.getElementById('close-modal-btn');
const addSieveBtn = document.getElementById('add-sieve-btn');
const modalSieveList = document.getElementById('modal-sieve-list');
const newSieveLabelInput = document.getElementById('new-sieve-label');
const newSieveSizeInput = document.getElementById('new-sieve-size');


// --- RENDER & UI ---
function renderModalSieveList() {
    modalSieveList.innerHTML = '';
    sieves.sort((a, b) => (b.size ?? -1) - (a.size ?? -1));
    sieves.forEach(sieve => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-2 border-b';
        item.innerHTML = `
            <span>${sieve.label} (${sieve.size ?? 'سینی'} µm)</span>
            <button data-label="${sieve.label}" class="delete-sieve-btn text-red-500 hover:text-red-700">حذف</button>
        `;
        modalSieveList.appendChild(item);
    });
}

function renderSieveInputs() {
    sieveInputsContainer.innerHTML = '';
    sieves.sort((a, b) => (b.size ?? -1) - (a.size ?? -1));
    sieves.forEach(sieve => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-4 animate-fade-in';
        const label = document.createElement('label');
        label.className = 'w-2/3 text-right text-gray-700';
        label.textContent = `${sieve.label} (${sieve.size ?? 'سینی'} µm):`;
        label.htmlFor = `sieve-${sieve.label}`;
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `sieve-${sieve.label}`;
        input.className = 'w-1/3 p-2 border rounded-md text-left focus:ring-2 focus:ring-purple-500 focus:border-purple-500';
        input.placeholder = '0.0';
        input.value = '0';
        div.appendChild(label);
        div.appendChild(input);
        sieveInputsContainer.appendChild(div);
    });
}

function loadSieveSet(setName) {
    currentSieveSet = setName;
    sieves = [...PREDEFINED_SIEVES[setName]];
    resetProgram();
}

// --- ANALYSIS (NOW CLIENT-SIDE) ---
function performAnalysis() {
    const getFloat = value => { const num = parseFloat(value); return isNaN(num) ? 0.0 : num; };
    const inputSieves = sieves.map(sieve => ({ ...sieve, weight: getFloat(document.getElementById(`sieve-${sieve.label}`).value) }));
    if (inputSieves.reduce((sum, s) => sum + s.weight, 0) === 0) { alert('مجموع وزن‌ها نمی‌تواند صفر باشد.'); return; }

    calculateBtn.disabled = true;
    calculateBtn.innerHTML = 'در حال محاسبه...';

    try {
        // Perform analysis directly in the browser
        latestAnalysis = performSieveAnalysisClientSide(inputSieves, currentSieveSet);
        latestAnalysis.analysis_text = generateAnalysisTextClientSide(latestAnalysis.summary_stats, currentSieveSet);

        displayResults();
        displayAnalysisHelp();
        fab.style.display = 'flex';
    } catch (error) {
        console.error('Analysis Error:', error);
        alert(`خطا در هنگام تحلیل داده‌ها: ${error.message}`);
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = 'محاسبه';
    }
}

// --- DISPLAY ---
function displayResults() {
    welcomeContainer.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    const { d_values, Cu, Cc, total_weight, std_dev_geotechnical, fineness_modulus } = latestAnalysis.summary_stats;
    const dValuesHTML = Object.entries(d_values).sort(([keyA], [keyB]) => parseInt(keyA.slice(1)) - parseInt(keyB.slice(1)))
        .map(([key, value]) => `<div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">${key.toUpperCase()}</p><p class="text-xl font-bold text-gray-800">${value?.toFixed(2) ?? 'N/A'}</p></div>`).join('');
    const fmCard = fineness_modulus ? `<div class="bg-green-100 p-3 rounded-lg border border-green-200"><p class="text-sm text-green-800">مدول نرمی (FM)</p><p class="text-xl font-bold text-green-900">${fineness_modulus?.toFixed(2) ?? 'N/A'}</p></div>` : '';
    summaryStatsContainer.innerHTML = `${dValuesHTML}<div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">Cu</p><p class="text-xl font-bold text-gray-800">${Cu?.toFixed(2) ?? 'N/A'}</p></div><div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">Cc</p><p class="text-xl font-bold text-gray-800">${Cc?.toFixed(2) ?? 'N/A'}</p></div><div class="bg-blue-100 p-3 rounded-lg border border-blue-200"><p class="text-sm text-blue-800">انحراف معیار (µm)</p><p class="text-xl font-bold text-blue-900">${std_dev_geotechnical?.toFixed(2) ?? 'N/A'}</p></div>${fmCard}<div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">وزن کل</p><p class="text-xl font-bold text-gray-800">${total_weight?.toFixed(2) ?? 'N/A'} g</p></div>`;
    updateCharts();
}

function displayAnalysisHelp() {
    const { analysis_text } = latestAnalysis;
    if (!analysis_text) return;
    generalAnalysisContainer.innerHTML = analysis_text.general_analysis;
    if (analysis_text.specific_analysis) {
        specificAnalysisContainer.innerHTML = analysis_text.specific_analysis;
        specificAnalysisContainer.classList.remove('hidden');
    } else {
        specificAnalysisContainer.classList.add('hidden');
    }
    analysisHelpContainer.classList.remove('hidden');
}

function updateCharts() {
    const tableData = latestAnalysis.results_table;
    const chartOptions = { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'logarithmic', title: { display: true, text: 'اندازه سرند (میکرون)' } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'درصد (%)' } } } };

    // Passing Chart
    const passingData = tableData.filter(d => d.size !== null).map(d => ({ x: d.size, y: d.percent_passing })).sort((a, b) => a.x - b.x);
    if (passingChartInstance) passingChartInstance.destroy();
    passingChartInstance = new Chart(document.getElementById('passing-chart').getContext('2d'), { type: 'line', data: { datasets: [{ label: 'درصد عبوری', data: passingData, borderColor: '#673ab7', backgroundColor: 'rgba(103, 58, 183, 0.2)', fill: true, tension: 0.4 }] }, options: chartOptions });

    // Retained Chart
    const retainedData = tableData.filter(d => d.size !== null).map(d => ({ x: d.size, y: d.cumulative_retained })).sort((a, b) => a.x - b.x);
    if (retainedChartInstance) retainedChartInstance.destroy();
    retainedChartInstance = new Chart(document.getElementById('retained-chart').getContext('2d'), { type: 'line', data: { datasets: [{ label: 'درصد تجمعی مانده', data: retainedData, borderColor: '#c2185b', backgroundColor: 'rgba(233, 30, 99, 0.2)', fill: true, tension: 0.4 }] }, options: chartOptions });

    // Weight Chart
    const weightData = tableData.filter(d => d.size !== null);
    if (weightChartInstance) weightChartInstance.destroy();
    weightChartInstance = new Chart(document.getElementById('weight-chart').getContext('2d'), { type: 'bar', data: { labels: weightData.map(d => d.label), datasets: [{ label: 'وزن باقی‌مانده (گرم)', data: weightData.map(d => d.weight), backgroundColor: 'rgba(255, 152, 0, 0.8)', borderColor: '#ff9800', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
}

function resetProgram() {
    renderSieveInputs();
    latestAnalysis = null;
    resultsContainer.classList.add('hidden');
    welcomeContainer.classList.remove('hidden');
    if (passingChartInstance) passingChartInstance.destroy();
    if (weightChartInstance) weightChartInstance.destroy();
    if (retainedChartInstance) retainedChartInstance.destroy();
    fab.style.display = 'none';
    fabOptions.classList.remove('active');
}

// --- EXPORTING ---
async function exportExcelClientSide() {
    if (!latestAnalysis) {
        alert('ابتدا تحلیل را انجام دهید.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const summaryWs = workbook.addWorksheet('Summary', { views: [{ rightToLeft: true }] });
    const dataWs = workbook.addWorksheet('Data', { views: [{ rightToLeft: true }] });

    // --- Summary Sheet ---
    const chartImageBase64 = passingChartInstance.toBase64Image();
    const imageId = workbook.addImage({
        base64: chartImageBase64,
        extension: 'png',
    });
    summaryWs.addImage(imageId, 'I1:P16'); // Adjust range as needed

    summaryWs.columns = [
        { header: 'پارامتر', key: 'param', width: 25 },
        { header: 'مقدار', key: 'value', width: 15 }
    ];

    const stats = latestAnalysis.summary_stats;
    const summaryData = [
        { param: "D10 (µm)", value: stats.d_values.d10 },
        { param: "D30 (µm)", value: stats.d_values.d30 },
        { param: "D50 (µm)", value: stats.d_values.d50 },
        { param: "D60 (µm)", value: stats.d_values.d60 },
        { param: "ضریب یکنواختی (Cu)", value: stats.Cu },
        { param: "ضریب انحنا (Cc)", value: stats.Cc },
        { param: "انحراف معیار (µm)", value: stats.std_dev_geotechnical },
        { param: "مدول نرمی (FM)", value: stats.fineness_modulus },
        { param: "وزن کل (g)", value: stats.total_weight }
    ];

    summaryData.forEach(item => {
        if (item.value !== null && item.value !== undefined) {
            const value = (typeof item.value === 'number') ? parseFloat(item.value.toFixed(2)) : item.value;
            summaryWs.addRow({ param: item.param, value: value });
        }
    });

    // --- Data Sheet ---
    dataWs.columns = [
        { header: "سرند", key: "label", width: 20 },
        { header: "اندازه (µm)", key: "size", width: 15 },
        { header: "وزن (g)", key: "weight", width: 15 },
        { header: "درصد مانده", key: "percent_retained", width: 15 },
        { header: "تجمعی مانده", key: "cumulative_retained", width: 15 },
        { header: "درصد عبوری", key: "percent_passing", width: 15 }
    ];

    latestAnalysis.results_table.forEach(row => {
        dataWs.addRow({
            label: row.label,
            size: row.size,
            weight: parseFloat(row.weight.toFixed(2)),
            percent_retained: parseFloat(row.percent_retained.toFixed(2)),
            cumulative_retained: parseFloat(row.cumulative_retained.toFixed(2)),
            percent_passing: parseFloat(row.percent_passing.toFixed(2))
        });
    });

    // --- Save File ---
    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'SieveAnalysis.xlsx');
    } catch (error) {
        console.error('Error writing excel file', error);
        alert('خطا در ایجاد فایل اکسل.');
    }
}

// Helper function to fetch a file and read it as a base64 string
async function getFileAsBase64(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to fetch file: ${path}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function exportPdfClientSide() {
    if (!latestAnalysis) {
        alert('ابتدا تحلیل را انجام دهید.');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // --- FONT & RTL SETUP ---
        const fontBase64 = await getFileAsBase64('Vazirmatn-Regular.ttf');
        doc.addFileToVFS('Vazirmatn-Regular.ttf', fontBase64);
        doc.addFont('Vazirmatn-Regular.ttf', 'Vazirmatn', 'normal');
        doc.setFont('Vazirmatn');

        // Helper for RTL text
        const p_text = (text) => {
            if (!text) return '';
            return arabicreshaper.reshape(text).split('').reverse().join('');
        };

        // --- PDF CONTENT ---
        const chartImageBase64 = passingChartInstance.toBase64Image();

        // Title
        doc.setFontSize(18);
        doc.text(p_text('گزارش تحلیل سرندی'), 105, 20, { align: 'center' });

        // Chart
        doc.addImage(chartImageBase64, 'PNG', 15, 30, 180, 100);

        // Summary Table
        const stats = latestAnalysis.summary_stats;
        const summaryData = [
            ["D10 (µm)", stats.d_values.d10],
            ["D30 (µm)", stats.d_values.d30],
            ["D50 (µm)", stats.d_values.d50],
            ["D60 (µm)", stats.d_values.d60],
            [p_text("ضریب یکنواختی (Cu)"), stats.Cu],
            [p_text("ضریب انحنا (Cc)"), stats.Cc],
            [p_text("انحراف معیار (µm)"), stats.std_dev_geotechnical],
            [p_text("مدول نرمی (FM)"), stats.fineness_modulus],
            [p_text("وزن کل (g)"), stats.total_weight]
        ].filter(row => row[1] !== null && row[1] !== undefined)
         .map(row => [
            (typeof row[1] === 'number') ? row[1].toFixed(2) : row[1],
            row[0]
         ]);

        doc.autoTable({
            startY: 140,
            head: [[p_text('مقدار'), p_text('پارامتر')]],
            body: summaryData,
            styles: {
                font: 'Vazirmatn',
                halign: 'center'
            },
            headStyles: {
                fillColor: [22, 160, 133]
            },
        });

        doc.save('SieveAnalysisReport.pdf');

    } catch (error) {
        console.error('Error creating PDF:', error);
        alert(`خطا در ایجاد فایل PDF: ${error.message}. ممکن است فایل فونت بارگذاری نشده باشد.`);
    }
}

// --- EVENT LISTENERS & INITIALIZATION ---
function setupEventListeners() {
    calculateBtn.addEventListener('click', performAnalysis);
    resetBtn.addEventListener('click', () => loadSieveSet('default'));
    loadCrusherBtn.addEventListener('click', () => loadSieveSet('crusher'));
    loadClayBtn.addEventListener('click', () => loadSieveSet('clay'));
    loadConcreteBtn.addEventListener('click', () => loadSieveSet('concrete'));

    fab.addEventListener('click', () => {
        if (latestAnalysis) fabOptions.classList.toggle('active');
        else alert('ابتدا باید محاسبات را انجام دهید.');
    });
    exportExcelBtn.addEventListener('click', exportExcelClientSide);
    exportPdfBtn.addEventListener('click', exportPdfClientSide);

    manageSievesBtn.addEventListener('click', () => {
        renderModalSieveList();
        sieveModal.classList.add('active');
        setTimeout(() => sieveModalContent.classList.remove('scale-95', 'opacity-0'), 10);
    });
    closeModalBtn.addEventListener('click', () => {
        sieveModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => sieveModal.classList.remove('active'), 300);
    });
    addSieveBtn.addEventListener('click', () => {
        const getFloat = value => { const num = parseFloat(value); return isNaN(num) ? 0.0 : num; };
        const label = newSieveLabelInput.value.trim();
        const size = newSieveSizeInput.value.trim();
        if (!label) { alert('لطفاً نام سرند را وارد کنید.'); return; }
        if (sieves.find(s => s.label === label)) { alert('سرندی با این نام از قبل وجود دارد.'); return; }
        sieves.push({ label, size: size === '' ? null : getFloat(size) });
        renderSieveInputs();
        renderModalSieveList(); // Update the modal list as well
        newSieveLabelInput.value = '';
        newSieveSizeInput.value = '';
    });

    // Event delegation for delete buttons
    modalSieveList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-sieve-btn')) {
            const labelToDelete = e.target.dataset.label;
            sieves = sieves.filter(s => s.label !== labelToDelete);
            renderSieveInputs();
            renderModalSieveList();
        }
    });
}

window.onload = () => {
    renderSieveInputs();
    setupEventListeners();
    fab.style.display = 'none';
};

// --- CLIENT-SIDE ANALYSIS LOGIC ---

/**
 * Generates descriptive text based on analysis summary statistics.
 * @param {object} summary_stats - The summary statistics object.
 * @param {string} sample_type - The type of sample being analyzed.
 * @returns {object} - An object with general and specific analysis text.
 */
function generateAnalysisTextClientSide(summary_stats, sample_type) {
    const { Cu, Cc, std_dev_geotechnical, fineness_modulus } = summary_stats;
    let lines = ["<strong>تحلیل دانه‌بندی (Gradation):</strong>"];
    if (Cu != null && Cc != null) {
        if (Cu >= 4 && Cc >= 1 && Cc <= 3) {
            lines.push(`<li>مقادیر Cu (${Cu.toFixed(2)}) و Cc (${Cc.toFixed(2)}) نشان‌دهنده یک خاک <strong>خوب دانه‌بندی شده (Well-Graded)</strong> است.</li>`);
        } else {
            lines.push(`<li>مقادیر Cu (${Cu.toFixed(2)}) و Cc (${Cc.toFixed(2)}) نشان‌دهنده یک خاک <strong>بد دانه‌بندی شده (Poorly-Graded)</strong> است.</li>`);
        }
    } else {
        lines.push("<li>مقادیر Cu و Cc برای تعیین دقیق نوع دانه‌بندی کافی نبود.</li>");
    }
    lines.push("<br><strong>تحلیل یکنواختی (Sorting):</strong>");
    if (std_dev_geotechnical != null) {
        lines.push(`<li>انحراف معیار نمونه برابر با <strong>${std_dev_geotechnical.toFixed(2)} میکرون</strong> است.</li>`);
    } else {
        lines.push("<li>انحراف معیار قابل محاسبه نبود.</li>");
    }
    let specific_text = '';
    if (sample_type === 'concrete' && fineness_modulus != null) {
        specific_text = `<strong>تحلیل سنگدانه بتن:</strong> مدول نرمی (FM) <strong>${fineness_modulus.toFixed(2)}</strong> محاسبه شد. `;
        if (fineness_modulus >= 2.3 && fineness_modulus <= 3.1) {
            specific_text += 'این مقدار در بازه استاندارد (2.3 تا 3.1) برای ماسه بتن قرار دارد.';
        } else {
            specific_text += 'این مقدار خارج از بازه استاندارد است.';
        }
    }
    return { "general_analysis": lines.join("\n"), "specific_analysis": specific_text };
}

/**
 * Calculates the Fineness Modulus (FM) for concrete aggregate analysis.
 * @param {Array<object>} data - The full analysis data table.
 * @returns {number|null} - The calculated Fineness Modulus or null.
 */
function calculateFinenessModulusClientSide(data) {
    const standardSizes = [9500, 4750, 2360, 1180, 600, 300, 150];
    const sievesWithSizes = data.filter(s => s.size !== null).sort((a, b) => a.size - b.size);
    if (sievesWithSizes.length === 0) return null;

    let sum_cum_retained = 0;
    standardSizes.forEach(stdSize => {
        // Find the closest sieve size in the data (asof merge equivalent)
        let closestSieve = null;
        for (const sieve of sievesWithSizes) {
            if (sieve.size <= stdSize) {
                closestSieve = sieve;
            } else {
                break;
            }
        }
        if (closestSieve) {
            sum_cum_retained += closestSieve.cumulative_retained;
        }
    });

    return sum_cum_retained > 0 ? sum_cum_retained / 100 : null;
}

/**
 * Performs a full sieve analysis on the input data, client-side.
 * @param {Array<object>} sieves_data - Array of sieve objects with weights.
 * @param {string} sample_type - The type of sample.
 * @returns {object} - An object containing the results table and summary stats.
 */
function performSieveAnalysisClientSide(sieves_data, sample_type) {
    // 1. Initial processing and sorting
    let df = sieves_data.map(s => ({...s, weight: parseFloat(s.weight) || 0, size: s.size ? parseFloat(s.size) : null }))
                      .sort((a, b) => (b.size ?? -1) - (a.size ?? -1));

    // 2. Calculate total weight and percentages
    const total_weight = df.reduce((sum, s) => sum + s.weight, 0);
    if (total_weight === 0) throw new Error("Total weight cannot be zero.");

    let cumulative_retained = 0;
    df = df.map(sieve => {
        const percent_retained = (sieve.weight / total_weight) * 100;
        cumulative_retained += percent_retained;
        return { ...sieve, percent_retained, cumulative_retained };
    });

    df = df.map(sieve => {
        const percent_passing = Math.max(0, 100 - sieve.cumulative_retained);
        return { ...sieve, percent_passing };
    });

    // 3. Interpolation for D-values
    const interp_df = df.filter(s => s.size !== null);
    const known_percents = interp_df.map(s => s.percent_passing).reverse();
    const known_log_sizes = interp_df.map(s => Math.log(s.size)).reverse();

    const linearInterpolate = (x, x_points, y_points) => {
        if (x <= x_points[0]) return y_points[0];
        if (x >= x_points[x_points.length - 1]) return y_points[x_points.length - 1];

        let i = 1;
        while (x > x_points[i]) i++;

        const x1 = x_points[i - 1], y1 = y_points[i - 1];
        const x2 = x_points[i], y2 = y_points[i];

        if (x1 === x2) return y1; // Avoid division by zero

        return y1 + (x - x1) * (y2 - y1) / (x2 - x1);
    };

    const d_values = {};
    const target_percents = [10, 16, 30, 50, 60, 84];
    if (known_percents.length >= 2) {
        target_percents.forEach(p => {
            const log_d = linearInterpolate(p, known_percents, known_log_sizes);
            d_values[`d${p}`] = !isNaN(log_d) ? Math.exp(log_d) : null;
        });
    }

    // 4. Calculate summary statistics
    const { d10, d16, d30, d60, d84 } = d_values;
    const Cu = (d10 && d60 && d10 > 0) ? d60 / d10 : null;
    const Cc = (d10 && d30 && d60 && d10 > 0 && d60 > 0) ? (d30**2) / (d10 * d60) : null;
    const std_dev_geotechnical = (d16 && d84) ? (d84 - d16) / 2 : null;
    const fineness_modulus = (sample_type === 'concrete') ? calculateFinenessModulusClientSide(df) : null;

    const summary = {
        d_values: { d10, d30, d50: d_values.d50, d60 },
        Cu,
        Cc,
        total_weight,
        std_dev_geotechnical,
        fineness_modulus
    };

    return { results_table: df, summary_stats: summary };
}
