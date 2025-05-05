import { RequestHandler } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { wishlistItemSchema } from "../types";

export const getWishlist: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const wishlist = await prisma.wishlist.findUnique({
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
      const newWishlist = await prisma.wishlist.create({
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
      data: {
        ...wishlist,
        items: wishlist.items.map((item) => ({
          ...item,
          product: {
            ...item.product,
            finalPrice: item.product.discount
              ? Number(item.product.price) * (1 - item.product.discount / 100)
              : item.product.price,
            inStock: item.product.stock > 0,
          },
        })),
      },
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist",
    });
  }
};

export const addToWishlist: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { productId } = wishlistItemSchema.parse(req.body);

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

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
      });
    }

    const existingItem = await prisma.wishlistItem.findFirst({
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

    const wishlistItem = await prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
      include: { product: true },
    });

    res.status(201).json({
      success: true,
      data: wishlistItem,
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
    console.error("Add to wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add item to wishlist",
    });
  }
};

export const toggleWishlistItem: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { productId } = wishlistItemSchema.parse(req.body);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
      });
    }

    const existingItem = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId },
    });

    if (existingItem) {
      // Remove from wishlist
      await prisma.wishlistItem.delete({
        where: { id: existingItem.id },
      });

      res.json({
        success: true,
        message: "Product removed from wishlist",
        isWishlisted: false,
      });
      return;
    } else {
      // Check if product exists
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

      // Add to wishlist
      await prisma.wishlistItem.create({
        data: { wishlistId: wishlist.id, productId },
      });

      res.json({
        success: true,
        message: "Product added to wishlist",
        isWishlisted: true,
      });
      return;
    }
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
    console.error("Toggle wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update wishlist",
    });
    return;
  }
};

export const removeFromWishlist: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.params;

    const wishlist = await prisma.wishlist.findUnique({
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

    const item = await prisma.wishlistItem.findFirst({
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

    await prisma.wishlistItem.delete({
      where: { id: itemId },
    });

    res.json({
      success: true,
      message: "Item removed from wishlist",
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item from wishlist",
    });
  }
};

export const clearWishlist: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const wishlist = await prisma.wishlist.findUnique({
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

    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id },
    });

    res.json({
      success: true,
      message: "Wishlist cleared successfully",
    });
  } catch (error) {
    console.error("Clear wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear wishlist",
    });
  }
};

export const moveToCart: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.params;

    const wishlist = await prisma.wishlist.findUnique({
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

    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart && userId) {
      cart = await prisma.cart.create({
        data: { userId: userId },
      });
    }

    const existingCartItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart?.id,
        productId: wishlistItem.productId,
      },
    });

    if (!cart?.id) {
      throw new Error("Cart not found");
    }

    if (existingCartItem) {
      await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: existingCartItem.quantity + 1 },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: wishlistItem.productId,
          quantity: 1,
        },
      });
    }

    await prisma.wishlistItem.delete({
      where: { id: itemId },
    });

    res.json({
      success: true,
      message: "Item moved to cart successfully",
    });
  } catch (error) {
    console.error("Move to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move item to cart",
    });
  }
};
