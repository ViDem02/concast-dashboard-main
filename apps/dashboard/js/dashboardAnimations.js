// GSAP Animations for Dashboard KPIs and Charts
// Animated counters for all numeric values

// Formatter per numeri italiani
const dashboardIntFormatter = new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
});

const dashboardDecimalFormatter = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

/**
 * Initialize all GSAP animations for the dashboard
 */
function initDashboardAnimations() {
    if (typeof gsap === 'undefined') {
        console.warn('GSAP not loaded, skipping animations');
        return;
    }

    console.log('🎨 Initializing dashboard GSAP animations');

    // Anima tutti i KPI con un piccolo delay (ridotto per renderle più rapide)
    setTimeout(() => {
        animateKPIValues();
        animateStrategyKPIValues();
        animateEfficiencyValues();
        animateComparisonValues();
    }, 100);
}

/**
 * Animate main KPI card values
 */
function animateKPIValues() {
    const kpiElements = [
        { id: 'kpi-ee-totale', hasDecimal: false, unit: '' },
        { id: 'kpi-autoprod', hasDecimal: false, unit: '' },
        { id: 'kpi-autosufficienza', hasDecimal: true, unit: '%' },
        { id: 'kpi-costo', hasDecimal: false, unit: '' },
        { id: 'kpi-risparmio', hasDecimal: false, unit: '' }
    ];

    kpiElements.forEach((kpi, index) => {
        animateNumber(kpi.id, kpi.hasDecimal, index * 0.05, kpi.unit);
    });
}

/**
 * Animate strategy KPI values
 */
function animateStrategyKPIValues() {
    const strategyElements = [
        { id: 'strategy-kpi-periodo', hasDecimal: false },
        { id: 'strategy-kpi-attuale', hasDecimal: false },
        { id: 'strategy-kpi-minimo', hasDecimal: false },
        { id: 'strategy-kpi-risparmio', hasDecimal: false },
        { id: 'strategy-kpi-range', hasDecimal: false }
    ];

    strategyElements.forEach((kpi, index) => {
        animateNumber(kpi.id, kpi.hasDecimal, index * 0.04);
    });

    // Animate savings cards
    animateSavingsCards();
}

/**
 * Animate savings card values
 */
function animateSavingsCards() {
    const savingsElements = [
        'savings-vs-spento',
        'savings-opt-attuale',
        'savings-opt-best',
        'savings-attuale-best'
    ];

    savingsElements.forEach((id, index) => {
        const el = document.getElementById(id);
        if (!el) return;

        const text = el.textContent.trim();
        // Match formato "12.345 € (12.3%)"
        const match = text.match(/(-?[\d.,]+)\s*€/);

        if (match) {
            const numStr = match[1].replace(/\./g, '').replace(/,/g, '.');
            const targetValue = parseFloat(numStr);

            if (!isNaN(targetValue)) {
                const counterObj = { value: 0 };

                gsap.to(counterObj, {
                    value: targetValue,
                    duration: 0.6,
                    delay: index * 0.04,
                    ease: "power2.out",
                    onUpdate: function () {
                        const formatted = dashboardIntFormatter.format(Math.round(counterObj.value));
                        // Mantieni il resto del testo (percentuale se presente)
                        const suffix = text.includes('(') ? text.substring(text.indexOf(' (')) : '';
                        el.textContent = `${formatted} €${suffix}`;
                    }
                });
            }
        }
    });
}

/**
 * Animate efficiency values
 */
function animateEfficiencyValues() {
    const effElements = [
        'eff-ee-value',
        'eff-term-value',
        'eff-tot-value',
        'ore-funz',
        'fattore-carico'
    ];

    effElements.forEach((id, index) => {
        animateNumber(id, true, index * 0.04);
    });
}

/**
 * Animate comparison section values
 */
function animateComparisonValues() {
    const compElements = [
        'comparison-kpi-optimal-percentage',
        'comparison-kpi-min-cost',
        'comparison-kpi-max-savings'
    ];

    compElements.forEach((id, index) => {
        animateNumber(id, false, index * 0.04);
    });
}

/**
 * Generic number animation function
 * @param {string} elementId - ID of the element to animate
 * @param {boolean} hasDecimal - Whether the number has decimal places
 * @param {number} delay - Animation delay in seconds
 * @param {string} forceUnit - Force a specific unit (e.g., '%')
 */
function animateNumber(elementId, hasDecimal = false, delay = 0, forceUnit = null) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const text = el.textContent.trim();
    if (!text || text === '-') return;

    // Extract number from text (remove dots as thousand separators, replace comma with dot)
    const cleanText = text.replace(/\./g, '').replace(/,/g, '.');
    const numMatch = cleanText.match(/(-?\d+\.?\d*)/);
    if (!numMatch) return;

    const targetValue = parseFloat(numMatch[0]);
    if (isNaN(targetValue)) return;

    // Extract suffix (everything after the number in original text)
    // Find where the number ends in the original text
    const originalNumMatch = text.match(/(-?[\d.,]+)/);
    if (!originalNumMatch) return;

    const numEndIndex = text.indexOf(originalNumMatch[0]) + originalNumMatch[0].length;
    const suffix = text.substring(numEndIndex).trim();

    // Use forced unit if provided, otherwise use extracted suffix
    const finalSuffix = forceUnit !== null ? forceUnit : suffix;

    const counterObj = { value: 0 };

    gsap.to(counterObj, {
        value: targetValue,
        duration: 0.6,
        delay: delay,
        ease: "power2.out",
        onUpdate: function () {
            const formatted = hasDecimal
                ? dashboardDecimalFormatter.format(counterObj.value)
                : dashboardIntFormatter.format(Math.round(counterObj.value));
            el.textContent = finalSuffix ? `${formatted} ${finalSuffix}` : formatted;
        }
    });
}

/**
 * Animate chart data on update
 * Call this function after chart data is updated
 */
function animateChartData() {
    // This could be extended to animate chart.js data
    // For now, chart.js has its own built-in animations
    console.log('📊 Charts animated with built-in animations');
}

// Export functions for use in app.js
window.initDashboardAnimations = initDashboardAnimations;
window.animateKPIValues = animateKPIValues;
window.animateStrategyKPIValues = animateStrategyKPIValues;
window.animateNumber = animateNumber;
