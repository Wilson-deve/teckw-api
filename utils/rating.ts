import prisma from "../lib/prisma";

export async function calculateAverageRating(productId: string) {
  const result = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    average: result._avg.rating || 0,
    count: result._count.rating,
  };
}

export async function updateProductRating(productId: string) {
  const { average } = await calculateAverageRating(productId);

  await prisma.product.update({
    where: { id: productId },
    data: { rating: average },
  });
}
