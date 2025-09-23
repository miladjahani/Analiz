// --- CONFIG & GLOBAL STATE ---
const API_BASE_URL = 'http://localhost:5000';
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
let retainedChartInstance = null; // New chart instance

// --- DOM ELEMENTS ---
// ... (omitted for brevity, they are the same)
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

// --- ANALYSIS ---
async function performAnalysis() {
    const getFloat = value => { const num = parseFloat(value); return isNaN(num) ? 0.0 : num; };
    const inputSieves = sieves.map(sieve => ({ ...sieve, weight: getFloat(document.getElementById(`sieve-${sieve.label}`).value) }));
    if (inputSieves.reduce((sum, s) => sum + s.weight, 0) === 0) { alert('مجموع وزن‌ها نمی‌تواند صفر باشد.'); return; }

    calculateBtn.disabled = true;
    calculateBtn.innerHTML = 'در حال محاسبه...';
    try {
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sieves: inputSieves, sample_type: currentSieveSet })
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || `Error: ${response.status}`); }
        latestAnalysis = await response.json();
        displayResults();
        displayAnalysisHelp();
        fab.style.display = 'flex';
    } catch (error) {
        console.error('Analysis Error:', error);
        alert(`خطا در ارتباط با سرور: ${error.message}`);
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

    // Retained Chart (New)
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
    if (retainedChartInstance) retainedChartInstance.destroy(); // Destroy new chart
    fab.style.display = 'none';
    fabOptions.classList.remove('active');
}

// --- EXPORTING ---
async function exportFile(url, fileName) {
    if (!latestAnalysis) { alert('ابتدا تحلیل را انجام دهید.'); return; }
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(latestAnalysis)
        });
        if (!response.ok) throw new Error('خطا در ساخت فایل در سرور.');
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error(`Export Error:`, error);
        alert(`خطا در خروجی گرفتن: ${error.message}`);
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
    exportExcelBtn.addEventListener('click', () => exportFile(`${API_BASE_URL}/export/excel`, 'SieveAnalysis.xlsx'));
    exportPdfBtn.addEventListener('click', () => exportFile(`${API_BASE_URL}/export/pdf`, 'SieveAnalysisReport.pdf'));

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
        renderModalSieveList();
        renderSieveInputs();
        newSieveLabelInput.value = '';
        newSieveSizeInput.value = '';
    });
}

window.onload = () => {
    renderSieveInputs();
    setupEventListeners();
    fab.style.display = 'none';
};
