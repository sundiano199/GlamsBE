const express = require("express");
const router = express.Router();

// Controllers
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  productSnapshot,
  mergeCartOnSignin,
} = require("../controllers/cartController");

// Middleware
const { protect } = require("../controllers/authController");

// Public session-backed cart endpoints
router.get("/", getCart);
router.post("/", addToCart);
router.put("/:itemId", updateCartItem);
router.delete("/:itemId", removeCartItem);

// Protected endpoints
router.post("/product-snapshot", protect, productSnapshot);
router.post("/merge", protect, mergeCartOnSignin);

module.exports = router;
