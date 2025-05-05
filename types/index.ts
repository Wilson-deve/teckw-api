import { z } from "zod";

export const registerSchema = z.object({
  firstname: z.string(),
  lastname: z.string(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(20, "Username must be at most 20 characters long")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
});

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, "Identifier must be at least 3 characters long"),
  password: z.string().min(1, "Password is required"),
});

export const updateUserSchema = z.object({
  firstname: z.string().min(2).max(50).optional(),
  lastname: z.string().min(2).max(50).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/)
    .optional(),
});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const addressSchema = z.object({
  contactname: z.string().min(1),
  phone: z.string().min(10),
  phone2: z.string().optional(),
  province: z.string().min(1),
  district: z.string().min(1),
  sector: z.string().min(1),
  street: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  imageUrl: z.string().url("Invalid image URL").optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: "Price must be a valid number",
  }),
  categoryId: z.string().uuid(),
  brand: z.string().min(1),
  stock: z.string().refine((val) => !isNaN(parseInt(val, 10)), {
    message: "Stock must be a valid number",
  }),
  specifications: z.record(z.any()).optional(),
  discount: z.string().optional().nullable(),
  images: z.array(z.string().url()).optional(),
});

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .nonempty(),
  shippingAddressId: z.string().uuid(),
  paymentMethod: z.enum(["CARD", "MOBILE_MONEY", "CASH_ON_DELIVERY"]),
});

export const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(1, "Review comment is required").max(500),
});

export const cartItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  color: z.string().optional(),
  storage: z.string().optional(),
});

export const updateCartItemSchema = cartItemSchema.partial().extend({
  quantity: z
    .number()
    .int()
    .positive("Quantity must be a positive integer")
    .optional(),
});

export const wishlistItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

export const createBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  description: z.string().optional(),
  logoUrl: z.string().url("Invalid logo URL").optional(),
  featured: z.boolean().optional().default(false),
});

export const updateBrandSchema = createBrandSchema.partial();
