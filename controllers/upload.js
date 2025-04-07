// controllers/upload.js
const csvParse = require('csv-parser');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dbConfig = require("../db_config.json");

let client = null;

async function initializeDatabase() {
  client = new Client({
    user: "alex",
    host: "localhost",
    database: "postgres",
    password: "alexadmin",
    port: 5432,
  });
  await client.connect();
  console.log("Connected to DB");
}

async function uploadFile(req, res) {
  if (!req.files || !req.files.file) {
    return res.status(400).send('No file uploaded.');
  }

  const uploadedFile = req.files.file;
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const filePath = path.join(dataDir, uploadedFile.name);

  try {
    await fs.promises.writeFile(filePath, uploadedFile.data);

    const results = [];
    let isFirstRow = true;
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParse({ headers: dbConfig.originalNames }))
         .on("data", (data) => {
          if (isFirstRow) {
            isFirstRow = false;
            return; // Skip the first row (headers)
          }
          results.push(data);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const columnNames = dbConfig.columns.map((column) => column.name);
    const placeholders = columnNames
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    let inserted = 0;
    let errors = 0;

    for (const row of results) {
      const query =  ` 
        INSERT INTO "${dbConfig.tableName}" ("${columnNames.join('", "')}")
        VALUES (${placeholders})
      `; 

      const values = columnNames.map((col, index) => { // VALUES - must be applied 
        const originalName = dbConfig.originalNames[index];
        if (col === "מתי חזר מזכאות") {
          if (!row[originalName]) return null;
          const date = new Date(row[originalName]);
          if (isNaN(date.getTime())) {
            console.warn(`Invalid date for row:`, row);
            return null;
          }
          return date.toISOString();
            } else if (col === "נסגר / לא נסגר") {
          // Convert to boolean: true for "כן", false for anything else
          return row[originalName] === "כן";
        }
        return row[originalName] || null;
      });
       try {
        const result = await client.query(query, values); // CLIENT QUERY  - must be applied
        if (result.rowCount === 1) {
          inserted++;
        }
      } catch (err) {
        console.error("Error inserting row:", err, "Row data:", row);
        errors++;
      }
    }

    res.send(`CSV file processed. Inserted: ${inserted} records. Errors: ${errors}.`)
  } catch (err) {
    console.error("Processing error:", err);
    res.status(500).send("Error: " + err.message);
  }
}


const fetchData = async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM yarokale_report');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching data from database');
  }
};

module.exports = { initializeDatabase, uploadFile, fetchData };
