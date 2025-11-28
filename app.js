require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

// Routes
const authRouter = require("./routes/authRouter");
const productRouter = require("./routes/productRouter");
const wishlistRouter = require("./routes/wishListRouter");
const cartRouter = require("./routes/cartRouter");

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = [
  "http://localhost:5173", // dev
  "https://g2-iota.vercel.app", // your Vercel frontend origin (exact)
];

// ---------- Middleware ----------
// Enable CORS for frontend with credentials
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow server-to-server
      return allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json());
// Parse cookies
app.use(cookieParser());

// ---------- API Routes ----------
app.use("/api/auth", authRouter);
app.use("/api", productRouter); // /api/products endpoint
app.use("/api/wishlist", wishlistRouter);
app.use("/api/cart", cartRouter);

// ---------- Serve React build in production ----------
if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "client", "build");
  app.use(express.static(buildPath));

  // SPA catch-all route — MUST be after API routes
  app.use((req, res, next) => {
    // If the request starts with /api, skip (for your API routes)
    if (req.path.startsWith("/api")) return next();

    res.sendFile(path.join(buildPath, "index.html"));
  });
}

// ---------- Connect to MongoDB & Start Server ----------
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Database connected");

    app.listen(port, () => {
      console.log(`Server running on PORT ${port}`);
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
};

startServer();
