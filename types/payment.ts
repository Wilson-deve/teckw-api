import { z } from "zod";

export type PaymentMethod = "MOMO" | "COD";

export type PaymentStatus =
  | "PENDING"
  | "INITIATED"
  | "PENDING_APPROVAL"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  transactionId?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MoMoPaymentResponse {
  status: string;
  reason?: string;
  financialTransactionId?: string;
  externalId: string;
  amount: string;
  currency: string;
  payer: {
    partyIdType: string;
    partyId: string;
  };
}

export interface MoMoCallbackRequest {
  referenceId: string;
  status: string;
  reason?: string;
  externalId?: string;
  amount?: string;
  currency?: string;
  financialTransactionId?: string;
}

export const paymentRequestSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  paymentMethod: z.enum(["MOMO", "COD"]),
  momoPhone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        return /^\+?[0-9]{10,12}$/.test(val);
      },
      { message: "Invalid phone number format" }
    ),
});

export type PaymentRequest = z.infer<typeof paymentRequestSchema>;

export interface PaymentVerificationResponse {
  success: boolean;
  data?: {
    status: PaymentStatus;
    paymentId: string;
    updatedAt: Date;
  };
  code?: string;
  message?: string;
}

export interface PaymentResponse {
  success: boolean;
  data?: {
    paymentId: string;
    reference?: string;
    status: PaymentStatus;
    message?: string;
    verificationUrl?: string;
  };
  code?: string;
  message?: string;
  details?: string;
}
