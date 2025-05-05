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
exports.deleteReview = exports.updateReview = exports.createReview = exports.getProductReviews = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const rating_1 = require("../utils/rating");
const types_1 = require("../types");
const getProductReviews = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        const { page = 1, limit = 10, sort = "-createdAt" } = req.query;
        const orderBy = {};
        const sortField = sort.toString().startsWith("-")
            ? sort.toString().substring(1)
            : sort.toString();
        const sortOrder = sort.toString().startsWith("-") ? "desc" : "asc";
        orderBy[sortField] = sortOrder;
        const [reviews, total] = yield Promise.all([
            prisma_1.default.review.findMany({
                where: { productId },
                orderBy,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatarUrl: true,
                        },
                    },
                },
            }),
            prisma_1.default.review.count({ where: { productId } }),
        ]);
        res.json({
            success: true,
            data: reviews,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
            averageRating: yield (0, rating_1.calculateAverageRating)(productId),
        });
    }
    catch (error) {
        console.error("Get product reviews error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product reviews",
        });
    }
});
exports.getProductReviews = getProductReviews;
const createReview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { productId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const data = types_1.createReviewSchema.parse(req.body);
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
        const hasPurchased = yield prisma_1.default.orderItem.findFirst({
            where: {
                productId,
                order: {
                    userId,
                    status: "DELIVERED",
                },
            },
        });
        if (!hasPurchased) {
            res.status(403).json({
                success: false,
                message: "You can only review products you have purchased",
            });
            return;
        }
        const existingReview = yield prisma_1.default.review.findFirst({
            where: {
                productId,
                userId,
            },
        });
        if (existingReview) {
            res.status(409).json({
                success: false,
                code: "REVIEW_EXISTS",
                message: "You have already reviewed this product",
            });
            return;
        }
        const review = yield prisma_1.default.review.create({
            data: Object.assign(Object.assign({}, data), { productId,
                userId }),
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                    },
                },
            },
        });
        yield (0, rating_1.updateProductRating)(productId);
        res.status(201).json({
            success: true,
            data: review,
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
        console.error("Create review error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create review",
        });
    }
});
exports.createReview = createReview;
const updateReview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const data = types_1.createReviewSchema.parse(req.body);
        const review = yield prisma_1.default.review.findUnique({
            where: { id },
        });
        if (!review) {
            res.status(404).json({
                success: false,
                code: "REVIEW_NOT_FOUND",
                message: "Review not found",
            });
            return;
        }
        if (review.userId !== userId) {
            res.status(403).json({
                success: false,
                code: "UNAUTHORIZED",
                message: "Not authorized to update this review",
            });
            return;
        }
        const updatedReview = yield prisma_1.default.review.update({
            where: { id },
            data,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                    },
                },
            },
        });
        yield (0, rating_1.updateProductRating)(review.productId);
        res.json({
            success: true,
            data: updatedReview,
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
        console.error("Update review error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update review",
        });
    }
});
exports.updateReview = updateReview;
const deleteReview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const review = yield prisma_1.default.review.findUnique({
            where: { id },
        });
        if (!review) {
            res.status(404).json({
                success: false,
                code: "REVIEW_NOT_FOUND",
                message: "Review not found",
            });
            return;
        }
        if (review.userId !== userId) {
            res.status(403).json({
                success: false,
                code: "UNAUTHORIZED",
                message: "Not authorized to delete this review",
            });
            return;
        }
        yield prisma_1.default.review.delete({
            where: { id },
        });
        yield (0, rating_1.updateProductRating)(review.productId);
        res.json({
            success: true,
            message: "Review deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete review error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete review",
        });
    }
});
exports.deleteReview = deleteReview;
