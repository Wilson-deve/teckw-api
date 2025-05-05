import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role?: Role };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader?.split(" ")[1];

    // If no access token, try refresh flow
    if (!accessToken) {
      handleTokenRefresh(req, res, next);
      return;
    }

    try {
      // Verify access token (will throw if expired)
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET!) as {
        userId: string;
        role: Role;
      };
      req.user = { userId: decoded.userId, role: decoded.role };
      next();
      return;
    } catch (accessTokenError) {
      // Only catch expiration errors - throw others
      if (accessTokenError instanceof jwt.TokenExpiredError) {
        handleTokenRefresh(req, res, next);
        return;
      }
      throw accessTokenError;
    }
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({
      success: false,
      code: "AUTHENTICATION_FAILED",
      message: "Please log in again",
    });
    return;
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required for this route",
      });
      return;
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        code: "UNAUTHORIZED_ROLE",
        message: `User role ${
          req.user.role || "undefined"
        } is not authorized to access this route`,
      });
      return;
    }

    next();
  };
};

const handleTokenRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) throw new Error("No refresh token available");

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET!
    ) as {
      userId: string;
    };

    // Check against database
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
        refreshToken,
      },
    });

    if (!user) throw new Error("Invalid refresh token");

    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    // Attach new tokens to response
    res.locals.newTokens = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };

    // Set user and proceed
    req.user = { userId: user.id, role: user.role };
    next();
  } catch (error) {
    console.error("Refresh failed:", error);
    res.status(401).json({
      success: false,
      code: "SESSION_EXPIRED",
      message: "Please log in again",
    });
  }
};
