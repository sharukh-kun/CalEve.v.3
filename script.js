// This will store the user's data after they log in
let loggedInUser = null;

// --- NEW: Calendar global variables ---
let currentViewDate = new Date();
let myAcceptedEvents = []; // Caches all accepted events
let allEventsCache = []; // Caches all events for the feed
let selectedDayDiv = null;

// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // --- GRAB ALL PAGE ELEMENTS ---
    // Login Page
    const loginPage = document.getElementById('login-page');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginResponseArea = document.getElementById('login-response-area');

    // Main App
    const mainContainer = document.getElementById('main-container');
    const responseArea = document.getElementById('responseArea');
    const loginRegisterArea = document.getElementById('login-register-area');
    const eventForm = document.getElementById('event-form');
    const storyFeedContainer = document.getElementById('storyFeedContainer');
    const mainFeedPostsContainer = document.getElementById('main-feed-posts');

    // Calendar View Elements
    const calendarView = document.getElementById('calendar-view');
    const calendarGridBody = document.getElementById('calendar-grid-body');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const prevMonthButton = document.getElementById('calendar-prev-month');
    const nextMonthButton = document.getElementById('calendar-next-month');
    const sidebarDate = document.getElementById('sidebar-date');
    const sidebarEventList = document.getElementById('sidebar-event-list');

    // Profile Page Elements
    const profileView = document.getElementById('profile-view');
    const profileAvatarLetter = document.getElementById('profile-avatar-letter');
    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');
    const profileEventList = document.getElementById('profile-event-list');
    
    // Sidebar Buttons
    const homeButton = document.getElementById('homeButton');
    const myCalendarButton = document.getElementById('myCalendarButton');
    const createEventMenuButton = document.getElementById('createEventMenuButton');
    const myProfileButton = document.getElementById('myProfileButton');

    // Right Sidebar
    const userProfileInfo = document.getElementById('user-profile-info');
    const loggedInUsername = document.getElementById('loggedInUsername');
    
    // Modals
    const storyModal = document.getElementById('storyModal');
    const modalClose = document.getElementById('modal-close');
    const modalEventName = document.getElementById('modal-eventName');
    const modalEventDetails = document.getElementById('modal-eventDetails');
    const clashModal = document.getElementById('clash-modal');
    const clashOptions = document.getElementById('clash-options');
    const clashCancelBtn = document.getElementById('clash-cancel-btn');
    const chatModal = document.getElementById('chat-modal');
    const chatModalClose = document.getElementById('chat-modal-close');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatShieldBtn = document.getElementById('chat-shield-btn');
    const chatEventName = document.getElementById('chat-event-name');
    
    // Form Elements
    const registerButton = document.getElementById('registerButton');
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const createEventButton = document.getElementById('createEventButton');
    const eventImageInput = document.getElementById('eventImage');
    const eventAnonymousInput = document.getElementById('eventAnonymous');

    // Chat state
    let currentChatId = null;
    let currentChatEventId = null;
    let chatPollInterval = null;
    
    // --- 1. INITIAL APP LOAD & PERSISTENT LOGIN ---
    
    function checkLoginState() {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            loggedInUser = JSON.parse(storedUser);
            handleLogin(loggedInUser, true); // Pass 'true' to skip re-fetching
            showView('home');
            fetchEvents();
        } else {
            loggedInUser = null;
            mainContainer.style.display = 'none';
            loginPage.style.display = 'flex';
        }
    }

    // --- 2. AUTHENTICATION (Login, Register, Logout) ---

    registerButton.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        loginResponseArea.style.display = 'block';
        loginResponseArea.textContent = 'Registering...';
        
        fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        })
        .then(response => response.json())
        .then(data => {
            loginResponseArea.textContent = JSON.stringify(data, null, 2);
            if (data.message === 'User registered successfully!') {
                document.getElementById('username').value = '';
                document.getElementById('email').value = '';
                document.getElementById('password').value = '';
            }
        })
        .catch(handleLoginError);
    });

    loginButton.addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        loginResponseArea.style.display = 'block';
        loginResponseArea.textContent = 'Logging in...';

        fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            loginResponseArea.textContent = JSON.stringify(data, null, 2);
            if (data.message === 'Login successful!') {
                document.getElementById('loginEmail').value = '';
                document.getElementById('loginPassword').value = '';
                handleLogin(data.user);
            }
        })
        .catch(handleLoginError);
    });

    logoutButton.addEventListener('click', () => {
        loggedInUser = null;
        localStorage.removeItem('loggedInUser'); // Clear persistent login
        mainContainer.style.display = 'none'; // Hide app
        loginPage.style.display = 'flex'; // Show login
        userProfileInfo.style.display = 'none';
        responseArea.textContent = 'Logged out.';
        loginResponseArea.textContent = 'You are logged out.';
        loginResponseArea.style.display = 'block';
    });

    // --- 3. NAVIGATION / PAGE SWITCHING ---
    
    function showView(viewToShow) {
        // Hide all main views
        mainFeedPostsContainer.style.display = 'none';
        calendarView.style.display = 'none';
        eventForm.style.display = 'none';
        profileView.style.display = 'none';
        storyFeedContainer.style.display = 'none'; 

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
        }
    }

    homeButton.addEventListener('click', () => {
        showView('home');
        fetchEvents();
    });

    myCalendarButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'Please log in to see your calendar.';
            return;
        }
        showView('calendar');
        loadCalendarForDate(currentViewDate);
    });

    createEventMenuButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'Please log in to create an event.';
            return;
        }
        showView('create');
    });
    
    myProfileButton.addEventListener('click', () => {
        if (!loggedInUser) {
            responseArea.textContent = 'Please log in to see your profile.';
            return;
        }
        showProfilePage(loggedInUser.acc_id);
    });

    // --- 4. CORE FEATURES (Create, Fetch, Build Posts) ---

    createEventButton.addEventListener('click', () => {
        const eventName = document.getElementById('eventName').value;
        const eventDesc = document.getElementById('eventDesc').value;
        const eventVenue = document.getElementById('eventVenue').value;
        const eventDate = document.getElementById('eventDate').value;
        const eventTime = document.getElementById('eventTime').value;
        const isAnonymous = eventAnonymousInput.checked;
        const imageFile = eventImageInput.files[0];

        if (!eventName || !eventDate || !eventTime) {
            responseArea.textContent = 'Event Name, Date, and Time are required!';
            return;
        }

        responseArea.textContent = 'Creating event...';

        if (imageFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Image = reader.result;
                postEvent(base64Image, isAnonymous);
            };
            reader.readAsDataURL(imageFile);
        } else {
            postEvent(null, isAnonymous);
        }
    });

    function postEvent(imageBase64, isAnonymous) {
        const eventData = {
            name: document.getElementById('eventName').value,
            description: document.getElementById('eventDesc').value,
            venue: document.getElementById('eventVenue').value,
            date: document.getElementById('eventDate').value,
            time: document.getElementById('eventTime').value,
            creator_id: loggedInUser.acc_id,
            image: imageBase64,
            is_anonymous: isAnonymous
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
                eventAnonymousInput.checked = false;
                fetchEvents();
            }
        })
        .catch(handleError);
    }
    
    function fetchEvents() {
        if (!loggedInUser) {
            storyFeedContainer.innerHTML = '<p style="color: #a8a8a8;">Please log in to see events.</p>';
            mainFeedPostsContainer.innerHTML = '';
            return;
        }

        fetch('http://localhost:3000/api/events')
            .then(response => response.json())
            .then(events => {
                allEventsCache = events; // Cache all events
                storyFeedContainer.innerHTML = ''; 
                mainFeedPostsContainer.innerHTML = '';

                if (events.length === 0) {
                    storyFeedContainer.innerHTML = '<p style="color: #a8a8a8;">No events yet. Create one!</p>';
                    mainFeedPostsContainer.innerHTML = '<p style="color: #a8a8a8; text-align: center;">No events to display.</p>';
                } else {
                    events.forEach(event => {
                        // 1. Build Story Circle
                        const circle = document.createElement('div');
                        circle.className = 'story-circle';
                        circle.textContent = event.name.charAt(0).toUpperCase();
                        circle.dataset.event = JSON.stringify(event);
                        circle.addEventListener('click', () => openEventModal(event));
                        storyFeedContainer.appendChild(circle);

                        // 2. Build Post Card
                        const postCard = buildPostCard(event);
                        
                        const usernameElement = postCard.querySelector('.post-card-header-name');
                        if (event.creator_id !== 0) { 
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

    // --- 5. MODAL & ATTENDANCE LOGIC (WITH CLASH DETECTION) ---

    // Generic function to open the modal with any event object
    function openEventModal(eventData) {
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
            <p><strong>When:</strong> <span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mrow><mi>e</mi><mi>v</mi><mi>e</mi><mi>n</mi><mi>t</mi><mi>D</mi><mi>a</mi><mi>t</mi><mi>e</mi></mrow><mi>a</mi><mi>t</mi></mrow><annotation encoding="application/x-tex">${eventDate} at </annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.6833em;"></span><span class="mord"><span class="mord mathnormal">e</span><span class="mord mathnormal" style="margin-right:0.03588em;">v</span><span class="mord mathnormal">e</span><span class="mord mathnormal">n</span><span class="mord mathnormal">t</span><span class="mord mathnormal" style="margin-right:0.02778em;">D</span><span class="mord mathnormal">a</span><span class="mord mathnormal">t</span><span class="mord mathnormal">e</span></span><span class="mord mathnormal">a</span><span class="mord mathnormal">t</span></span></span></span>${eventData.event_time}</p>
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

    // --- MODIFIED: setAttendance now checks for clashes ---
    async function setAttendance(eventId, status) {
        if (!loggedInUser || status !== 'accepted') {
            // If declining, just do it. No clash check needed.
            return sendAttendanceRequest(eventId, status);
        }

        responseArea.textContent = 'Checking calendar for clashes...';
        
        // 1. Get the event we're trying to accept
        const newEvent = allEventsCache.find(e => e.event_id === eventId);
        if (!newEvent) {
            handleError(new Error("Event not found in cache."));
            return;
        }
        
        // 2. Fetch all currently accepted events to check against
        const myCalendar = await fetchMyCalendarData();
        
        // 3. Find a clash (compare epoch ms of date+time)
        const newEventTime = new Date(`${newEvent.event_date}T${newEvent.event_time}`).getTime();
        const clashingEvent = myCalendar.find(event => {
            const existingEventTime = new Date(`${event.event_date}T${event.event_time}`).getTime();
            // Simple check: are they at the exact same date and time?
            return existingEventTime === newEventTime;
        });

        // 4. Handle the result
        if (clashingEvent) {
            // CLASH DETECTED!
            responseArea.textContent = "Clash detected!";
            showClashModal(newEvent, clashingEvent);
        } else {
            // NO CLASH. Just accept it.
            responseArea.textContent = "No clash. Accepting event...";
            sendAttendanceRequest(eventId, 'accepted');
        }
    }
    
    // This is the actual fetch request
    function sendAttendanceRequest(eventId, status) {
        if (!loggedInUser) return;
        
    responseArea.textContent = `Setting status to ${status}...`;
        const attendanceData = { event_id: eventId, user_id: loggedInUser.acc_id, status: status };

        fetch('http://localhost:3000/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attendanceData)
        })
        .then(response => response.json())
        .then(data => {
            responseArea.textContent = JSON.stringify(data, null, 2);
            // Refresh calendar data in background if it was successful
            if (data.message.includes('updated')) {
                fetchMyCalendarData().then(events => {
                    myAcceptedEvents = events;
                    // Re-render calendar if it's visible
                    if (calendarView.style.display === 'block') {
                        loadCalendarForDate(currentViewDate);
                    }
                });
            }
        })
        .catch(handleError);
    }

    // --- NEW: Clash Modal Logic ---
    function showClashModal(newEvent, existingEvent) {
        clashOptions.innerHTML = ''; // Clear old options
        
        // Option 1: Keep the new event
    const newEventBtn = document.createElement('button');
    newEventBtn.textContent = `Accept: ${newEvent.name} (Declines the other)`;
        newEventBtn.style.backgroundColor = '#0095f6';
        newEventBtn.onclick = () => {
            sendAttendanceRequest(newEvent.event_id, 'accepted');
            sendAttendanceRequest(existingEvent.event_id, 'declined');
            clashModal.style.display = 'none';
        };

        // Option 2: Keep the existing event
    const existingEventBtn = document.createElement('button');
    existingEventBtn.textContent = `Keep: ${existingEvent.name} (Don't accept new one)`;
        existingEventBtn.style.backgroundColor = '#5cb85c';
        existingEventBtn.onclick = () => {
            // We just don't do anything to the new event
            clashModal.style.display = 'none';
        };
        
        clashOptions.appendChild(newEventBtn);
        clashOptions.appendChild(existingEventBtn);
        clashModal.style.display = 'flex';
    }
    clashCancelBtn.addEventListener('click', () => {
        clashModal.style.display = 'none';
    });


    // --- 6. GOOGLE-STYLE CALENDAR LOGIC (ALL NEW) ---
    
    // Add listeners for month navigation
    prevMonthButton.addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        loadCalendarForDate(currentViewDate);
    });
    nextMonthButton.addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        loadCalendarForDate(currentViewDate);
    });

    // Main function to fetch data and build the grid
    async function loadCalendarForDate(date) {
        if (!loggedInUser) return;
        responseArea.textContent = 'Loading your calendar...';
        calendarGridBody.innerHTML = 'Loading...';

        // Fetch all accepted events
        myAcceptedEvents = await fetchMyCalendarData();
        if (!myAcceptedEvents) return; // Error was handled in fetch

        responseArea.textContent = 'Calendar loaded.';
        calendarMonthYear.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // --- Build the Grid ---
        calendarGridBody.innerHTML = ''; // Clear
        const today = new Date();
        const month = date.getMonth();
        const year = date.getFullYear();

        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dateString = firstDayOfMonth.toLocaleDateString('en-us', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' });
        const paddingDays = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday...

        // 1. Add padding days
        for (let i = 0; i < paddingDays; i++) {
            calendarGridBody.innerHTML += '<div class="calendar-day padding"></div>';
        }

        // 2. Add real days
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day');
            
            const thisDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // Check if this day is today
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayDiv.classList.add('today');
            }
            
            // Add day number
            dayDiv.innerHTML = `<div class="day-number">${day}</div>`;
            
            // Check for events on this day
            const eventsOnThisDay = myAcceptedEvents.filter(event => {
                const eventDate = event.event_date.split('T')[0]; // Handle SQL ISO date
                return eventDate === thisDateStr;
            });

            if (eventsOnThisDay.length > 0) {
                eventsOnThisDay.forEach(() => {
                    dayDiv.innerHTML += '<div class="calendar-event-dot"></div>';
                });
            }
            
            // Add click listener
            dayDiv.addEventListener('click', () => {
                // Remove 'selected' from old div
                if (selectedDayDiv) {
                    selectedDayDiv.classList.remove('selected');
                }
                // Add 'selected' to new div
                selectedDayDiv = dayDiv;
                selectedDayDiv.classList.add('selected');
                
                // Show events in sidebar
                loadEventsForDay(day, month, year, eventsOnThisDay);
            });

            calendarGridBody.appendChild(dayDiv);
        }
    }

    // New helper to fetch calendar data
    async function fetchMyCalendarData() {
        if (!loggedInUser) return [];
        try {
            const response = await fetch(`http://localhost:3000/api/my-calendar?user_id=${loggedInUser.acc_id}`);
            const myEvents = await response.json();
            if (myEvents.message) {
                handleError(new Error(myEvents.message));
                return [];
            }
            return myEvents;
        } catch (error) {
            handleError(error);
            return [];
        }
    }
    
    // New helper to show clicked day's events in the sidebar
    function loadEventsForDay(day, month, year, eventsOnThisDay) {
        sidebarDate.textContent = `${String(month + 1)}/${day}/${year}`;
        sidebarEventList.innerHTML = ''; // Clear

        if (eventsOnThisDay.length === 0) {
            sidebarEventList.innerHTML = '<li style="background: none; border: none; color: #a8a8a8;">No events.</li>';
            return;
        }

        eventsOnThisDay.forEach(event => {
            const eventLi = document.createElement('li');
            eventLi.textContent = `${event.event_time.substring(0, 5)} ${event.name}`;
            eventLi.addEventListener('click', () => openEventModal(event));
            sidebarEventList.appendChild(eventLi);
        });
    }

    // --- 7. PROFILE PAGE & HELPERS ---
    
    // (buildPostCard is now a shared helper)
    function buildPostCard(event) {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        const eventDate = new Date(event.event_date).toLocaleDateString();
        let imageHtml = '';
        if (event.image_url) {
            imageHtml = `<img src="${event.image_url}" alt="${event.name} Poster" class="post-card-image">`;
        }
        let messageButtonHtml = '';
        if (event.creator_id === 0 && loggedInUser && event.real_creator_id !== loggedInUser.acc_id) {
            messageButtonHtml = `<button class="post-card-message-btn" data-event-id="${event.event_id}">Message Creator</button>`;
        }

        postCard.innerHTML = `
            <div class="post-card-header">
                <div class="post-card-header-img">${event.creator_username ? event.creator_username.charAt(0).toUpperCase() : ''}</div>
                <span class="post-card-header-name">${event.creator_username}</span>
            </div>
            ${imageHtml}
            <div class="post-card-body">
                <p class="title">${event.name}</p>
                <p>${event.description}</p>
                <p style="margin-top: 10px;"><strong>When:</strong> ${eventDate} at ${event.event_time}</p>
                <p><strong>Where:</strong> ${event.venue}</p>
                <div class="post-card-actions">
                    <button class="post-card-accept-btn" data-event-id="${event.event_id}">Accept</button>
                    <button class="post-card-decline-btn" data-event-id="${event.event_id}">Decline</button>
                    ${messageButtonHtml}
                </div>
            </div>
        `;
        
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

        // Add message button listener
        const messageBtn = postCard.querySelector('.post-card-message-btn');
        if (messageBtn) {
            messageBtn.addEventListener('click', () => {
                openChatModal(event.event_id, event.name);
            });
        }

        return postCard;
    }

    function showProfilePage(userId) {
        if (!loggedInUser) {
            responseArea.textContent = 'Please log in to view profiles.';
            return;
        }

        if (userId === 0) {
            responseArea.textContent = 'Cannot view profile for Anonymous user.';
            return;
        }

        responseArea.textContent = 'Loading profile...';
        
        fetch(`http://localhost:3000/api/users/${userId}/events`)
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    responseArea.textContent = data.message;
                    return;
                }

                const profile = data.profile;
                const events = data.events;

                profileAvatarLetter.textContent = profile.username.charAt(0).toUpperCase();
                profileUsername.textContent = profile.username;
                profileEmail.textContent = profile.email;

                profileEventList.innerHTML = '';
                if (events.length === 0) {
                    profileEventList.innerHTML = '<p style="color: #a8a8a8; text-align: center;">No public events yet.</p>';
                } else {
                    events.forEach(event => {
                        const postCard = buildPostCard(event);
                        profileEventList.appendChild(postCard);
                    });
                }

                showView('profile');
                responseArea.textContent = 'Profile loaded.';
            })
            .catch(handleError);
    }

    // --- 8. ANONYMOUS CHAT SYSTEM ---

    function openChatModal(eventId, eventName) {
        currentChatEventId = eventId;
        chatEventName.textContent = eventName;
        chatMessages.innerHTML = '<p style="color: #a8a8a8;">Loading chat...</p>';
        chatInput.value = '';
        chatModal.style.display = 'flex';

        // Create or get chat session
        fetch('http://localhost:3000/api/chats/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_id: eventId,
                requester_id: loggedInUser.acc_id
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.chat_id) {
                currentChatId = data.chat_id;
                loadChatMessages();
                // Start polling for new messages
                if (chatPollInterval) clearInterval(chatPollInterval);
                chatPollInterval = setInterval(loadChatMessages, 3000);
            } else {
                chatMessages.innerHTML = `<p style="color: #ed4956;">${data.message}</p>`;
            }
        })
        .catch(error => {
            chatMessages.innerHTML = `<p style="color: #ed4956;">Error: ${error.message}</p>`;
        });
    }

function loadChatMessages() {
        if (!currentChatId) return;

        fetch(`http://localhost:3000/api/chats/${currentChatId}/messages`)
            .then(response => response.json())
            .then(data => {
                if (data.messages) {
                    displayChatMessages(data.messages, data.both_revealed, data.user_a_id, data.user_b_id, data.user_a_revealed, data.user_b_revealed);
                }
            })
            .catch(error => {
                console.error('Error loading messages:', error);
            });
    }

    function displayChatMessages(messages, bothRevealed, userAId, userBId, userARevealed, userBRevealed) {
        chatMessages.innerHTML = '';

        if (messages.length === 0) {
            chatMessages.innerHTML = '<p style="color: #a8a8a8;">No messages yet. Start the conversation!</p>';
            return;
        }

        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            
            const isMyMessage = msg.sender_id === loggedInUser.acc_id;
            messageDiv.classList.add(isMyMessage ? 'my-message' : 'their-message');

            let senderName = 'Anonymous';
            if (bothRevealed) {
                senderName = msg.sender_username;
            } else if (isMyMessage) {
                senderName = 'You';
            }

            const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            messageDiv.innerHTML = `
                <div class="message-sender">${senderName}</div>
                <div class="message-text">${msg.message_text}</div>
                <div class="message-time">${timestamp}</div>
            `;

            chatMessages.appendChild(messageDiv);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Update shield button status
        const myRevealed = (loggedInUser.acc_id === userAId && userARevealed) || 
                          (loggedInUser.acc_id === userBId && userBRevealed);
        
        if (bothRevealed) {
            chatShieldBtn.textContent = '✓ Identities Revealed';
            chatShieldBtn.disabled = true;
            chatShieldBtn.style.backgroundColor = '#4a9c4a';
        } else if (myRevealed) {
            chatShieldBtn.textContent = 'Waiting for other user...';
            chatShieldBtn.disabled = true;
            chatShieldBtn.style.backgroundColor = '#a8a8a8';
        } else {
            chatShieldBtn.textContent = '🛡 Reveal Identity';
            chatShieldBtn.disabled = false;
            chatShieldBtn.style.backgroundColor = '#0095f6';
        }
    }

    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    function sendChatMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText || !currentChatId) return;

        fetch(`http://localhost:3000/api/chats/${currentChatId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_id: loggedInUser.acc_id,
                message_text: messageText
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'Message sent successfully!') {
                chatInput.value = '';
                loadChatMessages();
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
        });
    }

    chatShieldBtn.addEventListener('click', () => {
        if (!currentChatId) return;

        fetch(`http://localhost:3000/api/chats/${currentChatId}/reveal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: loggedInUser.acc_id
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                loadChatMessages();
            }
        })
        .catch(error => {
            console.error('Error revealing identity:', error);
        });
    });

    chatModalClose.addEventListener('click', () => {
        chatModal.style.display = 'none';
        if (chatPollInterval) {
            clearInterval(chatPollInterval);
            chatPollInterval = null;
        }
        currentChatId = null;
        currentChatEventId = null;
    });

    chatModal.addEventListener('click', (e) => {
        if (e.target === chatModal) {
            chatModal.style.display = 'none';
            if (chatPollInterval) {
                clearInterval(chatPollInterval);
                chatPollInterval = null;
            }
            currentChatId = null;
            currentChatEventId = null;
        }
    });

    // --- 9. GLOBAL HELPER FUNCTIONS ---

    function handleError(error) {
        responseArea.textContent = `Error: ${error.message}\n\nIs your server running?`;
        console.error('Error:', error);
    }
    
    function handleLoginError(error) {
        loginResponseArea.textContent = `Error: ${error.message}\n\nIs your server running?`;
        console.error('Error:', error);
    }

    function handleLogin(user, isReload = false) {
        loggedInUser = user; 
        localStorage.setItem('loggedInUser', JSON.stringify(user)); // Save to localStorage
        
        // Hide login page, show app
        loginPage.style.display = 'none';
        mainContainer.style.display = 'flex';
        
        userProfileInfo.style.display = 'block';
        loggedInUsername.textContent = loggedInUser.username;

        if (!isReload) {
            // Programmatically click "Home" to show the main feed
            homeButton.click(); 
        }
    }

    // --- 10. INITIAL LOAD ---
    checkLoginState();
});
