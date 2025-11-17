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
    const mainFeedPostsContainer = document.getElementById('main-feed-posts');

    // --- NEW: Profile Page Elements ---
    const profileView = document.getElementById('profile-view');
    const profileAvatarLetter = document.getElementById('profile-avatar-letter');
    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');
    const profileEventList = document.getElementById('profile-event-list');
    
    // Sidebar Buttons
    const homeButton = Array.from(document.querySelectorAll('.sidebar-menu-item strong'))
                            .find(el => el.textContent === 'Home').closest('.sidebar-menu-item');
    const myCalendarButton = document.getElementById('myCalendarButton');
    const createEventMenuButton = document.getElementById('createEventMenuButton');
    const myProfileButton = document.getElementById('myProfileButton'); // <-- NEW

    // Get right sidebar elements
    const userProfileInfo = document.getElementById('user-profile-info');
    const loggedInUsername = document.getElementById('loggedInUsername');
    
    // Get modal elements
    const storyModal = document.getElementById('storyModal');
    const modalClose = document.getElementById('modal-close');
    const modalEventName = document.getElementById('modal-eventName');
    const modalEventDetails = document.getElementById('modal-eventDetails');
    
    // Other form elements
    const registerButton = document.getElementById('registerButton');
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const createEventButton = document.getElementById('createEventButton');
    const eventImageInput = document.getElementById('eventImage');
    const eventAnonymousInput = document.getElementById('eventAnonymous');

    // --- REGISTRATION ---
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
    logoutButton.addEventListener('click', () => {
        loggedInUser = null;
        // Show login view
        showView('login');
        userProfileInfo.style.display = 'none';
        responseArea.textContent = 'Logged out.';
        fetchEvents(); // Refresh feed (will show "please log in")
    });

    // --- NAVIGATION / PAGE SWITCHING (MODIFIED) ---
    
    // Helper to show/hide main content views
    function showView(viewToShow) {
        // Hide all main views
        mainFeedPostsContainer.style.display = 'none';
        calendarView.style.display = 'none';
        eventForm.style.display = 'none';
        profileView.style.display = 'none';
        loginRegisterArea.style.display = 'none';
        storyFeedContainer.style.display = 'none'; // Hide story feed by default

        // Show the requested view
        if (viewToShow === 'home') {
            storyFeedContainer.style.display = 'flex';
            mainFeedPostsContainer.style.display = 'flex';
        } else if (viewToShow === 'calendar') {
            calendarView.style.display = 'block';
        } else if (viewToShow === 'create') {
            storyFeedContainer.style.display = 'flex';
            eventForm.style.display = 'block';
        } else if (viewToShow === 'profile') {
            profileView.style.display = 'block';
        } else if (viewToShow === 'login') {
            storyFeedContainer.style.display = 'flex';
            loginRegisterArea.style.display = 'block';
        }
    }

    homeButton.addEventListener('click', () => {
        if (loggedInUser) {
            showView('home');
            fetchEvents();
        } else {
            showView('login');
        }
    });

    myCalendarButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'Please log in to see your calendar.';
            return;
        }
        showView('calendar');
        fetchMyCalendar();
    });

    createEventMenuButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'Please log in to create an event.';
            return;
        }
        showView('create');
    });
    
    // --- NEW: Profile Button Listener ---
    myProfileButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'Please log in to see your profile.';
            return;
        }
        // Show our own profile page
        showProfilePage(loggedInUser.acc_id);
    });

    // --- CREATE EVENT (POST STORY) (MODIFIED) ---
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
            image: imageBase64,
            is_anonymous: eventAnonymousInput.checked // <-- Send anonymous flag
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
                // Clear form
                document.getElementById('eventName').value = '';
                document.getElementById('eventDesc').value = '';
                document.getElementById('eventVenue').value = '';
                document.getElementById('eventDate').value = '';
                document.getElementById('eventTime').value = '';
                eventImageInput.value = '';
                eventAnonymousInput.checked = false; // <-- Reset checkbox
                
                homeButton.click(); // Click home to show the new post
            }
        })
        .catch(handleError);
    }
    
    // --- FETCH ALL EVENTS (MODIFIED) ---
    function fetchEvents() {
        if (!loggedInUser) {
            storyFeedContainer.innerHTML = '<p style="color: #a8a8a8;">Please log in to see events.</p>';
            mainFeedPostsContainer.innerHTML = '';
            return;
        }

        fetch('http://localhost:3000/api/events')
            .then(response => response.json())
            .then(events => {
                storyFeedContainer.innerHTML = ''; 
                mainFeedPostsContainer.innerHTML = '';

                if (events.length === 0) {
                    storyFeedContainer.innerHTML = '<p style="color: #a8a8a8;">No stories posted.</p>';
                    mainFeedPostsContainer.innerHTML = '<p style="color: #a8a8a8; text-align: center; font-size: 16px;">No events posted yet.</p>';
                } else {
                    events.forEach(event => {
                        // 1. Build Story Circle
                        const circle = document.createElement('div');
                        circle.className = 'story-circle';
                        circle.textContent = event.name.charAt(0).toUpperCase();
                        circle.dataset.event = JSON.stringify(event);
                        circle.addEventListener('click', openStoryModal);
                        storyFeedContainer.appendChild(circle);

                        // 2. Build Post Card
                        const postCard = buildPostCard(event);
                        
                        // --- NEW: Make username clickable IF NOT anonymous ---
                        const usernameElement = postCard.querySelector('.post-card-header-name');
                        if (event.creator_id !== 0) { // 0 is our anonymous ID
                            usernameElement.classList.add('clickable');
                            usernameElement.addEventListener('click', () => {
                                showProfilePage(event.creator_id);
                            });
                        } else {
                             usernameElement.classList.add('anonymous');
                        }
                        
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
        // Use the creator_username from the event data (which could be "Anonymous")
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

    // --- ACCEPT / DECLINE ---
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
    }

    // --- FETCH MY CALENDAR (MODIFIED) ---
    // Now re-uses the buildPostCard function
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
                    // Reuse the post-card builder!
                    const postCard = buildPostCard(event);
                    
                    // Remove the action buttons, add a "Accepted" status
                    postCard.querySelector('.post-card-actions').innerHTML = `
                        <p style="color: #5cb85c; margin-top: 10px; padding: 0 15px;">✔ You have accepted this event.</p>
                    `;
                    calendarEventList.appendChild(postCard);
                });

                responseArea.textContent = 'Calendar loaded.';
            })
            .catch(handleError);
    }

    // --- NEW: Re-usable Post Card Builder ---
    function buildPostCard(event) {
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
        
        // Add listeners to the buttons (if they exist)
        const acceptBtn = postCard.querySelector('.post-card-accept-btn');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', (e) => {
                setAttendance(event.event_id, 'accepted');
                e.currentTarget.style.backgroundColor = '#4a9c4a';
                e.currentTarget.textContent = 'Accepted!';
            });
            postCard.querySelector('.post-card-decline-btn').addEventListener('click', (e) => {
                setAttendance(event.event_id, 'declined');
                acceptBtn.style.backgroundColor = '#5cb85c';
                acceptBtn.textContent = 'Accept';
            });
        }
        
        return postCard;
    }

    // --- NEW: Show Profile Page Function ---
    function showProfilePage(userId) {
        if (!loggedInUser) return;
        
        responseArea.textContent = 'Loading profile...';
        profileEventList.innerHTML = 'Loading posts...';
        showView('profile'); // Switch to the profile view

        fetch(`http://localhost:3000/api/users/${userId}/events`)
            .then(response => response.json())
            .then(data => {
                if (data.message) { // Handle errors like "User not found"
                   responseArea.textContent = data.message;
                   profileEventList.innerHTML = `<p style="color: #a8a8a8;">${data.message}</p>`;
                   return;
                }

                const profile = data.profile;
                const events = data.events;

                // 1. Fill profile header
                profileUsername.textContent = profile.username;
                profileAvatarLetter.textContent = profile.username.charAt(0).toUpperCase();
                profileEmail.textContent = profile.email || ''; // Assuming email is fetched (we'll add it)

                // 2. Fill profile event list
                profileEventList.innerHTML = '';
                if (events.length === 0) {
                    profileEventList.innerHTML = '<p style="color: #a8a8a8;">This user has not posted any events.</p>';
                } else {
                    events.forEach(event => {
                        const postCard = buildPostCard(event);
                        profileEventList.appendChild(postCard);
                    });
                }
                responseArea.textContent = `Profile for ${profile.username} loaded.`;
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
    // Start on the home/login page
    homeButton.click();
});