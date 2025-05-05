import { RequestHandler } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { createBrandSchema, updateBrandSchema } from "../types";

export const getAllBrands: RequestHandler = async (req, res) => {
  try {
    const { featured, search, page = 1, limit = 10 } = req.query;

    const where: any = {};
    if (featured == "true") where.featured = true;
    if (search) {
      where.name = { contains: search.toString(), mode: "insensitive" };
    }

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
        skip: (Number(page) - 1) * Number(limit),
      }),
      prisma.brand.count({ where }),
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
  } catch (error) {
    console.error("Get all brands error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brands",
    });
  }
};

export const getFeaturedBrands: RequestHandler = async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({
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
      data: brands.map((brand) => ({
        ...brand,
        featuredProduct: brand.products[0] || null,
      })),
    });
  } catch (error) {
    console.error("Get featured brands error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured brands",
    });
  }
};

export const getBrandsByCategory: RequestHandler = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where: { categories: { some: { categoryId } } },
        include: {
          _count: { select: { products: { where: { categoryId } } } },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.brand.count({
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
  } catch (error) {
    console.error("Get brands by category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brands by category",
    });
  }
};

export const getBrandDetails: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      minPrice,
      maxPrice,
      search,
      sort = "-createdAt",
      page = 1,
      limit = 10,
    } = req.query;

    const where: any = {
      brandId: id,
      ...(categoryId && { categoryId: categoryId.toString() }),
    };

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    if (search) {
      where.OR = [
        { name: { contains: search.toString(), mode: "insensitive" } },
        { description: { contains: search.toString(), mode: "insensitive" } },
      ];
    }

    const orderBy: any = {};
    const sortField = sort.toString().startsWith("-")
      ? sort.toString().substring(1)
      : sort.toString();
    const sortOrder = sort.toString().startsWith("-") ? "desc" : "asc";
    orderBy[sortField] = sortOrder;

    const [brand, products, total] = await Promise.all([
      prisma.brand.findUnique({
        where: { id },
        include: {
          categories: { include: { category: true } },
          _count: { select: { products: true } },
        },
      }),
      prisma.product.findMany({
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
      prisma.product.count({ where }),
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
      const rating =
        product.reviews.length > 0
          ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
            product.reviews.length
          : null;

      return {
        ...product,
        rating: rating ? parseFloat(rating.toFixed(1)) : null,
        reviewCount: product.reviews.length,
      };
    });

    res.json({
      success: true,
      data: {
        ...brand,
        products: productsWithRating,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get brand details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brand details",
    });
  }
};

export const createBrand: RequestHandler = async (req, res) => {
  try {
    const data = createBrandSchema.parse(req.body);

    const existingBrand = await prisma.brand.findFirst({
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

    const brand = await prisma.brand.create({ data });

    res.status(201).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
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
};

export const updateBrand: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateBrandSchema.parse(req.body);

    const brand = await prisma.brand.findUnique({ where: { id } });

    if (!brand) {
      res.status(404).json({
        success: false,
        code: "BRAND_NOT_FOUND",
        message: "Brand not found",
      });
      return;
    }

    if (data.name && data.name.toLowerCase() !== brand.name.toLowerCase()) {
      const existingBrand = await prisma.brand.findFirst({
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

    const updatedBrand = await prisma.brand.update({ where: { id }, data });

    res.json({
      success: true,
      data: updatedBrand,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
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
};

export const deletedBrand: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const brandWithProducts = await prisma.brand.findUnique({
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

    await prisma.brand.delete({ where: { id } });

    res.json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error("Delete brand error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete brand",
    });
  }
};
