const mongoose = require("mongoose");
const Product = require("../models/product");

const getProducts = async (req, res) => {
  try {
    const category = req.query.category || "all";
    let products;

    if (category === "all") {
      products = await Product.find();
    } else {
      products = await Product.find({ categories: category });
    }

    res.status(200).json({ products });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Server error fetching products" });
  }
};
// controllers/productsController.js  (or wherever your getProductById is defined)

const getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    // 1) Try app-level id lookup first (your preferred flow)
    let product = await Product.findOne({ id });

    // 2) If not found, and the param looks like a Mongo ObjectId, try findById
    if (!product) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        product = await Product.findById(id);
      }
    }

    // 3) If still not found, return 404
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 4) Return product
    return res.json({ product });
  } catch (err) {
    console.error("Error fetching product by id:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

module.exports = { getProducts, getProductById };
