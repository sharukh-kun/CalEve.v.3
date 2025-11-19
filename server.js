// 1. Import all the packages
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');

// 2. Load Environment Variables
dotenv.config();

// 3. Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 4. Set up the Express app and port
const app = express();
const PORT = 3000;

// 5. Set up Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for images

// 6. Create the connection pool to your MySQL database
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'caleve',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// --- API ENDPOINTS ---

// 7. Test API endpoint
app.get('/api/test', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users');
        res.status(200).json({
            message: 'Database connection is working!',
            usersFound: rows
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error connecting to the database.',
            error: error.message
        });
    }
});

// 8. User Registration
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required!' });
    }
    try {
        const plainTextPassword = password;
        const sql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
        await pool.query(sql, [username, email, plainTextPassword]);
        console.log('New user registered:', email);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email or username already exists.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});

// 9. User Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required!' });
    }
    try {
        const sql = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await pool.query(sql, [email]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found. Please register.' });
        }
        const user = rows[0];
        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Account is deactivated or banned.' });
        }
        if (password === user.password_hash) {
            console.log('Successful login for:', email);
            res.status(200).json({
                message: 'Login successful!',
                user: { acc_id: user.acc_id, username: user.username, email: user.email }
            });
        } else {
            console.warn('Invalid password attempt for:', email);
            res.status(401).json({ message: 'Invalid password.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});

// 10. Create a new Event (MODIFIED for Anonymous)
app.post('/api/events', async (req, res) => {
    const { name, description, venue, date, time, creator_id, image, is_anonymous } = req.body;

    if (!name || !date || !time || !creator_id) {
        return res.status(400).json({ message: 'Event Name, Date, Time, and Creator ID are required.' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const eventSql = `
            INSERT INTO events 
            (name, description, venue, event_date, event_time, creator_id, is_anonymous) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [eventResult] = await connection.query(eventSql, [name, description, venue, date, time, creator_id, is_anonymous || false]);

        const newEventId = eventResult.insertId;
        let imageUrl = null;

        if (image) {
            console.log('Image provided, uploading to Cloudinary...');
            const uploaded = await cloudinary.uploader.upload(image, {
                folder: "caleve_events",
                public_id: `event_${newEventId}`,
                overwrite: true,
                resource_type: "image",
            });
            imageUrl = uploaded.secure_url;
            console.log('Upload successful:', imageUrl);

            const imageSql = `
                INSERT INTO event_images (event_id, image_url)
                VALUES (?, ?)
            `;
            await connection.query(imageSql, [newEventId, imageUrl]);
        }

        await connection.commit();

        console.log('New event created by user:', creator_id);
        res.status(201).json({
            message: 'Event created successfully!',
            event_id: newEventId,
            image_url: imageUrl
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create Event error (rolling back):', error);
        res.status(500).json({ message: 'Server error during event creation.', error: error.message });
    } finally {
        connection.release();
    }
});

// 11. Get all Events (MODIFIED for Anonymous + real_creator_id for chat)
app.get('/api/events', async (req, res) => {
    try {
        const sql = `
            SELECT 
                events.*, 
                (CASE
                    WHEN events.is_anonymous = 1 THEN 'Anonymous'
                    ELSE users.username
                END) AS creator_username,
                (CASE
                    WHEN events.is_anonymous = 1 THEN 0
                    ELSE events.creator_id
                END) AS creator_id,
                events.creator_id AS real_creator_id,
                event_images.image_url 
            FROM events
            JOIN users ON events.creator_id = users.acc_id
            LEFT JOIN event_images ON events.event_id = event_images.event_id
            WHERE users.status = 'active'
            ORDER BY events.event_date, events.event_time ASC
        `;
        const [events] = await pool.query(sql);
        res.status(200).json(events);
    } catch (error) {
        console.error('Get Events error:', error);
        res.status(500).json({ message: 'Server error when fetching events.', error: error.message });
    }
});

// 12. Set Attendance
app.post('/api/attendance', async (req, res) => {
    const { event_id, user_id, status } = req.body;
    if (!event_id || !user_id || !status) {
        return res.status(400).json({ message: 'Event ID, User ID, and Status are required.' });
    }
    if (status !== 'accepted' && status !== 'declined') {
        return res.status(400).json({ message: "Status must be 'accepted' or 'declined'." });
    }
    try {
        const sql = `
            INSERT INTO event_attendance (event_id, user_id, status)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE status = ?
        `;
        await pool.query(sql, [event_id, user_id, status, status]);

        console.log(`User ${user_id} set status ${status} for event ${event_id}`);
        res.status(200).json({ message: `Event status updated to ${status}.` });

    } catch (error) {
        console.error('Set Attendance error:', error);
        res.status(500).json({ message: 'Server error when setting attendance.', error: error.message });
    }
});

// 13. Get Personal Calendar
app.get('/api/my-calendar', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ message: 'A user_id query parameter is required.' });
    }

    try {
        const sql = `
            SELECT 
                events.*, 
                users.username AS creator_username,
                event_images.image_url
            FROM events
            JOIN event_attendance ON events.event_id = event_attendance.event_id
            JOIN users ON events.creator_id = users.acc_id
            LEFT JOIN event_images ON events.event_id = event_images.event_id
            WHERE 
                event_attendance.user_id = ? 
                AND event_attendance.status = 'accepted'
            ORDER BY events.event_date, events.event_time ASC
        `;
        
        const [myEvents] = await pool.query(sql, [user_id]);
        res.status(200).json(myEvents);

    } catch (error) {
        console.error('Get My Calendar error:', error);
        res.status(500).json({ message: 'Server error when fetching calendar.', error: error.message });
    }
});

// 14. User profile + non-anonymous events
app.get('/api/users/:userId/events', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (userId === '0' || !userId) {
             return res.status(404).json({ message: 'Cannot get profile for Anonymous user.' });
        }

        const [userRows] = await pool.query('SELECT username, acc_id, email FROM users WHERE acc_id = ?', [userId]);
        
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userProfile = userRows[0];

        const eventsSql = `
            SELECT 
                events.*, 
                users.username AS creator_username,
                event_images.image_url 
            FROM events
            JOIN users ON events.creator_id = users.acc_id
            LEFT JOIN event_images ON events.event_id = event_images.event_id
            WHERE events.creator_id = ? AND events.is_anonymous = 0
            ORDER BY events.created_at DESC
        `;
        const [events] = await pool.query(eventsSql, [userId]);

        res.status(200).json({
            profile: userProfile,
            events: events
        });

    } catch (error) {
        console.error('Get User Profile error:', error);
        res.status(500).json({ message: 'Server error when fetching user profile.', error: error.message });
    }
});

// 15. Get logged-in user's profile
app.get('/api/me', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
        return res.status(401).json({ message: 'Not logged in' });
    }
    
    const [userRows] = await pool.query('SELECT username, acc_id, email FROM users WHERE acc_id = ?', [user_id]);
    
    if (userRows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(userRows[0]);
});

// --- ANONYMOUS CHAT ENDPOINTS ---

// 16. Create chat
app.post('/api/chats/create', async (req, res) => {
    const { event_id, requester_id } = req.body;
    
    if (!event_id || !requester_id) {
        return res.status(400).json({ message: 'Event ID and Requester ID are required.' });
    }

    try {
        const [eventRows] = await pool.query('SELECT creator_id, is_anonymous FROM events WHERE event_id = ?', [event_id]);
        
        if (eventRows.length === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const event = eventRows[0];
        
        if (!event.is_anonymous) {
            return res.status(400).json({ message: 'This event is not anonymous.' });
        }

        const creator_id = event.creator_id;

        if (creator_id === requester_id) {
            return res.status(400).json({ message: 'You cannot chat with yourself.' });
        }

        const [existingChats] = await pool.query(
            `SELECT chat_id FROM anonymous_chats 
             WHERE event_id = ? AND 
             ((user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?))`,
            [event_id, creator_id, requester_id, requester_id, creator_id]
        );

        if (existingChats.length > 0) {
            return res.status(200).json({ 
                message: 'Chat session found.',
                chat_id: existingChats[0].chat_id 
            });
        }

        const [result] = await pool.query(
            `INSERT INTO anonymous_chats (event_id, user_a_id, user_b_id) 
             VALUES (?, ?, ?)`,
            [event_id, creator_id, requester_id]
        );

        res.status(201).json({ 
            message: 'Chat session created.',
            chat_id: result.insertId 
        });

    } catch (error) {
        console.error('Create Chat error:', error);
        res.status(500).json({ message: 'Server error when creating chat.', error: error.message });
    }
});

// 17. Get chat messages
app.get('/api/chats/:chatId/messages', async (req, res) => {
    const { chatId } = req.params;

    try {
        const [chatRows] = await pool.query(
            `SELECT user_a_id, user_b_id, user_a_revealed, user_b_revealed, both_revealed 
             FROM anonymous_chats WHERE chat_id = ?`,
            [chatId]
        );

        if (chatRows.length === 0) {
            return res.status(404).json({ message: 'Chat not found.' });
        }

        const chat = chatRows[0];

        const [messages] = await pool.query(
            `SELECT 
                anonymous_messages.*,
                users.username AS sender_username
             FROM anonymous_messages
             JOIN users ON anonymous_messages.sender_id = users.acc_id
             WHERE chat_id = ?
             ORDER BY timestamp ASC`,
            [chatId]
        );

        res.status(200).json({
            messages: messages,
            user_a_id: chat.user_a_id,
            user_b_id: chat.user_b_id,
            user_a_revealed: chat.user_a_revealed,
            user_b_revealed: chat.user_b_revealed,
            both_revealed: chat.both_revealed
        });

    } catch (error) {
        console.error('Get Messages error:', error);
        res.status(500).json({ message: 'Server error when fetching messages.', error: error.message });
    }
});

// 18. Send a message
app.post('/api/chats/:chatId/message', async (req, res) => {
    const { chatId } = req.params;
    const { sender_id, message_text } = req.body;

    if (!sender_id || !message_text) {
        return res.status(400).json({ message: 'Sender ID and message text are required.' });
    }

    try {
        await pool.query(
            `INSERT INTO anonymous_messages (chat_id, sender_id, message_text) 
             VALUES (?, ?, ?)`,
            [chatId, sender_id, message_text]
        );

        res.status(201).json({ message: 'Message sent successfully!' });

    } catch (error) {
        console.error('Send Message error:', error);
        res.status(500).json({ message: 'Server error when sending message.', error: error.message });
    }
});

// 19. Reveal identity
app.post('/api/chats/:chatId/reveal', async (req, res) => {
    const { chatId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    try {
        const [chatRows] = await pool.query(
            `SELECT user_a_id, user_b_id, user_a_revealed, user_b_revealed 
             FROM anonymous_chats WHERE chat_id = ?`,
            [chatId]
        );

        if (chatRows.length === 0) {
            return res.status(404).json({ message: 'Chat not found.' });
        }

        const chat = chatRows[0];
        let updateSql = '';
        
        if (user_id === chat.user_a_id) {
            updateSql = `
                UPDATE anonymous_chats 
                SET user_a_revealed = 1, 
                    both_revealed = (user_b_revealed = 1)
                WHERE chat_id = ?
            `;
        } else if (user_id === chat.user_b_id) {
            updateSql = `
                UPDATE anonymous_chats 
                SET user_b_revealed = 1, 
                    both_revealed = (user_a_revealed = 1)
                WHERE chat_id = ?
            `;
        } else {
            return res.status(403).json({ message: 'You are not part of this chat.' });
        }

        await pool.query(updateSql, [chatId]);

        res.status(200).json({ message: 'Identity reveal status updated.' });

    } catch (error) {
        console.error('Reveal Identity error:', error);
        res.status(500).json({ message: 'Server error when revealing identity.', error: error.message });
    }
});

// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server.');
});
