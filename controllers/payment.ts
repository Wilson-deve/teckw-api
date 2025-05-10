import { RequestHandler } from "express";
import {
  createPayment,
  processPayment,
  verifyPayment as verifyPaymentService,
  getPaymentById,
} from "../services/payment";
import { processMoMoCallback } from "../services/momo";
import { PaymentMethod } from "../types/payment";

export const initiatePayment: RequestHandler = async (req, res) => {
  try {
    const { paymentMethod, momoPhone } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
      return;
    }

    const payment = await createPayment(req.body, userId);

    const success = await processPayment(
      payment,
      paymentMethod === "MOMO" ? momoPhone : undefined
    );

    if (!success) {
      res.status(500).json({
        success: false,
        code: "PAYMENT_PROCESSING_FAILED",
        message: `${paymentMethod} payment processing failed`,
      });
      return;
    }

    const responseData = generatePaymentResponse(payment, paymentMethod);

    res.status(200).json({
      success: true,
      data: responseData,
    });
    return;
  } catch (error: any) {
    console.error("Payment initiation error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "PAYMENT_FAILED",
      message: error.message || "Payment processing failed",
    });
    return;
  }
};

export const verifyPayment: RequestHandler = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
      return;
    }

    const { status, payment } = await verifyPaymentService(paymentId, userId);

    res.status(200).json({
      success: true,
      data: {
        status,
        paymentId: payment.id,
        reference: payment.reference,
        updatedAt: payment.updatedAt,
      },
    });
    return;
  } catch (error: any) {
    console.error("Payment verification error:", error);

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        code: "PAYMENT_NOT_FOUND",
        message: "Payment not found",
      });
      return;
    }

    if (error.message.includes("permission")) {
      res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You do not have permission to access this payment",
      });
      return;
    }

    res.status(500).json({
      success: false,
      code: "VERIFICATION_FAILED",
      message: "Payment verification failed",
    });
    return;
  }
};

export const getPayment: RequestHandler = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
      return;
    }

    const payment = await getPaymentById(paymentId, userId);

    res.status(200).json({
      success: true,
      data: {
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        reference: payment.reference,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
    return;
  } catch (error: any) {
    console.error("Get payment error:", error);

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        code: "PAYMENT_NOT_FOUND",
        message: "Payment not found",
      });
      return;
    }

    if (error.message.includes("permission")) {
      res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You do not have permission to access this payment",
      });
      return;
    }

    res.status(500).json({
      success: false,
      code: "GET_PAYMENT_FAILED",
      message: "Failed to retrieve payment details",
    });
    return;
  }
};

export const handleMoMoCallback: RequestHandler = async (req, res) => {
  try {
    const { referenceId, status } = req.body;

    if (!referenceId || !status) {
      res.status(400).json({
        message: "Missing required parameters",
      });
      return;
    }

    const success = await processMoMoCallback(referenceId, status);

    res.status(200).json({
      success,
      message: success
        ? "Callback processed successfully"
        : "Payment reference not found",
    });
    return;
  } catch (error) {
    console.error("MoMo callback error:", error);

    res.status(200).json({
      success: false,
      message: "Webhook received with errors",
    });
    return;
  }
};

function generatePaymentResponse(payment: any, method: PaymentMethod) {
  const baseResponse = {
    paymentId: payment.id,
    reference: payment.reference,
    status: payment.status,
  };

  switch (method) {
    case "MOMO":
      return {
        ...baseResponse,
        message:
          "Payment request sent to your mobile phone. Please check and approve.",
      };
    case "COD":
      return {
        ...baseResponse,
        message: "Order created. Payment expected on delivery",
      };
    default:
      return baseResponse;
  }
}
