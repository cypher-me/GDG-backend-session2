import express from "express";
import "dotenv/config";
import prisma, { testConnection } from "./db.js";
import authRouter from "./routes/auth.js";

const app = express();

// Enable JSON body parsing for POST/PUT requests
app.use(express.json());

// Mount the authentication routes at /api/auth -> /api/auth/register, /api/auth/login
app.use("/api/auth", authRouter);

// Check the database connection when the server starts.
try {
    const row = await testConnection();
    console.log(`Connected to database "${row.db}" at ${row.now}`);
} catch (err) {
    // If the remote DB is unreachable, log it but keep the server running.
    console.error("Failed to connect to the database:", err.message);
}

// A quick example route that queries the DB (table "users" as a placeholder).
app.get("/users", async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { username: true, full_name: true, role: true },
            take: 10,
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create a new user (POST /users)
app.post("/users", async (req, res) => {
  const { username, full_name, role } = req.body;
  try {
    const newUser = await prisma.user.create({
      data: {
        username,
        full_name,
        role,
      },
    });
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
    res.send("got /");
});

app.listen(process.env.PORT, () => {
    console.log(`server is running on port ${process.env.PORT}`);
});
