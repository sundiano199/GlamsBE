const User = require("../models/user");
const mongoose = require("mongoose");

// Get wishlist
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "wishlist.product",
      select: "id title images",
    });
    res.json({ success: true, items: user.wishlist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Add to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!mongoose.isValidObjectId(productId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid product ID" });

    const user = await User.findById(req.user.id);

    // Check if already in wishlist
    if (user.wishlist.some((item) => item.product.equals(productId))) {
      return res
        .status(200)
        .json({ success: true, message: "Already in wishlist" });
    }

    user.wishlist.push({ product: productId });
    await user.save();
    res.status(201).json({
      success: true,
      message: "Added to wishlist",
      wishlist: user.wishlist,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Remove from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    // Basic validation
    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product ID" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Load user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // normalize incoming productId to string for comparisons
    const pidStr = String(productId);

    // find index robustly — handle item.product being ObjectId, populated doc, or string
    const index = user.wishlist.findIndex((item) => {
      if (!item) return false;
      const prod = item.product;
      if (!prod) return false;
      // If populated document with _id
      if (prod._id) {
        return String(prod._id) === pidStr;
      }
      // If ObjectId instance or plain value
      return String(prod) === pidStr;
    });

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Not in wishlist" });
    }

    // remove the item
    user.wishlist.splice(index, 1);
    await user.save();

    // Populate the wishlist.product for consistent frontend shape
    await user.populate("wishlist.product", "title images price_by_length");

    // send populated wishlist back
    return res.json({
      success: true,
      message: "Removed from wishlist",
      items: user.wishlist,
    });
  } catch (err) {
    // extra logging for debugging
    console.error(
      "removeFromWishlist error:",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
