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
const getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    // findOne returns a single document
    const product = await Product.findOne({ id });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ product });
  } catch (err) {
    console.error("Error fetching product by id:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

module.exports = { getProducts, getProductById };
