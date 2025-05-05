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
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoryById = exports.getCategories = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const types_1 = require("../types");
const getCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categories = yield prisma_1.default.category.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });
        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories.map((category) => (Object.assign(Object.assign({}, category), { productCount: category._count.products }))),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to get categories",
        });
    }
});
exports.getCategories = getCategories;
const getCategoryById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categoryId = req.params.id;
        const category = yield prisma_1.default.category.findUnique({
            where: { id: categoryId },
            include: {
                products: {
                    where: {
                        stock: {
                            gt: 0,
                        },
                    },
                    include: {
                        images: {
                            where: {
                                isMain: true,
                            },
                            take: 1,
                        },
                        reviews: {
                            select: {
                                rating: true,
                            },
                        },
                    },
                    take: 20,
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });
        if (!category) {
            res.status(404).json({
                success: false,
                message: "Category not found",
            });
            return;
        }
        const productsWithRating = category.products.map((product) => {
            var _a;
            const totalRatings = product.reviews.reduce((sum, review) => sum + review.rating, 0);
            const avgRating = product.reviews.length > 0 ? totalRatings / product.reviews.length : 0;
            return {
                id: product.id,
                name: product.name,
                price: Number(product.price),
                stock: product.stock,
                image: ((_a = product.images[0]) === null || _a === void 0 ? void 0 : _a.url) || null,
                avgRating: parseFloat(avgRating.toFixed(1)),
                reviewsCount: product.reviews.length,
                discount: product.discount || 0,
                finalPrice: product.discount
                    ? Number(product.price) * (1 - Number(product.discount) / 100)
                    : Number(product.price),
            };
        });
        res.status(200).json({
            success: true,
            data: {
                id: category.id,
                name: category.name,
                description: category.description,
                imageUrl: category.imageUrl,
                productCount: category.products.length,
                products: productsWithRating,
            },
        });
    }
    catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get category",
        });
    }
});
exports.getCategoryById = getCategoryById;
const createCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const validatedData = types_1.createCategorySchema.parse(req.body);
        const existingCategory = yield prisma_1.default.category.findFirst({
            where: {
                name: {
                    mode: "insensitive",
                    equals: validatedData.name,
                },
            },
        });
        if (existingCategory) {
            res.status(409).json({
                success: false,
                message: "Category with this name already exists",
            });
            return;
        }
        const newCategory = yield prisma_1.default.category.create({
            data: {
                name: validatedData.name,
                description: validatedData.description,
                imageUrl: validatedData.imageUrl,
            },
        });
        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: newCategory,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                error: error.errors.map((e) => ({
                    path: e.path.join("."),
                    message: e.message,
                })),
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to create category",
        });
    }
});
exports.createCategory = createCategory;
const updateCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, imageUrl } = req.body;
        const categoryId = req.params.id;
        const category = yield prisma_1.default.category.findUnique({
            where: { id: categoryId },
        });
        if (!category) {
            res.status(404).json({
                success: false,
                message: "Category not found",
            });
            return;
        }
        if (name && name.toLowerCase() !== category.name.toLowerCase()) {
            const existingCategory = yield prisma_1.default.category.findFirst({
                where: {
                    name: {
                        mode: "insensitive",
                        equals: name,
                    },
                    NOT: {
                        id: categoryId,
                    },
                },
            });
            if (existingCategory) {
                res.status(409).json({
                    success: false,
                    message: "Category with this name already exists",
                });
                return;
            }
        }
        const updatedCategory = yield prisma_1.default.category.update({
            where: { id: categoryId },
            data: {
                name: name || category.name,
                description: description !== undefined ? description : category.description,
                imageUrl: imageUrl !== undefined ? imageUrl : category.imageUrl,
            },
        });
        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: updatedCategory,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update category",
        });
    }
});
exports.updateCategory = updateCategory;
const deleteCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categoryId = req.params.id;
        const category = yield prisma_1.default.category.findUnique({
            where: { id: categoryId },
            include: {
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });
        if (!category) {
            res.status(404).json({
                success: false,
                message: "Category not found",
            });
            return;
        }
        if (category._count.products > 0) {
            res.status(400).json({
                success: false,
                message: "Cannot delete category with products. Please reassign or delete products first.",
            });
            return;
        }
        yield prisma_1.default.category.delete({
            where: { id: categoryId },
        });
        res.status(200).json({
            success: true,
            message: "Category deleted successfully",
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete category",
        });
    }
});
exports.deleteCategory = deleteCategory;
