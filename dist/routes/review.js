"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRoutes = void 0;
const express_1 = require("express");
const review_1 = require("../controllers/review");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router
    .route("/:productId")
    .get(review_1.getProductReviews)
    .post(auth_1.authenticate, review_1.createReview);
router
    .route("/:id")
    .put(auth_1.authenticate, review_1.updateReview)
    .delete(auth_1.authenticate, review_1.deleteReview);
exports.reviewRoutes = router;
