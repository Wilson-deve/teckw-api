import { v4 as uuidv4 } from "uuid";

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+250")) {
    return cleaned;
  } else if (cleaned.startsWith("250")) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith("0")) {
    return `+250${cleaned.substring(1)}`;
  }

  return `+250${cleaned}`;
}

export function generateReference(): string {
  return uuidv4();
}

export function getErrorMessage(error: any): string {
  if (error.response?.data) {
    try {
      if (typeof error.response.data === "string") {
        return error.response.data;
      }

      return JSON.stringify(error.response.data);
    } catch {
      return error.response.statusText || "API Error";
    }
  } else if (error.message) {
    return error.message;
  }
  return "Unknown error";
}

export function mapPaymentStatus(externalStatus: string): string {
  const statusMap: Record<string, string> = {
    SUCCESSFUL: "PAID",
    SUCCESS: "PAID",
    COMPLETED: "PAID",
    FAILED: "FAILED",
    REJECTED: "FAILED",
    CANCELLED: "CANCELLED",
    PENDING: "PENDING",
    INITIATED: "INITIATED",
  };

  return statusMap[externalStatus] || "PENDING";
}
