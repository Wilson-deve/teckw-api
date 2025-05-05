import { RequestHandler } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { addressSchema } from "../types";

export const getAddresses: RequestHandler = async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.userId },
      orderBy: { isDefault: "desc" },
    });
    res.json({ success: true, data: addresses });
  } catch (error) {
    console.error("Get addresses error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get addresses" });
  }
};

export const addAddress: RequestHandler = async (req, res) => {
  try {
    const validatedData = addressSchema.parse(req.body);

    const existingCount = await prisma.address.count({
      where: {
        userId: req.user!.userId,
      },
    });

    const newAddress = await prisma.address.create({
      data: {
        ...validatedData,
        userId: req.user!.userId,
        isDefault:
          existingCount === 0 ? true : validatedData.isDefault ?? false,
      },
    });

    if (validatedData.isDefault && existingCount > 0) {
      await prisma.address.updateMany({
        where: {
          userId: req.user!.userId,
          id: { not: newAddress.id },
        },
        data: { isDefault: false },
      });
    }

    res.status(201).json({ success: true, data: newAddress });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }

    res.status(500).json({ success: false, message: "Failed to add address" });
  }
};

export const updateAddress: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = addressSchema.parse(req.body);

    const updateAddress = await prisma.address.update({
      where: { id, userId: req.user!.userId },
      data: validatedData,
    });

    res.json({ success: true, data: updateAddress });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
};

export const deleteAddress: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      const address = await tx.address.findUnique({
        where: { id, userId: req.user!.userId },
      });

      if (!address) {
        return res
          .status(404)
          .json({ success: false, message: "Address not found" });
      }

      await tx.address.delete({ where: { id } });

      if (address.isDefault) {
        const firstAddress = await tx.address.findFirst({
          where: { userId: req.user!.userId },
        });
        if (firstAddress) {
          await tx.address.update({
            where: { id: firstAddress.id },
            data: { isDefault: true },
          });
        }
      }
    });

    res.json({ success: true, message: "Address deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete address" });
  }
};

export const setDefaultAddress: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => [
      prisma.address.updateMany({
        where: { userId: req.user!.userId, isDefault: true },
        data: { isDefault: false },
      }),

      prisma.address.update({
        where: { id, userId: req.user!.userId },
        data: { isDefault: true },
      }),
    ]);

    res.json({ success: true, message: "Default address updated" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to set default address" });
  }
};
