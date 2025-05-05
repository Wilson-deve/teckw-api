"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const brand_1 = require("../controllers/brand");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router
    .route("/")
    .get(brand_1.getAllBrands)
    .post(auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), brand_1.createBrand);
router.route("/featured").get(brand_1.getFeaturedBrands);
router.route("/categories/:categoryId").get(brand_1.getBrandsByCategory);
router
    .route("/:id")
    .get(brand_1.getBrandDetails)
    .put(auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), brand_1.updateBrand)
    .delete(auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), brand_1.deletedBrand);
exports.brandRoutes = router;
