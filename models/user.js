// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const { Schema } = mongoose;
const SALT_ROUNDS = 4;

const WishlistItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 150 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // allow multiple nulls
    },

    // Authentication
    password: { type: String, required: true, minlength: 6 },

    // Roles / verification
    isEmailVerified: { type: Boolean, default: false },
    roles: { type: [String], default: ["customer"] },

    // Wishlist (embedded small array)
    wishlist: { type: [WishlistItemSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: docToJSON },
    toObject: { virtuals: true },
  }
);

/**
 * Transform for toJSON: remove sensitive/internal fields
 */
function docToJSON(doc, ret /*, options*/) {
  delete ret.password;
  delete ret.__v;
  return ret;
}



/**
 * Hash password before saving (only when modified)
 */
userSchema.pre("save", async function (next) {
  const user = this;
  if (!user.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    user.password = await bcrypt.hash(user.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Compare candidate password with stored hash
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Wishlist helpers
 */
userSchema.methods.addToWishlist = function (productId) {
  const exists = this.wishlist.some((w) => w.product.equals(productId));
  if (!exists) {
    this.wishlist.push({ product: productId });
  }
  return this.save();
};

userSchema.methods.removeFromWishlist = function (productId) {
  this.wishlist = this.wishlist.filter((w) => !w.product.equals(productId));
  return this.save();
};

module.exports = mongoose.model("User", userSchema);
