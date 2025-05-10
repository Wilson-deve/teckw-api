import prisma from "../lib/prisma";
import { generateReference, getErrorMessage } from "../utils/helpers";
import { PaymentRequest, PaymentMethod, Payment } from "../types/payment";
import { PaymentStatus } from "@prisma/client";
import { initiateMoMoPayment, checkMoMoStatus } from "../services/momo";
import { OrderStatus } from "@prisma/client";

export async function createPayment(
  data: PaymentRequest,
  userId: string
): Promise<Payment> {
  const { orderId, amount, currency, paymentMethod } = data;

  const reference = generateReference();

  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new Error("Order not found or does not belong to the user");
    }

    const payment = (await tx.payment.create({
      data: {
        orderId,
        amount,
        currency,
        method: paymentMethod as PaymentMethod,
        status: "PENDING",
        reference,
      },
    })) as Payment;

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PENDING_PAYMENT },
    });

    return {
      ...payment,
      error: payment.error ?? undefined,
      transactionId: payment.transactionId ?? undefined,
      method: payment.method as PaymentMethod,
    };
  });
}

export async function processCODPayment(paymentId: string): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { orderId: true },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "PENDING" },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: "PROCESSING" },
      });
    });

    return true;
  } catch (error) {
    console.error("COD processing error:", error);

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "FAILED",
        error: getErrorMessage(error),
      },
    });

    return false;
  }
}

export async function processPayment(
  payment: Payment,
  momoPhone?: string
): Promise<boolean> {
  try {
    switch (payment.method) {
      case "MOMO":
        if (!momoPhone) {
          throw new Error("MoMo phone number is required");
        }

        const momoResponse = await initiateMoMoPayment(
          payment.id,
          payment.reference,
          payment.amount,
          momoPhone,
          payment.orderId
        );

        await prisma.payment.update({
          where: { id: payment.id },
          data: { transactionId: momoResponse.transactionId },
        });
        return true;

      case "COD":
        return await processCODPayment(payment.id);
      default:
        throw new Error(`Unsupported payment method: ${payment.method}`);
    }
  } catch (error) {
    console.error(`Payment processing error for ${payment.method}:`, error);

    // Update payment with error
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        error: getErrorMessage(error),
      },
    });

    return false;
  }
}

export async function verifyPayment(
  paymentId: string,
  userId: string
): Promise<{ status: PaymentStatus; payment: Payment }> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { select: { userId: true } } },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.order.userId !== userId) {
    throw new Error("You do not have permission to access this payment");
  }

  let status: PaymentStatus;

  switch (payment.method) {
    case "MOMO":
      if (!payment.reference) {
        throw new Error("Payment reference not found");
      }
      status = (await checkMoMoStatus(payment.reference)) as PaymentStatus;
      break;
    case "COD":
      status = "PENDING";
      break;
    default:
      status = "PENDING";
  }

  if (status !== payment.status) {
    await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: { status: status },
      });

      // If payment is successful, update order status
      if (status === "PAID") {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: "PROCESSING" },
        });
      }

      payment.status = updatedPayment.status;
      payment.updatedAt = updatedPayment.updatedAt;
    });
  }

  return {
    status,
    payment: {
      ...payment,
      error: payment.error ?? undefined,
      transactionId: payment.transactionId ?? undefined,
      method: payment.method as PaymentMethod,
    },
  };
}

export async function getPaymentById(
  paymentId: string,
  userId: string
): Promise<Payment> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { select: { userId: true } } },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.order.userId !== userId) {
    throw new Error("You do not have permission to access this payment");
  }

  return {
    ...payment,
    error: payment.error ?? undefined,
    transactionId: payment.transactionId ?? undefined,
    method: payment.method as PaymentMethod,
  };
}
