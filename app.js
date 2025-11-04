// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously,
    onAuthStateChanged,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc,
    updateDoc,
    addDoc, 
    collection, 
    query, 
    where, 
    onSnapshot,
    deleteDoc,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
// !! IMPORTANT: Paste your Firebase config object here from the tutorial.
const firebaseConfig = {
    apiKey: "AIzaSyB_7QcUkRuVQ_BN-eCG_awptKt90iEX4PU",
    authDomain: "my-calendar-app-1c2b5.firebaseapp.com",
    projectId: "my-calendar-app-1c2b5",
    storageBucket: "my-calendar-app-1c2b5.firebasestorage.app",
    messagingSenderId: "338550424431",
    appId: "1:338550424431:web:840336f5352eb0e8119e9a",
    measurementId: "G-JY88SMFDRF"
};

// --- Global Variables ---
let app, auth, db;
let currentUserId = null;
let currentViewDate = new Date();
let currentViewMode = 'week'; // 'day', 'week', 'month'
let calendars = {}; // To store calendar {id, name, color}
let events = []; // To store fetched events

// Firestore Collection Refs
let profileRef, calendarsRef, eventsRef;

// Unsubscribe functions for listeners
let unsubProfile = () => {};
let unsubCalendars = () => {};
let unsubEvents = () => {};

// DOM Elements
const mainGrid = document.getElementById('main-calendar-grid');
const mainHeaderDate = document.getElementById('main-header-date');
const miniCalGrid = document.getElementById('mini-calendar-grid');
const miniCalHeader = document.getElementById('mini-cal-header');
const calendarList = document.getElementById('calendar-list');
const userIdDisplay = document.getElementById('user-id-display');

// Modals
const eventModal = document.getElementById('event-modal');
const calendarModal = document.getElementById('calendar-modal');
const profileModal = document.getElementById('profile-modal');

// Forms
const eventForm = document.getElementById('event-form');
const calendarForm = document.getElementById('calendar-form');
const profileForm = document.getElementById('profile-form');

// --- Utility Functions ---

/**
 * Shows a toast notification.
 * @param {string} message - The message to display.
 * @param {'success' | 'error'} type - The type of toast.
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `
        <i data-lucide="${iconName}" class="w-5 h-5"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

/**
 * Parses a date string in DD/MM/YYYY format and a time string.
 * @param {string} dateString - The date, e.g., "02/11/2025"
 * @param {string} timeString - The time, e.g., "21:30"
 * @returns {Date} A JavaScript Date object.
 */
function parseDMYDate(dateString, timeString) {
    // This function assumes date format is DD/MM/YYYY
    // If your browser uses MM/DD/YYYY, this will need to change
    const [day, month, year] = dateString.split('/').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Check for invalid date parts
    if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hours) || isNaN(minutes)) {
        throw new Error('Invalid date or time format.');
    }

    // Month is 0-indexed in JavaScript Dates (0 = Jan, 11 = Dec)
    return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Formats a date object to HH:mm
 * @param {Date} date - The date object
 * @returns {string} - e.g., "09:30"
 */
function formatTime(date) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formats a date object to YYYY-MM-DD for input[type=date]
 * @param {Date} date - The date object
 * @returns {string} - e.g., "2025-03-05"
 */
function formatDateForInput(date) {
    // Note: toLocaleDateString can be problematic.
    // Using ISO string is more reliable.
    return date.toISOString().split('T')[0];
}

/**
 * Formats a date object to HH:mm for input[type=time]
 * @param {Date} date - The date object
 * @returns {string} - e.g., "09:30"
 */
function formatTimeForInput(date) {
    return date.toTimeString().slice(0, 5);
}

/**
 * Generic function to open a modal
 * @param {HTMLElement} modalEl - The modal element to open.
 */
function openModal(modalEl) {
    modalEl.classList.add('open');
}

/**
 * Generic function to close a modal
 * @param {HTMLElement} modalEl - The modal element to close.
 */
function closeModal(modalEl) {
    modalEl.classList.remove('open');
}

/**
 * Sets the loading state on a form submit button.
 * @param {boolean} isLoading - Whether to show loading state.
 * @param {string} [formId] - The ID of the form to find the button in.
 */
function setLoading(isLoading, formId = 'event-form') {
    const form = document.getElementById(formId);
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processing...</span>
        `;
    } else {
        button.disabled = false;
        // Restore original button text
        if (formId === 'event-form') {
            button.innerHTML = '<span>Save Agenda</span>';
        } else if (formId === 'calendar-form') {
            button.innerHTML = '<span>Save Calendar</span>';
        } else if (formId === 'profile-form') {
            button.innerHTML = '<span>Save Settings</span>';
        }
    }
}

// --- Core Application Logic ---

/**
 * Updates the styling of the Day/Week/Month view switcher
 */
function updateViewSwitcherUI() {
    document.getElementById('view-day-btn').classList.toggle('bg-white/20', currentViewMode === 'day');
    document.getElementById('view-day-btn').classList.toggle('text-white', currentViewMode === 'day');
    document.getElementById('view-day-btn').classList.toggle('text-white/70', currentViewMode !== 'day');

    document.getElementById('view-week-btn').classList.toggle('bg-white/20', currentViewMode === 'week');
    document.getElementById('view-week-btn').classList.toggle('text-white', currentViewMode === 'week');
    document.getElementById('view-week-btn').classList.toggle('text-white/70', currentViewMode !== 'week');

    document.getElementById('view-month-btn').classList.toggle('bg-white/20', currentViewMode === 'month');
    document.getElementById('view-month-btn').classList.toggle('text-white', currentViewMode === 'month');
    document.getElementById('view-month-btn').classList.toggle('text-white/70', currentViewMode !== 'month');
}

/**
 * Main function to render the current view (week, day, month)
 */
function render() {
    // Re-render all components that depend on the current date or view
    renderMiniCalendar();
    updateViewSwitcherUI();
    
    if (currentViewMode === 'week') {
        renderWeekView();
        updateHeaderDate(getWeekStart(currentViewDate));
    } else if (currentViewMode === 'day') {
        // TODO: Implement renderDayView()
        mainGrid.innerHTML = `<div class="p-8 text-white/70 col-span-8 text-center">Day View is not implemented yet.</div>`;
        mainHeaderDate.textContent = currentViewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else if (currentViewMode === 'month') {
        // TODO: Implement renderMonthView()
        mainGrid.innerHTML = `<div class="p-8 text-white/70 col-span-8 text-center">Month View is not implemented yet.</div>`;
        mainHeaderDate.textContent = currentViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
}

/**
 * Renders the main week view grid
 */
function renderWeekView() {
    mainGrid.innerHTML = ''; // Clear existing grid
    
    const weekStart = getWeekStart(currentViewDate);
    const days = [];
    
    // Create headers
    mainGrid.appendChild(document.createElement('div')); // Empty corner
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        days.push(day);
        
        const headerCell = document.createElement('div');
        headerCell.className = 'grid-header-cell';
        
        const dayName = day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const dayNum = day.getDate();
        const isToday = day.toDateString() === new Date().toDateString();
        
        headerCell.innerHTML = `
            <div class="text-xs ${isToday ? 'text-blue-400' : ''}">${dayName}</div>
            <div class="text-2xl mt-1 ${isToday ? 'text-blue-400 bg-blue-500/20 rounded-full w-10 h-10 mx-auto flex items-center justify-center' : ''}">${dayNum}</div>
        `;
        mainGrid.appendChild(headerCell);
    }
    
    // Create time slots and day cells
    for (let hour = 0; hour < 24; hour++) {
        const timeCell = document.createElement('div');
        timeCell.className = 'grid-time-cell';
        if (hour > 0) {
            timeCell.textContent = `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`;
        }
        mainGrid.appendChild(timeCell);
        
        for (let i = 0; i < 7; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'grid-day-cell';
            dayCell.dataset.date = days[i].toISOString().split('T')[0];
            dayCell.dataset.dayIndex = i;
            mainGrid.appendChild(dayCell);
        }
    }
    
    // Render events
    renderEvents(weekStart, 'week');
}

/**
 * Renders the event bubbles onto the grid
 * @param {Date} viewStartDate - The start date of the current view
 * @param {'week' | 'day' | 'month'} viewMode - The current view mode
 */
function renderEvents(viewStartDate, viewMode) {
    const viewEndDate = new Date(viewStartDate);
    if (viewMode === 'week') {
        viewEndDate.setDate(viewEndDate.getDate() + 7);
    } // TODO: Add day/month logic
    
    const relevantEvents = events.filter(event => {
        const eventStart = new Date(event.start);
        return eventStart >= viewStartDate && eventStart < viewEndDate;
    });

    relevantEvents.forEach(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        
        const dayIndex = (eventStart.getDay() - viewStartDate.getDay() + 7) % 7;
        
        // Find the correct cell column
        const dayCells = mainGrid.querySelectorAll(`[data-day-index="${dayIndex}"]`);
        if (!dayCells.length) return;

        const startHour = eventStart.getHours();
        const startMinute = eventStart.getMinutes();
        const endHour = eventEnd.getHours();
        const endMinute = eventEnd.getMinutes();
        
        // Calculate position and height
        const top = (startHour * 60) + startMinute; // 1px per minute
        const duration = ((endHour * 60) + endMinute) - top;
        
        const eventBubble = document.createElement('div');
        eventBubble.className = 'event-bubble';
        eventBubble.style.top = `${top}px`;
        eventBubble.style.height = `${duration}px`;
        
        const eventCalendar = calendars[event.calendarId];
        if (eventCalendar) {
            eventBubble.style.backgroundColor = eventCalendar.color + 'B3'; // 70% opacity
        }
        
        eventBubble.innerHTML = `
            <div class="title">${event.title}</div>
            <div class="time">${formatTime(eventStart)} - ${formatTime(eventEnd)}</div>
        `;
        
        // Add click listener to open edit modal
        eventBubble.addEventListener('click', () => openEventModal(event));
        
        // Append to the first cell in the correct day column (which is the 00:00 hour cell)
        dayCells[0].appendChild(eventBubble);
    });
}

/**
 * Renders the mini calendar in the sidebar
 */
function renderMiniCalendar() {
    miniCalGrid.innerHTML = '';
    miniCalHeader.textContent = currentViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Add day headers (S, M, T, W, T, F, S)
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        miniCalGrid.appendChild(dayHeader);
    });
    
    // Add blank days for preceding month
    for (let i = 0; i < firstDayOfMonth; i++) {
        miniCalGrid.appendChild(document.createElement('div'));
    }
    
    // Add days of the month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.textContent = day;
        dayEl.className = 'day';
        
        const date = new Date(year, month, day);
        
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayEl.classList.add('today');
        }
        
        // Check if this day is in the currently viewed week
        const weekStart = getWeekStart(currentViewDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        if (date >= weekStart && date <= weekEnd && currentViewMode === 'week') {
            dayEl.classList.add('selected');
        }
        
        dayEl.addEventListener('click', () => {
            currentViewDate = date;
            render();
        });
        
        miniCalGrid.appendChild(dayEl);
    }
}

/**
 * Renders the list of calendars (tags) in the sidebar
 */
function renderCalendarList() {
    calendarList.innerHTML = ''; // Clear list
    const calendarSelect = document.getElementById('event-calendar');
    calendarSelect.innerHTML = '<option value="">Select a tag...</option>'; // Clear select

    if (Object.keys(calendars).length === 0) {
         calendarList.innerHTML = `<li class="text-sm text-white/60">No calendars created. Click the '+' to add one.</li>`;
         return;
    }

    Object.values(calendars).forEach(cal => {
        // Add to sidebar list
        const li = document.createElement('li');
        li.className = 'flex items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-white/10';
        li.innerHTML = `
            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${cal.color}"></span>
            <span class="text-white/90 text-sm truncate">${cal.name}</span>
        `;
        calendarList.appendChild(li);
        
        // Add to event modal select
        const option = document.createElement('option');
        option.value = cal.id;
        option.textContent = cal.name;
        calendarSelect.appendChild(option);
    });
}

/**
 * Updates the main header date display
 * @param {Date} weekStartDate - The start date of the currently viewed week
 */
function updateHeaderDate(weekStartDate) {
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    
    const startMonth = weekStartDate.toLocaleDateString('en-US', { month: 'long' });
    const endMonth = weekEndDate.toLocaleDateString('en-US', { month: 'long' });
    
    let dateString = '';
    if (startMonth === endMonth) {
        dateString = `${startMonth} ${weekStartDate.getDate()} - ${weekEndDate.getDate()}, ${weekEndDate.getFullYear()}`;
    } else {
        dateString = `${startMonth} ${weekStartDate.getDate()} - ${endMonth} ${weekEndDate.getDate()}, ${weekEndDate.getFullYear()}`;
    }
    mainHeaderDate.textContent = dateString;
}

// --- Date Helper Functions ---

/**
 * Gets the start of the week (Sunday) for a given date
 * @param {Date} date - The date to find the week start for
 * @returns {Date} - The date of the Sunday at the start of the week
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // 0 = Sunday
    return new Date(d.setDate(diff));
}

// --- Modal & Form Handling ---

/**
 * Opens the event modal, either for create or edit.
 * @param {Object | null} [event] - The event object to edit, or null to create.
 */
function openEventModal(event = null) {
    const title = document.getElementById('event-modal-title');
    const deleteBtn = document.getElementById('delete-event-btn');
    
    if (event) {
        // Edit mode
        title.textContent = 'Edit Agenda';
        eventForm.title.value = event.title;
        eventForm.calendar.value = event.calendarId;
        
        // Dates and times are stored as ISO strings
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        
        // Use helper to format for input
        eventForm.date.value = formatDateForInput(startDate);
        eventForm.startTime.value = formatTimeForInput(startDate);
        eventForm.endTime.value = formatTimeForInput(endDate);
        
        eventForm.eventId.value = event.id;
        deleteBtn.classList.remove('hidden');
    } else {
        // Create mode
        title.textContent = 'Create Agenda';
        eventForm.reset();
        eventForm.eventId.value = '';
        // Set default date to today or current view
        eventForm.date.value = formatDateForInput(currentViewDate);
        deleteBtn.classList.add('hidden');
    }
    
    openModal(eventModal);
}

/**
 * Handles submission of the event form (create or update)
 * @param {Event} e - The form submit event
 */
async function handleEventFormSubmit(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const title = eventForm.title.value;
    const date = eventForm.date.value; // e.g., "2025-11-02" from input[type=date]
    const startTime = eventForm.startTime.value; // e.g., "21:30"
    const endTime = eventForm.endTime.value;
    const calendarId = eventForm.calendar.value;
    const eventId = eventForm.eventId.value;

    // Basic validation
    if (!title || !date || !startTime || !endTime || !calendarId) {
        showToast("Please fill in all fields.", "error");
        return;
    }

    // Start try...catch block *before* date parsing
    try {
        setLoading(true);
        
        // Use the built-in Date constructor, which works with YYYY-MM-DD
        // This is more reliable than custom parsing if the input type="date" is used.
        // NOTE: If the input[type=date] returns DD/MM/YYYY, we must use the parseDMYDate function.
        // Let's check the format from the input. input[type=date] *should* return YYYY-MM-DD.
        
        let startDateTime, endDateTime;
        
        if (date.includes('-')) {
            // Standard YYYY-MM-DD format
            startDateTime = new Date(`${date}T${startTime}`);
            endDateTime = new Date(`${date}T${endTime}`);
        } else {
            // Assume DD/MM/YYYY format
            startDateTime = parseDMYDate(date, startTime);
            endDateTime = parseDMYDate(date, endTime);
        }

        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            throw new Error("Invalid date or time entered.");
        }

        if (endDateTime <= startDateTime) {
            showToast("End time must be after start time.", "error");
            setLoading(false);
            return;
        }

        const eventData = {
            title,
            start: startDateTime.toISOString(), // Store as standard ISO string
            end: endDateTime.toISOString(),
            calendarId,
            userId: auth.currentUser.uid
        };

        if (eventId) {
            // Update existing event
            const eventRef = doc(db, 'events', eventId);
            await updateDoc(eventRef, eventData);
            showToast('Agenda updated successfully!');
        } else {
            // Create new event
            await addDoc(eventsRef, eventData);
            showToast('Agenda created successfully!');
        }

        closeModal(eventModal);
        
    } catch (error) {
        console.error("Error saving event:", error);
        showToast(`Error: ${error.message}`, "error");
    } finally {
        setLoading(false);
    }
}

/**
 * Handles deleting an event
 */
async function handleDeleteEvent() {
    if (!auth.currentUser) return;
    
    const eventId = eventForm.eventId.value;
    if (!eventId) return;
    
    // Simple confirm, replace with a custom modal for better UX
    if (!window.confirm("Are you sure you want to delete this event?")) {
        return;
    }
    
    setLoading(true, 'event-form');
    try {
        const eventRef = doc(db, 'events', eventId);
        await deleteDoc(eventRef);
        showToast('Agenda deleted.');
        closeModal(eventModal);
    } catch (error) {
        console.error("Error deleting event:", error);
        showToast("Error deleting event.", "error");
    } finally {
        setLoading(false, 'event-form');
    }
}

/**
 * Handles submission of the new calendar (tag) form
 * @param {Event} e - The form submit event
 */
async function handleCalendarFormSubmit(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const name = calendarForm.name.value;
    const color = calendarForm.color.value;
    
    if (!name || !color) {
        showToast("Please fill in all fields.", "error");
        return;
    }
    
    setLoading(true, 'calendar-form');
    try {
        await addDoc(calendarsRef, {
            name,
            color,
            userId: auth.currentUser.uid
        });
        
        showToast('Calendar created successfully!');
        closeModal(calendarModal);
        calendarForm.reset();
        
    } catch (error) {
        console.error("Error creating calendar:", error);
        showToast("Error creating calendar.", "error");
    } finally {
        setLoading(false, 'calendar-form');
    }
}

/**
 * Handles submission of the profile settings form
 * @param {Event} e - The form submit event
 */
async function handleProfileFormSubmit(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const name = profileForm.name.value;
    const backgroundUrl = profileForm.backgroundUrl.value;
    
    setLoading(true, 'profile-form');
    try {
        await setDoc(profileRef, {
            name: name || "",
            backgroundUrl: backgroundUrl || ""
        }, { merge: true }); // merge: true prevents overwriting other fields
        
        showToast('Profile updated!');
        closeModal(profileModal);
        
        // Live update the background if it was changed
        if (backgroundUrl) {
            document.documentElement.style.setProperty('--bg-image', `url('${backgroundUrl}')`);
        }
        
    } catch (error) {
        console.error("Error saving profile:", error);
        showToast("Error saving profile.", "error");
    } finally {
        setLoading(false, 'profile-form');
    }
}

// --- Firebase Setup ---

/**
 * Initializes the Firebase app and services
 */
function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        // Enable debug logging for Firestore
        // setLogLevel('debug');
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showToast("Could not connect to database. Check console.", "error");
    }
}

/**
 * Sets up real-time data listeners
 * @param {string} userId - The current user's ID
 */
function setupDataListeners(userId) {
    // Detach any existing listeners
    unsubProfile();
    unsubCalendars();
    unsubEvents();
    
    // Define new collection paths for this user
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userRootPath = `/artifacts/${appId}/users/${userId}`;
    
    // 1. Listen for Profile Settings
    profileRef = doc(db, `${userRootPath}/profile/settings`);
    unsubProfile = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (data.backgroundUrl) {
                document.documentElement.style.setProperty('--bg-image', `url('${data.backgroundUrl}')`);
                profileForm.backgroundUrl.value = data.backgroundUrl;
            }
            if (data.name) {
                profileForm.name.value = data.name;
            }
        } else {
            // No profile doc, use default
            document.documentElement.style.setProperty('--bg-image', `url('https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80')`);
        }
    }, (error) => {
        console.error("Error listening to profile:", error);
        showToast("Error loading profile.", "error");
    });
    
    // 2. Listen for Calendars (Tags)
    calendarsRef = collection(db, `${userRootPath}/calendars`);
    unsubCalendars = onSnapshot(calendarsRef, (snapshot) => {
        calendars = {}; // Reset local cache
        snapshot.forEach((doc) => {
            calendars[doc.id] = { id: doc.id, ...doc.data() };
        });
        renderCalendarList();
    }, (error) => {
        console.error("Error listening to calendars:", error);
        showToast("Error loading calendars.", "error");
    });

    // 3. Listen for Events
    eventsRef = collection(db, `${userRootPath}/events`);
    unsubEvents = onSnapshot(eventsRef, (snapshot) => {
        events = []; // Reset local cache
        snapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() });
        });
        // Re-render the grid with new events
        render();
    }, (error) => {
        console.error("Error listening to events:", error);
        showToast("Error loading events.", "error");
    });
}

/**
 * Main application initialization
 */
async function initApp() {
    // 1. Initialize Firebase
    initFirebase();
    if (!app) return;

    // 2. Set up Authentication
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            currentUserId = user.uid;
            userIdDisplay.textContent = currentUserId.substring(0, 8) + '...';
            
            // 3. Setup data listeners now that we have a user
            setupDataListeners(currentUserId);
            
        } else {
            // User is signed out, clear data
            currentUserId = null;
            userIdDisplay.textContent = 'Not logged in';
            // Detach listeners
            unsubProfile();
            unsubCalendars();
            unsubEvents();
        }
    });
    
    // Try to sign in with provided token, or fall back to anonymous
    try {
        if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            // No token provided, just sign in anonymously
            await signInAnonymously(auth);
        }
    } catch (error) {
         console.error("Authentication failed:", error);
         // If custom token fails (e.g., mismatch), fall back to anonymous sign-in
         // for this specific project.
         if (error.code === 'auth/custom-token-mismatch') {
            console.warn("Custom token mismatch. Falling back to anonymous sign-in.");
            try {
                await signInAnonymously(auth);
            } catch (anonError) {
                console.error("Anonymous sign-in also failed:", anonError);
                showToast("Authentication failed completely. Please refresh.", "error");
                return;
            }
         } else {
            // Other auth error
            showToast("Authentication failed. Please refresh.", "error");
            return;
         }
    }

    // 4. Render initial UI
    render();
    
    // 5. Initialize icons
    try {
        lucide.createIcons();
    } catch (error) {
        console.error("Lucide error. This might be from a previous bad load.", error);
    }

    // 6. Setup all event listeners
    
    // Header buttons
    document.getElementById('today-btn').addEventListener('click', () => {
        currentViewDate = new Date();
        render();
    });
    document.getElementById('prev-week-btn').addEventListener('click', () => {
        currentViewDate.setDate(currentViewDate.getDate() - 7);
        render();
    });
    document.getElementById('next-week-btn').addEventListener('click', () => {
        currentViewDate.setDate(currentViewDate.getDate() + 7);
        render();
    });

    // View switcher buttons
    document.getElementById('view-day-btn').addEventListener('click', () => {
        currentViewMode = 'day';
        render();
    });
    document.getElementById('view-week-btn').addEventListener('click', () => {
        currentViewMode = 'week';
        render();
    });
    document.getElementById('view-month-btn').addEventListener('click', () => {
        currentViewMode = 'month';
        render();
    });
    
    // Mini calendar buttons
    document.getElementById('mini-cal-prev').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        render();
    });
    document.getElementById('mini-cal-next').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        render();
    });
    
    // Modal Openers
    document.getElementById('open-event-modal-btn').addEventListener('click', () => openEventModal());
    document.getElementById('open-calendar-modal-btn').addEventListener('click', () => openModal(calendarModal));
    document.getElementById('open-profile-modal-btn').addEventListener('click', () => openModal(profileModal));
    
    // Modal Closers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.closest('.modal-backdrop'));
        });
    });
    document.querySelectorAll('.modal-backdrop').forEach(bg => {
        bg.addEventListener('click', (e) => {
            if (e.target === bg) {
                closeModal(bg);
            }
        });
    });

    // Form Submissions
    eventForm.addEventListener('submit', handleEventFormSubmit);
    calendarForm.addEventListener('submit', handleCalendarFormSubmit);
    profileForm.addEventListener('submit', handleProfileFormSubmit);
    
    // Other Listeners
    document.getElementById('delete-event-btn').addEventListener('click', handleDeleteEvent);

    // Mobile Nav
    const sidebar = document.querySelector('.sidebar');
    const mobileSidebarBtn = document.getElementById('mobile-sidebar-btn');
    const mobileHomeBtn = document.getElementById('mobile-home-btn');
    
    mobileSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('mobile-open');
        mobileSidebarBtn.classList.add('active');
        mobileHomeBtn.classList.remove('active');
    });
    mobileHomeBtn.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        mobileHomeBtn.classList.add('active');
        mobileSidebarBtn.classList.remove('active');
    });
    document.getElementById('mobile-create-btn').addEventListener('click', () => openEventModal());
    document.getElementById('mobile-profile-btn').addEventListener('click', () => openModal(profileModal));
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
         sidebar.classList.add('mobile-open');
         mobileSidebarBtn.classList.add('active');
         mobileHomeBtn.classList.remove('active');
    });
}

// --- Start the App ---
document.addEventListener('DOMContentLoaded', initApp);

