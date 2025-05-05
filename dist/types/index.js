"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBrandSchema = exports.createBrandSchema = exports.wishlistItemSchema = exports.updateCartItemSchema = exports.cartItemSchema = exports.createReviewSchema = exports.createOrderSchema = exports.createProductSchema = exports.createCategorySchema = exports.addressSchema = exports.userResponseSchema = exports.updateUserSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    firstname: zod_1.z.string(),
    lastname: zod_1.z.string(),
    phone: zod_1.z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    username: zod_1.z
        .string()
        .min(3, "Username must be at least 3 characters long")
        .max(20, "Username must be at most 20 characters long")
        .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z
        .string()
        .min(6, "Password must be at least 6 characters long")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
});
exports.loginSchema = zod_1.z.object({
    identifier: zod_1.z
        .string()
        .min(3, "Identifier must be at least 3 characters long"),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.updateUserSchema = zod_1.z.object({
    firstname: zod_1.z.string().min(2).max(50).optional(),
    lastname: zod_1.z.string().min(2).max(50).optional(),
    phone: zod_1.z
        .string()
        .regex(/^\+?[0-9]{10,15}$/)
        .optional(),
});
exports.userResponseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string().email(),
    username: zod_1.z.string(),
    firstname: zod_1.z.string().nullable(),
    lastname: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
    avatarUrl: zod_1.z.string().nullable(),
    createdAt: zod_1.z.date().optional(),
    updatedAt: zod_1.z.date().optional(),
});
exports.addressSchema = zod_1.z.object({
    contactname: zod_1.z.string().min(1),
    phone: zod_1.z.string().min(10),
    phone2: zod_1.z.string().optional(),
    province: zod_1.z.string().min(1),
    district: zod_1.z.string().min(1),
    sector: zod_1.z.string().min(1),
    street: zod_1.z.string().min(1),
    isDefault: zod_1.z.boolean().optional(),
});
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Category name is required"),
    description: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().url("Invalid image URL").optional(),
});
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    price: zod_1.z.string().refine((val) => !isNaN(parseFloat(val)), {
        message: "Price must be a valid number",
    }),
    categoryId: zod_1.z.string().uuid(),
    brand: zod_1.z.string().min(1),
    stock: zod_1.z.string().refine((val) => !isNaN(parseInt(val, 10)), {
        message: "Stock must be a valid number",
    }),
    specifications: zod_1.z.record(zod_1.z.any()).optional(),
    discount: zod_1.z.string().optional().nullable(),
    images: zod_1.z.array(zod_1.z.string().url()).optional(),
});
exports.createOrderSchema = zod_1.z.object({
    items: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().positive(),
    }))
        .nonempty(),
    shippingAddressId: zod_1.z.string().uuid(),
    paymentMethod: zod_1.z.enum(["CARD", "MOBILE_MONEY", "CASH_ON_DELIVERY"]),
});
exports.createReviewSchema = zod_1.z.object({
    rating: zod_1.z.number().min(1).max(5),
    comment: zod_1.z.string().min(1, "Review comment is required").max(500),
});
exports.cartItemSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "Product ID is required"),
    quantity: zod_1.z.number().int().positive("Quantity must be a positive integer"),
    color: zod_1.z.string().optional(),
    storage: zod_1.z.string().optional(),
});
exports.updateCartItemSchema = exports.cartItemSchema.partial().extend({
    quantity: zod_1.z
        .number()
        .int()
        .positive("Quantity must be a positive integer")
        .optional(),
});
exports.wishlistItemSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "Product ID is required"),
});
exports.createBrandSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Brand name is required"),
    description: zod_1.z.string().optional(),
    logoUrl: zod_1.z.string().url("Invalid logo URL").optional(),
    featured: zod_1.z.boolean().optional().default(false),
});
exports.updateBrandSchema = exports.createBrandSchema.partial();
