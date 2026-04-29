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
