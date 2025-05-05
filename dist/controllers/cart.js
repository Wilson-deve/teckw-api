"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const types_1 = require("../types");
const getCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const cart = yield prisma_1.default.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                discount: true,
                                images: true,
                                stock: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                },
            },
        });
        if (!cart) {
            const newCart = yield prisma_1.default.cart.create({
                data: {
                    userId,
                    items: {
                        create: [],
                    },
                },
                include: {
                    items: { include: { product: true } },
                },
            });
            res.json({
                success: true,
                data: newCart,
            });
            return;
        }
        let total = 0;
        const items = cart.items.map((item) => {
            const finalPrice = item.product.discount
                ? Number(item.product.price) * (1 - item.product.discount / 100)
                : Number(item.product.price);
            total += finalPrice * item.quantity;
            return Object.assign(Object.assign({}, item), { product: Object.assign(Object.assign({}, item.product), { finalPrice: parseFloat(finalPrice.toFixed(2)), available: item.product.stock >= item.quantity }) });
        });
        res.json({
            success: true,
            data: Object.assign(Object.assign({}, cart), { items, total: parseFloat(total.toFixed(2)), itemsCount: cart.items.reduce((sum, item) => sum + item.quantity, 0) }),
        });
    }
    catch (error) {
        console.error("Get cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cart",
        });
    }
});
exports.getCart = getCart;
const addToCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const data = types_1.cartItemSchema.parse(req.body);
        const product = yield prisma_1.default.product.findUnique({
            where: { id: data.productId },
            select: { stock: true, price: true },
        });
        if (!product) {
            res.status(404).json({
                success: false,
                code: "PRODUCT_NOT_FOUND",
                message: "Product not found",
            });
            return;
        }
        if (product.stock < data.quantity) {
            res.status(400).json({
                success: false,
                code: "INSUFFICIENT_STOCK",
                message: "Not enough stock available",
                availableStock: product.stock,
            });
            return;
        }
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        let cart = yield prisma_1.default.cart.findUnique({
            where: { userId },
        });
        if (!cart) {
            cart = yield prisma_1.default.cart.create({
                data: { userId },
            });
        }
        const existingItem = yield prisma_1.default.cartItem.findFirst({
            where: {
                cartId: cart.id,
                productId: data.productId,
            },
        });
        let cartItem;
        if (existingItem) {
            const newQuantity = existingItem.quantity + data.quantity;
            if (product.stock < newQuantity) {
                res.status(400).json({
                    success: false,
                    code: "INSUFFICIENT_STOCK",
                    message: "Adding this quantity would exceed available stock",
                    availableStock: product.stock,
                    currentInCart: existingItem.quantity,
                });
                return;
            }
            cartItem = yield prisma_1.default.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: newQuantity },
                include: { product: true },
            });
        }
        else {
            cartItem = yield prisma_1.default.cartItem.create({
                data: Object.assign(Object.assign({}, data), { cartId: cart.id }),
                include: { product: true },
            });
        }
        res.status(201).json({
            success: true,
            data: cartItem,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                errors: error.errors.map((e) => ({
                    path: e.path.join("."),
                    message: e.message,
                })),
            });
            return;
        }
        console.error("Add to cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item to cart",
        });
    }
});
exports.addToCart = addToCart;
const updateCartItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { itemId } = req.params;
        const data = types_1.updateCartItemSchema.parse(req.body);
        const cart = yield prisma_1.default.cart.findUnique({
            where: { userId },
            include: { items: { where: { id: itemId }, include: { product: true } } },
        });
        if (!cart) {
            res.status(404).json({
                success: false,
                code: "CART_NOT_FOUND",
                message: "Cart not found",
            });
            return;
        }
        const cartItem = cart.items[0];
        if (!cartItem) {
            res.status(404).json({
                success: false,
                code: "ITEM_NOT_FOUND",
                message: "Cart item not found",
            });
            return;
        }
        if (data.quantity !== undefined) {
            if (cartItem.product.stock < data.quantity) {
                res.status(400).json({
                    success: false,
                    code: "INSUFFICIENT_STOCK",
                    message: "Not enough stock available",
                    availableStock: cartItem.product.stock,
                });
                return;
            }
        }
        const updatedItem = yield prisma_1.default.cartItem.update({
            where: { id: itemId },
            data,
            include: { product: true },
        });
        res.json({
            success: true,
            data: updatedItem,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                errors: error.errors.map((e) => ({
                    path: e.path.join("."),
                    message: e.message,
                })),
            });
            return;
        }
        console.error("Update cart item error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cart item",
        });
    }
});
exports.updateCartItem = updateCartItem;
const removeFromCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { itemId } = req.params;
        const cart = yield prisma_1.default.cart.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!cart) {
            res.status(404).json({
                success: false,
                code: "CART_NOT_FOUND",
                message: "Cart not found",
            });
            return;
        }
        const item = yield prisma_1.default.cartItem.findFirst({
            where: {
                id: itemId,
                cartId: cart.id,
            },
        });
        if (!item) {
            res.status(404).json({
                success: false,
                code: "ITEM_NOT_FOUND",
                message: "Cart item not found",
            });
            return;
        }
        yield prisma_1.default.cartItem.delete({
            where: { id: itemId },
        });
        res.json({
            success: true,
            message: "Item removed from cart",
        });
    }
    catch (error) {
        console.error("Remove from cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove item from cart",
        });
    }
});
exports.removeFromCart = removeFromCart;
const clearCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const cart = yield prisma_1.default.cart.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!cart) {
            res.status(404).json({
                success: false,
                code: "CART_NOT_FOUND",
                message: "Cart not found",
            });
            return;
        }
        yield prisma_1.default.cartItem.deleteMany({
            where: { cartId: cart.id },
        });
        res.json({
            success: true,
            message: "Cart cleared successfully",
        });
    }
    catch (error) {
        console.error("Clear cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear cart",
        });
    }
});
exports.clearCart = clearCart;
