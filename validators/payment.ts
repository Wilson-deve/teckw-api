import { Request, Response, NextFunction } from "express";
import { paymentRequestSchema } from "./../types/payment";
import { z } from "zod";

export const validatePaymentRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = paymentRequestSchema.parse(req.body);

    if (validatedData.paymentMethod === "MOMO" && !validatedData.momoPhone) {
      res.status(400).json({
        success: false,
        code: "MISSING_PHONE",
        message: "MoMo phone number is required for MoMo payments",
      });
      return;
    }

    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        errors: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }

    res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Invalid payment request",
    });
    return;
  }
};

export const validatePaymentId = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { paymentId } = req.params;

    if (
      !paymentId ||
      typeof paymentId !== "string" ||
      !/^[0-9a-fA-F-]{36}$/.test(paymentId)
    ) {
      res.status(400).json({
        success: false,
        code: "INVALID_PAYMENT_ID",
        message: "Invalid payment ID format",
      });
      return;
    }

    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Invalid request parameters",
    });
    return;
  }
};
