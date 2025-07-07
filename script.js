document.addEventListener('DOMContentLoaded', async () => {
    // --- CACHE DOM ELEMENTS ---
    const DOM = {
        starsContainer: document.getElementById('stars'),
        // NEW: Cache the auto-rating indicator element
        autoRatingIndicator: document.getElementById('auto-rating-indicator'),
        currentTime: document.getElementById('current-time'),
        timerDisplay: document.getElementById('timer-display'),
        startBtn: document.getElementById('start-btn'),
        pauseBtn: document.getElementById('pause-btn'),
        resetBtn: document.getElementById('reset-btn'),
        goodBtn: document.getElementById('good-btn'),
        badBtn: document.getElementById('bad-btn'),
        goodCounter: document.getElementById('good-counter'),
        badCounter: document.getElementById('bad-counter'),
        summarySection: document.getElementById('summary'),
        finalRating: document.getElementById('final-rating'),
        finalDuration: document.getElementById('final-duration'),
        goodFeedbackLog: document.getElementById('good-feedback-log'),
        badFeedbackLog: document.getElementById('bad-feedback-log'),
        clearSessionBtn: document.getElementById('clear-session'),
    };

    // --- STATE MANAGEMENT ---
    let feedbackData = {};
    const initialAppState = {
        rating: 0,
        timer: { seconds: 0, running: false, intervalId: null, startTime: 0 },
        feedback: { good: [], bad: [] },
        sessionActive: false
    };
    let appState = {};

    // --- INITIALIZATION ---
    /**
     * Kicks off the application by loading data, state, and setting up listeners.
     */
    async function initializeApp() {
        await loadFeedbackData();
        loadState();
        setupEventListeners();
        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);
        updateDisplay();
    }

    /**
     * Fetches feedback options from a JSON file.
     */
    async function loadFeedbackData() {
        try {
            const response = await fetch('feedback-data.json');
            if (!response.ok) throw new Error('Network response was not ok');
            feedbackData = await response.json();
        } catch (error) {
            console.error('Failed to load feedback data:', error);
            alert('Error: Could not load feedback options. Please check the console.');
        }
    }

    /**
     * Loads application state from localStorage or sets initial state.
     */
    function loadState() {
        try {
            const savedState = localStorage.getItem('presentationRatingState');
            appState = savedState ? JSON.parse(savedState) : JSON.parse(JSON.stringify(initialAppState));
            // Ensure timer is not running on load
            if (appState.timer) {
                appState.timer.running = false;
                appState.timer.intervalId = null;
            }
        } catch (e) {
            console.error('Could not load state from localStorage:', e);
            appState = JSON.parse(JSON.stringify(initialAppState));
        }
    }

    /**
     * Saves the current application state to localStorage.
     */
    function saveState() {
        try {
            localStorage.setItem('presentationRatingState', JSON.stringify(appState));
        } catch (e) {
            console.error('Could not save state to localStorage:', e);
        }
    }
    
    /**
     * Central function to save state and update the entire UI.
     */
    function saveAndRender() {
        saveState();
        updateDisplay();
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        DOM.starsContainer.addEventListener('click', handleStarClick);
        DOM.startBtn.addEventListener('click', startTimer);
        DOM.pauseBtn.addEventListener('click', pauseTimer);
        DOM.resetBtn.addEventListener('click', resetTimer);
        DOM.goodBtn.addEventListener('click', () => openModal('good'));
        DOM.badBtn.addEventListener('click', () => openModal('bad'));
        DOM.clearSessionBtn.addEventListener('click', clearSession);
        setupModalListeners('good');
        setupModalListeners('bad');
    }

    function setupModalListeners(type) {
        const modal = document.getElementById(`${type}-modal`);
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('cancel')) {
                closeModal(type);
            }
        });
        modal.querySelector('.close-btn').addEventListener('click', () => closeModal(type));
        document.getElementById(`${type}-submit`).addEventListener('click', () => submitFeedback(type));
        document.getElementById(`${type}-search`).addEventListener('input', (e) => populateModal(type, e.target.value));
        
        const customInput = document.getElementById(`${type}-custom-input`);
        const customAddBtn = document.getElementById(`${type}-custom-add`);
        customAddBtn.addEventListener('click', () => addCustomFeedback(type));
        customInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') customAddBtn.click();
        });
    }

    // --- UI & DISPLAY ---
    function updateDisplay() {
        // MODIFICATION: Get effective rating (manual or auto) and pass it to UI updaters
        const { rating, isAuto } = getEffectiveRating();
        highlightStars(rating, isAuto);
        updateTimerDisplay();
        updateFeedbackCounters();
        updateSummary(); // updateSummary will now also use getEffectiveRating
        updateTimerButtons();
    }

    function updateCurrentTime() {
        DOM.currentTime.textContent = new Date().toLocaleTimeString();
    }

    // --- RATING ---
    /**
     * NEW: Determines if the rating is manual or should be auto-calculated.
     * @returns {{rating: number, isAuto: boolean}} The effective rating and its type.
     */
    function getEffectiveRating() {
        // If user has manually rated, use that rating.
        if (appState.rating > 0) {
            return { rating: appState.rating, isAuto: false };
        }

        const goodCount = appState.feedback.good.length;
        const totalCount = goodCount + appState.feedback.bad.length;

        // If no feedback is given, rating is 0.
        if (totalCount === 0) {
            return { rating: 0, isAuto: false };
        }

        const goodPercentage = (goodCount / totalCount) * 100;
        // Each of the 6 stars represents a ~16.67% step.
        // We use Math.ceil to grant a star for any fraction of a step.
        // We use Math.max(1, ...) to ensure that if any feedback exists, the rating is at least 1 star.
        const autoRating = Math.max(1, Math.ceil(goodPercentage / (100 / 6)));

        return { rating: autoRating, isAuto: true };
    }

    function handleStarClick(e) {
        if (e.target.classList.contains('star')) {
            appState.rating = parseInt(e.target.dataset.value);
            saveAndRender();
        }
    }

    /**
     * MODIFICATION: This function now handles auto-rating colors and indicator.
     * @param {number} rating The rating value to display.
     * @param {boolean} isAuto True if the rating is automatically calculated.
     */
    function highlightStars(rating, isAuto = false) {
        // Clear any previous auto-rating color classes
        DOM.starsContainer.classList.remove('auto-rating-low', 'auto-rating-mid', 'auto-rating-high');
        
        // Highlight the active stars
        document.querySelectorAll('.star').forEach(star => {
            star.classList.toggle('active', parseInt(star.dataset.value) <= rating);
        });

        // Show/hide indicator and apply color classes if rating is automatic
        DOM.autoRatingIndicator.classList.toggle('hidden', !isAuto);
        if (isAuto) {
            if (rating <= 2) {
                DOM.starsContainer.classList.add('auto-rating-low');
            } else if (rating <= 4) {
                DOM.starsContainer.classList.add('auto-rating-mid');
            } else {
                DOM.starsContainer.classList.add('auto-rating-high');
            }
        }
    }


    // --- TIMER ---
    function startTimer() {
        if (appState.timer.running) return;
        appState.timer.running = true;
        appState.sessionActive = true;
        appState.timer.startTime = Date.now() - (appState.timer.seconds * 1000);
        appState.timer.intervalId = setInterval(tick, 1000);
        saveAndRender();
    }

    function pauseTimer() {
        if (!appState.timer.running) return;
        appState.timer.running = false;
        clearInterval(appState.timer.intervalId);
        appState.timer.intervalId = null;
        saveAndRender();
    }

    function resetTimer() {
        pauseTimer();
        appState.timer.seconds = 0;
        saveAndRender();
    }
    
    function tick() {
        appState.timer.seconds = Math.floor((Date.now() - appState.timer.startTime) / 1000);
        updateTimerDisplay(); // Directly update to avoid full re-render every second
        saveState(); // Save timer progress
    }

    function updateTimerDisplay() {
        DOM.timerDisplay.textContent = formatTime(appState.timer.seconds);
    }
    
    function updateTimerButtons() {
        DOM.startBtn.disabled = appState.timer.running;
        DOM.pauseBtn.disabled = !appState.timer.running;
    }

    // --- MODALS & FEEDBACK ---
    function openModal(type) {
        document.getElementById(`${type}-search`).value = '';
        populateModal(type);
        document.getElementById(`${type}-modal`).classList.add('show');
    }

    function closeModal(type) {
        document.getElementById(`${type}-modal`).classList.remove('show');
    }

    function populateModal(type, searchTerm = '') {
        const listContainer = document.getElementById(`${type}-feedback-list`);
        listContainer.innerHTML = '';
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        let itemsFound = false;

        Object.entries(feedbackData[type]).forEach(([category, items]) => {
            const filteredItems = items.filter(item => item.text.toLowerCase().includes(lowerCaseSearchTerm));
            if (filteredItems.length === 0) return;

            itemsFound = true;
            const categoryHeader = document.createElement('h4');
            categoryHeader.className = 'feedback-category-header';
            categoryHeader.textContent = category;
            listContainer.appendChild(categoryHeader);

            filteredItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'feedback-item';
                div.innerHTML = `
                    <input type="checkbox" id="${item.id}" value="${item.text}">
                    <label for="${item.id}">${item.text}</label>
                `;
                listContainer.appendChild(div);
            });
        });
        
        if (!itemsFound) {
            listContainer.innerHTML = `<p class="no-results">No results found for "${searchTerm}"</p>`;
        }
    }

    function addCustomFeedback(type) {
        const input = document.getElementById(`${type}-custom-input`);
        const text = input.value.trim();
        if (!text) return;
        
        const listContainer = document.getElementById(`${type}-feedback-list`);
        const customId = `custom-${Date.now()}`;
        
        const div = document.createElement('div');
        div.className = 'feedback-item custom-added';
        div.innerHTML = `
            <input type="checkbox" id="${customId}" value="${text}" checked>
            <label for="${customId}">${text}</label>
        `;

        const noResults = listContainer.querySelector('.no-results');
        if (noResults) noResults.remove();
        
        listContainer.prepend(div);
        input.value = '';
        input.focus();
    }

    function submitFeedback(type) {
        const checkboxes = document.querySelectorAll(`#${type}-feedback-list input[type="checkbox"]:checked`);
        const newFeedback = Array.from(checkboxes).map(cb => ({
            text: cb.value,
            time: appState.timer.seconds
        }));
        
        appState.feedback[type].push(...newFeedback);
        appState.feedback[type].sort((a, b) => a.time - b.time); // Keep sorted by time
        closeModal(type);
        saveAndRender();
    }

    function updateFeedbackCounters() {
        DOM.goodCounter.textContent = appState.feedback.good.length;
        DOM.badCounter.textContent = appState.feedback.bad.length;
    }

    // --- SUMMARY ---
    function updateSummary() {
        const hasFeedback = appState.feedback.good.length > 0 || appState.feedback.bad.length > 0;
        const shouldShow = appState.sessionActive || hasFeedback;

        DOM.summarySection.classList.toggle('hidden', !shouldShow);

        if (shouldShow) {
            // MODIFICATION: Get effective rating and show "(auto)" if applicable
            const { rating, isAuto } = getEffectiveRating();
            const ratingText = `${rating} star${rating !== 1 ? 's' : ''}`;
            DOM.finalRating.textContent = isAuto ? `${ratingText} (auto)` : ratingText;
            
            DOM.finalDuration.textContent = formatTime(appState.timer.seconds);
            renderFeedbackLog('good', DOM.goodFeedbackLog);
            renderFeedbackLog('bad', DOM.badFeedbackLog);
        }
    }

    /**
     * Renders a list of feedback items into a specified container.
     * @param {'good'|'bad'} type - The type of feedback to render.
     * @param {HTMLElement} logContainer - The container element to render into.
     */
    function renderFeedbackLog(type, logContainer) {
        logContainer.innerHTML = '';
        const feedbackList = appState.feedback[type];
        
        if (feedbackList.length === 0) {
            logContainer.innerHTML = `<p class="no-feedback-item">No ${type} feedback given.</p>`;
            return;
        }

        feedbackList.forEach(item => {
            const logItem = document.createElement('div');
            logItem.className = 'feedback-log-item';
            logItem.innerHTML = `
                <span class="log-time">[${formatTime(item.time)}]</span>
                <span class="log-text">${item.text}</span>
            `;
            logContainer.appendChild(logItem);
        });
    }

    // --- SESSION & UTILITIES ---
    function clearSession() {
        if (confirm('Are you sure you want to clear all data for this session? This cannot be undone.')) {
            pauseTimer();
            appState = JSON.parse(JSON.stringify(initialAppState)); // Deep copy to reset
            saveAndRender();
        }
    }

    /**
     * Formats a total number of seconds into a MM:SS string.
     * @param {number} totalSeconds - The total seconds to format.
     * @returns {string} The formatted time string.
     */
    function formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    // --- START ---
    initializeApp();
});