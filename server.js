// 1. Import all the packages
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv'); // <-- NEW
const { v2: cloudinary } = require('cloudinary'); // <-- NEW

// 2. Load Environment Variables
dotenv.config(); // <-- NEW

// 3. Configure Cloudinary
cloudinary.config({ // <-- NEW
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 4. Set up the Express app and port
const app = express();
const PORT = 3000;

// 5. Set up Middleware
app.use(cors());
// Increase the limit to handle large image (base64) strings
app.use(express.json({ limit: '50mb' })); // <-- MODIFIED

// 6. Create the connection pool to your MySQL database
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'ClassSight123!', // <-- Make sure this is still your password
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
    // (This endpoint is unchanged)
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

// 10. Create a new Event (MODIFIED FOR IMAGE UPLOAD)
app.post('/api/events', async (req, res) => {
    // We now expect an 'image' (base64 string) in the body
    const { name, description, venue, date, time, creator_id, image } = req.body;

    if (!name || !date || !time || !creator_id) {
        return res.status(400).json({ message: 'Event Name, Date, Time, and Creator ID are required.' });
    }
    
    // We will use a database transaction to make sure both queries succeed or fail together
    const connection = await pool.getConnection(); // Get a connection from the pool

    try {
        await connection.beginTransaction(); // Start the transaction
        
        // --- Step 1: Insert the Event ---
        const eventSql = `
            INSERT INTO events 
            (name, description, venue, event_date, event_time, creator_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [eventResult] = await connection.query(eventSql, [name, description, venue, date, time, creator_id]);
        
        const newEventId = eventResult.insertId; // Get the ID of the event we just created
        let imageUrl = null; // Default to no image

        // --- Step 2: Upload Image (if one was provided) ---
        if (image) {
            console.log('Image provided, uploading to Cloudinary...');
            const uploaded = await cloudinary.uploader.upload(image, {
                folder: `caleve_events`, // A folder in Cloudinary
                public_id: `event_${newEventId}`, // Name the image after the event ID
                overwrite: true,
                resource_type: "image",
            });
            imageUrl = uploaded.secure_url; // Get the URL
            console.log('Upload successful:', imageUrl);

            // --- Step 3: Save Image URL to 'event_images' table ---
            const imageSql = `
                INSERT INTO event_images (event_id, image_url)
                VALUES (?, ?)
            `;
            await connection.query(imageSql, [newEventId, imageUrl]);
        }

        // --- Step 4: Commit Transaction ---
        // If we get here, both queries were successful
        await connection.commit();

        console.log('New event created by user:', creator_id);
        res.status(201).json({ 
            message: 'Event created successfully!',
            event_id: newEventId,
            image_url: imageUrl
        });

    } catch (error) {
        // If anything went wrong, roll back all changes
        await connection.rollback();
        console.error('Create Event error (rolling back):', error);
        res.status(500).json({ message: 'Server error during event creation.', error: error.message });
    } finally {
        // Always release the connection back to the pool
        connection.release();
    }
});

// 11. Get all Events
app.get('/api/events', async (req, res) => {
    // (This endpoint is unchanged)
    try {
        const sql = `
            SELECT 
                events.*, 
                users.username AS creator_username 
            FROM events
            JOIN users ON events.creator_id = users.acc_id
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
    // (This endpoint is unchanged)
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
        console.log(`User ${user_id} ${status} event ${event_id}`);
        res.status(200).json({ message: `Event status updated to ${status}.` });
    } catch (error) {
        console.error('Set Attendance error:', error);
        res.status(500).json({ message: 'Server error when setting attendance.', error: error.message });
    }
});

// 13. Your friend's "My Calendar" endpoint (UNCOMMENT WHEN READY)
/*
app.get('/api/my-calendar', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
        return res.status(400).json({ message: 'A user_id query parameter is required.' });
    }
    try {
        const sql = `
            SELECT 
                events.*, 
                users.username AS creator_username
            FROM events
            JOIN event_attendance ON events.event_id = event_attendance.event_id
            JOIN users ON events.creator_id = users.acc_id
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
*/

// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server.');
});