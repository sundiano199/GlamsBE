const express = require("express");
const {
  signup,
  login,
  logout,
  protect,
  getUser,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");

const router = express.Router();
router.post("/signup", signup);
router.post("/login", login);
router.get("/getUser", protect, getUser);
router.post("/logout", logout);

module.exports = router;
