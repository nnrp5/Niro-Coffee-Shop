import { requireSupabaseAuth } from "../middlewares/supabaseAuth";
import { and, eq, sql } from "drizzle-orm";
import {
  accountFavoritesTable,
  accountProfilesTable,
  customerLoyaltyTable,
  customerOrdersTable,
  db,
} from "@workspace/db";
import {
  GetAccountFavoritesResponse,
  GetAccountLoyaltyResponse,
  GetAccountOrdersResponse,
  GetAccountProfileResponse,
  RemoveAccountFavoriteParams,
  SaveAccountFavoriteBody,
  SaveAccountFavoriteResponse,
  UpdateAccountProfileBody,
  UpdateAccountProfileResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.use("/account", requireSupabaseAuth);

router.get("/account/profile", async (req, res): Promise<void> => {
  const userId = res.locals.authUserId as string;
  const [profile] = await db
    .select()
    .from(accountProfilesTable)
    .where(eq(accountProfilesTable.userId, userId))
    .limit(1);

  res.json(
    GetAccountProfileResponse.parse({
      fullName: profile?.fullName ?? "",
      phone: profile?.phone ?? null,
      updatedAt: profile?.updatedAt.toISOString() ?? new Date().toISOString(),
    }),
  );
});

router.patch("/account/profile", async (req, res): Promise<void> => {
  const body = UpdateAccountProfileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = res.locals.authUserId as string;
  const [profile] = await db
    .insert(accountProfilesTable)
    .values({
      userId,
      fullName: body.data.fullName,
      phone: body.data.phone ?? null,
    })
    .onConflictDoUpdate({
      target: accountProfilesTable.userId,
      set: {
        fullName: body.data.fullName,
        phone: body.data.phone ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(
    UpdateAccountProfileResponse.parse({
      fullName: profile.fullName,
      phone: profile.phone,
      updatedAt: profile.updatedAt.toISOString(),
    }),
  );
});

router.get("/account/orders", async (req, res): Promise<void> => {
  const userId = res.locals.authUserId as string;
  const orders = await db
    .select()
    .from(customerOrdersTable)
    .where(eq(customerOrdersTable.userId, userId))
    .orderBy(sql`${customerOrdersTable.placedAt} desc`);

  res.json(
    GetAccountOrdersResponse.parse(
      orders.map((order) => ({
        ...order,
        placedAt: order.placedAt.toISOString(),
      })),
    ),
  );
});

router.get("/account/loyalty", async (req, res): Promise<void> => {
  const userId = res.locals.authUserId as string;
  const [totals] = await db
    .select({
      pointsBalance: sql<number>`coalesce(sum(case when ${customerLoyaltyTable.kind} = 'earned' then ${customerLoyaltyTable.points} else -${customerLoyaltyTable.points} end), 0)::int`,
      lifetimeEarned: sql<number>`coalesce(sum(case when ${customerLoyaltyTable.kind} = 'earned' then ${customerLoyaltyTable.points} else 0 end), 0)::int`,
    })
    .from(customerLoyaltyTable)
    .where(eq(customerLoyaltyTable.userId, userId));

  res.json(
    GetAccountLoyaltyResponse.parse({
      pointsBalance: totals?.pointsBalance ?? 0,
      lifetimeEarned: totals?.lifetimeEarned ?? 0,
      pointsPerCurrencyUnit: 12,
      redemptionValuePer100Points: 0.083,
      currency: "KWD",
    }),
  );
});

router.get("/account/favorites", async (req, res): Promise<void> => {
  const userId = res.locals.authUserId as string;
  const favorites = await db
    .select({
      productId: accountFavoritesTable.productId,
      createdAt: accountFavoritesTable.createdAt,
    })
    .from(accountFavoritesTable)
    .where(eq(accountFavoritesTable.userId, userId))
    .orderBy(sql`${accountFavoritesTable.createdAt} desc`);

  res.json(
    GetAccountFavoritesResponse.parse(
      favorites.map((favorite) => ({
        ...favorite,
        createdAt: favorite.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/account/favorites", async (req, res): Promise<void> => {
  const body = SaveAccountFavoriteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = res.locals.authUserId as string;
  let [favorite] = await db
    .insert(accountFavoritesTable)
    .values({ userId, productId: body.data.productId })
    .onConflictDoNothing({
      target: [accountFavoritesTable.userId, accountFavoritesTable.productId],
    })
    .returning({
      productId: accountFavoritesTable.productId,
      createdAt: accountFavoritesTable.createdAt,
    });

  if (!favorite) {
    [favorite] = await db
      .select({
        productId: accountFavoritesTable.productId,
        createdAt: accountFavoritesTable.createdAt,
      })
      .from(accountFavoritesTable)
      .where(
        and(
          eq(accountFavoritesTable.userId, userId),
          eq(accountFavoritesTable.productId, body.data.productId),
        ),
      )
      .limit(1);
  }

  res.status(201).json(
    SaveAccountFavoriteResponse.parse({
      productId: favorite.productId,
      createdAt: favorite.createdAt.toISOString(),
    }),
  );
});

router.delete("/account/favorites/:productId", async (req, res): Promise<void> => {
  const params = RemoveAccountFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = res.locals.authUserId as string;
  await db
    .delete(accountFavoritesTable)
    .where(
      and(
        eq(accountFavoritesTable.userId, userId),
        eq(accountFavoritesTable.productId, params.data.productId),
      ),
    );
  res.sendStatus(204);
});

export default router;
