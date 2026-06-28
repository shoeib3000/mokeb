import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import compression from "compression";
import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';

// Configure dotenv with multiple fallback paths to support all environments (including local Windows server)
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

interface DBRow {
  path: string;
  collection: string | null;
  id: string | null;
  data: string;
  created_at?: string;
  updated_at?: string;
}

// Robust fallback key-value / document store simulating a single MySQL table in a local JSON file
class FallbackPool {
  private dbPath: string;

  constructor() {
    this.dbPath = path.resolve(process.cwd(), 'local_db.json');
    console.log(`Fallback JSON database initialized at: ${this.dbPath}`);
  }

  private readData(): DBRow[] {
    try {
      if (!fs.existsSync(this.dbPath)) {
        fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2), 'utf8');
        return [];
      }
      const fileContent = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(fileContent) || [];
    } catch (e) {
      console.error("Error reading local fallback DB file:", e);
      return [];
    }
  }

  private writeData(data: DBRow[]) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error("Error writing to local fallback DB file:", e);
    }
  }

  async query(sql: string, params: any[] = []): Promise<[any[], any]> {
    const data = this.readData();
    const sqlUpper = sql.trim().toUpperCase();

    // 1. SELECT 1
    if (sqlUpper.includes("SELECT 1") && !sqlUpper.includes("FROM")) {
      return [[{ "1": 1 }], null];
    }

    // 2. SELECT * FROM documents WHERE collection = ?
    if (sqlUpper.includes("COLLECTION = ?")) {
      const collectionVal = params[0];
      const rows = data.filter(r => r.collection === collectionVal);
      return [rows, null];
    }

    // 3. SELECT * FROM documents WHERE path = ?
    if (sqlUpper.includes("PATH = ?") && sqlUpper.includes("SELECT")) {
      const pathVal = params[0];
      const rows = data.filter(r => r.path === pathVal);
      return [rows, null];
    }

    // 4. INSERT INTO documents (path, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?
    if (sqlUpper.includes("ON DUPLICATE KEY UPDATE")) {
      const [pathVal, dataVal] = params;
      const index = data.findIndex(r => r.path === pathVal);
      
      const parts = pathVal.split('/');
      const id = parts.pop() || null;
      const collectionVal = parts.join('/') || null;

      if (index > -1) {
        data[index].data = dataVal;
        data[index].updated_at = new Date().toISOString();
      } else {
        data.push({
          path: pathVal,
          collection: collectionVal,
          id: id,
          data: dataVal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      this.writeData(data);
      return [[{ affectedRows: 1 }], null];
    }

    // 5. INSERT INTO documents (path, collection, id, data) VALUES (?, ?, ?, ?)
    if (sqlUpper.includes("INSERT INTO") && !sqlUpper.includes("ON DUPLICATE KEY")) {
      const [pathVal, collectionVal, idVal, dataVal] = params;
      const index = data.findIndex(r => r.path === pathVal);
      if (index > -1) {
        data[index] = {
          path: pathVal,
          collection: collectionVal,
          id: idVal,
          data: dataVal,
          updated_at: new Date().toISOString()
        };
      } else {
        data.push({
          path: pathVal,
          collection: collectionVal,
          id: idVal,
          data: dataVal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      this.writeData(data);
      return [[{ affectedRows: 1 }], null];
    }

    // 6. DELETE FROM documents WHERE path = ?
    if (sqlUpper.includes("DELETE FROM")) {
      const pathVal = params[0];
      const filtered = data.filter(r => r.path !== pathVal);
      this.writeData(filtered);
      return [[{ affectedRows: 1 }], null];
    }

    // 7. UPDATE documents SET data = ? WHERE path = ?
    if (sqlUpper.includes("UPDATE DOCUMENTS") && sqlUpper.includes("SET DATA")) {
      const [dataVal, pathVal] = params;
      const index = data.findIndex(r => r.path === pathVal);
      if (index > -1) {
        data[index].data = dataVal;
        data[index].updated_at = new Date().toISOString();
        this.writeData(data);
        return [[{ affectedRows: 1 }], null];
      }
      return [[{ affectedRows: 0 }], null];
    }

    console.warn("Fallback DB received unhandled SQL query:", sql, params);
    return [[], null];
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use compression for better performance
  app.use(compression());
  app.use(express.json());

  // MySQL Connection Pool
  let pool: any = null;

  const initializeDatabase = async (p: any) => {
    try {
      console.log("Checking and initializing database tables...");
      await p.query(`
        CREATE TABLE IF NOT EXISTS documents (
          path VARCHAR(255) NOT NULL PRIMARY KEY,
          collection VARCHAR(255) NULL,
          id VARCHAR(255) NULL,
          data LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_collection (collection)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("Database tables verified/created successfully!");
    } catch (err) {
      console.error("Failed to initialize database tables:", err);
    }
  };

  const getPool = async () => {
    if (pool) return pool;
    
    const host = process.env.MYSQL_HOST;
    const user = process.env.MYSQL_USER;
    const password = process.env.MYSQL_PASSWORD;
    const database = process.env.MYSQL_DATABASE;

    if (!host) {
      console.warn("MYSQL_HOST environment variable is not defined. Using local JSON file-based database (local_db.json) fallback.");
      pool = new FallbackPool();
      return pool;
    }

    try {
      console.log(`Connecting to MySQL at ${host} with database: ${database || 'mokeb_db'}...`);
      const tempPool = mysql.createPool({
        host: host,
        user: user || 'root',
        password: password || '',
        database: database || 'mokeb_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000 // Fails fast if host is offline/unreachable
      });

      // Quick test
      await tempPool.query("SELECT 1");
      console.log("MySQL connection test successful!");

      pool = tempPool;
      // Auto-create/initialize documents table on startup
      await initializeDatabase(pool);
      return pool;
    } catch (err) {
      console.error(`Failed to connect to MySQL database at ${host}. Error: ${(err as Error).message}`);
      console.warn("Falling back to local JSON file-based database (local_db.json).");
      pool = new FallbackPool();
      return pool;
    }
  };

  // Test DB Connection
  app.get("/api/db/test", async (req, res) => {
    try {
      const p = await getPool();
      await p.query("SELECT 1");
      const isFallback = p instanceof FallbackPool;
      res.json({ 
        success: true, 
        message: isFallback 
          ? "اتصال به پایگاه داده موقت محلی (local_db.json) با موفقیت انجام شد." 
          : "اتصال به پایگاه داده MySQL با موفقیت برقرار شد.",
        mode: isFallback ? "fallback" : "mysql"
      });
    } catch(err) {
      console.error("Database connection test failed:", err);
      res.status(500).json({ success: false, message: "Database connection failed", error: (err as Error).message });
    }
  });

  // Database API Routes using MySQL
  app.post("/api/db/getDocs", async (req, res) => {
    try {
      const pool = await getPool();
      const { path } = req.body;
      const [rows] = await pool.query("SELECT * FROM documents WHERE collection = ?", [path]);
      const results = (rows as any[]).map((r: any) => ({
        id: r.id,
        data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data
      }));
      res.json(results);
    } catch(err) {
      console.error("Database error:", err);
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  app.post("/api/db/getDoc", async (req, res) => {
    try {
      const pool = await getPool();
      const { path } = req.body;
      const [rows] = await pool.query("SELECT * FROM documents WHERE path = ?", [path]);
      if ((rows as any[]).length === 0) return res.status(404).json(null);
      const row = (rows as any[])[0];
      res.json({ id: row.id, data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data });
    } catch(err) {
      console.error("Database error:", err);
      res.status(404).json(null);
    }
  });

  app.post("/api/db/setDoc", async (req, res) => {
    try {
      const pool = await getPool();
      const { docRef, data } = req.body;
      const path = docRef.path;
      await pool.query(
        "INSERT INTO documents (path, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?",
        [path, JSON.stringify(data), JSON.stringify(data)]
      );
      res.json({ success: true });
    } catch(err) {
      console.error("Database error:", err);
      res.json({ success: false });
    }
  });

  app.post("/api/db/addDoc", async (req, res) => {
    try {
      const pool = await getPool();
      const { collectionRef, data } = req.body;
      const id = Math.random().toString(36).substring(2, 15);
      const path = collectionRef.path + '/' + id;
      await pool.query(
        "INSERT INTO documents (path, collection, id, data) VALUES (?, ?, ?, ?)",
        [path, collectionRef.path, id, JSON.stringify(data)]
      );
      res.json({ success: true, id });
    } catch(err) {
      console.error("Database error:", err);
      res.json({ success: false });
    }
  });

  app.post("/api/db/deleteDoc", async (req, res) => {
    try {
      const pool = await getPool();
      const { path } = req.body;
      await pool.query("DELETE FROM documents WHERE path = ?", [path]);
      res.json({ success: true });
    } catch(err) {
      console.error("Database error:", err);
      res.json({ success: false });
    }
  });

  app.post("/api/db/updateDoc", async (req, res) => {
    try {
      const pool = await getPool();
      const { docRef, data } = req.body;
      const path = docRef.path;
      
      const [rows] = await pool.query("SELECT data FROM documents WHERE path = ?", [path]);
      if ((rows as any[]).length === 0) {
        return res.status(404).json({ success: false, message: "Document not found" });
      }
      
      const row = (rows as any[])[0];
      const existingData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      const mergedData = { ...existingData, ...data };
      
      await pool.query(
        "UPDATE documents SET data = ? WHERE path = ?",
        [JSON.stringify(mergedData), path]
      );
      res.json({ success: true });
    } catch(err) {
      console.error("Database error in updateDoc:", err);
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // Handle registration data
  app.post("/api/register-mokeb", async (req, res) => {
    const { userData, mokebData } = req.body;
    console.log("Received registration data:", { userData, mokebData });
    // TODO: Add Firestore insertion logic if needed
    res.json({ success: true, message: "Data received successfully." });
  });

  // Handle username check
  app.post("/api/check-username", async (req, res) => {
    const { username } = req.body;
    console.log("Checking username:", username);
    // TODO: Add Firestore check logic if needed
    res.json({ available: true });
  });

  // Handle Sync endpoint
  app.post("/api/sync-sql", async (req, res) => {
    res.json({ success: true, message: "Sync not implemented for Firestore." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: '1h',
      etag: true,
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          // Don't cache index.html
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
  process.exit(1);
});
