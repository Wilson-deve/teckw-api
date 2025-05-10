import dotenv from "dotenv";
dotenv.config();

export interface MoMoConfig {
  apiKey: string;
  userId: string;
  primaryKey: string;
  baseUrl: string;
  environment: string;
  currency: string;
  callbackUrl: string;
}

export const momoConfig: MoMoConfig = {
  apiKey: process.env.MTN_MOMO_API_KEY || "",
  userId: process.env.MTN_MOMO_USER_ID || "",
  primaryKey: process.env.MTN_MOMO_PRIMARY_KEY || "",
  baseUrl:
    process.env.MTN_MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com",
  environment: process.env.MTN_MOMO_ENVIRONMENT || "sandbox",
  currency: process.env.MTN_MOMO_CURRENCY || "RWF",
  callbackUrl:
    process.env.MTN_MOMO_CALLBACK_URL ||
    "https://https://teckw-api.onrender.com/api/v1/payments/webhook/momo",
};

export let momoTokenCache: {
  token: string;
  expiresAt: number;
} | null = null;
