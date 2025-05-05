import { RequestHandler } from "express";
import prisma from "../lib/prisma";
import dotenv from "dotenv";

dotenv.config();

export const getProducts: RequestHandler = async (req, res) => {
  try {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      search,
      sort = "-createdAt",
      page = 1,
      limit = 10,
    } = req.query;

    const userId = req.user?.userId;

    const where: any = {};
    if (category) where.category = category;
    if (brand) where.brand = brand;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    let orderBy: any = {};
    const sortField = sort.toString().startsWith("-")
      ? sort.toString().substring(1)
      : sort.toString();
    const sortOrder = sort.toString().startsWith("-") ? "desc" : "asc";
    orderBy[sortField as string] = sortOrder;

    switch (sortField) {
      case "name":
        orderBy.name = sortOrder;
        break;
      case "price":
        orderBy.price = sortOrder;
        break;
      case "highPrice":
        orderBy.price = "desc";
        break;
      case "lowPrice":
        orderBy.price = "asc";
        break;
      case "sale":
        orderBy = {
          discountPercentage: "desc",
        };
        break;
      case "newest":
        orderBy.createdAt = "desc";
        break;
      case "popularity":
        orderBy.viewCount = "desc";
        break;
      default:
        orderBy[sortField] = sortOrder;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          category: true,
          images: true,
          reviews: {
            select: { rating: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const wishlists = userId
      ? await prisma.wishlistItem.findMany({
          where: {
            wishlist: {
              userId: userId,
            },
            productId: {
              in: products.map((p) => p.id),
            },
          },
        })
      : [];

    const cartItems = userId
      ? await prisma.cartItem.findMany({
          where: {
            cart: { userId },
            productId: { in: products.map((p) => p.id) },
          },
        })
      : [];

    const enhancedProducts = products.map((product) => {
      const averageRating =
        product.reviews.length > 0
          ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
            product.reviews.length
          : null;

      const discountPercentage =
        product.discount && product.price
          ? Math.round(
              ((Number(product.price) - Number(product.discount)) /
                Number(product.price)) *
                100
            )
          : null;

      const isWishlisted = wishlists.some((w) => w.productId === product.id);

      const cartItem = cartItems.find((c) => c.productId === product.id);

      return {
        ...product,
        rating: averageRating,
        discountPercentage,
        isOnSale: discountPercentage !== null,
        isWishlisted,
        inCart: !!cartItem,
        cartQuantity: cartItem?.quantity || 0,
        mainImage: product.images.length > 0 ? product.images[0].url : null,
      };
    });

    res.json({
      success: true,
      data: enhancedProducts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

export const getProductById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: true,
        variations: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
      });
      return;
    }

    const totalReviews = product.reviews.length;
    const averageRating =
      product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
          product.reviews.length
        : null;

    const discountPercentage = product.discount || null;
    const finalPrice = product.discount
      ? Number(product.price) * (1 - product.discount / 100)
      : Number(product.price);

    let isWishlisted = false;
    if (userId) {
      const userWishlist = await prisma.wishlist.findUnique({
        where: { userId },
        include: {
          items: {
            where: { productId: id },
            take: 1,
          },
        },
      });

      isWishlisted = userWishlist?.items.length ? true : false;
    }

    let inCart = false;
    let cartQuantity = 0;
    if (userId) {
      const userCart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            where: { productId: id },
            take: 1,
          },
        },
      });

      if (userCart?.items.length) {
        inCart = true;
        cartQuantity = userCart.items[0].quantity;
      }
    }

    const formattedProduct = {
      ...product,
      rating: averageRating,
      totalReviewCount: totalReviews,
      discount: discountPercentage,
      originalPrice: Number(product.price),
      finalPrice: parseFloat(finalPrice.toFixed(2)),
      isOnSale: !!product.discount,
      isWishlisted,
      inCart,
      cartQuantity,
      inStock: product.stock > 0,
      colorOptions: [],
      variations:
        product.variations?.map((variation) => ({
          id: variation.id,
          price: variation.price || product.price,
          stock:
            variation.stock !== undefined ? variation.stock : product.stock,
          // Additional variation details here
        })) || [],
    };

    res.json({
      success: true,
      data: formattedProduct,
    });
  } catch (error) {
    console.error("Get product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

export const getShareLink: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.params;

    const shareLink = `${process.env.APP_URL}/product/${productId}`;

    res.json({
      success: true,
      data: {
        shareLink,
        title: "Check out this product!",
      },
    });
  } catch (error) {
    console.error("Get share link error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate share link",
    });
  }
};

export const createProduct: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      categoryId,
      brand,
      stock,
      specifications,
      discount,
      images,
    } = req.body;

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category: {
          connect: { id: categoryId },
        },
        brand,
        stock: parseInt(stock, 10),
        specifications,
        discount: discount ? parseFloat(discount) : null,
        images: {
          create: images
            ? images.map((image: string, index: number) => ({
                url: image,
                isMain: index === 0,
              }))
            : [],
        },
      },
      include: {
        category: true,
        images: true,
      },
    });

    res.status(201).json({
      success: true,
      data: newProduct,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

export const updateProduct: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      brand,
      categoryId,
      specifications,
      discount,
      images,
    } = req.body;

    const productExists = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!productExists) {
      res.status(404).json({
        success: false,
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
      });
      return;
    }

    const productData = {
      name,
      description,
      price: price ? parseFloat(price) : undefined,
      stock: stock ? parseInt(stock, 10) : undefined,
      brand,
      specifications,
      discount: discount ? parseFloat(discount) : null,
      categoryId,
    } as Record<string, any>;

    Object.keys(productData).forEach((key) => {
      if (productData[key] === undefined) {
        delete productData[key];
      }
    });

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: req.params.id },
        data: productData,
        include: {
          category: true,
          images: true,
        },
      });

      if (images && images.length > 0) {
        await tx.productImage.deleteMany({
          where: {
            productId: req.params.id,
          },
        });

        await tx.productImage.createMany({
          data: images.map((image: string, index: number) => ({
            url: image,
            isMain: index === 0,
            productId: req.params.id,
          })),
        });

        const updatedImages = await tx.productImage.findMany({
          where: { productId: req.params.id },
        });
        product.images = updatedImages;
      }
      return product;
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
};

export const deleteProduct: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const productExists = await prisma.product.findUnique({
      where: { id },
    });

    if (!productExists) {
      res.status(404).json({
        success: false,
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
      });
      return;
    }

    await prisma.product.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};
