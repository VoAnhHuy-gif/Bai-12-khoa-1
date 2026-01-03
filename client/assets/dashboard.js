/**
 * Dashboard WebSocket Client
 * Kết nối tới ws://localhost:8765/ws/dashboard
 */

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const toggleTemperature = document.getElementById('toggleTemperature');
const toggleStock = document.getElementById('toggleStock');
const toggleCpu = document.getElementById('toggleCpu');
const historyTableBody = document.getElementById('historyTableBody');

// Metric cards
const cardTemperature = document.getElementById('cardTemperature');
const cardStock = document.getElementById('cardStock');
const cardCpu = document.getElementById('cardCpu');

const valueTemperature = document.getElementById('valueTemperature');
const valueStock = document.getElementById('valueStock');
const valueCpu = document.getElementById('valueCpu');

// Charts
const chartTemperature = document.getElementById('chartTemperature');
const chartStock = document.getElementById('chartStock');
const chartCpu = document.getElementById('chartCpu');

const canvasTemperature = document.getElementById('canvasTemperature');
const canvasStock = document.getElementById('canvasStock');
const canvasCpu = document.getElementById('canvasCpu');

// WebSocket
let ws = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
const MAX_RECONNECT_DELAY = 30000;

// Data storage
const MAX_HISTORY_ROWS = 20;
const MAX_CHART_POINTS = 30;

const historyData = [];
const chartData = {
    temperature: [],
    stock: [],
    cpu: []
};

// ============================================================================
// WebSocket Connection
// ============================================================================

function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }

    updateConnectionStatus('connecting');

    try {
        ws = new WebSocket('ws://localhost:8765/ws/dashboard');

        ws.onopen = () => {
            console.log('WebSocket connected');
            reconnectAttempts = 0;
            updateConnectionStatus('connected');
            sendSubscription();
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            updateConnectionStatus('disconnected');
            scheduleReconnect();
        };

    } catch (error) {
        console.error('Error creating WebSocket:', error);
        updateConnectionStatus('disconnected');
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;

    reconnectTimeout = setTimeout(() => {
        connect();
    }, delay);
}

function updateConnectionStatus(status) {
    const statusDot = connectionStatus.querySelector('.status-dot');
    const statusText = connectionStatus.querySelector('.status-text');

    statusDot.className = 'status-dot';
    
    if (status === 'connected') {
        statusDot.classList.add('connected');
        statusText.textContent = 'Đang kết nối';
    } else if (status === 'disconnected') {
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Mất kết nối';
    } else {
        statusText.textContent = 'Đang kết nối...';
    }
}

// ============================================================================
// Subscription Management
// ============================================================================

function sendSubscription() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
    }

    const metrics = [];
    
    if (toggleTemperature.checked) metrics.push('temperature');
    if (toggleStock.checked) metrics.push('stock');
    if (toggleCpu.checked) metrics.push('cpu');

    const message = {
        type: 'subscribe',
        metrics: metrics
    };

    ws.send(JSON.stringify(message));
}

function updateMetricVisibility() {
    // Cards
    cardTemperature.classList.toggle('hidden', !toggleTemperature.checked);
    cardStock.classList.toggle('hidden', !toggleStock.checked);
    cardCpu.classList.toggle('hidden', !toggleCpu.checked);

    // Charts
    chartTemperature.classList.toggle('hidden', !toggleTemperature.checked);
    chartStock.classList.toggle('hidden', !toggleStock.checked);
    chartCpu.classList.toggle('hidden', !toggleCpu.checked);

    sendSubscription();
}

toggleTemperature.addEventListener('change', updateMetricVisibility);
toggleStock.addEventListener('change', updateMetricVisibility);
toggleCpu.addEventListener('change', updateMetricVisibility);

// ============================================================================
// Message Handling
// ============================================================================

function handleMessage(data) {
    if (data.type === 'metrics' && data.data) {
        updateMetrics(data.data);
    }
}

function updateMetrics(metricsData) {
    // Create history entry
    const historyEntry = {
        timestamp: Date.now(),
        temperature: null,
        stock: null,
        cpu: null
    };

    // Update each metric
    for (const [metric, data] of Object.entries(metricsData)) {
        if (metric === 'temperature') {
            valueTemperature.textContent = data.value.toFixed(1);
            historyEntry.temperature = data.value;
            updateChartData('temperature', data.value, data.ts);
        } else if (metric === 'stock') {
            valueStock.textContent = data.value.toFixed(2);
            historyEntry.stock = data.value;
            updateChartData('stock', data.value, data.ts);
        } else if (metric === 'cpu') {
            valueCpu.textContent = data.value.toFixed(1);
            historyEntry.cpu = data.value;
            updateChartData('cpu', data.value, data.ts);
        }
    }

    // Add to history
    historyData.unshift(historyEntry);
    if (historyData.length > MAX_HISTORY_ROWS) {
        historyData.pop();
    }

    updateHistoryTable();
    updateCharts();
}

// ============================================================================
// Chart Management
// ============================================================================

function updateChartData(metric, value, timestamp) {
    const data = chartData[metric];
    
    data.push({
        value: value,
        timestamp: timestamp
    });

    // Keep only last N points
    if (data.length > MAX_CHART_POINTS) {
        data.shift();
    }
}

function updateCharts() {
    drawChart(canvasTemperature, chartData.temperature, '#667eea', 15, 40);
    drawChart(canvasStock, chartData.stock, '#f5576c', 50, 550);
    drawChart(canvasCpu, chartData.cpu, '#4facfe', 0, 100);
}

function drawChart(canvas, data, color, minValue, maxValue) {
    if (!data || data.length === 0) {
        return;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate points
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const xStep = chartWidth / (MAX_CHART_POINTS - 1);
    const yRange = maxValue - minValue;

    // Draw grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    // Draw line
    if (data.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();

        for (let i = 0; i < data.length; i++) {
            const x = padding + (i * xStep);
            const normalizedValue = (data[i].value - minValue) / yRange;
            const y = padding + chartHeight - (normalizedValue * chartHeight);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Draw gradient fill
        const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '00');

        ctx.lineTo(padding + (data.length - 1) * xStep, height - padding);
        ctx.lineTo(padding, height - padding);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw points
        ctx.fillStyle = color;
        for (let i = 0; i < data.length; i++) {
            const x = padding + (i * xStep);
            const normalizedValue = (data[i].value - minValue) / yRange;
            const y = padding + chartHeight - (normalizedValue * chartHeight);

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ============================================================================
// History Table
// ============================================================================

function updateHistoryTable() {
    historyTableBody.innerHTML = '';

    if (historyData.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.className = 'no-data';
        cell.textContent = 'Đang chờ dữ liệu...';
        row.appendChild(cell);
        historyTableBody.appendChild(row);
        return;
    }

    historyData.forEach(entry => {
        const row = document.createElement('tr');

        // Time
        const timeCell = document.createElement('td');
        timeCell.textContent = formatTime(entry.timestamp);
        row.appendChild(timeCell);

        // Temperature
        const tempCell = document.createElement('td');
        tempCell.textContent = entry.temperature !== null ? entry.temperature.toFixed(1) + ' °C' : '-';
        row.appendChild(tempCell);

        // Stock
        const stockCell = document.createElement('td');
        stockCell.textContent = entry.stock !== null ? '$' + entry.stock.toFixed(2) : '-';
        row.appendChild(stockCell);

        // CPU
        const cpuCell = document.createElement('td');
        cpuCell.textContent = entry.cpu !== null ? entry.cpu.toFixed(1) + ' %' : '-';
        row.appendChild(cpuCell);

        historyTableBody.appendChild(row);
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// ============================================================================
// Initialize
// ============================================================================

connect();
updateMetricVisibility();
