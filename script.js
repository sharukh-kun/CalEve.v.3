// This will store the user's data after they log in
let loggedInUser = null;

// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // --- GRAB ALL PAGE ELEMENTS ---
    const responseArea = document.getElementById('responseArea');
    const loginRegisterArea = document.getElementById('login-register-area');
    const eventForm = document.getElementById('event-form');
    const storyFeedContainer = document.getElementById('storyFeedContainer');
    
    // Get right sidebar elements
    const userProfileInfo = document.getElementById('user-profile-info');
    const loggedInUsername = document.getElementById('loggedInUsername');
    
    // Get modal elements
    const storyModal = document.getElementById('storyModal');
    const modalClose = document.getElementById('modal-close');
    const modalEventName = document.getElementById('modal-eventName');
    const modalEventDetails = document.getElementById('modal-eventDetails');
    const modalAcceptBtn = document.getElementById('modal-accept');
    const modalDeclineBtn = document.getElementById('modal-decline');

    // --- REGISTRATION ---
    const registerButton = document.getElementById('registerButton');
    registerButton.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        responseArea.textContent = 'Registering...';
        
        fetch('http://localhost:3000/api/register', {
            method: 'POST', // <-- This is the syntax fix
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        })
        .then(response => response.json())
        .then(data => {
            responseArea.textContent = JSON.stringify(data, null, 2);
            if (data.message === 'User registered successfully!') {
                document.getElementById('username').value = '';
                document.getElementById('email').value = '';
                document.getElementById('password').value = '';
            }
        })
        .catch(handleError);
    });

    // --- LOGIN ---
    const loginButton = document.getElementById('loginButton');
    loginButton.addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        responseArea.textContent = 'Logging in...';

        fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            responseArea.textContent = JSON.stringify(data, null, 2);
            if (data.message === 'Login successful!') {
                document.getElementById('loginEmail').value = '';
                document.getElementById('loginPassword').value = '';
                handleLogin(data.user); // Call helper function for new UI
            }
        })
        .catch(handleError);
    });

    // --- LOGOUT ---
    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => {
        loggedInUser = null;
        
        // Show login forms
        loginRegisterArea.style.display = 'block';
        
        // Hide event form and user profile info
        eventForm.style.display = 'none';
        userProfileInfo.style.display = 'none'; // <-- Logic for new UI

        responseArea.textContent = 'Logged out.';
    });

    // --- CREATE EVENT (POST STORY) ---
    // Link to "Create" button in left sidebar
    const createEventMenuButton = document.getElementById('createEventMenuButton');
    createEventMenuButton.addEventListener('click', () => {
        if (loggedInUser) {
            // Show the event form in the main feed
            eventForm.style.display = 'block';
            loginRegisterArea.style.display = 'none';
        } else {
            responseArea.textContent = 'Please log in to create an event.';
        }
    });

    const createEventButton = document.getElementById('createEventButton');
    createEventButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'You must be logged in to create an event.';
            return;
        }

        const eventData = {
            name: document.getElementById('eventName').value,
            description: document.getElementById('eventDesc').value,
            venue: document.getElementById('eventVenue').value,
            date: document.getElementById('eventDate').value,
            time: document.getElementById('eventTime').value,
            creator_id: loggedInUser.acc_id
        };

        responseArea.textContent = 'Creating event...';

        fetch('http://localhost:3000/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        })
        .then(response => response.json())
        .then(data => {
            responseArea.textContent = JSON.stringify(data, null, 2);
            if (data.message === 'Event created successfully!') {
                // Clear the form
                document.getElementById('eventName').value = '';
                document.getElementById('eventDesc').value = '';
                document.getElementById('eventVenue').value = '';
                document.getElementById('eventDate').value = '';
                document.getElementById('eventTime').value = '';
                
                // Refresh the story feed to show the new event
                fetchEvents(); 
            }
        })
        .catch(handleError);
    });

    // --- FETCH ALL EVENTS (POPULATE STORY FEED) ---
    function fetchEvents() {
        fetch('http://localhost:3000/api/events')
            .then(response => response.json())
            .then(events => {
                storyFeedContainer.innerHTML = ''; // Clear the old feed
                
                if (events.length === 0) {
                    storyFeedContainer.innerHTML = '<p style="color: #a8a8a8;">No stories posted.</p>';
                } else {
                    events.forEach(event => {
                        const circle = document.createElement('div');
                        circle.className = 'story-circle';
                        circle.textContent = event.name.charAt(0).toUpperCase();
                        circle.dataset.event = JSON.stringify(event);
                        circle.addEventListener('click', openStoryModal);
                        storyFeedContainer.appendChild(circle);
                    });
                }
            })
            .catch(handleError);
    }

    // --- STORY MODAL LOGIC ---
    function openStoryModal(clickEvent) {
        const eventData = JSON.parse(clickEvent.currentTarget.dataset.event);
        const eventDate = new Date(eventData.event_date).toLocaleDateString();

        modalEventName.textContent = eventData.name;
        modalEventDetails.innerHTML = `
            <p><strong>By:</strong> ${eventData.creator_username}</p>
            <p><strong>When:</strong> ${eventDate} at ${eventData.event_time}</p>
            <p><strong>Where:</strong> ${eventData.venue}</p>
            <p>${eventData.description}</p>
        `;
        modalAcceptBtn.dataset.eventId = eventData.event_id;
        modalDeclineBtn.dataset.eventId = eventData.event_id;

        storyModal.style.display = 'flex';
    }

    modalClose.addEventListener('click', () => {
        storyModal.style.display = 'none';
    });
    storyModal.addEventListener('click', (e) => {
        if (e.target === storyModal) {
            storyModal.style.display = 'none';
        }
    });

    // --- ACCEPT / DECLINE ---
    modalAcceptBtn.addEventListener('click', () => {
        setAttendance(modalAcceptBtn.dataset.eventId, 'accepted');
    });

    modalDeclineBtn.addEventListener('click', () => {
        setAttendance(modalDeclineBtn.dataset.eventId, 'declined');
    });

    function setAttendance(eventId, status) {
        if (!loggedInUser) {
            responseArea.textContent = 'You must be logged in to accept or decline an event.';
            storyModal.style.display = 'none';
            return;
        }

        responseArea.textContent = `Setting status to ${status}...`;

        const attendanceData = {
            event_id: eventId,
            user_id: loggedInUser.acc_id,
            status: status
        };

        fetch('http://localhost:3000/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attendanceData)
        })
        .then(response => response.json())
        .then(data => {
            responseArea.textContent = JSON.stringify(data, null, 2);
        })
        .catch(handleError);
        
        storyModal.style.display = 'none';
    }

    // --- HELPER FUNCTIONS ---
    function handleError(error) {
        responseArea.textContent = `Error: ${error.message}\n\nIs your server running?`;
        console.error('Error:', error);
    }

    // This function handles all the UI changes on login
    function handleLogin(user) {
        // 1. Save user data
        loggedInUser = user; 

        // 2. Hide login forms
        loginRegisterArea.style.display = 'none';

        // 3. Show "Create Event" form
        eventForm.style.display = 'block';

        // 4. Update logged in user text in right sidebar
        loggedInUsername.textContent = loggedInUser.username;
        userProfileInfo.style.display = 'block';
    }

    // --- INITIAL LOAD ---
    // Load all stories when the page first loads
    fetchEvents();
});