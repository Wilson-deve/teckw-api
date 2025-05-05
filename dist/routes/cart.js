"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const cart_1 = require("../controllers/cart");
const router = (0, express_1.Router)();
router
    .route("/")
    .get(auth_1.authenticate, cart_1.getCart)
    .post(auth_1.authenticate, cart_1.addToCart)
    .delete(auth_1.authenticate, cart_1.clearCart);
router
    .route("/:itemId")
    .put(auth_1.authenticate, cart_1.updateCartItem)
    .delete(auth_1.authenticate, cart_1.removeFromCart);
exports.cartRoutes = router;
