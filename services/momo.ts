import axios from "axios";
import { momoConfig } from "../config/momo";
import { momoTokenCache as momoTokenCacheConfig } from "../config/momo";

let momoTokenCache = momoTokenCacheConfig;
import {
  formatPhoneNumber,
  getErrorMessage,
  mapPaymentStatus,
} from "../utils/helpers";
import { MoMoPaymentResponse } from "../types/payment";
import prisma from "../lib/prisma";
import { PaymentStatus, OrderStatus } from "@prisma/client";

export async function getMoMoToken(): Promise<string> {
  if (momoTokenCache && momoTokenCache.expiresAt > Date.now()) {
    return momoTokenCache.token;
  }

  try {
    const response = await axios.post(
      `${momoConfig.baseUrl}/collection/token/`,
      {},
      {
        headers: {
          "Ocp-Apim-Subscription-Key": momoConfig.primaryKey,
          Authorization: `Basic ${Buffer.from(
            `${momoConfig.userId}:${momoConfig.apiKey}`
          ).toString("base64")}`,
        },
      }
    );

    const expiryMinutes = 55;
    momoTokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + expiryMinutes * 60 * 1000,
    };

    return momoTokenCache.token;
  } catch (error) {
    console.error("Failed to get MoMo token:", error);
    throw new Error(`MoMo authentication failed: ${getErrorMessage(error)}`);
  }
}

export async function initiateMoMoPayment(
  paymentId: string,
  reference: string,
  amount: number,
  phone: string,
  orderId: string
): Promise<{ transactionId: string; paymentUrl?: string }> {
  try {
    const formattedPhone = formatPhoneNumber(phone);

    const accessToken = await getMoMoToken();

    await axios.post(
      `${momoConfig.baseUrl}/collection/v1_0/requesttopay`,
      {
        amount: amount.toString(),
        currency: momoConfig.currency,
        externalId: reference,
        payer: {
          partyIdType: "MSISDN",
          partyId: formattedPhone,
        },
        payerMessage: `Payment for order ${orderId}`,
        payeeNote: "E-commerce purchase",
        callbackUrl: momoConfig.callbackUrl,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Reference-Id": reference,
          "X-Target-Environment": momoConfig.environment,
          "Content-Type": "application/json",
        },
      }
    );

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "INITIATED",
        transactionId: reference,
      },
    });

    return {
      transactionId: reference,
      paymentUrl: `${momoConfig.baseUrl}/${reference}`,
    };
  } catch (error) {
    console.error("MoMo payment initiation error:", error);

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "FAILED",
        error: getErrorMessage(error),
      },
    });

    throw new Error(
      `MoMo payment initiation failed: ${getErrorMessage(error)}`
    );
  }
}

export async function checkMoMoStatus(referenceId: string): Promise<string> {
  try {
    const accessToken = await getMoMoToken();

    const response = await axios.get<MoMoPaymentResponse>(
      `${momoConfig.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Target-Environment": momoConfig.environment,
          "Ocp-Apim-Subscription-Key": momoConfig.primaryKey,
        },
      }
    );

    return mapPaymentStatus(response.data.status);
  } catch (error) {
    console.error("Error checking MoMo status:", error);

    return "PENDING";
  }
}

export async function processMoMoCallback(
  referenceId: string,
  status: string
): Promise<boolean> {
  try {
    const payment = await prisma.payment.findFirst({
      where: { reference: referenceId },
      include: { order: true },
    });

    if (!payment) {
      console.error(`Payment with reference ${referenceId} not found`);
      return false;
    }

    const paymentStatus = mapPaymentStatus(status) as PaymentStatus;

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
        },
      });

      if (paymentStatus === "PAID") {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.PROCESSING },
        });
      }
    });

    return true;
  } catch (error) {
    console.error("Error processing MoMo callback:", error);
    return false;
  }
}
