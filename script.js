document.addEventListener('DOMContentLoaded', () => {
    // --- INITIAL DATA & DEFAULTS ---
    const DEFAULT_SIEVES = [
        { label: 'سرند 15', size: 150000 }, { label: '10 سانت', size: 100000 },
        { label: '7.5 سانت', size: 75000 }, { label: '2 اینچ', size: 50800 },
        { label: '1اینچ', size: 25400 }, { label: '3/4 اینچ', size: 19000 },
        { label: '1/2 اینچ', size: 12700 }, { label: '4 مش', size: 4760 },
        { label: '8 مش', size: 2380 }, { label: '16 مش', size: 1190 },
        { label: '30 مش', size: 595 }, { label: '100 مش', size: 149 },
        { label: 'سینی', size: null },
    ];
    let sieves = [];
    const TARGET_VALUES = { d10: 10, d30: 30, d50: 50, d60: 60, d80: 80 };
    let latestAnalysis = null;
    let passingChartInstance = null;
    let weightChartInstance = null;

    // --- DOM ELEMENTS ---
    const sieveInputsContainer = document.getElementById('sieve-inputs');
    const calculateBtn = document.getElementById('calculate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const exportBtn = document.getElementById('export-btn');
    const resultsContainer = document.getElementById('results-container');
    const welcomeContainer = document.getElementById('welcome-container');
    const summaryStatsContainer = document.getElementById('summary-stats');

    // Modal elements
    const manageSievesBtn = document.getElementById('manage-sieves-btn');
    const sieveModal = document.getElementById('sieve-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addSieveBtn = document.getElementById('add-sieve-btn');
    const modalSieveList = document.getElementById('modal-sieve-list');
    const newSieveLabelInput = document.getElementById('new-sieve-label');
    const newSieveSizeInput = document.getElementById('new-sieve-size');

    // Theme elements
    const themeToggle = document.getElementById('theme-toggle');
    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');

    // --- THEME MANAGEMENT ---
    function updateTheme(isDark) {
        lightIcon.classList.toggle('hidden', isDark);
        darkIcon.classList.toggle('hidden', !isDark);
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        if (latestAnalysis) {
            updateCharts(); // Redraw charts with new theme colors
        }
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        updateTheme(!isDark);
    });

    function initTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        lightIcon.classList.toggle('hidden', isDark);
        darkIcon.classList.toggle('hidden', !isDark);
    }

    // --- SIEVE DATA PERSISTENCE ---
    function saveSieves() {
        localStorage.setItem('sieves', JSON.stringify(sieves));
    }

    function loadSieves() {
        const savedSieves = localStorage.getItem('sieves');
        try {
            sieves = savedSieves ? JSON.parse(savedSieves) : [...DEFAULT_SIEVES];
        } catch (e) {
            console.error("Error parsing sieves from localStorage", e);
            sieves = [...DEFAULT_SIEVES];
        }
    }

    // --- UI RENDERING ---
    function renderSieveInputs() {
        sieveInputsContainer.innerHTML = '';
        sieves.sort((a, b) => (b.size ?? -Infinity) - (a.size ?? -Infinity));
        sieves.forEach(sieve => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-4';

            const label = document.createElement('label');
            label.className = 'w-2/3 text-right text-slate-700 dark:text-slate-300';
            label.textContent = `${sieve.label} (${sieve.size !== null ? sieve.size : 'سینی'} µm):`;
            label.htmlFor = `sieve-${sieve.label}`;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `sieve-${sieve.label}`;
            input.className = 'w-1/3 p-2 border bg-slate-50 border-slate-300 dark:bg-slate-700 dark:border-slate-500 rounded-md text-left focus:ring-2 focus:ring-sky-500 focus:border-sky-500';
            input.placeholder = '0.0';
            input.value = '0';

            div.appendChild(label);
            div.appendChild(input);
            sieveInputsContainer.appendChild(div);
        });
    }

    // --- CALCULATION LOGIC ---
    function getFloat(value) {
        const num = parseFloat(value);
        return isNaN(num) || num < 0 ? 0.0 : num;
    }

    function linearInterpolation(target, points) {
        if (!points || points.length === 0) return null;
        points.sort((a, b) => b[0] - a[0]);
        if (target >= points[0][0]) return points[0][1];
        if (target <= points[points.length - 1][0]) return points[points.length - 1][1];

        for (let i = 0; i < points.length - 1; i++) {
            const [p_high, d_high] = points[i];
            const [p_low, d_low] = points[i + 1];
            if (p_high >= target && target > p_low) {
                if (p_high - p_low === 0) return d_high;
                const fraction = (p_high - target) / (p_high - p_low);
                return Math.exp(Math.log(d_high) - fraction * (Math.log(d_high) - Math.log(d_low)));
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
        let cum = 0.0;
        const cumRetained = percents.map(p => cum += p);
        const percentPassing = cumRetained.map(cr => Math.max(0, 100 - cr));

        const interpPoints = sieves.map((sieve, i) =>
            sieve.size !== null ? [percentPassing[i], sieve.size] : null
        ).filter(Boolean);

        const dValues = {};
        for (const key in TARGET_VALUES) {
            dValues[key] = linearInterpolation(TARGET_VALUES[key], interpPoints);
        }

        const Cu = (dValues.d10 && dValues.d60) ? dValues.d60 / dValues.d10 : null;
        const Cc = (dValues.d10 && dValues.d60 && dValues.d30) ? Math.pow(dValues.d30, 2) / (dValues.d10 * dValues.d60) : null;

        latestAnalysis = { weights, percents, cumRetained, percentPassing, dValues, Cu, Cc, totalWeight };

        displayResults();
        exportBtn.disabled = false;
    }

    function displayResults() {
        welcomeContainer.classList.add('hidden');
        resultsContainer.classList.remove('hidden');

        const format = (val) => val?.toFixed(2) ?? 'N/A';
        summaryStatsContainer.innerHTML = `
            <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="text-sm text-slate-500 dark:text-slate-400">D10</p><p class="text-xl font-bold text-slate-800 dark:text-slate-200">${format(latestAnalysis.dValues.d10)}</p></div>
            <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="text-sm text-slate-500 dark:text-slate-400">D30</p><p class="text-xl font-bold text-slate-800 dark:text-slate-200">${format(latestAnalysis.dValues.d30)}</p></div>
            <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="text-sm text-slate-500 dark:text-slate-400">D50</p><p class="text-xl font-bold text-slate-800 dark:text-slate-200">${format(latestAnalysis.dValues.d50)}</p></div>
            <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="text-sm text-slate-500 dark:text-slate-400">D60</p><p class="text-xl font-bold text-slate-800 dark:text-slate-200">${format(latestAnalysis.dValues.d60)}</p></div>
            <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="text-sm text-slate-500 dark:text-slate-400">D80</p><p class="text-xl font-bold text-slate-800 dark:text-slate-200">${format(latestAnalysis.dValues.d80)}</p></div>
            <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="text-sm text-slate-500 dark:text-slate-400">Cu</p><p class="text-xl font-bold text-slate-800 dark:text-slate-200">${format(latestAnalysis.Cu)}</p></div>
            <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="text-sm text-slate-500 dark:text-slate-400">Cc</p><p class="text-xl font-bold text-slate-800 dark:text-slate-200">${format(latestAnalysis.Cc)}</p></div>
            <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><p class="text-sm text-slate-500 dark:text-slate-400">Total Weight</p><p class="text-xl font-bold text-slate-800 dark:text-slate-200">${format(latestAnalysis.totalWeight)} g</p></div>
        `;

        updateCharts();
    }

    function getChartColors() {
        const isDark = document.documentElement.classList.contains('dark');
        return {
            grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            ticks: isDark ? '#cbd5e1' : '#475569', // slate-300, slate-600
            text: isDark ? '#e2e8f0' : '#334155', // slate-200, slate-700
            line: 'rgb(14, 165, 233)', // sky-500
            lineBg: 'rgba(14, 165, 233, 0.2)',
            bar: 'rgb(59, 130, 246)', // blue-500
            barBg: 'rgba(59, 130, 246, 0.6)',
        };
    }

    function updateCharts() {
        if (!latestAnalysis) return;
        const colors = getChartColors();
        Chart.defaults.color = colors.ticks;
        Chart.defaults.font.family = "'Vazirmatn', sans-serif";

        // Passing Chart
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
                    borderColor: colors.line,
                    backgroundColor: colors.lineBg,
                    fill: true,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'logarithmic',
                        title: { display: false },
                        grid: { color: colors.grid },
                    },
                    y: {
                        beginAtZero: true, max: 100,
                        title: { display: true, text: 'درصد عبوری (%)', color: colors.text },
                        grid: { color: colors.grid },
                    }
                },
                plugins: { legend: { labels: { color: colors.text } } }
            }
        });

        // Weight Chart
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
                    backgroundColor: colors.barBg,
                    borderColor: colors.bar,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: colors.grid } }
                },
                 plugins: { legend: { labels: { color: colors.text } } }
            }
        });
    }

    function resetProgram() {
        renderSieveInputs();
        latestAnalysis = null;
        resultsContainer.classList.add('hidden');
        welcomeContainer.classList.remove('hidden');
        exportBtn.disabled = true;
        if (passingChartInstance) passingChartInstance.destroy();
        if (weightChartInstance) weightChartInstance.destroy();
    }

    function exportToExcel() {
        if (!latestAnalysis) {
            alert('ابتدا تحلیل را انجام دهید.');
            return;
        }
        const rawData = sieves.map((sieve, i) => ({
            'سرند': sieve.label,
            'اندازه (میکرون)': sieve.size ?? '',
            'وزن (گرم)': latestAnalysis.weights[i],
            'درصد نگه‌داری': latestAnalysis.percents[i],
            'درصد تجمعی نگه‌داری': latestAnalysis.cumRetained[i],
            'درصد عبوری': latestAnalysis.percentPassing[i],
        }));
        const summaryData = Object.entries(latestAnalysis.dValues).map(([k,v]) => ({'پارامتر': k.toUpperCase(), 'مقدار': v}));
        summaryData.push({ 'پارامتر': 'Cu', 'مقدار': latestAnalysis.Cu });
        summaryData.push({ 'پارامتر': 'Cc', 'مقدار': latestAnalysis.Cc });

        const wb = XLSX.utils.book_new();
        const wsRaw = XLSX.utils.json_to_sheet(rawData);
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw Data');
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'SieveAnalysisResults.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- MODAL LOGIC ---
    function renderModalSieveList() {
        modalSieveList.innerHTML = '';
        sieves.forEach(sieve => {
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 border-b border-slate-200 dark:border-slate-700';
            row.innerHTML = `<span class="text-slate-700 dark:text-slate-300">${sieve.label} (${sieve.size ?? 'سینی'} µm)</span>`;
            if (sieve.label !== 'سینی') {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 font-semibold p-1 rounded-full';
                removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`;
                removeBtn.onclick = () => {
                    sieves = sieves.filter(s => s.label !== sieve.label);
                    saveSieves();
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
    });

    closeModalBtn.addEventListener('click', () => {
        sieveModal.classList.remove('active');
    });

    addSieveBtn.addEventListener('click', () => {
        const label = newSieveLabelInput.value.trim();
        const size = newSieveSizeInput.value.trim();
        if (!label) {
            alert('لطفاً نام سرند را وارد کنید.');
            return;
        }
        const sizeValue = size === '' ? null : getFloat(size);
        if (sieves.find(s => s.label === label)) {
            alert('سرندی با این نام از قبل وجود دارد.');
            return;
        }
        sieves.push({ label, size: sizeValue });
        saveSieves();
        newSieveLabelInput.value = '';
        newSieveSizeInput.value = '';
        renderModalSieveList();
        renderSieveInputs();
    });

    // --- EVENT LISTENERS ---
    calculateBtn.addEventListener('click', performAnalysis);
    resetBtn.addEventListener('click', resetProgram);
    exportBtn.addEventListener('click', exportToExcel);

    // --- INITIALIZE ---
    initTheme();
    loadSieves();
    renderSieveInputs();
});
