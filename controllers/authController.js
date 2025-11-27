// controllers/authController.js
const User = require("../models/user");
const jwt = require("jsonwebtoken");

/* ---------- Config ---------- */
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d"; // token expiry

/* ---------- Helpers ---------- */

/**
 * Sign a JWT for a user
 * (include minimal info in payload)
 */
const signToken = (user) => {
  return jwt.sign(
    { id: String(user._id), email: user.email, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Cookie options factory (used for set + clear).
 * - DO NOT set `domain` so cookie is host-scoped (important for proxy).
 * - `sameSite:none` + `secure:true` in production to support cross-site cookies when needed.
 */
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  path: "/",
});

/**
 * Set token cookie on response
 */
const sendTokenCookie = (res, token) => {
  res.cookie("token", token, cookieOptions());
};

/**
 * Clear token cookie on response (explicitly overwrite)
 */
const clearTokenCookie = (res) => {
  // Use same options but expire immediately
  res.cookie("token", "", {
    ...cookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
};

/* ---------- Controllers ---------- */

/**
 * Sign up (create user + set cookie)
 */
const signup = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Prevent duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const newUser = await User.create({ fullName, email, phone, password });

    const token = signToken(newUser);
    sendTokenCookie(res, token);

    return res.status(201).json({
      message: "Signup successful",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
      },
    });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ message: "Error signing up" });
  }
};

/**
 * Login (validate credentials + set cookie)
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // fetch user with password for comparison
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);
    sendTokenCookie(res, token);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "Error logging in" });
  }
};

/**
 * Logout (clear cookie)
 */
const logout = (req, res) => {
  try {
    clearTokenCookie(res);
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};

/**
 * Protect middleware — verify JWT in cookie and attach `req.user`
 */
const protect = async (req, res, next) => {
  try {
    // cookies parser middleware must run earlier (cookieParser())
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Not logged in" });

    // verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // attach minimal user info to req.user
    req.user = {
      id: decoded.id,
      email: decoded.email,
      fullName: decoded.fullName,
    };
    return next();
  } catch (err) {
    console.error("protect error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Get current logged-in user (reads req.user set by protect)
 */
const getUser = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ message: "Not logged in" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        wishlist: user.wishlist || [],
      },
    });
  } catch (err) {
    console.error("getUser error:", err);
    return res.status(500).json({ message: "Error fetching user" });
  }
};

/**
 * Request password reset (sends token — email sending omitted)
 */
const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email }).select(
      "+passwordResetToken +passwordResetExpires"
    );
    if (!user) {
      // keep response generic to avoid account enumeration
      return res
        .status(200)
        .json({ message: "If that account exists, a reset link was sent." });
    }

    const resetToken = user.createPasswordResetToken(60); // 60 mins expiry
    await user.save({ validateBeforeSave: false });

    // TODO: send email with link containing token & userId
    // Example: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&id=${user._id}`

    return res
      .status(200)
      .json({ message: "If that account exists, a reset link was sent." });
  } catch (err) {
    console.error("requestPasswordReset error:", err);
    return res.status(500).json({ message: "Error requesting password reset" });
  }
};

/**
 * Reset password given token & id
 */
const resetPassword = async (req, res) => {
  const { token, id } = req.query;
  const { password } = req.body;
  try {
    if (!token || !id)
      return res.status(400).json({ message: "Invalid request" });

    const user = await User.findById(id).select(
      "+passwordResetToken +passwordResetExpires"
    );
    if (!user || !user.isPasswordResetTokenValid(token)) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = password;
    await user.clearPasswordResetToken();

    await user.save();
    return res
      .status(200)
      .json({ message: "Password reset successful. Please log in." });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Error resetting password" });
  }
};

/* ---------- Exports ---------- */
module.exports = {
  signup,
  login,
  logout,
  protect,
  getUser,
  requestPasswordReset,
  resetPassword,
};
