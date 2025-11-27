const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
} = require("../controllers/productController");

// Use plural "products" to match frontend fetch
router.get("/products", getProducts);
router.get("/products/:id", getProductById);


module.exports = router;
