import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define type for Request with file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // MongoDB Connection Setup & In-Memory Fallback
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/pdca_system";
  let db: any = null;
  const memoryDb: Record<string, Record<string, any>> = {};

  try {
    const { MongoClient } = await import("mongodb");
    console.log("Connecting to MongoDB at:", MONGODB_URI);
    const mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db();
    console.log("Successfully connected to MongoDB database!");
  } catch (error) {
    console.warn("MongoDB connection failed. Running in memory-fallback mode...", error);
  }

  // --- LOCAL NOSQL DATABASE REST API ENDPOINTS ---

  // GET: List all documents in a collection
  app.get("/api/db/:collection", async (req, res) => {
    const { collection } = req.params;
    try {
      if (db) {
        const docs = await db.collection(collection).find({}).toArray();
        const mapped = docs.map((doc: any) => {
          const { _id, ...rest } = doc;
          return { id: _id, ...rest };
        });
        return res.json(mapped);
      } else {
        const col = memoryDb[collection] || {};
        return res.json(Object.values(col));
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET: Get single document
  app.get("/api/db/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    try {
      if (db) {
        const doc = await db.collection(collection).findOne({ _id: id });
        if (!doc) return res.status(404).json({ error: "Not found" });
        const { _id, ...rest } = doc;
        return res.json({ id: _id, ...rest });
      } else {
        const doc = memoryDb[collection]?.[id];
        if (!doc) return res.status(404).json({ error: "Not found" });
        return res.json(doc);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST: Create or overwrite document (with optional merge) - matches setDoc
  app.post("/api/db/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    const { data, merge } = req.body;
    try {
      const cleanData = { ...data, id };
      if (cleanData._id) delete cleanData._id; // Remove MongoDB internal keys if leaked

      if (db) {
        if (merge) {
          await db.collection(collection).updateOne(
            { _id: id },
            { $set: cleanData },
            { upsert: true }
          );
        } else {
          await db.collection(collection).replaceOne(
            { _id: id },
            { ...cleanData },
            { upsert: true }
          );
        }
        return res.json({ success: true, id });
      } else {
        if (!memoryDb[collection]) memoryDb[collection] = {};
        if (merge) {
          memoryDb[collection][id] = { ...memoryDb[collection][id], ...cleanData };
        } else {
          memoryDb[collection][id] = cleanData;
        }
        return res.json({ success: true, id });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT: Update partial fields in a document - matches updateDoc
  app.put("/api/db/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    const { data } = req.body;
    try {
      if (data._id) delete data._id; // Prevent _id modification
      if (db) {
        await db.collection(collection).updateOne(
          { _id: id },
          { $set: data }
        );
        return res.json({ success: true, id });
      } else {
        if (memoryDb[collection]?.[id]) {
          memoryDb[collection][id] = { ...memoryDb[collection][id], ...data };
          return res.json({ success: true, id });
        }
        return res.status(404).json({ error: "Not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE: Delete a document
  app.delete("/api/db/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    try {
      if (db) {
        await db.collection(collection).deleteOne({ _id: id });
        return res.json({ success: true });
      } else {
        if (memoryDb[collection]) {
          delete memoryDb[collection][id];
        }
        return res.json({ success: true });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST: Create a new document with an auto-generated ID - matches addDoc
  app.post("/api/db/:collection", async (req, res) => {
    const { collection } = req.params;
    const { data } = req.body;
    try {
      const generatedId = "doc_" + Math.random().toString(36).substring(2, 11);
      const cleanData = { ...data, id: generatedId };
      if (db) {
        await db.collection(collection).insertOne({ ...cleanData, _id: generatedId });
        return res.json({ success: true, id: generatedId });
      } else {
        if (!memoryDb[collection]) memoryDb[collection] = {};
        memoryDb[collection][generatedId] = cleanData;
        return res.json({ success: true, id: generatedId });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Drive Setup
  const SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"];
  
  const getDriveClient = () => {
    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyString) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is missing");
    }
    
    let credentials;
    try {
      credentials = JSON.parse(keyString);
    } catch (e) {
      throw new Error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY as JSON");
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: SCOPES,
    });

    return google.drive({ version: "v3", auth });
  };

  const upload = multer({ storage: multer.memoryStorage() });

  // API Routes
  app.post("/api/drive/upload", upload.single("file"), async (req: MulterRequest, res: Response) => {
    try {
      const { projectId, projectName, driveFolderId } = req.body;
      const file = req.file;

      if (!file || !projectId || !projectName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const drive = getDriveClient();
      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "1fvFyLFU1QGZkfOxYvreHxtEZVWE8l_96";
      
      let currentFolderId = driveFolderId;

      // If no folder ID provided, search or create
      if (!currentFolderId || currentFolderId === "undefined" || currentFolderId === "null") {
        console.log(`Searching for folder for project: ${projectName}`);
        const response = await drive.files.list({
          q: `mimeType='application/vnd.google-apps.folder' and name='${projectName}' and '${parentFolderId}' in parents and trashed=false`,
          fields: "files(id, name)",
          spaces: "drive",
        });

        const existingFolder = response.data.files?.[0];
        
        if (existingFolder) {
          currentFolderId = existingFolder.id;
        } else {
          console.log(`Creating new folder for project: ${projectName}`);
          const folderMetadata = {
            name: projectName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentFolderId],
          };

          const folder = await drive.files.create({
            requestBody: folderMetadata,
            fields: "id",
          });
          
          currentFolderId = folder.data.id;
        }
      }

      // Upload file to the folder
      const fileMetadata = {
        name: file.originalname,
        parents: [currentFolderId!],
      };

      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };

      const driveFile = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, webViewLink, size, mimeType",
      });

      res.json({
        fileId: driveFile.data.id,
        fileName: driveFile.data.name,
        fileUrl: driveFile.data.webViewLink,
        driveFolderId: currentFolderId,
        size: parseInt(driveFile.data.size || "0"),
        mimeType: driveFile.data.mimeType
      });
    } catch (error: any) {
      console.error("Error in /api/drive/upload:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
