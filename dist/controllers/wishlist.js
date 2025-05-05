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
exports.moveToCart = exports.clearWishlist = exports.removeFromWishlist = exports.toggleWishlistItem = exports.addToWishlist = exports.getWishlist = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const types_1 = require("../types");
const getWishlist = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const wishlist = yield prisma_1.default.wishlist.findUnique({
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
                                rating: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });
        if (!wishlist) {
            const newWishlist = yield prisma_1.default.wishlist.create({
                data: {
                    userId,
                    items: { create: [] },
                },
                include: { items: { include: { product: true } } },
            });
            res.json({
                success: true,
                data: newWishlist,
            });
            return;
        }
        res.json({
            success: true,
            data: Object.assign(Object.assign({}, wishlist), { items: wishlist.items.map((item) => (Object.assign(Object.assign({}, item), { product: Object.assign(Object.assign({}, item.product), { finalPrice: item.product.discount
                            ? Number(item.product.price) * (1 - item.product.discount / 100)
                            : item.product.price, inStock: item.product.stock > 0 }) }))) }),
        });
    }
    catch (error) {
        console.error("Get wishlist error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch wishlist",
        });
    }
});
exports.getWishlist = getWishlist;
const addToWishlist = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { productId } = types_1.wishlistItemSchema.parse(req.body);
        const product = yield prisma_1.default.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            res.status(404).json({
                success: false,
                code: "PRODUCT_NOT_FOUND",
                message: "Product not found",
            });
            return;
        }
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        let wishlist = yield prisma_1.default.wishlist.findUnique({
            where: { userId },
        });
        if (!wishlist) {
            wishlist = yield prisma_1.default.wishlist.create({
                data: { userId },
            });
        }
        const existingItem = yield prisma_1.default.wishlistItem.findFirst({
            where: { wishlistId: wishlist.id, productId },
        });
        if (existingItem) {
            res.status(409).json({
                success: false,
                code: "ITEM_EXISTS",
                message: "Product already in wishlist",
            });
            return;
        }
        const wishlistItem = yield prisma_1.default.wishlistItem.create({
            data: { wishlistId: wishlist.id, productId },
            include: { product: true },
        });
        res.status(201).json({
            success: true,
            data: wishlistItem,
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
        console.error("Add to wishlist error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item to wishlist",
        });
    }
});
exports.addToWishlist = addToWishlist;
const toggleWishlistItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { productId } = types_1.wishlistItemSchema.parse(req.body);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        let wishlist = yield prisma_1.default.wishlist.findUnique({
            where: { userId },
        });
        if (!wishlist) {
            wishlist = yield prisma_1.default.wishlist.create({
                data: { userId },
            });
        }
        const existingItem = yield prisma_1.default.wishlistItem.findFirst({
            where: { wishlistId: wishlist.id, productId },
        });
        if (existingItem) {
            // Remove from wishlist
            yield prisma_1.default.wishlistItem.delete({
                where: { id: existingItem.id },
            });
            res.json({
                success: true,
                message: "Product removed from wishlist",
                isWishlisted: false,
            });
            return;
        }
        else {
            // Check if product exists
            const product = yield prisma_1.default.product.findUnique({
                where: { id: productId },
            });
            if (!product) {
                res.status(404).json({
                    success: false,
                    code: "PRODUCT_NOT_FOUND",
                    message: "Product not found",
                });
                return;
            }
            // Add to wishlist
            yield prisma_1.default.wishlistItem.create({
                data: { wishlistId: wishlist.id, productId },
            });
            res.json({
                success: true,
                message: "Product added to wishlist",
                isWishlisted: true,
            });
            return;
        }
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
        console.error("Toggle wishlist error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update wishlist",
        });
        return;
    }
});
exports.toggleWishlistItem = toggleWishlistItem;
const removeFromWishlist = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { itemId } = req.params;
        const wishlist = yield prisma_1.default.wishlist.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!wishlist) {
            res.status(404).json({
                success: false,
                code: "WISHLIST_NOT_FOUND",
                message: "Wishlist not found",
            });
            return;
        }
        const item = yield prisma_1.default.wishlistItem.findFirst({
            where: { id: itemId, wishlistId: wishlist.id },
        });
        if (!item) {
            res.status(404).json({
                success: false,
                code: "ITEM_NOT_FOUND",
                message: "Wishlist item not found",
            });
            return;
        }
        yield prisma_1.default.wishlistItem.delete({
            where: { id: itemId },
        });
        res.json({
            success: true,
            message: "Item removed from wishlist",
        });
    }
    catch (error) {
        console.error("Remove from wishlist error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove item from wishlist",
        });
    }
});
exports.removeFromWishlist = removeFromWishlist;
const clearWishlist = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const wishlist = yield prisma_1.default.wishlist.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!wishlist) {
            res.status(404).json({
                success: false,
                code: "WISHLIST_NOT_FOUND",
                message: "Wishlist not found",
            });
            return;
        }
        yield prisma_1.default.wishlistItem.deleteMany({
            where: { wishlistId: wishlist.id },
        });
        res.json({
            success: true,
            message: "Wishlist cleared successfully",
        });
    }
    catch (error) {
        console.error("Clear wishlist error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear wishlist",
        });
    }
});
exports.clearWishlist = clearWishlist;
const moveToCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { itemId } = req.params;
        const wishlist = yield prisma_1.default.wishlist.findUnique({
            where: { userId },
            include: { items: { where: { id: itemId }, include: { product: true } } },
        });
        if (!wishlist) {
            res.status(404).json({
                success: false,
                code: "WISHLIST_NOT_FOUND",
                message: "Wishlist not found",
            });
            return;
        }
        const wishlistItem = wishlist.items[0];
        if (!wishlistItem) {
            res.status(404).json({
                success: false,
                code: "ITEM_NOT_FOUND",
                message: "Wishlist item not found",
            });
            return;
        }
        if (wishlistItem.product.stock < 1) {
            res.status(400).json({
                success: false,
                code: "OUT_OF_STOCK",
                message: "Product is out of stock",
                productId: wishlistItem.productId,
            });
            return;
        }
        let cart = yield prisma_1.default.cart.findUnique({
            where: { userId },
        });
        if (!cart && userId) {
            cart = yield prisma_1.default.cart.create({
                data: { userId: userId },
            });
        }
        const existingCartItem = yield prisma_1.default.cartItem.findFirst({
            where: {
                cartId: cart === null || cart === void 0 ? void 0 : cart.id,
                productId: wishlistItem.productId,
            },
        });
        if (!(cart === null || cart === void 0 ? void 0 : cart.id)) {
            throw new Error("Cart not found");
        }
        if (existingCartItem) {
            yield prisma_1.default.cartItem.update({
                where: { id: existingCartItem.id },
                data: { quantity: existingCartItem.quantity + 1 },
            });
        }
        else {
            yield prisma_1.default.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId: wishlistItem.productId,
                    quantity: 1,
                },
            });
        }
        yield prisma_1.default.wishlistItem.delete({
            where: { id: itemId },
        });
        res.json({
            success: true,
            message: "Item moved to cart successfully",
        });
    }
    catch (error) {
        console.error("Move to cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to move item to cart",
        });
    }
});
exports.moveToCart = moveToCart;
