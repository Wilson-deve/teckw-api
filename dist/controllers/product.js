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
exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getShareLink = exports.getProductById = exports.getProducts = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { category, brand, minPrice, maxPrice, search, sort = "-createdAt", page = 1, limit = 10, } = req.query;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const where = {};
        if (category)
            where.category = category;
        if (brand)
            where.brand = brand;
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice)
                where.price.gte = Number(minPrice);
            if (maxPrice)
                where.price.lte = Number(maxPrice);
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }
        let orderBy = {};
        const sortField = sort.toString().startsWith("-")
            ? sort.toString().substring(1)
            : sort.toString();
        const sortOrder = sort.toString().startsWith("-") ? "desc" : "asc";
        orderBy[sortField] = sortOrder;
        switch (sortField) {
            case "name":
                orderBy.name = sortOrder;
                break;
            case "price":
                orderBy.price = sortOrder;
                break;
            case "highPrice":
                orderBy.price = "desc";
                break;
            case "lowPrice":
                orderBy.price = "asc";
                break;
            case "sale":
                orderBy = {
                    discountPercentage: "desc",
                };
                break;
            case "newest":
                orderBy.createdAt = "desc";
                break;
            case "popularity":
                orderBy.viewCount = "desc";
                break;
            default:
                orderBy[sortField] = sortOrder;
        }
        const [products, total] = yield Promise.all([
            prisma_1.default.product.findMany({
                where,
                orderBy,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: {
                    category: true,
                    images: true,
                    reviews: {
                        select: { rating: true },
                    },
                },
            }),
            prisma_1.default.product.count({ where }),
        ]);
        const wishlists = userId
            ? yield prisma_1.default.wishlistItem.findMany({
                where: {
                    wishlist: {
                        userId: userId,
                    },
                    productId: {
                        in: products.map((p) => p.id),
                    },
                },
            })
            : [];
        const cartItems = userId
            ? yield prisma_1.default.cartItem.findMany({
                where: {
                    cart: { userId },
                    productId: { in: products.map((p) => p.id) },
                },
            })
            : [];
        const enhancedProducts = products.map((product) => {
            const averageRating = product.reviews.length > 0
                ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
                    product.reviews.length
                : null;
            const discountPercentage = product.discount && product.price
                ? Math.round(((Number(product.price) - Number(product.discount)) /
                    Number(product.price)) *
                    100)
                : null;
            const isWishlisted = wishlists.some((w) => w.productId === product.id);
            const cartItem = cartItems.find((c) => c.productId === product.id);
            return Object.assign(Object.assign({}, product), { rating: averageRating, discountPercentage, isOnSale: discountPercentage !== null, isWishlisted, inCart: !!cartItem, cartQuantity: (cartItem === null || cartItem === void 0 ? void 0 : cartItem.quantity) || 0, mainImage: product.images.length > 0 ? product.images[0].url : null });
        });
        res.json({
            success: true,
            data: enhancedProducts,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Get products error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products",
        });
    }
});
exports.getProducts = getProducts;
const getProductById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const product = yield prisma_1.default.product.findUnique({
            where: { id },
            include: {
                category: true,
                images: true,
                variations: true,
                reviews: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatarUrl: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });
        if (!product) {
            res.status(404).json({
                success: false,
                code: "PRODUCT_NOT_FOUND",
                message: "Product not found",
            });
            return;
        }
        const totalReviews = product.reviews.length;
        const averageRating = product.reviews.length > 0
            ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
                product.reviews.length
            : null;
        const discountPercentage = product.discount || null;
        const finalPrice = product.discount
            ? Number(product.price) * (1 - product.discount / 100)
            : Number(product.price);
        let isWishlisted = false;
        if (userId) {
            const userWishlist = yield prisma_1.default.wishlist.findUnique({
                where: { userId },
                include: {
                    items: {
                        where: { productId: id },
                        take: 1,
                    },
                },
            });
            isWishlisted = (userWishlist === null || userWishlist === void 0 ? void 0 : userWishlist.items.length) ? true : false;
        }
        let inCart = false;
        let cartQuantity = 0;
        if (userId) {
            const userCart = yield prisma_1.default.cart.findUnique({
                where: { userId },
                include: {
                    items: {
                        where: { productId: id },
                        take: 1,
                    },
                },
            });
            if (userCart === null || userCart === void 0 ? void 0 : userCart.items.length) {
                inCart = true;
                cartQuantity = userCart.items[0].quantity;
            }
        }
        const formattedProduct = Object.assign(Object.assign({}, product), { rating: averageRating, totalReviewCount: totalReviews, discount: discountPercentage, originalPrice: Number(product.price), finalPrice: parseFloat(finalPrice.toFixed(2)), isOnSale: !!product.discount, isWishlisted,
            inCart,
            cartQuantity, inStock: product.stock > 0, colorOptions: [], variations: ((_b = product.variations) === null || _b === void 0 ? void 0 : _b.map((variation) => ({
                id: variation.id,
                price: variation.price || product.price,
                stock: variation.stock !== undefined ? variation.stock : product.stock,
                // Additional variation details here
            }))) || [] });
        res.json({
            success: true,
            data: formattedProduct,
        });
    }
    catch (error) {
        console.error("Get product by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product",
        });
    }
});
exports.getProductById = getProductById;
const getShareLink = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        const shareLink = `${process.env.APP_URL}/product/${productId}`;
        res.json({
            success: true,
            data: {
                shareLink,
                title: "Check out this product!",
            },
        });
    }
    catch (error) {
        console.error("Get share link error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate share link",
        });
    }
});
exports.getShareLink = getShareLink;
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, price, categoryId, brand, stock, specifications, discount, images, } = req.body;
        const newProduct = yield prisma_1.default.product.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                category: {
                    connect: { id: categoryId },
                },
                brand,
                stock: parseInt(stock, 10),
                specifications,
                discount: discount ? parseFloat(discount) : null,
                images: {
                    create: images
                        ? images.map((image, index) => ({
                            url: image,
                            isMain: index === 0,
                        }))
                        : [],
                },
            },
            include: {
                category: true,
                images: true,
            },
        });
        res.status(201).json({
            success: true,
            data: newProduct,
        });
    }
    catch (error) {
        console.error("Create product error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create product",
        });
    }
});
exports.createProduct = createProduct;
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, price, stock, brand, categoryId, specifications, discount, images, } = req.body;
        const productExists = yield prisma_1.default.product.findUnique({
            where: { id: req.params.id },
        });
        if (!productExists) {
            res.status(404).json({
                success: false,
                code: "PRODUCT_NOT_FOUND",
                message: "Product not found",
            });
            return;
        }
        const productData = {
            name,
            description,
            price: price ? parseFloat(price) : undefined,
            stock: stock ? parseInt(stock, 10) : undefined,
            brand,
            specifications,
            discount: discount ? parseFloat(discount) : null,
            categoryId,
        };
        Object.keys(productData).forEach((key) => {
            if (productData[key] === undefined) {
                delete productData[key];
            }
        });
        const updatedProduct = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const product = yield tx.product.update({
                where: { id: req.params.id },
                data: productData,
                include: {
                    category: true,
                    images: true,
                },
            });
            if (images && images.length > 0) {
                yield tx.productImage.deleteMany({
                    where: {
                        productId: req.params.id,
                    },
                });
                yield tx.productImage.createMany({
                    data: images.map((image, index) => ({
                        url: image,
                        isMain: index === 0,
                        productId: req.params.id,
                    })),
                });
                const updatedImages = yield tx.productImage.findMany({
                    where: { productId: req.params.id },
                });
                product.images = updatedImages;
            }
            return product;
        }));
        res.status(200).json({
            success: true,
            data: updatedProduct,
        });
    }
    catch (error) {
        console.error("Update product error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update product",
        });
    }
});
exports.updateProduct = updateProduct;
const deleteProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const productExists = yield prisma_1.default.product.findUnique({
            where: { id },
        });
        if (!productExists) {
            res.status(404).json({
                success: false,
                code: "PRODUCT_NOT_FOUND",
                message: "Product not found",
            });
            return;
        }
        yield prisma_1.default.product.delete({
            where: { id },
        });
        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete product error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete product",
        });
    }
});
exports.deleteProduct = deleteProduct;
