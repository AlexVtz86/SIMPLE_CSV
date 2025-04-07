// app.js
const express = require('express');
const fileUpload = require('express-fileupload');
const { initializeDatabase, uploadFile, fetchData } = require('./controllers/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// Initialize DB
initializeDatabase()
  .then(() => {
    // Routes
    app.post('/api/upload/', uploadFile);
    app.get("/api/data", fetchData);
    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public/index.html"));
    });

// Start
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
})
  .catch(err => {
  console.error("DB init failed:", err);
  process.exit(1);
});