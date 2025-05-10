import { RequestHandler } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { createOrderSchema } from "../types";
import { generateOrderNumber } from "../utils/orderNumberGenerator";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { sendOrderConfirmationEmail } from "../services/emailService";
import { v4 as uuidv4 } from "uuid";
import { initiateMoMoPayment } from "../services/momo";

export const createOrder: RequestHandler = async (req, res) => {
  try {
    const { shippingAddressId, paymentMethod } = createOrderSchema.parse(
      req.body
    );
    const userId = req.user!.userId;

    const orderNumber = await generateOrderNumber(prisma);

    const address = await prisma.address.findFirst({
      where: { id: shippingAddressId, userId },
    });

    if (!address) {
      res.status(400).json({
        success: false,
        code: "INVALID_ADDRESS",
        message: "Shipping address not found",
      });
      return;
    }

    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!cart?.items?.length) {
        throw new Error("Your cart is empty");
      }

      const VAT_RATE = 0.18;
      let subtotal = 0;
      const orderItems = cart.items.map((item) => {
        const price = item.product.discount
          ? Number(item.product.price) * (1 - item.product.discount / 100)
          : Number(item.product.price);

        if (item.product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.product.name}`);
        }

        subtotal += price * item.quantity;
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: parseFloat(price.toFixed(2)),
        };
      });

      const vat = subtotal * VAT_RATE;
      const total = parseFloat((subtotal + vat).toFixed(2));

      const newOrder = await tx.order.create({
        data: {
          userId,
          orderNumber,
          total,
          vat,
          status:
            paymentMethod === "COD"
              ? OrderStatus.AWAITING_CONFIRMATION
              : OrderStatus.PENDING_PAYMENT,
          shippingAddressId,
          items: { create: orderItems },
          payments: {
            create: {
              method: paymentMethod,
              amount: total,
              currency: "RWF",
              status: PaymentStatus.PENDING,
              reference: uuidv4(),
            },
          },
        },
        include: {
          items: { include: { product: true } },
          shippingAddress: true,
          payments: true,
        },
      });

      if (paymentMethod !== "COD") {
        await Promise.all(
          cart.items.map((item) =>
            tx.product.update({
              where: { id: item.productId },
              data: { reservedStock: { increment: item.quantity } },
            })
          )
        );
      } else {
        await Promise.all(
          cart.items.map((item) =>
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            })
          )
        );
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return newOrder;
    });

    if (paymentMethod !== "COD") {
      try {
        const payment = order.payments[0];
        const paymentResult = await initiateMoMoPayment(
          payment.id,
          payment.reference,
          payment.amount,
          req.body.momoPhone,
          order.id
        );

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.INITIATED,
            transactionId: paymentResult.transactionId,
          },
        });

        order.payments[0].paymentUrl = paymentResult.paymentUrl ?? null;
      } catch (error) {
        await prisma.payment.update({
          where: { id: order.payments[0].id },
          data: {
            status: PaymentStatus.FAILED,
            error:
              error instanceof Error
                ? error.message
                : "Payment initiation failed",
          },
        });
        throw new Error(
          `Payment initiation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    if (req.user?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
      });
      if (user) {
        const orderWithPaymentMethod = {
          ...order,
          paymentMethod: order.payments[0].method,
        };
        await sendOrderConfirmationEmail(orderWithPaymentMethod, user);
      }
    }

    await prisma.notification.create({
      data: {
        type: "ORDER",
        title:
          paymentMethod === "COD" ? "COD Order Placed" : "Payment Initiated",
        message:
          paymentMethod === "COD"
            ? `Your COD order #${order.orderNumber} is awaiting confirmation`
            : `Please complete payment for order #${order.orderNumber}`,
        userId,
      },
    });

    res.status(201).json({
      success: true,
      message:
        paymentMethod === "COD"
          ? "COD order placed successfully"
          : "Payment initiated successfully",
      data: order,
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

    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      code: "ORDER_CREATION_FAILED",
      message:
        error instanceof Error ? error.message : "Failed to create order",
    });
  }
};

export const getUserOrders: RequestHandler = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user?.userId;

    const orders = await prisma.order.findMany({
      where: {
        userId,
        ...(status && { status: status as OrderStatus }),
      },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: {
        items: {
          include: {
            product: {
              include: { images: { where: { isMain: true }, take: 1 } },
            },
          },
        },
        shippingAddress: true,
      },
    });

    const total = await prisma.order.count({ where: { userId } });

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

export const getOrderDetails: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const order = await prisma.order.findUnique({
      where: { id, userId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, images: true, price: true },
            },
          },
        },
        shippingAddress: true,
      },
    });

    if (!order) {
      res.status(404).json({
        success: false,
        code: "ORDER_NOT_FOUND",
        message: "Order not found",
      });
      return;
    }

    if (order.userId !== userId) {
      res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
      return;
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
    });
  }
};

export const cancelOrder: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id, userId },
        include: { items: true },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.status !== OrderStatus.PROCESSING) {
        throw new Error("Order cannot be cancelled at this stage");
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });

      await Promise.all(
        order.items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          })
        )
      );

      return updatedOrder;
    });

    if (userId) {
      await prisma.notification.create({
        data: {
          type: "ORDER",
          title: "Order Cancelled",
          message: `Your order #${order.orderNumber} has been cancelled`,
          userId,
        },
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      code: "ORDER_CANCELLATION_FAILED",
      message:
        error instanceof Error ? error.message : "Failed to cancel order",
    });
  }
};
