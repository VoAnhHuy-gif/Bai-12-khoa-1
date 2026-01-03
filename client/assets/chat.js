/**
 * Chat WebSocket Client
 * Kết nối tới ws://localhost:8765/ws/chat
 */

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const nameInput = document.getElementById('nameInput');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const connectionStatus = document.getElementById('connectionStatus');

// WebSocket
let ws = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

// User state
let userName = localStorage.getItem('chatUserName') || '';
if (userName) {
    nameInput.value = userName;
}

// ============================================================================
// WebSocket Connection
// ============================================================================

function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }

    updateConnectionStatus('connecting');

    try {
        ws = new WebSocket('ws://localhost:8765/ws/chat');

        ws.onopen = () => {
            console.log('WebSocket connected');
            reconnectAttempts = 0;
            updateConnectionStatus('connected');
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

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
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
// Message Handling
// ============================================================================

function handleMessage(data) {
    if (data.type === 'chat') {
        displayChatMessage(data);
    } else if (data.type === 'system') {
        displaySystemMessage(data.text);
    } else if (data.type === 'error') {
        displaySystemMessage(data.text);
    } else if (data.type === 'online_count') {
        updateOnlineCount(data.count);
    }
}

function updateOnlineCount(count) {
    const onlineCountText = document.getElementById('onlineCountText');
    if (onlineCountText) {
        onlineCountText.textContent = count;
    }
}

function displayChatMessage(data) {
    // Remove welcome message if exists
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    const currentUser = nameInput.value.trim();
    const isOwn = data.name === currentUser;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;

    // Avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.textContent = data.name.charAt(0).toUpperCase();

    // Content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'message-name';
    nameDiv.textContent = data.name;

    // Bubble
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = data.text;

    // Time
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(data.ts);

    contentDiv.appendChild(nameDiv);
    contentDiv.appendChild(bubbleDiv);
    contentDiv.appendChild(timeDiv);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function displaySystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'system-message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// ============================================================================
// Send Message
// ============================================================================

function sendMessage() {
    const name = nameInput.value.trim();
    const text = messageInput.value.trim();

    if (!name || !text) {
        return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        const message = {
            type: 'chat',
            name: name,
            text: text,
            ts: Date.now()
        };

        ws.send(JSON.stringify(message));

        // Save username
        localStorage.setItem('chatUserName', name);

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        updateSendButton();
    } else {
        displaySystemMessage('Không thể gửi tin nhắn. Đang kết nối lại...');
    }
}

// ============================================================================
// Input Handling
// ============================================================================

function updateSendButton() {
    const name = nameInput.value.trim();
    const text = messageInput.value.trim();
    sendButton.disabled = !name || !text || !ws || ws.readyState !== WebSocket.OPEN;
}

// Auto-resize textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    updateSendButton();
});

nameInput.addEventListener('input', updateSendButton);

// Enter to send (Shift+Enter for new line)
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);

// ============================================================================
// Initialize
// ============================================================================

connect();
updateSendButton();
