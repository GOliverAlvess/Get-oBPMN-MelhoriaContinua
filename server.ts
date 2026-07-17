import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";
import dotenv from "dotenv";
import bcryptjs from "bcryptjs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define type for Request with file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3004;

  app.use(express.json());

  // MongoDB Connection Setup & In-Memory Fallback
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/pdca_system";
  let db: any = null;
  const memoryDb: Record<string, Record<string, any>> = {};

  const seedUsers = async (dbInstance: any) => {
    const defaultUsers = [
      {
        id: "ga_oliveira_master",
        name: "Gabriel Oliveira",
        email: "ga.oliveira@ativalog.com.br",
        sector: "Diretoria",
        profile: "Usuário Master"
      },
      {
        id: "biel_alves_master",
        name: "Gabriel Alves",
        email: "bielalves201@gmail.com",
        sector: "Administração",
        profile: "Usuário Master"
      }
    ];

    try {
      if (dbInstance) {
        const collection = dbInstance.collection("users");
        for (const user of defaultUsers) {
          const existing = await collection.findOne({ email: user.email });
          if (!existing) {
            console.log(`Seeding user to MongoDB: ${user.email}`);
            await collection.insertOne({ ...user, _id: user.id });
          }
        }
      } else {
        if (!memoryDb["users"]) memoryDb["users"] = {};
        for (const user of defaultUsers) {
          if (!memoryDb["users"][user.id]) {
            console.log(`Seeding user to MemoryDB: ${user.email}`);
            memoryDb["users"][user.id] = user;
          }
        }
      }
    } catch (err) {
      console.error("Error seeding users:", err);
    }
  };

  try {
    const { MongoClient } = await import("mongodb");
    console.log("Connecting to MongoDB at:", MONGODB_URI);
    const mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    });
    await mongoClient.connect();
    db = mongoClient.db();
    console.log("Successfully connected to MongoDB database!");
    await seedUsers(db);
  } catch (error) {
    console.warn("MongoDB connection failed. Running in memory-fallback mode...", error);
    await seedUsers(null);
  }

  const getUserByEmail = async (email: string) => {
    if (!email) return null;
    const emailLower = email.trim().toLowerCase();

    try {
      if (db) {
        return await db.collection("users").findOne({ email: { $regex: new RegExp(`^${emailLower}$`, "i") } });
      } else {
        const col = memoryDb["users"] || {};
        return Object.values(col).find((u: any) => u.email?.toLowerCase() === emailLower) || null;
      }
    } catch (err) {
      console.error("Error fetching user by email:", err);
      return null;
    }
  };

  const authorizeMutation = async (req: express.Request, collection: string, id: string | undefined, method: string) => {
    const email = req.headers['x-user-email'] as string;
    if (!email) {
      return { authorized: true }; // Allow operations during registration or seed
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return { authorized: false, error: "Usuário não autorizado." };
    }

    const profile = user.profile || 'Usuário Analista';

    if (profile === 'Usuário Master') {
      return { authorized: true };
    }

    if (profile === 'Usuário Visualizador') {
      if (collection === 'reportLogs' && method === 'POST') {
        return { authorized: true };
      }
      return { authorized: false, error: "Usuário com perfil de Visualizador não possui permissão para alterar dados." };
    }

    if (profile === 'Usuário Analista') {
      if (collection === 'users') {
        return { authorized: false, error: "Usuário com perfil de Analista não possui permissão para gerenciar usuários." };
      }
      if (collection === 'config') {
        return { authorized: false, error: "Usuário com perfil de Analista não possui permissão para alterar configurações." };
      }
      if (collection === 'bpmnSavedColors') {
        return { authorized: true };
      }

      if (collection === 'projects') {
        const payload = req.body?.data;
        if (method === 'DELETE') {
          let existingProj: any = null;
          if (db) {
            existingProj = await db.collection('projects').findOne({ _id: id });
          } else {
            existingProj = memoryDb['projects']?.[id!];
          }
          if (existingProj && existingProj.assignedTo !== user.id) {
            return { authorized: false, error: "Você não é o responsável designado para este projeto." };
          }
        } else {
          if (payload) {
            if (payload.assignedTo && payload.assignedTo !== user.id) {
              return { authorized: false, error: "Você só pode salvar ou mover projetos atribuídos a você mesmo." };
            }
          }
        }
      }

      if (collection === 'operationalActions') {
        const payload = req.body?.data;
        if (method === 'DELETE') {
          let existingAction: any = null;
          if (db) {
            existingAction = await db.collection('operationalActions').findOne({ _id: id });
          } else {
            existingAction = memoryDb['operationalActions']?.[id!];
          }
          if (existingAction && existingAction.responsibleId !== user.id) {
            return { authorized: false, error: "Você não é o responsável por esta ação." };
          }
        } else {
          if (payload && payload.responsibleId && payload.responsibleId !== user.id) {
            return { authorized: false, error: "Você só pode salvar ações atribuídas a você mesmo." };
          }
        }
      }

      return { authorized: true };
    }

    return { authorized: true };
  };

  // --- CUSTOM AUTHENTICATION ENDPOINTS ---
  app.post("/api/auth/check-user", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "E-mail é obrigatório." });
    }
    const emailLower = email.trim().toLowerCase();
    
    try {
      const user = await getUserByEmail(emailLower);

      if (!user) {
        return res.json({ exists: false });
      }

      return res.json({
        exists: true,
        hasPassword: !!user.passwordHash,
        userId: user.id || user._id
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: "E-mail é obrigatório." });
    }
    const emailLower = email.trim().toLowerCase();

    try {
      const user = await getUserByEmail(emailLower);
      if (!user) {
        return res.status(401).json({ error: "Usuário não autorizado." });
      }

      // Check if user has password set yet
      if (!user.passwordHash) {
        return res.json({ status: "first_access", userId: user.id || user._id });
      }

      if (!password) {
        return res.status(400).json({ error: "Senha é obrigatória." });
      }

      // Compare password
      const isValid = bcryptjs.compareSync(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Senha incorreta." });
      }

      return res.json({
        status: "success",
        user: {
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          profile: user.profile || "Usuário Analista"
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/register-password", async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    try {
      let user: any = null;
      if (db) {
        user = await db.collection("users").findOne({ _id: userId });
      } else {
        user = memoryDb["users"]?.[userId];
      }

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      // Security: block setting a password if the user already has one defined
      if (user.passwordHash) {
        return res.status(400).json({ error: "Este usuário já possui uma senha cadastrada." });
      }

      const passwordHash = bcryptjs.hashSync(password, 10);

      if (db) {
        await db.collection("users").updateOne(
          { _id: userId },
          { $set: { passwordHash } }
        );
      } else {
        if (!memoryDb["users"]) memoryDb["users"] = {};
        memoryDb["users"][userId] = { ...memoryDb["users"][userId], passwordHash };
      }

      // Broadcast update
      await broadcastDocChange("users", userId, "update");

      return res.json({
        status: "success",
        user: {
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          profile: user.profile || "Usuário Analista"
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    try {
      let user: any = null;
      if (db) {
        user = await db.collection("users").findOne({ _id: userId });
      } else {
        user = memoryDb["users"]?.[userId];
      }

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      // Verify current password
      const isValid = user.passwordHash ? bcryptjs.compareSync(currentPassword, user.passwordHash) : false;
      if (!isValid) {
        return res.status(401).json({ error: "Senha atual incorreta." });
      }

      const passwordHash = bcryptjs.hashSync(newPassword, 10);

      if (db) {
        await db.collection("users").updateOne(
          { _id: userId },
          { $set: { passwordHash } }
        );
      } else {
        if (!memoryDb["users"]) memoryDb["users"] = {};
        memoryDb["users"][userId] = { ...memoryDb["users"][userId], passwordHash };
      }

      // Broadcast update
      await broadcastDocChange("users", userId, "update");

      return res.json({ status: "success" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- LOCAL NOSQL DATABASE REST API ENDPOINTS ---

  // --- REAL-TIME SYNC VIA SERVER-SENT EVENTS (SSE) ---
  const sseClients = new Set<express.Response>();

  const broadcastSync = (collection: string, id: string, type: "set" | "update" | "delete", data: any) => {
    const payload = JSON.stringify({ collection, id, type, data });
    for (const client of sseClients) {
      client.write(`data: ${payload}\n\n`);
    }
  };

  const broadcastDocChange = async (collection: string, id: string, type: "set" | "update" | "delete") => {
    try {
      if (type === "delete") {
        broadcastSync(collection, id, "delete", null);
        return;
      }
      let docData: any = null;
      if (db) {
        const found = await db.collection(collection).findOne({ _id: id });
        if (found) {
          const { _id, ...rest } = found;
          docData = { id: _id, ...rest };
        }
      } else {
        docData = memoryDb[collection]?.[id] || null;
      }
      if (docData) {
        broadcastSync(collection, id, type, docData);
      }
    } catch (err) {
      console.error("Error broadcasting sync:", err);
    }
  };

  app.get("/api/db-sync", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(": open\n\n");

    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

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
        if (collection === "users") {
          mapped.forEach((user: any) => {
            delete user.password;
            delete user.passwordHash;
          });
        }
        return res.json(mapped);
      } else {
        const col = memoryDb[collection] || {};
        const list = Object.values(col);
        if (collection === "users") {
          const sanitized = list.map((user: any) => {
            const { password, passwordHash, ...rest } = user;
            return rest;
          });
          return res.json(sanitized);
        }
        return res.json(list);
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
        const mapped = { id: _id, ...rest };
        if (collection === "users") {
          delete mapped.password;
          delete mapped.passwordHash;
        }
        return res.json(mapped);
      } else {
        const doc = memoryDb[collection]?.[id];
        if (!doc) return res.status(404).json({ error: "Not found" });
        if (collection === "users") {
          const { password, passwordHash, ...rest } = doc;
          return res.json(rest);
        }
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
      const authCheck = await authorizeMutation(req, collection, id, 'POST');
      if (!authCheck.authorized) {
        return res.status(403).json({ error: authCheck.error || "Ação não autorizada para seu perfil" });
      }

      let cleanData = { ...data, id };
      if (cleanData._id) delete cleanData._id; // Remove MongoDB internal keys if leaked

      if (collection === "users") {
        if (cleanData.password) {
          cleanData.passwordHash = bcryptjs.hashSync(cleanData.password, 10);
          delete cleanData.password;
        } else {
          // If no new password is sent, retain existing password hash from database
          let existingUser: any = null;
          if (db) {
            existingUser = await db.collection("users").findOne({ _id: id });
          } else {
            existingUser = memoryDb["users"]?.[id];
          }
          if (existingUser && existingUser.passwordHash) {
            cleanData.passwordHash = existingUser.passwordHash;
          }
        }
      }

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
        await broadcastDocChange(collection, id, 'set');
        return res.json({ success: true, id });
      } else {
        if (!memoryDb[collection]) memoryDb[collection] = {};
        if (merge) {
          memoryDb[collection][id] = { ...memoryDb[collection][id], ...cleanData };
        } else {
          memoryDb[collection][id] = cleanData;
        }
        await broadcastDocChange(collection, id, 'set');
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
      const authCheck = await authorizeMutation(req, collection, id, 'PUT');
      if (!authCheck.authorized) {
        return res.status(403).json({ error: authCheck.error || "Ação não autorizada para seu perfil" });
      }

      let cleanData = { ...data };
      if (cleanData._id) delete cleanData._id; // Prevent _id modification

      if (collection === "users" && cleanData.password) {
        cleanData.passwordHash = bcryptjs.hashSync(cleanData.password, 10);
        delete cleanData.password;
      }

      if (db) {
        await db.collection(collection).updateOne(
          { _id: id },
          { $set: cleanData }
        );
        await broadcastDocChange(collection, id, 'update');
        return res.json({ success: true, id });
      } else {
        if (memoryDb[collection]?.[id]) {
          memoryDb[collection][id] = { ...memoryDb[collection][id], ...cleanData };
          await broadcastDocChange(collection, id, 'update');
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
      const authCheck = await authorizeMutation(req, collection, id, 'DELETE');
      if (!authCheck.authorized) {
        return res.status(403).json({ error: authCheck.error || "Ação não autorizada para seu perfil" });
      }

      if (db) {
        await db.collection(collection).deleteOne({ _id: id });
        await broadcastDocChange(collection, id, 'delete');
        return res.json({ success: true });
      } else {
        if (memoryDb[collection]) {
          delete memoryDb[collection][id];
        }
        await broadcastDocChange(collection, id, 'delete');
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
      const authCheck = await authorizeMutation(req, collection, undefined, 'POST');
      if (!authCheck.authorized) {
        return res.status(403).json({ error: authCheck.error || "Ação não autorizada para seu perfil" });
      }

      const generatedId = "doc_" + Math.random().toString(36).substring(2, 11);
      let cleanData = { ...data, id: generatedId };

      if (collection === "users" && cleanData.password) {
        cleanData.passwordHash = bcryptjs.hashSync(cleanData.password, 10);
        delete cleanData.password;
      }

      if (db) {
        await db.collection(collection).insertOne({ ...cleanData, _id: generatedId });
        await broadcastDocChange(collection, generatedId, 'set');
        return res.json({ success: true, id: generatedId });
      } else {
        if (!memoryDb[collection]) memoryDb[collection] = {};
        memoryDb[collection][generatedId] = cleanData;
        await broadcastDocChange(collection, generatedId, 'set');
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
      throw new Error("A variável de ambiente GOOGLE_SERVICE_ACCOUNT_KEY está ausente. Por favor, configure-a com o JSON da Service Account no painel de configurações ou no arquivo .env.");
    }
    
    const trimmedKey = keyString.trim();
    
    let credentials: any;
    try {
      credentials = JSON.parse(trimmedKey);
    } catch (e: any) {
      throw new Error(`Erro ao analisar a variável GOOGLE_SERVICE_ACCOUNT_KEY como JSON válido: ${e.message}`);
    }

    if (!credentials || !credentials.client_email || !credentials.private_key) {
      throw new Error("Os campos 'client_email' ou 'private_key' estão ausentes na credencial da Conta de Serviço do Google Cloud.");
    }

    // Normalizar quebras de linha da chave privada (substituir '\\n' por '\n')
    const formattedPrivateKey = credentials.private_key.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: formattedPrivateKey,
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

      const email = req.headers['x-user-email'] as string;
      if (email) {
        const user = await getUserByEmail(email);
        if (user && (user.profile || 'Usuário Analista') === 'Usuário Visualizador') {
          return res.status(403).json({ error: "Perfil de Visualizador não possui permissão para enviar arquivos." });
        }
      }

      if (!file || !projectId || !projectName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const drive = getDriveClient();
      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "0AFf6OFctpR_7Uk9PVA";
      
      let currentFolderId = driveFolderId;

      // If no folder ID provided, search or create
      if (!currentFolderId || currentFolderId === "undefined" || currentFolderId === "null") {
        console.log(`Searching for folder for project: ${projectName}`);
        const response = await drive.files.list({
          q: `mimeType='application/vnd.google-apps.folder' and name='${projectName}' and '${parentFolderId}' in parents and trashed=false`,
          fields: "files(id, name)",
          spaces: "drive",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
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
            supportsAllDrives: true
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
        supportsAllDrives: true
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
