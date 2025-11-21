// models/Product.js
const mongoose = require("mongoose");
const slugify = require("slugify");

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    short_description: { type: String, trim: true },
    description: { type: String, trim: true },
    categories: { type: [String], default: [] },
    lengths: { type: [Number], default: [] },
    price_by_length: { type: Map, of: Number, default: {} },
    base_price: { type: String, trim: true },
    images: { type: String, trim: true }, // single image URL
  },
  { timestamps: true }
);

/**
 * Pre-save hook to auto-generate slug from title if not provided
 * and compute base_price from price_by_length
 */
productSchema.pre("save", function (next) {
  // Ensure slug is slugified from title if not already set
  if (!this.slug) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }

  // Compute base_price string: min - max from price_by_length
  if (this.price_by_length && Object.keys(this.price_by_length).length > 0) {
    const prices = Object.values(this.price_by_length);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    this.base_price = `${min.toFixed(3)} - ${max.toFixed(3)}`;
  }

  next();
});

module.exports = mongoose.model("Product", productSchema);
