import { RequestHandler } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { cartItemSchema, updateCartItemSchema } from "../types";

export const getCart: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const cart = await prisma.cart.findUnique({
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
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!cart) {
      const newCart = await prisma.cart.create({
        data: {
          userId,
          items: {
            create: [],
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });
      res.json({
        success: true,
        data: newCart,
      });
      return;
    }

    let total = 0;
    const items = cart.items.map((item) => {
      const finalPrice = item.product.discount
        ? Number(item.product.price) * (1 - item.product.discount / 100)
        : Number(item.product.price);

      total += finalPrice * item.quantity;

      return {
        ...item,
        product: {
          ...item.product,
          finalPrice: parseFloat(finalPrice.toFixed(2)),
          available: item.product.stock >= item.quantity,
        },
      };
    });

    res.json({
      success: true,
      data: {
        ...cart,
        items,
        total: parseFloat(total.toFixed(2)),
        itemsCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
    });
  }
};

export const addToCart: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const data = cartItemSchema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { stock: true, price: true },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
      });
      return;
    }

    if (product.stock < data.quantity) {
      res.status(400).json({
        success: false,
        code: "INSUFFICIENT_STOCK",
        message: "Not enough stock available",
        availableStock: product.stock,
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: data.productId,
      },
    });

    let cartItem;
    if (existingItem) {
      const newQuantity = existingItem.quantity + data.quantity;

      if (product.stock < newQuantity) {
        res.status(400).json({
          success: false,
          code: "INSUFFICIENT_STOCK",
          message: "Adding this quantity would exceed available stock",
          availableStock: product.stock,
          currentInCart: existingItem.quantity,
        });
        return;
      }

      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: { product: true },
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          ...data,
          cartId: cart.id,
        },
        include: { product: true },
      });
    }

    res.status(201).json({
      success: true,
      data: cartItem,
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
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
    });
  }
};

export const updateCartItem: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.params;
    const data = updateCartItemSchema.parse(req.body);

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { where: { id: itemId }, include: { product: true } } },
    });

    if (!cart) {
      res.status(404).json({
        success: false,
        code: "CART_NOT_FOUND",
        message: "Cart not found",
      });
      return;
    }

    const cartItem = cart.items[0];
    if (!cartItem) {
      res.status(404).json({
        success: false,
        code: "ITEM_NOT_FOUND",
        message: "Cart item not found",
      });
      return;
    }

    if (data.quantity !== undefined) {
      if (cartItem.product.stock < data.quantity) {
        res.status(400).json({
          success: false,
          code: "INSUFFICIENT_STOCK",
          message: "Not enough stock available",
          availableStock: cartItem.product.stock,
        });
        return;
      }
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data,
      include: { product: true },
    });

    res.json({
      success: true,
      data: updatedItem,
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
    console.error("Update cart item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cart item",
    });
  }
};

export const removeFromCart: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.params;

    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      res.status(404).json({
        success: false,
        code: "CART_NOT_FOUND",
        message: "Cart not found",
      });
      return;
    }

    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      res.status(404).json({
        success: false,
        code: "ITEM_NOT_FOUND",
        message: "Cart item not found",
      });
      return;
    }

    await prisma.cartItem.delete({
      where: { id: itemId },
    });

    res.json({
      success: true,
      message: "Item removed from cart",
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item from cart",
    });
  }
};

export const clearCart: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      res.status(404).json({
        success: false,
        code: "CART_NOT_FOUND",
        message: "Cart not found",
      });
      return;
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    res.json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
    });
  }
};
