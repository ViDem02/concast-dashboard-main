/**
 * OptProd Charts - Context-Agnostic Canvas Chart Renderer
 * 
 * A generalized, reusable chart rendering library for HTML5 Canvas.
 * Supports multiple chart types with interactive features.
 * 
 * @version 2.0.0
 * @license MIT
 */

class OptProdChartRenderer {
    /**
     * Create a new chart renderer instance
     * @param {Object} options - Configuration options
     * @param {Object} options.colors - Color palette for charts (optional)
     * @param {Object} options.defaultPadding - Default padding for charts (optional)
     * @param {string} options.locale - Locale for number formatting (default: 'it-IT')
     */
    constructor(options = {}) {
        this.options = {
            colors: options.colors || this._getDefaultColors(),
            defaultPadding: options.defaultPadding || { top: 20, right: 60, bottom: 40, left: 60 },
            locale: options.locale || 'it-IT',
            retinaScale: 2,
            weekendKeywords: options.weekendKeywords || ['Sab', 'Dom', 'Sat', 'Sun'],
            ...options
        };
        
        this._zoom = {}; // Per-canvas zoom state
        this._payloads = {}; // Last draw payloads per canvas for redraw
        this._snapshots = {}; // Canvas snapshots for efficient redraws
    }

    /**
     * Get default color palette
     * @private
     */
    _getDefaultColors() {
        return {
            primary: '#3b82f6',
            secondary: '#10b981',
            tertiary: '#f97316',
            quaternary: '#8b5cf6',
            accent: '#fbbf24',
            danger: '#ef4444',
            dark: '#1e293b',
            muted: '#94a3b8'
        };
    }

    /**
     * Format number with locale-specific thousand separators
     * @param {number} num - Number to format
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted number
     */
    formatNumber(num, decimals = 0) {
        if (num == null || isNaN(num)) return '0';
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    /**
     * Draw a dual Y-axis line chart
     * @param {string} canvasId - Canvas element ID
     * @param {Object} data - Chart data
     * @param {string[]} data.labels - X-axis labels
     * @param {Object} data.leftAxis - Left Y-axis datasets
     * @param {Object} data.rightAxis - Right Y-axis datasets
     * @param {Object} options - Drawing options
     */
    drawDualAxisLineChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element with id "${canvasId}" not found`);
            return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        // Setup canvas for retina displays
        canvas.width = rect.width * this.options.retinaScale;
        canvas.height = rect.height * this.options.retinaScale;
        ctx.scale(this.options.retinaScale, this.options.retinaScale);

        const padding = options.padding || this.options.defaultPadding;
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calculate scales for left and right axes
        const leftValues = Object.values(data.leftAxis).flat();
        const rightValues = Object.values(data.rightAxis).flat();
        
        const minValLeft = options.leftMin ?? 0;
        const maxValLeft = options.leftMax ?? Math.max(...leftValues) * 1.1;
        const minValRight = options.rightMin ?? 0;
        const maxValRight = options.rightMax ?? Math.max(...rightValues) * 1.1;

        // Draw grid
        this.drawGrid(ctx, padding, width, height, minValLeft, maxValLeft, data.labels.length);

        // Draw weekend bands if enabled
        if (options.showWeekends !== false) {
            this.drawWeekendBands(ctx, data.labels, padding, width, height);
        }

        // Draw axes
        this.drawLeftAxis(ctx, padding, width, height, data.labels, minValLeft, maxValLeft, 
            options.leftAxisLabel || '');
        this.drawRightAxis(ctx, padding, width, height, minValRight, maxValRight, 
            options.rightAxisLabel || '');

        // Prepare datasets
        const allDatasets = [];

        // Left axis datasets
        const leftEntries = Object.entries(data.leftAxis);
        leftEntries.forEach(([key, values], index) => {
            const dataset = {
                data: values,
                color: options.leftColors?.[key] || this._getColorByIndex(index),
                label: options.leftLabels?.[key] || key,
                axis: 'left',
                lineWidth: (options.leftLineWidths && options.leftLineWidths[key]) || options.leftLineWidth || 2,
            };
            allDatasets.push(dataset);
            this.drawLine(ctx, values, padding, width, height, minValLeft, maxValLeft, 
                dataset.color, dataset.lineWidth);
        });

        // Optional band fill between two left-axis series (e.g., Min/Max temperature range)
        if (options.fillBandLeft && options.fillBandLeft.lowerKey && options.fillBandLeft.upperKey) {
            const lower = data.leftAxis[options.fillBandLeft.lowerKey];
            const upper = data.leftAxis[options.fillBandLeft.upperKey];
            if (Array.isArray(lower) && Array.isArray(upper) && lower.length === upper.length) {
                const bandColor = options.fillBandLeft.color || this.options.colors.muted;
                const bandOpacity = options.fillBandLeft.opacity ?? 0.15;
                this.drawArea(ctx, lower, upper, padding, width, height, minValLeft, maxValLeft, bandColor, bandOpacity);
            }
        }

        // Optional soft fill under left-axis series (e.g., surplus area)
        if (options.fillLeft) {
            const opacity = options.leftFillOpacity ?? 0.2;
            const zeroBaseline = new Array(data.labels.length).fill(minValLeft);
            leftEntries.forEach(([key, values], index) => {
                const fillColor = options.leftColors?.[key] || this._getColorByIndex(index);
                this.drawArea(ctx, zeroBaseline, values, padding, width, height, 
                    minValLeft, maxValLeft, fillColor, opacity);
            });
        }

        // Right axis datasets
        Object.entries(data.rightAxis).forEach(([key, values], index) => {
            const dataset = {
                data: values,
                color: options.rightColors?.[key] || this._getColorByIndex(index + 3),
                label: options.rightLabels?.[key] || key,
                axis: 'right',
                lineWidth: options.rightLineWidth || 3
            };
            allDatasets.push(dataset);
            this.drawLine(ctx, values, padding, width, height, minValRight, maxValRight, 
                dataset.color, dataset.lineWidth);
        });

        // Draw points
        if (options.showPoints !== false) {
            allDatasets.forEach(dataset => {
                const minVal = dataset.axis === 'left' ? minValLeft : minValRight;
                const maxVal = dataset.axis === 'left' ? maxValLeft : maxValRight;
                this.drawPoints(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color);
            });
        }

        // Update legend if requested (basic legend: color + label)
        if (options.legendId) {
            const legendItems = allDatasets.map(ds => ({ color: ds.color, label: ds.label }));
            this.updateLegendBasic(options.legendId, legendItems);
        }

        // Add tooltip
        this.addDualAxisTooltip(canvas, allDatasets, data.labels, padding, width, height,
            minValLeft, maxValLeft, minValRight, maxValRight, options.unit || '');
    }

    /**
     * Draw a compact sparkline (no axes, optional area fill)
     * @param {string} canvasId
     * @param {number[]} series - values (can be percents 0-100)
     * @param {Object} options
     * @param {string} options.color - line color
     * @param {number} options.lineWidth - line width
     * @param {boolean} options.fill - whether to fill area under line
     * @param {number} options.topPadding - inner padding top
     * @param {number} options.bottomPadding - inner padding bottom
     */
    drawSparkline(canvasId, series, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !Array.isArray(series) || series.length < 2) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * this.options.retinaScale;
        canvas.height = rect.height * this.options.retinaScale;
        ctx.scale(this.options.retinaScale, this.options.retinaScale);

        const padding = {
            left: 6,
            right: 6,
            top: options.topPadding ?? 6,
            bottom: options.bottomPadding ?? 6
        };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        const minVal = Math.min(...series);
        const maxVal = Math.max(...series);
        const range = maxVal - minVal || 1;

        // Optional fill under line
        if (options.fill) {
            ctx.beginPath();
            series.forEach((v, i) => {
                const x = padding.left + (width / (series.length - 1)) * i;
                const y = padding.top + height - ((v - minVal) / range) * height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.lineTo(padding.left + width, padding.top + height);
            ctx.lineTo(padding.left, padding.top + height);
            ctx.closePath();
            ctx.fillStyle = (options.color || this.options.colors.primary) + '30';
            ctx.fill();
        }

        // Line
        ctx.beginPath();
        series.forEach((v, i) => {
            const x = padding.left + (width / (series.length - 1)) * i;
            const y = padding.top + height - ((v - minVal) / range) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = options.color || this.options.colors.primary;
        ctx.lineWidth = options.lineWidth || 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    /**
     * Draw a stacked area chart
     * @param {string} canvasId - Canvas element ID
     * @param {Object} data - Chart data
     * @param {string[]} data.labels - X-axis labels
     * @param {Object} data.datasets - Array of dataset objects
     * @param {number[]} data.referenceLine - Optional reference line data
     * @param {string} legendId - Legend element ID (optional)
     * @param {Object} options - Drawing options
     */
    drawStackedAreaChart(canvasId, data, legendId = null, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element with id "${canvasId}" not found`);
            return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * this.options.retinaScale;
        canvas.height = rect.height * this.options.retinaScale;
        ctx.scale(this.options.retinaScale, this.options.retinaScale);

        const padding = options.padding || { ...this.options.defaultPadding, right: 20 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calculate max value
        let maxVal;
        if (options.maxValue !== undefined) {
            maxVal = options.maxValue;
        } else if (data.referenceLine && Array.isArray(data.referenceLine)) {
            maxVal = Math.max(...data.referenceLine, ...data.datasets.flatMap(ds => ds.data));
        } else {
            maxVal = Math.max(...data.datasets.flatMap(ds => ds.data));
        }
        maxVal = maxVal * 1.1;

        // Draw grid
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Draw weekend bands
        if (options.showWeekends !== false) {
            this.drawWeekendBands(ctx, data.labels, padding, width, height);
        }

        // Draw axes
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, options.unit || '');

        // Prepare datasets with totals
        const datasets = data.datasets.map(ds => ({
            ...ds,
            data: ds.data.map(v => Math.max(0, v)), // Ensure non-negative values
            totale: ds.data.reduce((a, b) => a + b, 0)
        }));

        // Draw stacked areas
        let cumulativeData = new Array(data.labels.length).fill(0);

        datasets.forEach(dataset => {
            const layerData = dataset.data.map((val, i) => cumulativeData[i] + val);
            
            if (dataset.pattern) {
                this.drawAreaWithHatch(ctx, cumulativeData, layerData, padding, width, height, 
                    0, maxVal, dataset.color);
            } else {
                this.drawArea(ctx, cumulativeData, layerData, padding, width, height, 
                    0, maxVal, dataset.color, dataset.opacity || 0.7);
            }
            
            cumulativeData = layerData;
        });

        // Draw reference line if provided (supports dashed styling)
        if (data.referenceLine) {
            if (options.referenceDash && Array.isArray(options.referenceDash)) {
                ctx.setLineDash(options.referenceDash);
            }
            this.drawLine(
                ctx,
                data.referenceLine,
                padding,
                width,
                height,
                0,
                maxVal,
                options.referenceColor || this.options.colors.dark,
                2
            );
            // Reset line dash
            if (options.referenceDash && Array.isArray(options.referenceDash)) {
                ctx.setLineDash([]);
            }
        }

        // Update legend
        if (legendId) {
            this.updateLegend(legendId, datasets, options.unit || '');
        }

        // Add tooltip
        const tooltipDatasets = data.referenceLine 
            ? [...datasets, { data: data.referenceLine, color: options.referenceColor || this.options.colors.dark, 
                label: options.referenceLabel || 'Reference' }]
            : datasets;
        
        this.addTooltip(canvas, tooltipDatasets, data.labels, padding, width, height, 
            0, maxVal, options.unit || '');
    }

    /**
     * Draw a bar chart with optional overlay lines
     * @param {string} canvasId - Canvas element ID
     * @param {Object} data - Chart data
     * @param {string[]} data.labels - X-axis labels
     * @param {Object} data.bars - Bar dataset
     * @param {Array} data.lines - Line datasets (optional)
     * @param {string} legendId - Legend element ID (optional)
     * @param {Object} options - Drawing options
     */
    drawBarChartWithLines(canvasId, data, legendId = null, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element with id "${canvasId}" not found`);
            return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * this.options.retinaScale;
        canvas.height = rect.height * this.options.retinaScale;
        ctx.scale(this.options.retinaScale, this.options.retinaScale);

        const padding = options.padding || { ...this.options.defaultPadding, right: 20 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Store payload for redraw
        this._payloads[canvasId] = { data, legendId, options };

        const lines = data.lines || [];
        
        // Calculate max value
        const lineValues = lines.flatMap(ds => ds.data || []);
        const maxVal = Math.max(
            ...(data.bars.data || [0]),
            ...(lineValues.length ? lineValues : [0])
        ) * 1.1;

        // Draw grid
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Draw weekend bands
        if (options.showWeekends !== false) {
            this.drawWeekendBands(ctx, data.labels, padding, width, height);
        }

        // Draw axes
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, options.unit || '');

        // Draw bars
        const barWidth = width / data.labels.length * (options.barWidthRatio || 0.6);
        const barSpacing = width / data.labels.length;
        
        data.labels.forEach((label, i) => {
            const value = data.bars.data[i] || 0;
            const barHeight = (value / maxVal) * height;
            const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = padding.top + height - barHeight;
            ctx.fillStyle = data.bars.color;
            ctx.fillRect(x, y, barWidth, barHeight);
        });

        // Draw overlay lines
        lines.forEach(lineDataset => {
            if (lineDataset.data && lineDataset.data.length === data.labels.length) {
                this.drawLine(ctx, lineDataset.data, padding, width, height, 0, maxVal, 
                    lineDataset.color, lineDataset.lineWidth || 2.5);
            }
        });

        // Update legend
        if (legendId) {
            const datasets = [
                { ...data.bars, totale: data.bars.data.reduce((a, b) => a + b, 0) },
                ...lines.map(ds => ({ ...ds, totale: ds.data.reduce((a, b) => a + b, 0) }))
            ];
            this.updateLegend(legendId, datasets, options.unit || '');
        }

        // Add tooltip
        this.addTooltip(canvas, [data.bars, ...lines], data.labels, padding, width, height, 
            0, maxVal, options.unit || '');
    }

    /**
     * Draw a comparison chart with two lines
     * @param {string} canvasId - Canvas element ID
     * @param {string[]} labels - X-axis labels
     * @param {Object} dataset1 - First dataset
     * @param {Object} dataset2 - Second dataset
     * @param {string} legendId - Legend element ID (optional)
     * @param {Object} options - Drawing options
     */
    drawComparisonChart(canvasId, labels, dataset1, dataset2, legendId = null, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element with id "${canvasId}" not found`);
            return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * this.options.retinaScale;
        canvas.height = rect.height * this.options.retinaScale;
        ctx.scale(this.options.retinaScale, this.options.retinaScale);

        const padding = options.padding || { ...this.options.defaultPadding, right: 20 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calculate dynamic min/max with "middle ground" scaling
        const allValues = [...dataset1.data, ...dataset2.data];
        const dataMax = Math.max(...allValues);
        const dataMin = Math.min(...allValues);
        const range = dataMax - dataMin;

        // Minimum visual range = 50% of max value (avoid excessive zoom)
        const minVisualRange = dataMax * (options.minVisualRatio || 0.5);

        let minVal, maxVal;

        if (range < minVisualRange) {
            const center = (dataMax + dataMin) / 2;
            const halfRange = minVisualRange / 2;
            minVal = center - halfRange;
            maxVal = center + halfRange;
        } else {
            const paddingVal = range * 0.1;
            minVal = dataMin - paddingVal;
            maxVal = dataMax + paddingVal;
        }

        // Clamp to 0 if data is positive
        if (dataMin >= 0 && minVal < 0) minVal = 0;

        // Draw grid
        this.drawGrid(ctx, padding, width, height, minVal, maxVal, labels.length);

        // Draw weekend bands
        if (options.showWeekends !== false) {
            this.drawWeekendBands(ctx, labels, padding, width, height);
        }

        // Draw axes
        this.drawAxes(ctx, padding, width, height, labels, minVal, maxVal, options.unit || '');

        // Draw lines
        const datasets = [dataset1, dataset2];
        datasets.forEach(dataset => {
            this.drawLine(ctx, dataset.data, padding, width, height, minVal, maxVal, 
                dataset.color, dataset.lineWidth || 3);
        });

        // Draw points
        if (options.showPoints !== false) {
            datasets.forEach(dataset => {
                this.drawPoints(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color);
            });
        }

        // Update legend
        if (legendId) {
            const datasetsWithTotals = datasets.map(ds => ({
                ...ds,
                totale: ds.data.reduce((a, b) => a + b, 0)
            }));
            this.updateLegend(legendId, datasetsWithTotals, options.unit || '');
        }

        // Add tooltip
        this.addTooltip(canvas, datasets, labels, padding, width, height, minVal, maxVal, options.unit || '');
    }

    /**
     * Draw a grouped bar chart
     * @param {string} canvasId - Canvas element ID
     * @param {Object} data - Chart data
     * @param {string[]} data.labels - X-axis labels
     * @param {Array} data.groups - Array of bar groups
     * @param {string} legendId - Legend element ID (optional)
     * @param {Object} options - Drawing options
     */
    drawGroupedBarChart(canvasId, data, legendId = null, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element with id "${canvasId}" not found`);
            return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * this.options.retinaScale;
        canvas.height = rect.height * this.options.retinaScale;
        ctx.scale(this.options.retinaScale, this.options.retinaScale);

        const padding = options.padding || { ...this.options.defaultPadding, right: 20 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calculate max value
        const allValues = data.groups.flatMap(group => 
            group.bars.map(bar => bar.stacked 
                ? bar.data.reduce((a, b) => a + b, 0) 
                : Math.max(...bar.data)
            )
        );
        const maxVal = Math.max(...allValues) * 1.1;

        // Draw grid
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Draw weekend bands
        if (options.showWeekends !== false) {
            this.drawWeekendBands(ctx, data.labels, padding, width, height);
        }

        // Draw axes
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, options.unit || '');

        // Calculate bar dimensions
        const groupSpacing = width / data.labels.length;
        const numGroups = data.groups.length;
        const groupWidth = groupSpacing * (options.groupWidthRatio || 0.75);
        const barWidth = groupWidth / numGroups;
        const barGap = barWidth * (options.barGapRatio || 0.15);

        // Draw bars
        data.labels.forEach((label, i) => {
            const groupX = padding.left + i * groupSpacing;
            const centerOffset = (groupSpacing - (numGroups * barWidth + (numGroups - 1) * barGap)) / 2;

            data.groups.forEach((group, j) => {
                const barX = groupX + centerOffset + j * (barWidth + barGap);
                
                if (group.bars[0].stacked) {
                    // Stacked bars
                    let cumulativeHeight = 0;
                    group.bars.forEach(bar => {
                        const value = bar.data[i];
                        const segmentHeight = (value / maxVal) * height;
                        const y = padding.top + height - cumulativeHeight - segmentHeight;
                        ctx.fillStyle = bar.color;
                        ctx.fillRect(barX, y, barWidth, segmentHeight);
                        cumulativeHeight += segmentHeight;
                    });
                } else {
                    // Single bar
                    const value = group.bars[0].data[i];
                    const barHeight = (value / maxVal) * height;
                    const y = padding.top + height - barHeight;
                    ctx.fillStyle = group.bars[0].color;
                    ctx.fillRect(barX, y, barWidth, barHeight);
                }
            });
        });

        // Update legend
        if (legendId) {
            const datasets = data.groups.flatMap(group => 
                group.bars.map(bar => ({
                    ...bar,
                    totale: bar.data.reduce((a, b) => a + b, 0)
                }))
            );
            this.updateLegend(legendId, datasets, options.unit || '');
        }

        // Add custom tooltip for grouped bars
        this.addGroupedBarTooltip(canvas, data, padding, width, height, 0, maxVal, 
            options.unit || '', groupSpacing, barWidth, barGap);
    }

    // ==================== DRAWING PRIMITIVES ====================

    /**
     * Draw grid lines
     * @private
     */
    drawGrid(ctx, padding, width, height, minVal, maxVal, numPoints) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;

        const numHLines = 5;
        for (let i = 0; i <= numHLines; i++) {
            const y = padding.top + (height / numHLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + width, y);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Draw weekend bands
     * @private
     */
    drawWeekendBands(ctx, labels, padding, width, height) {
        const weekendRanges = [];
        let currentWeekendStart = null;

        labels.forEach((label, i) => {
            const dayName = label.split(' ')[0];
            const isWeekend = this.options.weekendKeywords.some(kw => dayName.includes(kw));

            if (isWeekend && currentWeekendStart === null) {
                currentWeekendStart = i;
            } else if (!isWeekend && currentWeekendStart !== null) {
                weekendRanges.push({ start: currentWeekendStart, end: i - 1 });
                currentWeekendStart = null;
            }
        });

        if (currentWeekendStart !== null) {
            weekendRanges.push({ start: currentWeekendStart, end: labels.length - 1 });
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        weekendRanges.forEach(range => {
            const xStart = padding.left + (width / (labels.length - 1)) * range.start;
            const xEnd = padding.left + (width / (labels.length - 1)) * range.end;
            const bandWidth = xEnd - xStart + (width / (labels.length - 1));
            ctx.fillRect(xStart, padding.top, bandWidth, height);
        });
    }

    /**
     * Draw axes with labels
     * @private
     */
    drawAxes(ctx, padding, width, height, labels, minVal, maxVal, unit) {
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'right';

        // Y-axis labels
        const numYLabels = 5;
        for (let i = 0; i <= numYLabels; i++) {
            const value = maxVal - (maxVal - minVal) / numYLabels * i;
            const y = padding.top + (height / numYLabels) * i;
            ctx.fillText(this.formatNumber(value, 0), padding.left - 10, y + 4);
        }

        // Y-axis label
        ctx.save();
        ctx.translate(15, padding.top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 12px -apple-system, sans-serif';
        ctx.fillText(unit, 0, 0);
        ctx.restore();

        // X-axis labels
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';

        const maxLabels = width < 600 ? 6 : 12;
        const step = Math.ceil(labels.length / maxLabels);

        labels.forEach((label, i) => {
            if (i % step === 0 || i === labels.length - 1) {
                const x = padding.left + (width / (labels.length - 1)) * i;
                // Format date labels properly
                let displayLabel = label;
                try {
                    const date = new Date(label);
                    if (!isNaN(date.getTime())) {
                        displayLabel = date.toLocaleDateString('it-IT', { 
                            day: '2-digit', 
                            month: '2-digit'
                        });
                    }
                } catch (e) {
                    // If parsing fails, use original label
                }
                ctx.fillText(displayLabel, x, padding.top + height + 20);
            }
        });
    }

    /**
     * Draw left Y-axis
     * @private
     */
    drawLeftAxis(ctx, padding, width, height, labels, minVal, maxVal, unit) {
        this.drawAxes(ctx, padding, width, height, labels, minVal, maxVal, unit);
    }

    /**
     * Draw right Y-axis
     * @private
     */
    drawRightAxis(ctx, padding, width, height, minVal, maxVal, unit) {
        ctx.fillStyle = '#f97316';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'left';

        const numYLabels = 5;
        const rightX = padding.left + width;

        for (let i = 0; i <= numYLabels; i++) {
            const value = maxVal - (maxVal - minVal) / numYLabels * i;
            const y = padding.top + (height / numYLabels) * i;
            ctx.fillText(this.formatNumber(value, 2), rightX + 10, y + 4);
        }

        // Right Y-axis label
        ctx.save();
        ctx.translate(padding.left + width + 45, padding.top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.fillText(unit, 0, 0);
        ctx.restore();
    }

    /**
     * Draw a line
     * @private
     */
    drawLine(ctx, data, padding, width, height, minVal, maxVal, color, lineWidth = 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        data.forEach((value, i) => {
            const x = padding.left + (width / (data.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    /**
     * Draw points on a line
     * @private
     */
    drawPoints(ctx, data, padding, width, height, minVal, maxVal, color) {
        ctx.fillStyle = color;

        data.forEach((value, i) => {
            const x = padding.left + (width / (data.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Draw filled area between two lines
     * @private
     */
    drawArea(ctx, bottomData, topData, padding, width, height, minVal, maxVal, color, opacity = 0.7) {
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;

        ctx.beginPath();

        // Draw top line
        topData.forEach((value, i) => {
            const x = padding.left + (width / (topData.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Draw bottom line in reverse
        for (let i = bottomData.length - 1; i >= 0; i--) {
            const x = padding.left + (width / (bottomData.length - 1)) * i;
            const y = padding.top + height - ((bottomData[i] - minVal) / (maxVal - minVal)) * height;
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    /**
     * Draw area with diagonal hatch pattern
     * @private
     */
    drawAreaWithHatch(ctx, bottomData, topData, padding, width, height, minVal, maxVal, color) {
        // Fill base area
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;

        ctx.beginPath();

        topData.forEach((value, i) => {
            const x = padding.left + (width / (topData.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        for (let i = bottomData.length - 1; i >= 0; i--) {
            const x = padding.left + (width / (bottomData.length - 1)) * i;
            const y = padding.top + height - ((bottomData[i] - minVal) / (maxVal - minVal)) * height;
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Add hatch lines
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;

        ctx.save();
        ctx.beginPath();

        topData.forEach((value, i) => {
            const x = padding.left + (width / (topData.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        for (let i = bottomData.length - 1; i >= 0; i--) {
            const x = padding.left + (width / (bottomData.length - 1)) * i;
            const y = padding.top + height - ((bottomData[i] - minVal) / (maxVal - minVal)) * height;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.clip();

        const spacing = 6;
        for (let x = padding.left - height; x < padding.left + width + height; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x + height, padding.top + height);
            ctx.stroke();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    /**
     * Draw vertical band
     * @private
     */
    drawVerticalBand(ctx, xStart, xEnd, padding, height) {
        ctx.save();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.fillRect(xStart, padding.top, xEnd - xStart, height);
        ctx.restore();
    }

    /**
     * Draw crosshair for single axis charts
     * @private
     */
    drawCrosshair(ctx, x, padding, width, height, datasets, dataIndex, minVal, maxVal) {
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + height);
        ctx.stroke();
        ctx.setLineDash([]);

        datasets.forEach(dataset => {
            const value = dataset.data[dataIndex];
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            ctx.fillStyle = dataset.color + '40';
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = dataset.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.restore();
    }

    /**
     * Draw crosshair for dual axis charts
     * @private
     */
    drawDualAxisCrosshair(ctx, x, padding, width, height, datasets, dataIndex, minValLeft, maxValLeft, minValRight, maxValRight) {
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + height);
        ctx.stroke();
        ctx.setLineDash([]);

        datasets.forEach(dataset => {
            const value = dataset.data[dataIndex];
            const minVal = dataset.axis === 'left' ? minValLeft : minValRight;
            const maxVal = dataset.axis === 'left' ? maxValLeft : maxValRight;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            ctx.fillStyle = dataset.color + '40';
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = dataset.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.restore();
    }

    // ==================== LEGEND & TOOLTIPS ====================

    /**
     * Update chart legend
     * @private
     */
    updateLegend(legendId, datasets, unit) {
        const legendEl = document.getElementById(legendId);
        if (!legendEl) return;

        legendEl.innerHTML = '';

        [...datasets].reverse().forEach(dataset => {
            const item = document.createElement('div');
            item.className = 'legend-item';

            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = dataset.color;

            const label = document.createElement('span');
            label.className = 'legend-label';
            label.textContent = dataset.label;

            const value = document.createElement('span');
            value.className = 'legend-value';
            value.textContent = `(${this.formatNumber(dataset.totale)} ${unit})`;

            item.appendChild(colorBox);
            item.appendChild(label);
            item.appendChild(value);
            legendEl.appendChild(item);
        });
    }

    /**
     * Update legend with simple items (color + label)
     * @private
     */
    updateLegendBasic(legendId, items) {
        const legendEl = document.getElementById(legendId);
        if (!legendEl) return;

        legendEl.innerHTML = '';

        items.forEach(ds => {
            const item = document.createElement('div');
            item.className = 'legend-item';

            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = ds.color;

            const label = document.createElement('span');
            label.className = 'legend-label';
            label.textContent = ds.label;

            item.appendChild(colorBox);
            item.appendChild(label);
            legendEl.appendChild(item);
        });
    }

    /**
     * Add interactive tooltip
     * @private
     */
    addTooltip(canvas, datasets, labels, padding, width, height, minVal, maxVal, unit) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let canvasSnapshot = null;
        const saveSnapshot = () => {
            canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        };
        setTimeout(saveSnapshot, 100);

        let tooltip = canvas.parentElement.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (mouseX < padding.left || mouseX > rect.width - padding.right ||
                mouseY < padding.top || mouseY > rect.height - padding.bottom) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
                return;
            }

            const relativeX = mouseX - padding.left;
            const index = Math.round((relativeX / width) * (labels.length - 1));

            if (index < 0 || index >= labels.length) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
                return;
            }

            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
                const x = padding.left + (width / (labels.length - 1)) * index;
                this.drawCrosshair(ctx, x, padding, width, height, datasets, index, minVal, maxVal);
            }

            let html = `<div class="chart-tooltip-title">${labels[index]}</div>`;

            datasets.forEach(dataset => {
                const value = dataset.data[index];
                html += `
                    <div class="chart-tooltip-item">
                        <div class="chart-tooltip-color" style="background-color: ${dataset.color}"></div>
                        <span class="chart-tooltip-label">${dataset.label}:</span>
                        <span class="chart-tooltip-value">${this.formatNumber(value, 2)} ${unit}</span>
                    </div>
                `;
            });

            tooltip.innerHTML = html;
            tooltip.classList.add('visible');

            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX = mouseX + 15;
            let tooltipY = mouseY - tooltipRect.height / 2;

            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = mouseX - tooltipRect.width - 15;
            }
            if (tooltipY < 0) tooltipY = 10;
            if (tooltipY + tooltipRect.height > rect.height) {
                tooltipY = rect.height - tooltipRect.height - 10;
            }

            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
            if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
        });
    }

    /**
     * Add tooltip for dual axis charts
     * @private
     */
    addDualAxisTooltip(canvas, datasets, labels, padding, width, height, minValLeft, maxValLeft, minValRight, maxValRight, unit) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let canvasSnapshot = null;
        const saveSnapshot = () => {
            canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        };
        setTimeout(saveSnapshot, 100);

        let tooltip = canvas.parentElement.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (mouseX < padding.left || mouseX > rect.width - padding.right ||
                mouseY < padding.top || mouseY > rect.height - padding.bottom) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
                return;
            }

            const relativeX = mouseX - padding.left;
            const index = Math.round((relativeX / width) * (labels.length - 1));

            if (index < 0 || index >= labels.length) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
                return;
            }

            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
                const x = padding.left + (width / (labels.length - 1)) * index;
                this.drawDualAxisCrosshair(ctx, x, padding, width, height, datasets, index, 
                    minValLeft, maxValLeft, minValRight, maxValRight);
            }

            let html = `<div class="chart-tooltip-title">${labels[index]}</div>`;

            datasets.forEach(dataset => {
                const value = dataset.data[index];
                html += `
                    <div class="chart-tooltip-item">
                        <div class="chart-tooltip-color" style="background-color: ${dataset.color}"></div>
                        <span class="chart-tooltip-label">${dataset.label}:</span>
                        <span class="chart-tooltip-value">${this.formatNumber(value, 2)} ${unit}</span>
                    </div>
                `;
            });

            tooltip.innerHTML = html;
            tooltip.classList.add('visible');

            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX = mouseX + 15;
            let tooltipY = mouseY - tooltipRect.height / 2;

            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = mouseX - tooltipRect.width - 15;
            }
            if (tooltipY < 0) tooltipY = 10;
            if (tooltipY + tooltipRect.height > rect.height) {
                tooltipY = rect.height - tooltipRect.height - 10;
            }

            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
            if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
        });
    }

    /**
     * Add tooltip for grouped bar charts
     * @private
     */
    addGroupedBarTooltip(canvas, data, padding, width, height, minVal, maxVal, unit, groupSpacing, barWidth, barGap) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let canvasSnapshot = null;
        const saveSnapshot = () => {
            canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        };
        setTimeout(saveSnapshot, 100);

        let tooltip = canvas.parentElement.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (mouseX < padding.left || mouseX > rect.width - padding.right ||
                mouseY < padding.top || mouseY > rect.height - padding.bottom) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
                return;
            }

            const relativeX = mouseX - padding.left;
            const index = Math.floor(relativeX / groupSpacing);

            if (index < 0 || index >= data.labels.length) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
                return;
            }

            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
                const xStart = padding.left + index * groupSpacing;
                const xEnd = xStart + groupSpacing;
                this.drawVerticalBand(ctx, xStart, xEnd, padding, height);
            }

            let html = `<div class="chart-tooltip-title">${data.labels[index]}</div>`;

            data.groups.forEach((group, groupIdx) => {
                html += `<div class="chart-tooltip-section"><strong>${group.label || `Group ${groupIdx + 1}`}:</strong></div>`;
                group.bars.forEach(bar => {
                    const value = bar.data[index];
                    html += `
                        <div class="chart-tooltip-item">
                            <div class="chart-tooltip-color" style="background-color: ${bar.color}"></div>
                            <span class="chart-tooltip-label">${bar.label}:</span>
                            <span class="chart-tooltip-value">${this.formatNumber(value, 2)} ${unit}</span>
                        </div>
                    `;
                });
            });

            tooltip.innerHTML = html;
            tooltip.classList.add('visible');

            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX = mouseX + 15;
            let tooltipY = mouseY - tooltipRect.height / 2;

            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = mouseX - tooltipRect.width - 15;
            }
            if (tooltipY < 0) tooltipY = 10;
            if (tooltipY + tooltipRect.height > rect.height) {
                tooltipY = rect.height - tooltipRect.height - 10;
            }

            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
            if (canvasSnapshot) ctx.putImageData(canvasSnapshot, 0, 0);
        });
    }

    // ==================== UTILITIES ====================

    /**
     * Get color by index from default palette
     * @private
     */
    _getColorByIndex(index) {
        const colors = Object.values(this.options.colors);
        return colors[index % colors.length];
    }

    /**
     * Draw Gantt chart for production shifts
     * @param {string} canvasId - Canvas element ID
     * @param {Object} data - Gantt chart data
     * @param {Object} data.phases - Object with phase names as keys
     * @param {Object} options - Drawing options
     */
    drawGanttChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element with id "${canvasId}" not found`);
            return;
        }

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        
        // Calculate proper dimensions
        const phases = Object.keys(data.phases);
        const numPhases = phases.length;
        const rowHeight = options.rowHeight || 60;
        const headerHeight = options.headerHeight || 40;
        const labelWidth = options.labelWidth || 120;
        
        // Set canvas size to match container width
        const containerWidth = container.offsetWidth;
        canvas.width = containerWidth * this.options.retinaScale;
        canvas.height = (headerHeight + numPhases * rowHeight + 20) * this.options.retinaScale;
        ctx.scale(this.options.retinaScale, this.options.retinaScale);
        
        const width = containerWidth;
        const height = headerHeight + numPhases * rowHeight + 20;
        
        ctx.clearRect(0, 0, width, height);
        
        // Find min and max days from all shifts (using day/hour/minute format)
        let minDay = Infinity;
        let maxDay = -Infinity;
        phases.forEach(phaseName => {
            const phase = data.phases[phaseName];
            phase.shifts.forEach(shift => {
                const days = [
                    shift.original_start.day,
                    shift.original_end.day,
                    shift.shifted_start.day,
                    shift.shifted_end.day
                ];
                days.forEach(d => {
                    if (d < minDay) minDay = d;
                    if (d > maxDay) maxDay = d;
                });
            });
        });
        
        const totalDays = maxDay - minDay + 1;
        const dayWidth = (width - labelWidth) / totalDays;
        
        // Draw header background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, headerHeight);
        
        // Draw day labels
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i < totalDays; i++) {
            // Use day numbers instead of actual dates
            const dayNum = minDay + i;
            const dayLabel = `Giorno ${dayNum}`;
            const x = labelWidth + i * dayWidth + dayWidth / 2;
            ctx.fillText(dayLabel, x, headerHeight / 2);
            
            // Draw vertical grid lines
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(labelWidth + i * dayWidth, headerHeight);
            ctx.lineTo(labelWidth + i * dayWidth, height);
            ctx.stroke();
            
            // Draw midday line (dashed)
            ctx.strokeStyle = '#cbd5e1';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(labelWidth + i * dayWidth + dayWidth / 2, headerHeight);
            ctx.lineTo(labelWidth + i * dayWidth + dayWidth / 2, height);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Draw phases
        const baseColors = [
            '#ef4444', '#22c55e', '#3b82f6', '#f97316', 
            '#8b5cf6', '#06b6d4', '#eab308', '#ec4899'
        ];
        
        phases.forEach((phaseName, phaseIndex) => {
            const phase = data.phases[phaseName];
            const y = headerHeight + phaseIndex * rowHeight;
            const baseColor = baseColors[phaseIndex % baseColors.length];
            
            // Draw horizontal grid line
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            
            // Draw phase label background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, y, labelWidth, rowHeight);
            
            // Draw phase label
            ctx.fillStyle = '#1e293b';
            ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            // Wrap text if too long
            const maxWidth = labelWidth - 16;
            const words = phaseName.split('_');
            let line = '';
            let lineY = y + 12;
            
            for (let word of words) {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && line !== '') {
                    ctx.fillText(line, 8, lineY);
                    line = word + ' ';
                    lineY += 14;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, 8, lineY);
            
            // Draw shifts (split those that wrap across week boundary)
            phase.shifts.forEach((shift, shiftIndex) => {
                const splitShifts = this._splitShiftAcrossWeek(shift, minDay, maxDay);
                splitShifts.forEach(seg => {
                    this._drawShiftOnGantt(
                        ctx,
                        seg,
                        y,
                        rowHeight,
                        labelWidth,
                        dayWidth,
                        baseColor,
                        shiftIndex,
                        phase.shifts.length,
                        options.shadeShifts,
                        options.viewMode || 'both',
                        minDay,
                        shift // collect bounds back on the original shift for interactivity
                    );
                });
            });
        });
        
        // Draw final bottom line
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height - 20);
        ctx.lineTo(width, height - 20);
        ctx.stroke();
        
        // Add click interactivity
        this._addGanttInteractivity(canvas, data, labelWidth, dayWidth, headerHeight, rowHeight);
    }

    /**
     * Draw a single shift on the Gantt chart
     * @private
     */
    _drawShiftOnGantt(ctx, shift, yBase, rowHeight, labelWidth, dayWidth, baseColor, shiftIndex, totalShifts, shadeShifts = false, viewMode = 'both', minDay, boundsTargetShift = null) {
        // Extract day and minutes from the new format {day, hour, minute}
        const getMinutesInDay = (timeObj) => timeObj.hour * 60 + timeObj.minute;
        
        const origStartDay = shift.original_start.day - minDay;
        const origStartMin = getMinutesInDay(shift.original_start);
        const origEndDay = shift.original_end.day - minDay;
        const origEndMin = getMinutesInDay(shift.original_end);
        
        const shiftStartDay = shift.shifted_start.day - minDay;
        const shiftStartMin = getMinutesInDay(shift.shifted_start);
        const shiftEndDay = shift.shifted_end.day - minDay;
        const shiftEndMin = getMinutesInDay(shift.shifted_end);
        
        // Calculate x positions
        const calcX = (day, minutes) => labelWidth + (day + minutes / (24 * 60)) * dayWidth;
        
        const origX = calcX(origStartDay, origStartMin);
        let origW = calcX(origEndDay, origEndMin) - origX;
        
        const shiftX = calcX(shiftStartDay, shiftStartMin);
        let shiftW = calcX(shiftEndDay, shiftEndMin) - shiftX;

        // Ensure a minimum visible width so very short or zero-width shifts are still rendered
        const minVisibleW = 2; // px
        let drawOriginal = true;
        let drawShifted = true;
        if (origW <= 0) {
            drawOriginal = false;
        } else if (origW < minVisibleW) {
            origW = minVisibleW;
        }
        if (shiftW <= 0) {
            drawShifted = false;
        } else if (shiftW < minVisibleW) {
            shiftW = minVisibleW;
        }
        
        // Calculate y position with some padding
        const padding = 8;
        const rectY = yBase + padding;
        const rectH = rowHeight - 2 * padding;
        
        // Apply different shading for each shift if enabled
        let fillColor = baseColor;
        let strokeColor = baseColor;
        
        if (shadeShifts && totalShifts > 1) {
            // Create gradient of shades from light to dark
            const lightness = 0.8;
            fillColor = this._adjustColorLightness(baseColor, lightness);
            strokeColor = this._adjustColorLightness(baseColor, Math.max(0.2, lightness - 0.3));
        }
        
        // Draw based on view mode
        if (viewMode === 'both') {
            // Draw shifted shift first (filled, behind) with transparency
            if (drawShifted) {
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = fillColor;
                ctx.fillRect(shiftX, rectY, shiftW, rectH);
                ctx.globalAlpha = 1.0;
            }
            
            // Draw original shift on top (filled rectangle with border color)
            if (drawOriginal) {
                ctx.fillStyle = strokeColor;
                ctx.fillRect(origX, rectY, origW, rectH);
            }

            // Outline to ensure visibility even when overlapped or unchanged
            ctx.lineWidth = 1.25;
            ctx.strokeStyle = '#0f172a33';
            if (drawOriginal) ctx.strokeRect(origX, rectY, origW, rectH);
            if (drawShifted) ctx.strokeRect(shiftX, rectY, shiftW, rectH);
        } else if (viewMode === 'optimized') {
            // Draw only shifted shift in full color (not transparent)
            if (drawShifted) {
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = strokeColor;  // Use solid color instead of fillColor
                ctx.fillRect(shiftX, rectY, shiftW, rectH);
                // Outline
                ctx.lineWidth = 1.25;
                ctx.strokeStyle = '#0f172a33';
                ctx.strokeRect(shiftX, rectY, shiftW, rectH);
            }
        } else if (viewMode === 'original') {
            // Draw only original shift
            if (drawOriginal) {
                ctx.fillStyle = strokeColor;
                ctx.fillRect(origX, rectY, origW, rectH);
                // Outline
                ctx.lineWidth = 1.25;
                ctx.strokeStyle = '#0f172a33';
                ctx.strokeRect(origX, rectY, origW, rectH);
            }
        }

        // If shift wasn't moved, add a subtle indicator so it is recognizable
        if (shift.shift_minutes === 0 && drawOriginal) {
            ctx.save();
            ctx.strokeStyle = '#64748b66';
            ctx.setLineDash([3, 2]);
            ctx.lineWidth = 1;
            // Draw small dashed underline beneath the bar
            const underlineY = rectY + rectH + 3;
            const underlineX = origX;
            const underlineW = origW;
            ctx.beginPath();
            ctx.moveTo(underlineX, underlineY);
            ctx.lineTo(underlineX + underlineW, underlineY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
        
        // Store bounds for click detection
        const target = boundsTargetShift || shift;
        if (!target._bounds) target._bounds = { original: [], shifted: [] };
        if (drawOriginal) target._bounds.original.push({ x: origX, y: rectY, w: origW, h: rectH });
        if (drawShifted) target._bounds.shifted.push({ x: shiftX, y: rectY, w: shiftW, h: rectH });
    }

    /**
     * Add click interactivity to Gantt chart
     * @private
     */
    _addGanttInteractivity(canvas, data, labelWidth, dayWidth, headerHeight, rowHeight) {
        // Hover only changes cursor, no tooltip on hover
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            let found = false;
            const phases = Object.keys(data.phases);
            
            for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
                const phase = data.phases[phases[phaseIndex]];
                
                for (let shift of phase.shifts) {
                    if (!shift._bounds) continue;
                    
                    const { original, shifted } = shift._bounds;
                    const originalRects = Array.isArray(original) ? original : (original ? [original] : []);
                    const shiftedRects = Array.isArray(shifted) ? shifted : (shifted ? [shifted] : []);
                    
                    // Check if mouse is over any shift box
                    const overOriginal = originalRects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
                    const overShifted = shiftedRects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
                    
                    if (overOriginal || overShifted) {
                        found = true;
                        canvas.style.cursor = 'pointer';
                        break;
                    }
                }
                
                if (found) break;
            }
            
            if (!found) canvas.style.cursor = 'default';
        });
        // No tooltip on mouseleave either

        // Click to show a persistent popup with shift details
        const ensurePopup = () => {
            let el = canvas.parentElement.querySelector('.gantt-click-popup');
            if (!el) {
                el = document.createElement('div');
                el.className = 'gantt-click-popup';
                el.style.cssText = `
                    position: absolute;
                    background: rgba(30, 41, 59, 0.98);
                    color: #fff;
                    padding: 14px 16px 12px 16px;
                    border-radius: 10px;
                    font-size: 13px;
                    line-height: 1.35;
                    pointer-events: auto;
                    opacity: 0;
                    transition: opacity 0.15s ease;
                    z-index: 1001;
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
                    max-width: 360px;
                    min-width: 260px;
                `;
                canvas.parentElement.style.position = canvas.parentElement.style.position || 'relative';
                canvas.parentElement.appendChild(el);
            }
            return el;
        };

        const formatDateTime = (timeObj) => {
            const hourStr = String(timeObj.hour).padStart(2, '0');
            const minStr = String(timeObj.minute).padStart(2, '0');
            return `Giorno ${timeObj.day}, ${hourStr}:${minStr}`;
        };

        const showPopupForShift = (e, shift) => {
            const popup = ensurePopup();
            const dir = shift.shift_minutes > 0 ? 'posticipato' : (shift.shift_minutes < 0 ? 'anticipato' : 'invariato');
            const absMin = Math.abs(shift.shift_minutes);
            popup.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:8px;">
                    <div style="font-weight:600; font-size:14px;">${shift.name}</div>
                    <button class=\"gpopup-close\" aria-label=\"Chiudi\" title=\"Chiudi\" style=\"\n                        background: #ef4444; border: none; color: #ffffffff; cursor: pointer;\n                        font-size: 16px; line-height: 1; padding: 2px; border-radius: 6px;\">\n                        ×\n                    </button>
                </div>
                <div style="display:grid; gap:6px;">
                    <div><strong>Originale:</strong> ${formatDateTime(shift.original_start)} → ${formatDateTime(shift.original_end)}</div>
                    <div><strong>Ottimizzato:</strong> ${formatDateTime(shift.shifted_start)} → ${formatDateTime(shift.shifted_end)}</div>
                    <div style="margin-top: 2px; color: #fbbf24;"><strong>Shift:</strong> ${dir}${absMin ? ` di ${absMin} minuti` : ''}</div>
                </div>
            `;

            // Position popup near click within canvas bounds
            const rect = canvas.getBoundingClientRect();
            const parentRect = canvas.parentElement.getBoundingClientRect();
            let px = e.clientX - parentRect.left + 16;
            let py = e.clientY - parentRect.top + 16;

            // Temporarily make visible to measure
            popup.style.opacity = '0';
            popup.style.display = 'block';
            requestAnimationFrame(() => {
                const pRect = popup.getBoundingClientRect();
                const maxX = rect.right - parentRect.left - pRect.width - 10;
                const maxY = rect.bottom - parentRect.top - pRect.height - 10;
                if (px > maxX) px = Math.max(10, maxX);
                if (py > maxY) py = Math.max(10, maxY);
                if (px < 10) px = 10;
                if (py < 10) py = 10;
                popup.style.left = `${px}px`;
                popup.style.top = `${py}px`;
                popup.style.opacity = '1';
            });

            // Close actions
            const closeBtn = popup.querySelector('.gpopup-close');
            if (closeBtn) {
                closeBtn.onclick = (ev) => { ev.stopPropagation(); popup.style.opacity = '0'; popup.style.display = 'none'; };
            }
        };

        const hitTestShiftAt = (x, y) => {
            const phases = Object.keys(data.phases);
            for (let p = 0; p < phases.length; p++) {
                const phase = data.phases[phases[p]];
                for (let shift of phase.shifts) {
                    if (!shift._bounds) continue;
                    const { original, shifted } = shift._bounds;
                    const originalRects = Array.isArray(original) ? original : (original ? [original] : []);
                    const shiftedRects = Array.isArray(shifted) ? shifted : (shifted ? [shifted] : []);
                    const overOriginal = originalRects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
                    const overShifted = shiftedRects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
                    if (overOriginal || overShifted) return shift;
                }
            }
            return null;
        };

        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hit = hitTestShiftAt(x, y);
            if (hit) {
                e.stopPropagation();
                showPopupForShift(e, hit);
            }
        });

        // Dismiss popup when clicking outside
        const outsideClickHandler = (e) => {
            const popup = canvas.parentElement.querySelector('.gantt-click-popup');
            if (!popup) return;
            if (!canvas.parentElement.contains(e.target)) {
                popup.style.opacity = '0';
                popup.style.display = 'none';
            }
        };
        // Ensure only one global listener per canvas parent
        if (!canvas.parentElement._ganttOutsideListenerAttached) {
            document.addEventListener('click', outsideClickHandler);
            canvas.parentElement._ganttOutsideListenerAttached = true;
        }
    }

    /**
     * Split a shift that wraps across the end of the visible week.
     * If either the original or shifted interval has start.day > end.day,
     * return two segment shifts covering [start..weekEnd] and [weekStart..end].
     * Bounds are collected back onto the original shift in draw.
     * @private
     */
    _splitShiftAcrossWeek(shift, minDay, maxDay) {
        const weekStart = { day: minDay, hour: 0, minute: 0 };
        const weekEnd = { day: maxDay, hour: 23, minute: 59 };

        const splitPair = (start, end) => {
            if (start.day <= end.day) return [{ start, end }];
            return [
                { start, end: weekEnd },
                { start: weekStart, end }
            ];
        };

        const origSegs = splitPair(shift.original_start, shift.original_end);
        const shftSegs = splitPair(shift.shifted_start, shift.shifted_end);

        const segments = [];
        const count = Math.max(origSegs.length, shftSegs.length);
        for (let i = 0; i < count; i++) {
            const o = origSegs[i];
            const s = shftSegs[i];
            // For non-splitting side, create an empty segment on the second piece
            // to avoid drawing unintended bars.
            const original_start = o ? o.start : (i === 0 ? shift.original_start : weekStart);
            const original_end = o ? o.end : (i === 0 ? shift.original_end : weekStart);
            const shifted_start = s ? s.start : (i === 0 ? shift.shifted_start : weekStart);
            const shifted_end = s ? s.end : (i === 0 ? shift.shifted_end : weekStart);

            segments.push({
                ...shift,
                original_start,
                original_end,
                shifted_start,
                shifted_end
            });
        }
        return segments;
    }

    /**
     * Draw horizontal bar chart showing shift time translations
     * @param {string} canvasId - Canvas element ID
     * @param {Object} data - Shift data
     * @param {Object} options - Drawing options
     */
    drawShiftTranslationChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element with id "${canvasId}" not found`);
            return;
        }

        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * this.options.retinaScale;
        canvas.height = rect.height * this.options.retinaScale;
        ctx.scale(this.options.retinaScale, this.options.retinaScale);

        const padding = options.padding || { top: 24, right: 80, bottom: 64, left: 220 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Collect shifts with non-zero translation
        const shiftsToPlot = [];
        const phases = Object.keys(data.phases);
        const baseColors = [
            '#ef4444', '#22c55e', '#3b82f6', '#f97316', 
            '#8b5cf6', '#06b6d4', '#eab308', '#ec4899'
        ];

        const phaseColorMap = {};

        phases.forEach((phaseName, phaseIndex) => {
            const phase = data.phases[phaseName];
            const baseColor = baseColors[phaseIndex % baseColors.length];
            phaseColorMap[phaseName] = baseColor;

            phase.shifts.forEach((shift, shiftIndex) => {
                if (shift.shift_minutes !== 0) {
                    const alpha = 0.5 + (shiftIndex / Math.max(phase.shifts.length, 1)) * 0.5;
                    shiftsToPlot.push({
                        name: shift.name.replace(/_/g, ' '),
                        minutes: shift.shift_minutes,
                        color: this._adjustColorAlpha(baseColor, alpha),
                        phaseName: phaseName,
                        _baseColor: baseColor
                    });
                }
            });
        });

        if (shiftsToPlot.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Nessun turno traslato', rect.width / 2, rect.height / 2);
            return;
        }

        // Find max absolute value for scaling
        const maxAbs = Math.max(...shiftsToPlot.map(s => Math.abs(s.minutes)));
        
        // Optional sorting by absolute magnitude (default on)
        const sortByAbs = options.sortByAbs !== false;
        if (sortByAbs) {
            shiftsToPlot.sort((a, b) => Math.abs(b.minutes) - Math.abs(a.minutes));
        }

        // Calculate bar dimensions
        const barHeight = Math.min(30, (height / shiftsToPlot.length) * 0.65);
        const barSpacing = height / shiftsToPlot.length;

        // Zebra row background for readability
        for (let i = 0; i < shiftsToPlot.length; i++) {
            if (i % 2 === 1) {
                ctx.fillStyle = 'rgba(148,163,184,0.08)';
                const y = padding.top + i * barSpacing;
                ctx.fillRect(padding.left, y, width, barSpacing);
            }
        }

        // Draw X-axis (center zero line)
        const centerY = padding.top + height / 2;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, centerY);
        ctx.lineTo(padding.left + width, centerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw grid lines and labels for X-axis
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';

        const numGridLines = 5;
        for (let i = -numGridLines; i <= numGridLines; i++) {
            const value = (maxAbs / numGridLines) * i;
            const x = padding.left + width / 2 + (value / maxAbs) * (width / 2);
            
            // Draw grid line
            if (i !== 0) {
                ctx.beginPath();
                ctx.moveTo(x, padding.top);
                ctx.lineTo(x, padding.top + height);
                ctx.stroke();
            }
            
            // Draw label
            ctx.fillText(Math.round(value), x, padding.top + height + 20);
        }

        // Draw X-axis label
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Traslazione Temporale (minuti)', padding.left + width / 2, padding.top + height + 45);

        // Draw "Anticipo" and "Ritardo" labels
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = '#3b82f6';
        ctx.textAlign = 'center';
        ctx.fillText('← Anticipo', padding.left + width / 4, padding.top - 5);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Ritardo →', padding.left + (width * 3) / 4, padding.top - 5);

        // Helper to draw rounded rectangles
        const drawRoundedRect = (x, y, w, h, r) => {
            const radius = Math.min(r, h / 2, w / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        };

        // Draw horizontal bars with labels and capture for tooltip
        const barRects = [];
        shiftsToPlot.forEach((shift, index) => {
            const y = padding.top + index * barSpacing + (barSpacing - barHeight) / 2;
            const centerX = padding.left + width / 2;

            const barWidth = (Math.abs(shift.minutes) / maxAbs) * (width / 2) * 0.95;
            const barX = shift.minutes > 0 ? centerX : centerX - barWidth;

            // Bar fill
            ctx.fillStyle = shift.color;
            drawRoundedRect(barX, y, barWidth, barHeight, 6);
            ctx.fill();
            // Border
            ctx.strokeStyle = this._adjustColorAlpha(shift._baseColor, 0.9);
            ctx.lineWidth = 1;
            ctx.stroke();

            // Left-side label: shift name + small phase tag
            ctx.fillStyle = '#1e293b';
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            let displayName = shift.name;
            const maxNameWidth = padding.left - 20;
            if (ctx.measureText(displayName).width > maxNameWidth) {
                while (ctx.measureText(displayName + '…').width > maxNameWidth && displayName.length > 0) {
                    displayName = displayName.slice(0, -1);
                }
                displayName += '…';
            }
            ctx.fillText(displayName, padding.left - 12, y + barHeight / 2);

            // Value pill near bar end
            const valueText = `${shift.minutes > 0 ? '+' : ''}${shift.minutes}`;
            ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textBaseline = 'middle';
            const textPaddingX = 6;
            const textPaddingY = 3;
            const textWidth = ctx.measureText(valueText).width;
            const pillH = 16;
            let pillX;
            let textAlign;
            if (shift.minutes > 0) {
                pillX = barX + barWidth + 6;
                textAlign = 'left';
            } else {
                pillX = barX - (textWidth + textPaddingX * 2) - 6;
                textAlign = 'left';
            }
            const pillY = y + barHeight / 2 - pillH / 2;
            ctx.fillStyle = '#0f172a';
            drawRoundedRect(pillX, pillY, textWidth + textPaddingX * 2, pillH, 8);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = textAlign;
            ctx.fillText(valueText, pillX + textPaddingX, y + barHeight / 2 + 1);

            // Save rect for tooltip hit-test
            barRects.push({
                x: barX,
                y,
                w: barWidth,
                h: barHeight,
                data: shift
            });
        });

        // Legend by phase (optional)
        if (options.legendId) {
            const uniquePhases = [];
            const seen = new Set();
            shiftsToPlot.forEach(s => {
                if (!seen.has(s.phaseName)) {
                    seen.add(s.phaseName);
                    uniquePhases.push({ label: s.phaseName.replace(/_/g, ' '), color: s._baseColor });
                }
            });
            this.updateLegendBasic(options.legendId, uniquePhases);
        }

        // Tooltip for bars
        const ensureTooltip = () => {
            let t = canvas.parentElement.querySelector('.chart-tooltip');
            if (!t) {
                t = document.createElement('div');
                t.className = 'chart-tooltip';
                canvas.parentElement.style.position = 'relative';
                canvas.parentElement.appendChild(t);
            }
            return t;
        };
        const tooltip = ensureTooltip();
        canvas.onmousemove = (e) => {
            const rectC = canvas.getBoundingClientRect();
            const mx = e.clientX - rectC.left;
            const my = e.clientY - rectC.top;
            const hit = barRects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
            if (!hit) {
                tooltip.classList.remove('visible');
                return;
            }
            const s = hit.data;
            const dir = s.minutes > 0 ? 'posticipato' : 'anticipato';
            const sign = s.minutes > 0 ? '+' : '';
            tooltip.innerHTML = `
                <div class="chart-tooltip-title">${s.name}</div>
                <div class="chart-tooltip-item">
                    <div class="chart-tooltip-color" style="background-color: ${s._baseColor}"></div>
                    <span class="chart-tooltip-label">Fase:</span>
                    <span class="chart-tooltip-value">${s.phaseName.replace(/_/g, ' ')}</span>
                </div>
                <div class="chart-tooltip-item">
                    <div class="chart-tooltip-color" style="background-color: #0ea5e9"></div>
                    <span class="chart-tooltip-label">Shift:</span>
                    <span class="chart-tooltip-value">${dir} di ${sign}${Math.abs(s.minutes)} min</span>
                </div>`;
            tooltip.classList.add('visible');
            const tRect = tooltip.getBoundingClientRect();
            let tx = mx + 15;
            let ty = my - tRect.height / 2;
            if (tx + tRect.width > rectC.width) tx = mx - tRect.width - 15;
            if (ty < 0) ty = 10;
            if (ty + tRect.height > rectC.height) ty = rectC.height - tRect.height - 10;
            tooltip.style.left = tx + 'px';
            tooltip.style.top = ty + 'px';
        };
        canvas.onmouseleave = () => tooltip.classList.remove('visible');
    }

    /**
     * Adjust color alpha
     * @private
     */
    _adjustColorAlpha(hexColor, alpha) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Adjust color lightness
     * @private
     */
    _adjustColorLightness(hexColor, lightness) {
        // Convert hex to RGB
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        
        // Convert to HSL
        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;
        
        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
                case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
                case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
            }
        }
        
        // Apply new lightness
        l = lightness;
        
        // Convert back to RGB
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        let rOut, gOut, bOut;
        if (s === 0) {
            rOut = gOut = bOut = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            rOut = hue2rgb(p, q, h + 1/3);
            gOut = hue2rgb(p, q, h);
            bOut = hue2rgb(p, q, h - 1/3);
        }
        
        const rHex = Math.round(rOut * 255).toString(16).padStart(2, '0');
        const gHex = Math.round(gOut * 255).toString(16).padStart(2, '0');
        const bHex = Math.round(bOut * 255).toString(16).padStart(2, '0');
        
        return `#${rHex}${gHex}${bHex}`;
    }

    /**
     * Destroy chart and cleanup resources
     * @param {string} canvasId - Canvas element ID
     */
    destroy(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Remove tooltip
        const tooltip = canvas.parentElement?.querySelector('.chart-tooltip');
        if (tooltip) tooltip.remove();

        // Clear canvas
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Cleanup stored data
        delete this._zoom[canvasId];
        delete this._payloads[canvasId];
        delete this._snapshots[canvasId];
    }

    /**
     * Resize chart to fit container
     * @param {string} canvasId - Canvas element ID
     */
    resize(canvasId) {
        const payload = this._payloads[canvasId];
        if (!payload) return;

        // Redraw with stored payload
        const { data, legendId, options } = payload;
        
        // Determine chart type and redraw
        if (data.bars) {
            this.drawBarChartWithLines(canvasId, data, legendId, options);
        } else if (data.datasets) {
            this.drawStackedAreaChart(canvasId, data, legendId, options);
        } else if (data.leftAxis) {
            this.drawDualAxisLineChart(canvasId, data, options);
        }
    }
}

// Export for use as module or global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptProdChartRenderer;
} else {
    window.OptProdChartRenderer = OptProdChartRenderer;
}
