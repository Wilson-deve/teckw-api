import { RequestHandler } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { createCategorySchema } from "../types";

export const getCategories: RequestHandler = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
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
      data: categories.map((category) => ({
        ...category,
        productCount: category._count.products,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get categories",
    });
  }
};

export const getCategoryById: RequestHandler = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await prisma.category.findUnique({
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
      const totalRatings = product.reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const avgRating =
        product.reviews.length > 0 ? totalRatings / product.reviews.length : 0;

      return {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        stock: product.stock,
        image: product.images[0]?.url || null,
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
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get category",
    });
  }
};

export const createCategory: RequestHandler = async (req, res) => {
  try {
    const validatedData = createCategorySchema.parse(req.body);

    const existingCategory = await prisma.category.findFirst({
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

    const newCategory = await prisma.category.create({
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
  } catch (error) {
    if (error instanceof z.ZodError) {
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
};

export const updateCategory: RequestHandler = async (req, res) => {
  try {
    const { name, description, imageUrl } = req.body;
    const categoryId = req.params.id;

    const category = await prisma.category.findUnique({
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
      const existingCategory = await prisma.category.findFirst({
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

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: name || category.name,
        description:
          description !== undefined ? description : category.description,
        imageUrl: imageUrl !== undefined ? imageUrl : category.imageUrl,
      },
    });

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

export const deleteCategory: RequestHandler = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await prisma.category.findUnique({
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
        message:
          "Cannot delete category with products. Please reassign or delete products first.",
      });
      return;
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};
