"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderNumber = void 0;
const generateOrderNumber = (prisma) => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, ""); // '20250426'
    // Count how many orders were created today
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));
    const todayOrdersCount = yield prisma.order.count({
        where: {
            createdAt: {
                gte: todayStart,
                lte: todayEnd,
            },
        },
    });
    const sequenceNumber = (todayOrdersCount + 1).toString().padStart(4, "0"); // '0001'
    return `ORD-${datePart}-${sequenceNumber}`;
});
exports.generateOrderNumber = generateOrderNumber;
