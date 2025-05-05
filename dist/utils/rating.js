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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAverageRating = calculateAverageRating;
exports.updateProductRating = updateProductRating;
const prisma_1 = __importDefault(require("../lib/prisma"));
function calculateAverageRating(productId) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield prisma_1.default.review.aggregate({
            where: { productId },
            _avg: { rating: true },
            _count: { rating: true },
        });
        return {
            average: result._avg.rating || 0,
            count: result._count.rating,
        };
    });
}
function updateProductRating(productId) {
    return __awaiter(this, void 0, void 0, function* () {
        const { average } = yield calculateAverageRating(productId);
        yield prisma_1.default.product.update({
            where: { id: productId },
            data: { rating: average },
        });
    });
}
