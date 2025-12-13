document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();

    const welcomeMessageEl = document.getElementById('welcome-message');
    const bannedWordsListEl = document.getElementById('banned-words-list');
    const newBannedWordEl = document.getElementById('new-banned-word');
    const addWordBtn = document.getElementById('add-word-btn');
    const saveBtn = document.getElementById('save-btn');

    let state = {
        welcomeMessage: '',
        bannedWords: []
    };

    // Load initial data from URL
    function loadInitialData() {
        const urlParams = new URLSearchParams(window.location.search);
        const configParam = urlParams.get('config');

        if (configParam) {
            try {
                const decodedConfig = atob(configParam);
                const config = JSON.parse(decodedConfig);
                state.welcomeMessage = config.welcomeMessage || '';
                state.bannedWords = config.bannedWords || [];
            } catch (e) {
                console.error("Failed to parse config from URL:", e);
                tg.showAlert("Failed to load existing settings.");
            }
        }
        render();
    }

    // Render the UI based on the current state
    function render() {
        welcomeMessageEl.value = state.welcomeMessage;
        renderBannedWords();
    }

    function renderBannedWords() {
        bannedWordsListEl.innerHTML = '';
        state.bannedWords.forEach(word => {
            const item = document.createElement('div');
            item.className = 'banned-word-item';
            
            const wordSpan = document.createElement('span');
            wordSpan.textContent = word;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-word-btn';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => {
                state.bannedWords = state.bannedWords.filter(w => w !== word);
                renderBannedWords();
            };
            
            item.appendChild(wordSpan);
            item.appendChild(removeBtn);
            bannedWordsListEl.appendChild(item);
        });
    }

    // Event Listeners
    addWordBtn.addEventListener('click', () => {
        const newWord = newBannedWordEl.value.toLowerCase().trim();
        if (newWord && !state.bannedWords.includes(newWord)) {
            state.bannedWords.push(newWord);
            newBannedWordEl.value = '';
            renderBannedWords();
        }
    });
    
    function saveData() {
        // Update state from UI just before saving
        state.welcomeMessage = welcomeMessageEl.value;
        
        if (state.welcomeMessage || state.bannedWords.length > 0) {
            tg.sendData(JSON.stringify(state));
        } else {
            tg.showAlert("No settings to save.");
        }
    }

    saveBtn.addEventListener('click', saveData);

    // Configure the main Telegram button
    tg.MainButton.setText('Save and Close');
    tg.MainButton.show();
    tg.MainButton.enable();
    tg.onEvent('mainButtonClicked', () => {
        saveData();
    });

    // Initial load
    loadInitialData();
});
