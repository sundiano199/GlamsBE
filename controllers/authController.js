// controllers/authController.js
const User = require("../models/user");
const jwt = require("jsonwebtoken");

const crypto = require("crypto");

// JWT settings
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d"; // access token expiry

/**
 * Helper to create a signed JWT for a user
 */
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Cookie options factory (reused for set + clear)
 */
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  path: "/", // ensure cookie is available site-wide
});

/**
 * Helper to send token in HTTP-only cookie
 */
const sendTokenCookie = (res, token) => {
  res.cookie("token", token, cookieOptions());
};

/**
 * Sign Up
 */
const signup = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Prevent duplicate email
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const newUser = await User.create({ fullName, email, phone, password });

    const token = signToken(newUser);
    sendTokenCookie(res, token);

    res.status(201).json({
      message: "Signup successful",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error signing up" });
  }
};

/**
 * Login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    const token = signToken(user);
    sendTokenCookie(res, token);

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error logging in" });
  }
};

/**
 * Logout
 */
const logout = (req, res) => {
  // Explicitly overwrite cookie with same options used when setting it
  res.cookie("token", "", {
    ...cookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return res.json({ success: true, message: "Logged out successfully" });
};

/**
 * Middleware: Protect routes
 */
const protect = async (req, res, next) => {
  try {
    if (!req.cookies) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Not logged in" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Protect error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Get current logged-in user
 */
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // IMPORTANT: return under { user: ... } so frontend fetchUser() can read res.data.user
    res.status(200).json({
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        wishlist: user.wishlist || [],
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching user" });
  }
};

/**
 * Request Password Reset
 */
const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email }).select(
      "+passwordResetToken +passwordResetExpires"
    );
    if (!user)
      return res
        .status(200)
        .json({ message: "If that account exists, a reset link was sent." });

    const resetToken = user.createPasswordResetToken(60); // 60 mins expiry
    await user.save({ validateBeforeSave: false });

    // TODO: send email with link containing token & userId
    // Example: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&id=${user._id}`

    res
      .status(200)
      .json({ message: "If that account exists, a reset link was sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error requesting password reset" });
  }
};

/**
 * Reset Password
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
    if (!user || !user.isPasswordResetTokenValid(token))
      return res.status(400).json({ message: "Invalid or expired token" });

    user.password = password;
    await user.clearPasswordResetToken();

    await user.save();
    res
      .status(200)
      .json({ message: "Password reset successful. Please log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resetting password" });
  }
};

module.exports = {
  signup,
  login,
  logout,
  protect,
  getUser,
  requestPasswordReset,
  resetPassword,
};
