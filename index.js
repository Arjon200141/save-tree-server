const express = require('express');
const app = express();
const cors = require('cors');
const multer = require('multer');
const fs = require('fs'); 
const path = require('path');
const port = process.env.PORT || 5000;
require('dotenv').config();

app.use(cors());
app.use(express.json());
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://save-tree:HIkyKr34VFkDFHsc@cluster0.ej6qyrh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server
        await client.connect();
        const db = client.db('save-tree');
        const eventCollection = db.collection('events');
        const volunteerCollection = db.collection('volunteers');

        // Get all events
        app.get('/events', async (req, res) => {
            try {
                const result = await eventCollection.find().toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching events:", error);
                res.status(500).send("Internal Server Error");
            }
        });

        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, uploadDir); // Use the uploadDir variable
            },
            filename: (req, file, cb) => {
                cb(null, Date.now() + path.extname(file.originalname));
            }
        });

        const upload = multer({
            storage: storage,
            limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
            fileFilter: (req, file, cb) => {
                const filetypes = /jpeg|jpg|png|pdf/;
                const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
                const mimetype = filetypes.test(file.mimetype);

                if (extname && mimetype) {
                    return cb(null, true);
                } else {
                    cb('Error: Only images (JPEG/JPG/PNG) and PDFs are allowed!');
                }
            }
        }).single('photo');

        // POST endpoint for volunteer registration
        app.post('/volunteers', (req, res) => {
            upload(req, res, async (err) => {
                if (err instanceof multer.MulterError) {
                    return res.status(400).json({ success: false, message: err.message });
                } else if (err) {
                    return res.status(400).json({ success: false, message: err });
                }

                try {
                    const {
                        fullName,
                        age,
                        gender,
                        phone,
                        email,
                        division,
                        district,
                        education,
                        motivation,
                        experience,
                        experienceDetails,
                        availability,
                        facebook
                    } = req.body;

                    // Basic validation
                    if (!fullName || !age || !gender || !phone || !email || !division || !education || !motivation || !experience || !availability) {
                        return res.status(400).json({ success: false, message: 'All required fields must be provided' });
                    }

                    // Create new volunteer document
                    const newVolunteer = {
                        fullName,
                        age: parseInt(age),
                        gender,
                        phone,
                        email,
                        division,
                        district,
                        education,
                        motivation,
                        experience,
                        availability,
                        createdAt: new Date()
                    };

                    // Add conditional fields
                    if (experience === 'Yes') {
                        newVolunteer.experienceDetails = experienceDetails;
                    }
                    if (facebook) {
                        newVolunteer.facebook = facebook;
                    }
                    if (req.file) {
                        newVolunteer.photo = `/uploads/${req.file.filename}`;
                    }

                    // Insert into MongoDB
                    const result = await volunteerCollection.insertOne(newVolunteer);

                    res.status(201).json({
                        success: true,
                        message: 'Volunteer registration successful!',
                        data: { ...newVolunteer, _id: result.insertedId }
                    });
                } catch (error) {
                    console.error('Registration error:', error);
                    res.status(500).json({
                        success: false,
                        message: 'An error occurred during registration',
                        error: error.message
                    });
                }
            });
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Save Tree is running');
});

app.listen(port, () => {
    console.log(`Save Tree is running on port ${port}`);
});