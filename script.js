// This will store the user's data after they log in
let loggedInUser = null;

// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // --- GRAB ALL PAGE ELEMENTS ---
    const responseArea = document.getElementById('responseArea');
    const loginRegisterArea = document.getElementById('login-register-area');
    const eventForm = document.getElementById('event-form');
    const storyFeedContainer = document.getElementById('storyFeedContainer');
    const calendarView = document.getElementById('calendar-view');
    const calendarEventList = document.getElementById('calendar-event-list');
    
    // --- NEW: Main post feed container ---
    const mainFeedPostsContainer = document.getElementById('main-feed-posts');

    const homeButton = Array.from(document.querySelectorAll('.sidebar-menu-item strong'))
                            .find(el => el.textContent === 'Home').closest('.sidebar-menu-item');
    const myCalendarButton = document.getElementById('myCalendarButton');

    // Get right sidebar elements
    const userProfileInfo = document.getElementById('user-profile-info');
    const loggedInUsername = document.getElementById('loggedInUsername');
    
    // Get modal elements
    const storyModal = document.getElementById('storyModal');
    const modalClose = document.getElementById('modal-close');
    const modalEventName = document.getElementById('modal-eventName');
    const modalEventDetails = document.getElementById('modal-eventDetails');
    // Modal buttons are no longer needed here

    // --- REGISTRATION ---
    const registerButton = document.getElementById('registerButton');
    registerButton.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        responseArea.textContent = 'Registering...';
        fetch('http://localhost:3000/api/register', {
            method: 'POST',
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
                handleLogin(data.user);
            }
        })
        .catch(handleError);
    });

    // --- LOGOUT ---
    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => {
        loggedInUser = null;
        loginRegisterArea.style.display = 'block';
        eventForm.style.display = 'none';
        userProfileInfo.style.display = 'none';
        calendarView.style.display = 'none';
        mainFeedPostsContainer.style.display = 'none'; // Hide post feed
        storyFeedContainer.style.display = 'flex';
        responseArea.textContent = 'Logged out.';
        fetchEvents(); // Refresh feed
    });

    // --- NAVIGATION / PAGE SWITCHING (MODIFIED) ---
    homeButton.addEventListener('click', () => {
        storyFeedContainer.style.display = 'flex';
        mainFeedPostsContainer.style.display = 'flex'; // Show post feed
        calendarView.style.display = 'none';
        eventForm.style.display = 'none'; // Hide form

        if (loggedInUser) {
            loginRegisterArea.style.display = 'none';
        } else {
            loginRegisterArea.style.display = 'block';
            mainFeedPostsContainer.style.display = 'none'; // Hide feed if logged out
        }
        fetchEvents();
    });

    myCalendarButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'Please log in to see your calendar.';
            return;
        }
        storyFeedContainer.style.display = 'none';
        loginRegisterArea.style.display = 'none';
        eventForm.style.display = 'none';
        mainFeedPostsContainer.style.display = 'none'; // Hide post feed
        calendarView.style.display = 'block';
        fetchMyCalendar();
    });

    // --- CREATE EVENT (POST STORY) (MODIFIED) ---
    const createEventMenuButton = document.getElementById('createEventMenuButton');
    createEventMenuButton.addEventListener('click', () => {
        if (loggedInUser) {
            eventForm.style.display = 'block'; // Show form
            loginRegisterArea.style.display = 'none';
            calendarView.style.display = 'none';
            mainFeedPostsContainer.style.display = 'none'; // Hide post feed
            storyFeedContainer.style.display = 'flex';
        } else {
            responseArea.textContent = 'Please log in to create an event.';
        }
    });

    // (Create event button logic is unchanged)
    const createEventButton = document.getElementById('createEventButton');
    const eventImageInput = document.getElementById('eventImage');
    createEventButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'You must be logged in to create an event.';
            return;
        }
        const file = eventImageInput.files[0];
        if (!file) {
            postEvent(null);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => { postEvent(reader.result); };
        reader.onerror = () => { responseArea.textContent = "Error reading file."; };
        reader.readAsDataURL(file);
    });

    function postEvent(imageBase64) {
        responseArea.textContent = 'Creating event...';
        const eventData = {
            name: document.getElementById('eventName').value,
            description: document.getElementById('eventDesc').value,
            venue: document.getElementById('eventVenue').value,
            date: document.getElementById('eventDate').value,
            time: document.getElementById('eventTime').value,
            creator_id: loggedInUser.acc_id,
            image: imageBase64
        };

        fetch('http://localhost:3000/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        })
        .then(response => response.json())
        .then(data => {
            responseArea.textContent = JSON.stringify(data, null, 2);
            if (data.message === 'Event created successfully!') {
                document.getElementById('eventName').value = '';
                document.getElementById('eventDesc').value = '';
                document.getElementById('eventVenue').value = '';
                document.getElementById('eventDate').value = '';
                document.getElementById('eventTime').value = '';
                eventImageInput.value = '';
                homeButton.click(); // Click home to show the new post
            }
        })
        .catch(handleError);
    }
    
    // --- FETCH ALL EVENTS (HEAVILY MODIFIED) ---
    function fetchEvents() {
        // Only fetch if logged in
        if (!loggedInUser) {
            storyFeedContainer.innerHTML = '<p style="color: #a8a8a8;">Please log in to see events.</p>';
            mainFeedPostsContainer.innerHTML = '';
            return;
        }

        fetch('http://localhost:3000/api/events')
            .then(response => response.json())
            .then(events => {
                storyFeedContainer.innerHTML = ''; 
                mainFeedPostsContainer.innerHTML = ''; // Clear the post feed

                if (events.length === 0) {
                    storyFeedContainer.innerHTML = '<p style="color: #a8a8a8;">No stories posted.</p>';
                    mainFeedPostsContainer.innerHTML = '<p style="color: #a8a8a8; text-align: center; font-size: 16px;">No events posted yet.</p>';
                } else {
                    events.forEach(event => {
                        // 1. Build Story Circle (Unchanged)
                        const circle = document.createElement('div');
                        circle.className = 'story-circle';
                        circle.textContent = event.name.charAt(0).toUpperCase();
                        circle.dataset.event = JSON.stringify(event);
                        circle.addEventListener('click', openStoryModal);
                        storyFeedContainer.appendChild(circle);

                        // 2. Build Post Card
                        const postCard = document.createElement('div');
                        postCard.className = 'post-card';
                        
                        const eventDate = new Date(event.event_date).toLocaleDateString();
                        let imageHtml = '';
                        if (event.image_url) {
                            imageHtml = `<img src="${event.image_url}" alt="${event.name} Poster" class="post-card-image">`;
                        }

                        // Build the card's inner HTML
                        postCard.innerHTML = `
                            <div class="post-card-header">
                                <div class="post-card-header-img">${event.creator_username.charAt(0).toUpperCase()}</div>
                                <span class="post-card-header-name">${event.creator_username}</span>
                            </div>
                            ${imageHtml}
                            <div class="post-card-actions">
                                <button class="post-card-accept-btn" data-event-id="${event.event_id}">Accept</button>
                                <button class="post-card-decline-btn" data-event-id="${event.event_id}">Decline</button>
                            </div>
                            <div class="post-card-body">
                                <p class="title">${event.name}</p>
                                <p>${event.description}</p>
                                <p style="margin-top: 10px;"><strong>When:</strong> ${eventDate} at ${event.event_time}</p>
                                <p><strong>Where:</strong> ${event.venue}</p>
                            </div>
                        `;
                        
                        // Add listeners to the new buttons on the card
                        postCard.querySelector('.post-card-accept-btn').addEventListener('click', (e) => {
                            setAttendance(event.event_id, 'accepted');
                            // Give user feedback
                            e.currentTarget.style.backgroundColor = '#4a9c4a';
                            e.currentTarget.textContent = 'Accepted!';
                        });
                        postCard.querySelector('.post-card-decline-btn').addEventListener('click', (e) => {
                            setAttendance(event.event_id, 'declined');
                            // Give user feedback
                            const acceptBtn = e.currentTarget.parentElement.querySelector('.post-card-accept-btn');
                            acceptBtn.style.backgroundColor = '#5cb85c';
                            acceptBtn.textContent = 'Accept';
                        });
                        
                        mainFeedPostsContainer.appendChild(postCard);
                    });
                }
            })
            .catch(handleError);
    }

    // --- STORY MODAL LOGIC (MODIFIED) ---
    // The modal now just shows info, no buttons
    function openStoryModal(clickEvent) {
        const eventData = JSON.parse(clickEvent.currentTarget.dataset.event);
        const eventDate = new Date(eventData.event_date).toLocaleDateString();
        let imageHtml = '';
        if (eventData.image_url) {
            imageHtml = `
                <img 
                    src="${eventData.image_url}" 
                    alt="${eventData.name} Poster" 
                    style="width: 100%; border-radius: 8px; margin-bottom: 15px;"
                >
            `;
        }
        modalEventName.textContent = eventData.name;
        modalEventDetails.innerHTML = `
            ${imageHtml}
            <p><strong>By:</strong> ${eventData.creator_username}</p>
            <p><strong>When:</strong> ${eventDate} at ${eventData.event_time}</p>
            <p><strong>Where:</strong> ${eventData.venue}</p>
            <p>${eventData.description}</p>
        `;
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

    // --- ACCEPT / DECLINE (Unchanged, but now used by cards) ---
    function setAttendance(eventId, status) {
        if (!loggedInUser) {
            responseArea.textContent = 'You must be logged in to accept or decline an event.';
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
        
        // No longer need to close modal
    }

    // --- FETCH MY CALENDAR (MODIFIED) ---
    // Now uses the same post-card style
    function fetchMyCalendar() {
        if (!loggedInUser) return;

        responseArea.textContent = 'Loading your calendar...';
        calendarEventList.innerHTML = 'Loading...';

        fetch(`http://localhost:3000/api/my-calendar?user_id=${loggedInUser.acc_id}`)
            .then(response => response.json())
            .then(myEvents => {
                calendarEventList.innerHTML = ''; 
                
                if (myEvents.length === 0) {
                    calendarEventList.innerHTML = '<p style="color: #a8a8a8;">You have not accepted any events yet.</p>';
                    responseArea.textContent = 'Calendar empty.';
                    return;
                }

                myEvents.forEach(event => {
                    // Reuse the post-card style
                    const postCard = document.createElement('div');
                    postCard.className = 'post-card';
                    
                    const eventDate = new Date(event.event_date).toLocaleDateString();
                    let imageHtml = '';
                    if (event.image_url) {
                        imageHtml = `<img src="${event.image_url}" alt="${event.name} Poster" class="post-card-image">`;
                    }

                    postCard.innerHTML = `
                        <div class="post-card-header">
                            <div class="post-card-header-img">${event.creator_username.charAt(0).toUpperCase()}</div>
                            <span class="post-card-header-name">${event.creator_username}</span>
                        </div>
                        ${imageHtml}
                        <div class="post-card-body">
                            <p class="title">${event.name}</p>
                            <p><strong>When:</strong> ${eventDate} at ${event.event_time}</p>
                            <p><strong>Where:</strong> ${event.venue}</p>
                            <p style="color: #5cb85c; margin-top: 10px;">✔ You have accepted this event.</p>
                        </div>
                    `;
                    calendarEventList.appendChild(postCard);
                });

                responseArea.textContent = 'Calendar loaded.';
            })
            .catch(handleError);
    }

    // --- HELPER FUNCTIONS ---
    function handleError(error) {
        responseArea.textContent = `Error: ${error.message}\n\nIs your server running?`;
        console.error('Error:', error);
    }

    function handleLogin(user) {
        loggedInUser = user; 
        loginRegisterArea.style.display = 'none';
        
        userProfileInfo.style.display = 'block';
        loggedInUsername.textContent = loggedInUser.username;

        // Programmatically click "Home" to show the main feed
        homeButton.click(); 
    }

    // --- INITIAL LOAD ---
    // Show login screen, don't fetch events yet
    homeButton.click();
});