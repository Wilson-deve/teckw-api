"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const wishlist_1 = require("../controllers/wishlist");
const router = (0, express_1.Router)();
router
    .route("/")
    .get(auth_1.authenticate, wishlist_1.getWishlist)
    .post(auth_1.authenticate, wishlist_1.addToWishlist)
    .post(auth_1.authenticate, wishlist_1.toggleWishlistItem)
    .delete(auth_1.authenticate, wishlist_1.clearWishlist);
router.route("/:itemId").delete(auth_1.authenticate, wishlist_1.removeFromWishlist);
router.route("/:itemId/move-to-cart").post(auth_1.authenticate, wishlist_1.moveToCart);
exports.wishlistRoutes = router;
