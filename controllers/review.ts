import { RequestHandler } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { calculateAverageRating, updateProductRating } from "../utils/rating";
import { createReviewSchema } from "../types";

export const getProductReviews: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = "-createdAt" } = req.query;

    const orderBy: any = {};
    const sortField = sort.toString().startsWith("-")
      ? sort.toString().substring(1)
      : sort.toString();
    const sortOrder = sort.toString().startsWith("-") ? "desc" : "asc";
    orderBy[sortField] = sortOrder;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
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
      prisma.review.count({ where: { productId } }),
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
      averageRating: await calculateAverageRating(productId),
    });
  } catch (error) {
    console.error("Get product reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product reviews",
    });
  }
};

export const createReview: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }
    const data = createReviewSchema.parse(req.body);

    const product = await prisma.product.findUnique({
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

    const hasPurchased = await prisma.orderItem.findFirst({
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

    const existingReview = await prisma.review.findFirst({
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

    const review = await prisma.review.create({
      data: {
        ...data,
        productId,
        userId,
      },
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

    await updateProductRating(productId);

    res.status(201).json({
      success: true,
      data: review,
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
    console.error("Create review error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create review",
    });
  }
};

export const updateReview: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const data = createReviewSchema.parse(req.body);

    const review = await prisma.review.findUnique({
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

    const updatedReview = await prisma.review.update({
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

    await updateProductRating(review.productId);

    res.json({
      success: true,
      data: updatedReview,
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
    console.error("Update review error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update review",
    });
  }
};

export const deleteReview: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const review = await prisma.review.findUnique({
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

    await prisma.review.delete({
      where: { id },
    });

    await updateProductRating(review.productId);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete review",
    });
  }
};
