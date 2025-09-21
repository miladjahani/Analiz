// --- PREDEFINED DATA ---
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
    ]
};
let sieves = [...PREDEFINED_SIEVES.default];
let currentSieveSet = 'default';

const TARGET_VALUES = { d10: 10, d30: 30, d50: 50, d60: 60, d80: 80 };
let latestAnalysis = null;
let passingChartInstance = null;
let weightChartInstance = null;

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
const exportPdfFaBtn = document.getElementById('export-pdf-fa-btn');
const exportPdfEnBtn = document.getElementById('export-pdf-en-btn');

// Predefined data buttons
const loadCrusherBtn = document.getElementById('load-crusher-btn');
const loadClayBtn = document.getElementById('load-clay-btn');

// Modal elements
const manageSievesBtn = document.getElementById('manage-sieves-btn');
const sieveModal = document.getElementById('sieve-modal');
const sieveModalContent = sieveModal.querySelector('.bg-white');
const closeModalBtn = document.getElementById('close-modal-btn');
const addSieveBtn = document.getElementById('add-sieve-btn');
const modalSieveList = document.getElementById('modal-sieve-list');
const newSieveLabelInput = document.getElementById('new-sieve-label');
const newSieveSizeInput = document.getElementById('new-sieve-size');

// --- UI RENDERING ---
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

// --- CALCULATION LOGIC (Unchanged) ---
function getFloat(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0.0 : num;
}

function linearInterpolation(target, points) {
    if (!points || points.length === 0) return null;
    points.sort((a,b) => b[0] - a[0]);
    if (target >= points[0][0]) return points[0][1];
    if (target <= points[points.length - 1][0]) return points[points.length - 1][1];

    for (let i = 0; i < points.length - 1; i++) {
        const [p_high, d_high] = points[i];
        const [p_low, d_low] = points[i + 1];
        if (p_high >= target && target >= p_low) {
            if (p_high - p_low === 0) return d_high;
            const log_d_high = Math.log(d_high);
            const log_d_low = Math.log(d_low);
            const log_d_target = log_d_low + (target - p_low) * (log_d_high - log_d_low) / (p_high - p_low);
            return Math.exp(log_d_target);
        }
    }
    return null;
}

function performAnalysis() {
    const weights = sieves.map(sieve => getFloat(document.getElementById(`sieve-${sieve.label}`).value));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    if (totalWeight === 0) {
        alert('مجموع وزن‌ها نمی‌تواند صفر باشد.');
        return;
    }

    const percents = weights.map(w => (w / totalWeight) * 100);
    const cumRetained = [];
    let cum = 0.0;
    percents.forEach(p => {
        cum += p;
        cumRetained.push(cum);
    });
    const percentPassing = cumRetained.map(cr => 100 - cr);

    const interpPoints = [];
    sieves.forEach((sieve, i) => {
        if (sieve.size !== null) {
            interpPoints.push([percentPassing[i], sieve.size]);
        }
    });

    const dValues = {};
    for (const key in TARGET_VALUES) {
        dValues[key] = linearInterpolation(TARGET_VALUES[key], interpPoints);
    }

    let Cu = null;
    if (dValues.d10 && dValues.d10 > 0 && dValues.d60) {
        Cu = dValues.d60 / dValues.d10;
    }

    let Cc = null;
    if (dValues.d10 && dValues.d60 && dValues.d30 && dValues.d10 > 0 && dValues.d60 > 0) {
        Cc = Math.pow(dValues.d30, 2) / (dValues.d10 * dValues.d60);
    }

    latestAnalysis = {
        sieves, weights, percents, cumRetained, percentPassing, dValues, Cu, Cc, totalWeight
    };

    displayResults();
}

function displayAnalysisHelp() {
    const { Cu, Cc } = latestAnalysis;

    generalAnalysisContainer.innerHTML = `
        <p><strong>ضریب یکنواختی (Cu):</strong> این ضریب نشان‌دهنده بازه توزیع اندازه ذرات است. مقدار Cu برابر با <strong>${Cu?.toFixed(2) ?? 'N/A'}</strong> است.</p>
        <ul class="list-disc list-inside pr-4">
            <li><strong>Cu > 4:</strong> خاک خوب دانه‌بندی شده (Well-graded).</li>
            <li><strong>Cu < 4:</strong> خاک بد دانه‌بندی شده (Poorly-graded).</li>
        </ul>
        <p><strong>ضریب انحنا (Cc):</strong> این ضریب شکل منحنی توزیع ذرات را نشان می‌دهد. مقدار Cc برابر با <strong>${Cc?.toFixed(2) ?? 'N/A'}</strong> است.</p>
        <ul class="list-disc list-inside pr-4">
            <li><strong>1 < Cc < 3:</strong> منحنی توزیع ذرات نرم و پیوسته است (برای خاک خوب دانه‌بندی شده).</li>
            <li><strong>Cc < 1 or Cc > 3:</strong> نشان‌دهنده کمبود ذرات در یک یا چند بازه اندازه‌ای است.</li>
        </ul>
    `;

    let specificText = '';
    if (currentSieveSet === 'crusher') {
        specificText = '<strong>تحلیل نمونه سنگ شکن:</strong> این نمونه معرف خوراک ورودی به سنگ‌شکن‌ها یا محصول خروجی آن‌هاست. توزیع گسترده ذرات (Cu بالا) معمولاً مطلوب است تا فضای خالی بین ذرات بزرگ توسط ذرات کوچکتر پر شود و تراکم هیپ افزایش یابد.';
    } else if (currentSieveSet === 'clay') {
        specificText = '<strong>تحلیل نمونه رس:</strong> این نمونه دارای درصد بالایی از ذرات بسیار ریز است. مقادیر بالای ذرات ریز (مثلاً زیر 75 میکرون) می‌تواند نفوذپذیری هیپ را به شدت کاهش داده و باعث ایجاد مشکلاتی مانند کانالیزه شدن محلول و کاهش راندمان لیچینگ شود.';
    }

    if (specificText) {
        specificAnalysisContainer.innerHTML = specificText;
        specificAnalysisContainer.classList.remove('hidden');
    } else {
        specificAnalysisContainer.classList.add('hidden');
    }

    analysisHelpContainer.classList.remove('hidden');
}

function displayResults() {
    welcomeContainer.classList.add('hidden');
    resultsContainer.classList.remove('hidden');

    summaryStatsContainer.innerHTML = `
        <div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">D10</p><p class="text-xl font-bold text-gray-800">${latestAnalysis.dValues.d10?.toFixed(2) ?? 'N/A'}</p></div>
        <div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">D30</p><p class="text-xl font-bold text-gray-800">${latestAnalysis.dValues.d30?.toFixed(2) ?? 'N/A'}</p></div>
        <div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">D50</p><p class="text-xl font-bold text-gray-800">${latestAnalysis.dValues.d50?.toFixed(2) ?? 'N/A'}</p></div>
        <div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">D60</p><p class="text-xl font-bold text-gray-800">${latestAnalysis.dValues.d60?.toFixed(2) ?? 'N/A'}</p></div>
        <div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">D80</p><p class="text-xl font-bold text-gray-800">${latestAnalysis.dValues.d80?.toFixed(2) ?? 'N/A'}</p></div>
        <div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">Cu</p><p class="text-xl font-bold text-gray-800">${latestAnalysis.Cu?.toFixed(2) ?? 'N/A'}</p></div>
        <div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">Cc</p><p class="text-xl font-bold text-gray-800">${latestAnalysis.Cc?.toFixed(2) ?? 'N/A'}</p></div>
        <div class="bg-gray-100 p-3 rounded-lg"><p class="text-sm text-gray-500">Total Weight</p><p class="text-xl font-bold text-gray-800">${latestAnalysis.totalWeight?.toFixed(2) ?? 'N/A'} g</p></div>
    `;

    updateCharts();
}

function updateCharts() {
    const passingCtx = document.getElementById('passing-chart').getContext('2d');
    const passingData = sieves
        .map((s, i) => ({ x: s.size, y: latestAnalysis.percentPassing[i] }))
        .filter(d => d.x !== null)
        .sort((a,b) => a.x - b.x);

    if (passingChartInstance) passingChartInstance.destroy();
    passingChartInstance = new Chart(passingCtx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'درصد عبوری',
                data: passingData,
                borderColor: '#673ab7',
                backgroundColor: 'rgba(103, 58, 183, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { type: 'logarithmic', title: { display: false } },
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'درصد عبوری (%)' } }
            }
        }
    });

    const weightCtx = document.getElementById('weight-chart').getContext('2d');
    const weightData = sieves.filter(s => s.size !== null);
    if (weightChartInstance) weightChartInstance.destroy();
    weightChartInstance = new Chart(weightCtx, {
        type: 'bar',
        data: {
            labels: weightData.map(s => s.label),
            datasets: [{
                label: 'وزن باقی‌مانده (گرم)',
                data: latestAnalysis.weights.slice(0, weightData.length),
                backgroundColor: 'rgba(255, 152, 0, 0.8)',
                borderColor: '#ff9800',
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function resetProgram() {
    renderSieveInputs();
    latestAnalysis = null;
    resultsContainer.classList.add('hidden');
    welcomeContainer.classList.remove('hidden');
    if (passingChartInstance) passingChartInstance.destroy();
    if (weightChartInstance) weightChartInstance.destroy();
    fabOptions.classList.remove('active');
}

// --- EXCEL EXPORT ---
async function exportToExcel() {
    if (!latestAnalysis) {
        alert('ابتدا تحلیل را انجام دهید.');
        return;
    }

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sieve Analysis Web App';
        workbook.created = new Date();
        workbook.views = [{
            x: 0, y: 0, width: 10000, height: 20000,
            firstSheet: 0, activeTab: 0, visibility: 'visible',
            rtl: true
        }];

        // --- SUMMARY SHEET ---
        const summarySheet = workbook.addWorksheet('خلاصه نتایج');
        summarySheet.views = [{ rtl: true }];
        summarySheet.columns = [
            { header: 'پارامتر', key: 'param', width: 25 },
            { header: 'مقدار', key: 'value', width: 20, style: { numFmt: '#,##0.00' } }
        ];
        const summaryData = [
            { param: 'D10 (µm)', value: latestAnalysis.dValues.d10 },
            { param: 'D30 (µm)', value: latestAnalysis.dValues.d30 },
            { param: 'D50 (µm)', value: latestAnalysis.dValues.d50 },
            { param: 'D60 (µm)', value: latestAnalysis.dValues.d60 },
            { param: 'D80 (µm)', value: latestAnalysis.dValues.d80 },
            { param: 'Cu (ضریب یکنواختی)', value: latestAnalysis.Cu },
            { param: 'Cc (ضریب انحنا)', value: latestAnalysis.Cc },
            { param: 'مجموع وزن (گرم)', value: latestAnalysis.totalWeight },
        ];
        summarySheet.addRows(summaryData);

        // --- RAW DATA SHEET ---
        const dataSheet = workbook.addWorksheet('داده‌های خام');
        dataSheet.views = [{ rtl: true }];
        dataSheet.columns = [
            { header: 'سرند', key: 'label', width: 15 },
            { header: 'اندازه (میکرون)', key: 'size', width: 20 },
            { header: 'وزن (گرم)', key: 'weight', width: 15, style: { numFmt: '#,##0.00' } },
            { header: 'درصد نگه‌داری', key: 'percent', width: 18, style: { numFmt: '0.00"%"' } },
            { header: 'درصد تجمعی نگه‌داری', key: 'cumRetained', width: 25, style: { numFmt: '0.00"%"' } },
            { header: 'درصد عبوری', key: 'percentPassing', width: 18, style: { numFmt: '0.00"%"' } },
        ];

        latestAnalysis.sieves.forEach((sieve, i) => {
            dataSheet.addRow({
                label: sieve.label,
                size: sieve.size,
                weight: latestAnalysis.weights[i],
                percent: latestAnalysis.percents[i],
                cumRetained: latestAnalysis.cumRetained[i],
                percentPassing: latestAnalysis.percentPassing[i]
            });
        });

        // --- GENERATE AND DOWNLOAD FILE ---
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'آنالیز-سرندی.xlsx');

    } catch (error) {
        console.error("Error exporting to Excel:", error);
        alert("متاسفانه در ایجاد فایل اکسل خطایی رخ داد. لطفا دوباره امتحان کنید.");
    }
}

// --- MODAL LOGIC ---
function renderModalSieveList() {
    modalSieveList.innerHTML = '';
    sieves.forEach(sieve => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-2 border-b';
        row.innerHTML = `<span>${sieve.label} (${sieve.size ?? 'سینی'} µm)</span>`;
        if (sieve.label !== 'سینی') {
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'حذف';
            removeBtn.className = 'text-red-500 hover:text-red-700 font-semibold';
            removeBtn.onclick = () => {
                sieves = sieves.filter(s => s.label !== sieve.label);
                renderModalSieveList();
                renderSieveInputs();
            };
            row.appendChild(removeBtn);
        }
        modalSieveList.appendChild(row);
    });
}

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
    const label = newSieveLabelInput.value.trim();
    const size = newSieveSizeInput.value.trim();
    if (!label) { alert('لطفاً نام سرند را وارد کنید.'); return; }
    const sizeValue = size === '' ? null : getFloat(size);
    if (sieves.find(s => s.label === label)) { alert('سرندی با این نام از قبل وجود دارد.'); return; }
    sieves.push({ label, size: sizeValue });
    newSieveLabelInput.value = '';
    newSieveSizeInput.value = '';
    renderModalSieveList();
    renderSieveInputs();
});

// --- EVENT LISTENERS ---
calculateBtn.addEventListener('click', performAnalysis);
resetBtn.addEventListener('click', () => loadSieveSet('default'));
loadCrusherBtn.addEventListener('click', () => loadSieveSet('crusher'));
loadClayBtn.addEventListener('click', () => loadSieveSet('clay'));

fab.addEventListener('click', () => {
    if (!latestAnalysis) {
        alert('ابتدا باید محاسبات را انجام دهید تا بتوانید خروجی بگیرید.');
        return;
    }
    fabOptions.classList.toggle('active');
});

fabOptions.addEventListener('click', (event) => {
    const target = event.target.closest('.fab-option');
    if (!target) return;

    const action = target.id;

    if (action === 'export-excel-btn') {
        exportToExcel();
    } else if (action === 'export-pdf-fa-btn') {
        exportToPDF();
    } else if (action === 'export-pdf-en-btn') {
        exportToPDF_EN();
    }

    // Hide the options menu after a selection is made
    fabOptions.classList.remove('active');
});

// --- PDF EXPORT ---
async function exportToPDF() {
    if (!latestAnalysis) {
        alert('ابتدا تحلیل را انجام دهید.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Helper function to reshape Persian text if the library is loaded
    const reshape = (text) => {
        if (typeof arabicReshaper !== 'undefined') {
            return arabicReshaper.reshape(String(text));
        }
        return text; // Fallback
    };

    try {
        // 1. Fetch Vazirmatn font
        const fontURL = 'https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/ttf/Vazirmatn-Regular.ttf';
        const fontResponse = await fetch(fontURL);
        if (!fontResponse.ok) throw new Error('Network response was not ok');
        const fontBuffer = await fontResponse.arrayBuffer();

        // Convert ArrayBuffer to Base64 string
        let binary = '';
        const bytes = new Uint8Array(fontBuffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const fontBase64 = btoa(binary);

        // 2. Add font to jsPDF
        doc.addFileToVFS('Vazirmatn-Regular.ttf', fontBase64);
        doc.addFont('Vazirmatn-Regular.ttf', 'Vazirmatn', 'normal');
        doc.setFont('Vazirmatn');

    } catch (error) {
        console.error("Font loading failed, falling back to default font:", error);
        alert("خطا در بارگزاری فونت فارسی. PDF با فونت پیش‌فرض ساخته می‌شود.");
    }

    // 3. Add Content
    doc.setR2L(true); // Enable Right-to-Left mode
    doc.setFontSize(22);
    doc.text(reshape('آنالیز سرندی'), 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(reshape(`مجموع وزن کل: ${latestAnalysis.totalWeight.toFixed(2)} گرم`), 105, 30, { align: 'center' });

    // 4. Add Charts as Images
    const passingChartImg = passingChartInstance.canvas.toDataURL('image/jpeg', 0.8);
    const weightChartImg = weightChartInstance.canvas.toDataURL('image/jpeg', 0.8);

    doc.addImage(passingChartImg, 'JPEG', 15, 40, 180, 80);
    doc.addImage(weightChartImg, 'JPEG', 15, 125, 180, 80);

    // 5. Add Summary Table
    const summaryHead = [[reshape('مقدار'), reshape('پارامتر')]];
    const summaryBody = [
        [latestAnalysis.dValues.d10?.toFixed(2) ?? 'N/A', reshape('D10 (µm)')],
        [latestAnalysis.dValues.d30?.toFixed(2) ?? 'N/A', reshape('D30 (µm)')],
        [latestAnalysis.dValues.d50?.toFixed(2) ?? 'N/A', reshape('D50 (µm)')],
        [latestAnalysis.dValues.d60?.toFixed(2) ?? 'N/A', reshape('D60 (µm)')],
        [latestAnalysis.dValues.d80?.toFixed(2) ?? 'N/A', reshape('D80 (µm)')],
        [latestAnalysis.Cu?.toFixed(2) ?? 'N/A', reshape('Cu (ضریب یکنواختی)')],
        [latestAnalysis.Cc?.toFixed(2) ?? 'N/A', reshape('Cc (ضریب انحنا)')],
    ];

    doc.autoTable({
        startY: 210,
        head: summaryHead,
        body: summaryBody,
        theme: 'grid',
        styles: { font: 'Vazirmatn', halign: 'center' },
        headStyles: { fillColor: [103, 58, 183] }, // Purple header
    });

    // 6. Add Raw Data Table on a new page
    doc.addPage();
    doc.text(reshape('داده‌های خام تحلیل'), 105, 20, { align: 'center' });

    const rawDataHead = [[reshape('درصد عبوری'), reshape('درصد تجمعی نگه‌داری'), reshape('درصد نگه‌داری'), reshape('وزن (گرم)'), reshape('اندازه (میکرون)'), reshape('سرند')]];
    const rawDataBody = latestAnalysis.sieves.map((s, i) => [
        `${latestAnalysis.percentPassing[i].toFixed(2)}%`,
        `${latestAnalysis.cumRetained[i].toFixed(2)}%`,
        `${latestAnalysis.percents[i].toFixed(2)}%`,
        latestAnalysis.weights[i].toFixed(2),
        s.size ?? reshape('سینی'),
        reshape(s.label)
    ]);

    doc.autoTable({
        startY: 30,
        head: rawDataHead,
        body: rawDataBody,
        theme: 'striped',
        styles: { font: 'Vazirmatn', halign: 'center' },
        headStyles: { fillColor: [103, 58, 183] },
    });

    // 7. Save PDF
    doc.save('آنالیز-سرندی.pdf');
}

async function exportToPDF_EN() {
    if (!latestAnalysis) {
        alert('Please run the analysis first.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Add Content (No custom font needed)
    doc.setFontSize(22);
    doc.text('Sieve Analysis Report', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Total Sample Weight: ${latestAnalysis.totalWeight.toFixed(2)} g`, 105, 30, { align: 'center' });

    // 2. Add Charts as Images
    const passingChartImg = passingChartInstance.canvas.toDataURL('image/jpeg', 0.8);
    const weightChartImg = weightChartInstance.canvas.toDataURL('image/jpeg', 0.8);

    doc.addImage(passingChartImg, 'JPEG', 15, 40, 180, 80);
    doc.addImage(weightChartImg, 'JPEG', 15, 125, 180, 80);

    // 3. Add Summary Table
    const summaryHead = [['Parameter', 'Value']];
    const summaryBody = [
        ['D10 (µm)', latestAnalysis.dValues.d10?.toFixed(2) ?? 'N/A'],
        ['D30 (µm)', latestAnalysis.dValues.d30?.toFixed(2) ?? 'N/A'],
        ['D50 (µm)', latestAnalysis.dValues.d50?.toFixed(2) ?? 'N/A'],
        ['D60 (µm)', latestAnalysis.dValues.d60?.toFixed(2) ?? 'N/A'],
        ['D80 (µm)', latestAnalysis.dValues.d80?.toFixed(2) ?? 'N/A'],
        ['Cu (Uniformity Coefficient)', latestAnalysis.Cu?.toFixed(2) ?? 'N/A'],
        ['Cc (Curvature Coefficient)', latestAnalysis.Cc?.toFixed(2) ?? 'N/A'],
    ];

    doc.autoTable({
        startY: 210,
        head: summaryHead,
        body: summaryBody,
        theme: 'grid',
        headStyles: { fillColor: [103, 58, 183] }, // Purple header
    });

    // 4. Add Raw Data Table on a new page
    doc.addPage();
    doc.text('Raw Analysis Data', 105, 20, { align: 'center' });

    const enLabelMap = {
        'سرند 15': 'Sieve 15', '10 سانت': '10 cm', '7.5 سانت': '7.5 cm', '2 اینچ': '2 inch', '1اینچ': '1 inch', '3/4 اینچ': '3/4 inch', '1/2 اینچ': '1/2 inch', '4 مش': '4 mesh', '8 مش': '8 mesh', '16 مش': '16 mesh', '30 مش': '30 mesh', '100 مش': '100 mesh', 'سینی': 'Pan',
        '6 اینچ': '6 inch', '4 اینچ': '4 inch', '3/8 اینچ': '3/8 inch', '10 مش': '10 mesh', '40 مش': '40 mesh', '200 مش': '200 mesh',
        '20 مش': '20 mesh', '60 مش': '60 mesh', '80 مش': '80 mesh', '120 مش': '120 mesh', '140 مش': '140 mesh', '170 مش': '170 mesh', '270 مش': '270 mesh', '400 مش': '400 mesh', '500 مش': '500 mesh'
    };
    const getEnLabel = (faLabel) => enLabelMap[faLabel] || faLabel;

    const rawDataHead = [['Sieve', 'Size (µm)', 'Weight (g)', 'Retained %', 'Cum. Retained %', 'Passing %']];
    const rawDataBody = latestAnalysis.sieves.map((s, i) => [
        getEnLabel(s.label),
        s.size ?? 'Pan',
        latestAnalysis.weights[i].toFixed(2),
        `${latestAnalysis.percents[i].toFixed(2)}%`,
        `${latestAnalysis.cumRetained[i].toFixed(2)}%`,
        `${latestAnalysis.percentPassing[i].toFixed(2)}%`,
    ]);

    doc.autoTable({
        startY: 30,
        head: rawDataHead,
        body: rawDataBody,
        theme: 'striped',
        headStyles: { fillColor: [103, 58, 183] },
    });

    // 5. Save PDF
    doc.save('Sieve-Analysis-Report.pdf');
}


// --- INITIALIZE ---
window.onload = () => {
    renderSieveInputs();
};
