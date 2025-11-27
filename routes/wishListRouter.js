const express = require("express");
const router = express.Router();
const wishlistController = require("../controllers/wishListController");
const { protect } = require("../controllers/authController");

// Get wishlist
router.get("/", protect, wishlistController.getWishlist);

// Add to wishlist
router.post("/", protect, wishlistController.addToWishlist);

// Remove from wishlist
router.delete("/:productId", protect, wishlistController.removeFromWishlist);

module.exports = router;
