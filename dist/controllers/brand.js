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
exports.deletedBrand = exports.updateBrand = exports.createBrand = exports.getBrandDetails = exports.getBrandsByCategory = exports.getFeaturedBrands = exports.getAllBrands = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const types_1 = require("../types");
const getAllBrands = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { featured, search, page = 1, limit = 10 } = req.query;
        const where = {};
        if (featured == "true")
            where.featured = true;
        if (search) {
            where.name = { contains: search.toString(), mode: "insensitive" };
        }
        const [brands, total] = yield Promise.all([
            prisma_1.default.brand.findMany({
                where,
                include: { _count: { select: { products: true } } },
                orderBy: { name: "asc" },
                skip: (Number(page) - 1) * Number(limit),
            }),
            prisma_1.default.brand.count({ where }),
        ]);
        res.json({
            success: true,
            data: brands,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Get all brands error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch brands",
        });
    }
});
exports.getAllBrands = getAllBrands;
const getFeaturedBrands = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const brands = yield prisma_1.default.brand.findMany({
            where: { featured: true },
            include: {
                _count: { select: { products: true } },
                products: {
                    take: 1,
                    include: { images: { where: { isMain: true }, take: 1 } },
                },
            },
            take: 8,
        });
        res.json({
            success: true,
            data: brands.map((brand) => (Object.assign(Object.assign({}, brand), { featuredProduct: brand.products[0] || null }))),
        });
    }
    catch (error) {
        console.error("Get featured brands error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch featured brands",
        });
    }
});
exports.getFeaturedBrands = getFeaturedBrands;
const getBrandsByCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const [brands, total] = yield Promise.all([
            prisma_1.default.brand.findMany({
                where: { categories: { some: { categoryId } } },
                include: {
                    _count: { select: { products: { where: { categoryId } } } },
                },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma_1.default.brand.count({
                where: { categories: { some: { categoryId } } },
            }),
        ]);
        res.json({
            success: true,
            data: brands,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Get brands by category error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch brands by category",
        });
    }
});
exports.getBrandsByCategory = getBrandsByCategory;
const getBrandDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { categoryId, minPrice, maxPrice, search, sort = "-createdAt", page = 1, limit = 10, } = req.query;
        const where = Object.assign({ brandId: id }, (categoryId && { categoryId: categoryId.toString() }));
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice)
                where.price.gte = Number(minPrice);
            if (maxPrice)
                where.price.lte = Number(maxPrice);
        }
        if (search) {
            where.OR = [
                { name: { contains: search.toString(), mode: "insensitive" } },
                { description: { contains: search.toString(), mode: "insensitive" } },
            ];
        }
        const orderBy = {};
        const sortField = sort.toString().startsWith("-")
            ? sort.toString().substring(1)
            : sort.toString();
        const sortOrder = sort.toString().startsWith("-") ? "desc" : "asc";
        orderBy[sortField] = sortOrder;
        const [brand, products, total] = yield Promise.all([
            prisma_1.default.brand.findUnique({
                where: { id },
                include: {
                    categories: { include: { category: true } },
                    _count: { select: { products: true } },
                },
            }),
            prisma_1.default.product.findMany({
                where,
                include: {
                    images: { where: { isMain: true }, take: 1 },
                    category: true,
                    reviews: { select: { rating: true } },
                },
                orderBy,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma_1.default.product.count({ where }),
        ]);
        if (!brand) {
            res.status(404).json({
                success: false,
                code: "BRAND_NOT_FOUND",
                message: "Brand not found",
            });
            return;
        }
        const productsWithRating = products.map((product) => {
            const rating = product.reviews.length > 0
                ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
                    product.reviews.length
                : null;
            return Object.assign(Object.assign({}, product), { rating: rating ? parseFloat(rating.toFixed(1)) : null, reviewCount: product.reviews.length });
        });
        res.json({
            success: true,
            data: Object.assign(Object.assign({}, brand), { products: productsWithRating, pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                } }),
        });
    }
    catch (error) {
        console.error("Get brand details error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch brand details",
        });
    }
});
exports.getBrandDetails = getBrandDetails;
const createBrand = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = types_1.createBrandSchema.parse(req.body);
        const existingBrand = yield prisma_1.default.brand.findFirst({
            where: {
                name: { equals: data.name, mode: "insensitive" },
            },
        });
        if (existingBrand) {
            res.status(409).json({
                success: false,
                code: "BRAND_EXISTS",
                message: "Brand with this name already exists",
            });
            return;
        }
        const brand = yield prisma_1.default.brand.create({ data });
        res.status(201).json({
            success: true,
            data: brand,
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
        console.error("Create brand error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create brand",
        });
    }
});
exports.createBrand = createBrand;
const updateBrand = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const data = types_1.updateBrandSchema.parse(req.body);
        const brand = yield prisma_1.default.brand.findUnique({ where: { id } });
        if (!brand) {
            res.status(404).json({
                success: false,
                code: "BRAND_NOT_FOUND",
                message: "Brand not found",
            });
            return;
        }
        if (data.name && data.name.toLowerCase() !== brand.name.toLowerCase()) {
            const existingBrand = yield prisma_1.default.brand.findFirst({
                where: {
                    name: { equals: data.name, mode: "insensitive" },
                    NOT: { id },
                },
            });
            if (existingBrand) {
                res.status(409).json({
                    success: false,
                    code: "BRAND_EXISTS",
                    message: "Brand with this name already exists",
                });
                return;
            }
        }
        const updatedBrand = yield prisma_1.default.brand.update({ where: { id }, data });
        res.json({
            success: true,
            data: updatedBrand,
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
        console.error("Update brand error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update brand",
        });
    }
});
exports.updateBrand = updateBrand;
const deletedBrand = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const brandWithProducts = yield prisma_1.default.brand.findUnique({
            where: { id },
            include: { _count: { select: { products: true } } },
        });
        if (!brandWithProducts) {
            res.status(404).json({
                success: false,
                code: "BRAND_NOT_FOUND",
                message: "Brand not found",
            });
            return;
        }
        if (brandWithProducts._count.products > 0) {
            res.status(400).json({
                success: false,
                code: "BRAND_HAS_PRODUCTS",
                message: "Cannot delete brand with products. Delete products first.",
            });
            return;
        }
        yield prisma_1.default.brand.delete({ where: { id } });
        res.json({
            success: true,
            message: "Brand deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete brand error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete brand",
        });
    }
});
exports.deletedBrand = deletedBrand;
