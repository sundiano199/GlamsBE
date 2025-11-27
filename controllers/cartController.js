const mongoose = require("mongoose");
const Cart = require("../models/cart");
const Product = require("../models/product");

// Helper to format cart items for frontend
const formatCartItems = (items) =>
  items.map((it) => ({
    id: it.productId.toString(),
    title: it.name,
    images: it.image ? [it.image] : [],
    price: it.price,
    quantity: it.quantity,
  }));

/**
 * GET /api/cart
 * Returns cart items for guest or signed-in user
 */
const getCart = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (userId) {
      let cart = await Cart.findOne({ user: userId }).lean();
      if (!cart) cart = { items: [] };
      return res.json({ items: formatCartItems(cart.items) });
    }

    // guest session
    req.session = req.session || {};
    req.session.cart = req.session.cart || [];
    return res.json({ items: formatCartItems(req.session.cart) });
  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/cart
 * Add item to cart (guest or signed-in user)
 */
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    if (!productId)
      return res.status(400).json({ message: "productId required" });

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });

    const userId = req.user?.id;

    if (userId) {
      // signed-in user
      let cart = await Cart.findOne({ user: userId });
      if (!cart) cart = await Cart.create({ user: userId, items: [] });

      const existing = cart.items.find(
        (it) => it.productId.toString() === productId
      );
      if (existing) existing.quantity += qty;
      else
        cart.items.push({
          productId: mongoose.Types.ObjectId(productId),
          name: product.title,
          price: product.price,
          image: product.image || "",
          quantity: qty,
        });

      await cart.save();
      return res.json({ items: formatCartItems(cart.items) });
    }

    // guest
    req.session = req.session || {};
    req.session.cart = req.session.cart || [];
    const existing = req.session.cart.find((it) => it.productId === productId);
    if (existing) existing.quantity += qty;
    else
      req.session.cart.push({
        productId,
        name: product.title,
        price: product.price,
        image: product.image || "",
        quantity: qty,
      });

    return res.json({ items: formatCartItems(req.session.cart) });
  } catch (err) {
    console.error("addToCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /api/cart/:itemId
 * Update quantity
 */
const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!itemId) return res.status(400).json({ message: "itemId required" });

    // coerce quantity to integer (allow 0 to remove)
    const qty = Math.max(0, parseInt(quantity, 10) || 0);

    // signed-in user path
    const userId = req.user?.id;
    if (userId) {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      // ensure itemId is a valid ObjectId before comparing
      const idStr = String(itemId);
      const item = cart.items.find((it) => String(it.productId) === idStr);
      if (!item) return res.status(404).json({ message: "Item not found" });

      if (qty === 0) {
        cart.items = cart.items.filter((it) => String(it.productId) !== idStr);
      } else {
        item.quantity = qty;
      }

      await cart.save();

      return res.json({ items: formatCartItems(cart.items) });
    }

    // guest session path
    req.session = req.session || {};
    req.session.cart = req.session.cart || [];
    const idx = req.session.cart.findIndex(
      (it) => String(it.productId) === String(itemId)
    );
    if (idx === -1) return res.status(404).json({ message: "Item not found" });

    if (qty === 0) {
      req.session.cart.splice(idx, 1);
    } else {
      req.session.cart[idx].quantity = qty;
    }

    return res.json({ items: formatCartItems(req.session.cart) });
  } catch (err) {
    console.error("updateCartItem error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /api/cart/:itemId
 */
const removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user?.id;

    if (userId) {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      cart.items = cart.items.filter(
        (it) => it.productId.toString() !== itemId
      );
      await cart.save();
      return res.json({ items: formatCartItems(cart.items) });
    }

    // guest
    req.session.cart = req.session.cart || [];
    req.session.cart = req.session.cart.filter((it) => it.productId !== itemId);
    return res.json({ items: formatCartItems(req.session.cart) });
  } catch (err) {
    console.error("removeCartItem error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/cart/product-snapshot
 */
const productSnapshot = async (req, res) => {
  try {
    const { productIds } = req.body;
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    return res.json({ products });
  } catch (err) {
    console.error("productSnapshot error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/cart/merge
 */
// server/controllers/cartController.js

// ... other requires at top of file (Cart, Product, etc.)

/**
 * POST /api/cart/merge
 * Merge guest items into the signed-in user's cart.
 * Expects req.body.items = [{ productId, name, price, image, quantity }, ...]
 */
const mergeCartOnSignin = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const guestItems = req.body.items || [];
    if (!Array.isArray(guestItems))
      return res.status(400).json({ message: "Invalid items" });

    // validate productIds and normalize items
    const normalized = [];
    for (const it of guestItems) {
      const pid = it?.productId || it?.id || it;
      if (!pid || !mongoose.isValidObjectId(pid)) {
        // skip invalid ids, but don't crash
        console.warn("Skipping invalid productId during merge:", pid);
        continue;
      }
      normalized.push({
        productId: new mongoose.Types.ObjectId(String(pid)),
        name: it.name || it.title || "",
        price: Number(it.price) || 0,
        image: it.image || (Array.isArray(it.images) ? it.images[0] : "") || "",
        quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
      });
    }

    // find or create user's cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // merge: for each normalized item, add quantity if exists else push
    for (const g of normalized) {
      const existing = cart.items.find(
        (c) => String(c.productId) === String(g.productId)
      );
      if (existing) {
        existing.quantity = (existing.quantity || 0) + g.quantity;
        // optionally keep price/image/name from product (or from guest item)
        existing.price = g.price || existing.price;
        existing.name = g.name || existing.name;
        existing.image = g.image || existing.image;
      } else {
        cart.items.push({
          productId: g.productId,
          name: g.name,
          price: g.price,
          image: g.image,
          quantity: g.quantity,
        });
      }
    }

    await cart.save();

    // return formatted items (same shape as getCart: id,title,images,price,quantity)
    const formatted = cart.items.map((it) => ({
      id: it.productId.toString(),
      title: it.name,
      images: it.image ? [it.image] : [],
      price: it.price,
      quantity: it.quantity,
    }));

    return res.json({ items: formatted });
  } catch (err) {
    console.error("mergeCartOnSignin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  productSnapshot,
  mergeCartOnSignin,
};
