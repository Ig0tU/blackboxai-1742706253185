// Constants
const API_BASE_URL = 'http://127.0.0.1:8000/v1';  // API server port
const TOP_MODELS = [
    { id: 'claude-3-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'gpt-4', name: 'GPT-4 Turbo' },
    { id: 'gemini-pro', name: 'Gemini 1.5 Pro' },
    { id: 'mistral-large', name: 'Mistral Large' },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku' }
];

// DOM Elements
const modelSelector = document.getElementById('modelSelector');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendMessage');
const chatMessages = document.getElementById('chatMessages');
const clearButton = document.getElementById('clearChat');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorToast = document.getElementById('errorToast');
const errorMessage = document.getElementById('errorMessage');

// State
let currentModel = '';
let conversationHistory = [];

// Initialize
function init() {
    populateModelSelector();
    setupEventListeners();
    showWelcomeMessage();
    checkAPIConnection();
}

// Check API Connection
async function checkAPIConnection() {
    try {
        const response = await fetch(API_BASE_URL + '/models');
        if (!response.ok) {
            throw new Error('API server is not responding');
        }
        const data = await response.json();
        console.log('Connected to API server successfully');
    } catch (error) {
        showError('Cannot connect to API server. Please ensure the server is running.');
    }
}

// Populate model selector
function populateModelSelector() {
    TOP_MODELS.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelector.appendChild(option);
    });
}

// Event Listeners
function setupEventListeners() {
    modelSelector.addEventListener('change', handleModelChange);
    messageInput.addEventListener('input', handleInputChange);
    sendButton.addEventListener('click', handleSendMessage);
    clearButton.addEventListener('click', handleClearChat);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
}

// Welcome Message
function showWelcomeMessage() {
    addBotMessage("👋 Welcome! I'm @poe_tools/App_Creator. Please select a model from the dropdown above to start our conversation.");
}

// Model Change Handler
function handleModelChange(e) {
    currentModel = e.target.value;
    sendButton.disabled = !currentModel || !messageInput.value.trim();
}

// Input Change Handler
function handleInputChange(e) {
    sendButton.disabled = !currentModel || !e.target.value.trim();
}

// Send Message Handler
async function handleSendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentModel) return;

    // Add user message to chat
    addUserMessage(message);
    messageInput.value = '';
    sendButton.disabled = true;

    try {
        showLoading();
        const response = await sendMessageToAPI(message);
        hideLoading();

        if (response.ok) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let botResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(5);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0].delta.content;
                            if (content) {
                                botResponse += content;
                                updateLastBotMessage(botResponse);
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }
            }
        } else {
            const error = await response.json();
            throw new Error(error.error?.message || 'An error occurred');
        }
    } catch (error) {
        showError(error.message);
        hideLoading();
    }
}

// API Communication
async function sendMessageToAPI(message) {
    try {
        return await fetch(`${API_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer anything' // The API ignores this but requires it
            },
            body: JSON.stringify({
                model: currentModel,
                messages: [
                    { role: 'user', content: message }
                ],
                stream: true
            })
        });
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to connect to API server. Please ensure it is running.');
    }
}

// UI Updates
function addUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message fade-in';
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addBotMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message fade-in';
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function updateLastBotMessage(message) {
    const lastMessage = chatMessages.querySelector('.bot-message:last-child');
    if (!lastMessage) {
        addBotMessage(message);
    } else {
        lastMessage.textContent = message;
        scrollToBottom();
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Clear Chat Handler
function handleClearChat() {
    chatMessages.innerHTML = '';
    showWelcomeMessage();
}

// Loading State
function showLoading() {
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

// Error Handling
function showError(message) {
    errorMessage.textContent = message;
    errorToast.classList.remove('hidden');
    errorToast.classList.add('show-toast');
    setTimeout(() => {
        errorToast.classList.add('hidden');
        errorToast.classList.remove('show-toast');
    }, 5000);
}

// Initialize the app
init();