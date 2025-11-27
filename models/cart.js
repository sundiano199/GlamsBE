// models/Cart.js
const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CartItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: String,
  price: Number, // snapshot price
  image: String,
  quantity: { type: Number, default: 1 },
});

const CartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    items: [CartItemSchema],
  },
  { timestamps: true }
);

module.exports = model("Cart", CartSchema);
