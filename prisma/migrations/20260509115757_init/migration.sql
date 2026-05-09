-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "storeName" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tool_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "reviewsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smartCartEnabled" BOOLEAN NOT NULL DEFAULT true,
    "videosEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "review_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "autoRequestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requestDelay" INTEGER NOT NULL DEFAULT 7,
    "requestSubject" TEXT NOT NULL DEFAULT 'How was your order? Leave a review!',
    "requestBody" TEXT NOT NULL DEFAULT 'We''d love to hear your feedback.',
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderDelay" INTEGER NOT NULL DEFAULT 14,
    "allowPhotoReviews" BOOLEAN NOT NULL DEFAULT true,
    "allowVideoReviews" BOOLEAN NOT NULL DEFAULT false,
    "incentiveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "incentiveType" TEXT NOT NULL DEFAULT 'discount',
    "incentiveValue" REAL NOT NULL DEFAULT 10,
    "widgetTheme" TEXT NOT NULL DEFAULT 'light',
    "primaryColor" TEXT NOT NULL DEFAULT '#5C6AC4',
    "showStarRating" BOOLEAN NOT NULL DEFAULT true,
    "showReviewCount" BOOLEAN NOT NULL DEFAULT true,
    "showVerifiedBadge" BOOLEAN NOT NULL DEFAULT true,
    "showPhotos" BOOLEAN NOT NULL DEFAULT true,
    "reviewsPerPage" INTEGER NOT NULL DEFAULT 10,
    "sortDefault" TEXT NOT NULL DEFAULT 'recent',
    "seoSnippetsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "googleShoppingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoShareFacebook" BOOLEAN NOT NULL DEFAULT false,
    "autoShareInstagram" BOOLEAN NOT NULL DEFAULT false,
    "autoShareTiktok" BOOLEAN NOT NULL DEFAULT false,
    "qaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "photoUrls" TEXT NOT NULL DEFAULT '[]',
    "videoUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "notHelpful" INTEGER NOT NULL DEFAULT 0,
    "reply" TEXT,
    "repliedAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'email',
    "importSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT NOT NULL,
    "productIds" TEXT NOT NULL,
    "sentAt" DATETIME,
    "reminderAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "review_qa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "askedBy" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" DATETIME,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "smart_cart_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "cartDrawerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "drawerPosition" TEXT NOT NULL DEFAULT 'right',
    "primaryColor" TEXT NOT NULL DEFAULT '#008060',
    "accentColor" TEXT NOT NULL DEFAULT '#5C6AC4',
    "cartTitle" TEXT NOT NULL DEFAULT 'Your Cart',
    "showCartCount" BOOLEAN NOT NULL DEFAULT true,
    "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "freeShippingThreshold" REAL NOT NULL DEFAULT 499,
    "freeShippingMessage" TEXT NOT NULL DEFAULT 'Add {amount} more for FREE shipping 🚚',
    "freeShippingSuccessMsg" TEXT NOT NULL DEFAULT '🎉 You unlocked FREE shipping!',
    "milestonesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "milestones" TEXT NOT NULL DEFAULT '[]',
    "upsellEnabled" BOOLEAN NOT NULL DEFAULT true,
    "upsellTitle" TEXT NOT NULL DEFAULT 'You might also like',
    "upsellMaxProducts" INTEGER NOT NULL DEFAULT 3,
    "upsellProductIds" TEXT NOT NULL DEFAULT '[]',
    "freebieEnabled" BOOLEAN NOT NULL DEFAULT false,
    "freebieThreshold" REAL NOT NULL DEFAULT 999,
    "freebieProductIds" TEXT NOT NULL DEFAULT '[]',
    "discountEnabled" BOOLEAN NOT NULL DEFAULT false,
    "discountCodes" TEXT NOT NULL DEFAULT '[]',
    "announcementEnabled" BOOLEAN NOT NULL DEFAULT false,
    "announcementText" TEXT NOT NULL DEFAULT '',
    "announcementColor" TEXT NOT NULL DEFAULT '#008060',
    "prepaidNudgeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "prepaidDiscount" REAL NOT NULL DEFAULT 50,
    "prepaidDiscountType" TEXT NOT NULL DEFAULT 'flat',
    "codRestrictionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "codMinOrderValue" REAL NOT NULL DEFAULT 0,
    "codMaxOrderValue" REAL NOT NULL DEFAULT 10000,
    "trustBadgesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trustBadges" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "cart_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "value" REAL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "video_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "autoplayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "muteByDefault" BOOLEAN NOT NULL DEFAULT true,
    "showProductTags" BOOLEAN NOT NULL DEFAULT true,
    "showAddToCart" BOOLEAN NOT NULL DEFAULT true,
    "defaultWidgetType" TEXT NOT NULL DEFAULT 'carousel',
    "primaryColor" TEXT NOT NULL DEFAULT '#5C6AC4',
    "borderRadius" INTEGER NOT NULL DEFAULT 8,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "lazyLoadEnabled" BOOLEAN NOT NULL DEFAULT true,
    "compressionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cdnEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tiktokConnected" BOOLEAN NOT NULL DEFAULT false,
    "tiktokHandle" TEXT NOT NULL DEFAULT '',
    "instagramConnected" BOOLEAN NOT NULL DEFAULT false,
    "instagramHandle" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "videos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'upload',
    "sourceId" TEXT,
    "productIds" TEXT NOT NULL DEFAULT '[]',
    "widgetType" TEXT NOT NULL DEFAULT 'carousel',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "addToCarts" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "video_widgets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL DEFAULT 'carousel',
    "placement" TEXT NOT NULL DEFAULT 'product_page',
    "videoIds" TEXT NOT NULL DEFAULT '[]',
    "title" TEXT NOT NULL DEFAULT '',
    "maxVideos" INTEGER NOT NULL DEFAULT 10,
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "value" REAL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_shop_key" ON "app_settings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "tool_settings_shop_key" ON "tool_settings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "review_settings_shop_key" ON "review_settings"("shop");

-- CreateIndex
CREATE INDEX "reviews_shop_idx" ON "reviews"("shop");

-- CreateIndex
CREATE INDEX "reviews_shop_productId_idx" ON "reviews"("shop", "productId");

-- CreateIndex
CREATE INDEX "reviews_shop_published_idx" ON "reviews"("shop", "published");

-- CreateIndex
CREATE INDEX "review_requests_shop_idx" ON "review_requests"("shop");

-- CreateIndex
CREATE INDEX "review_requests_shop_orderId_idx" ON "review_requests"("shop", "orderId");

-- CreateIndex
CREATE INDEX "review_qa_shop_productId_idx" ON "review_qa"("shop", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "smart_cart_settings_shop_key" ON "smart_cart_settings"("shop");

-- CreateIndex
CREATE INDEX "cart_events_shop_idx" ON "cart_events"("shop");

-- CreateIndex
CREATE INDEX "cart_events_shop_event_idx" ON "cart_events"("shop", "event");

-- CreateIndex
CREATE UNIQUE INDEX "video_settings_shop_key" ON "video_settings"("shop");

-- CreateIndex
CREATE INDEX "videos_shop_idx" ON "videos"("shop");

-- CreateIndex
CREATE INDEX "videos_shop_published_idx" ON "videos"("shop", "published");

-- CreateIndex
CREATE INDEX "video_widgets_shop_idx" ON "video_widgets"("shop");

-- CreateIndex
CREATE INDEX "analytics_events_shop_idx" ON "analytics_events"("shop");

-- CreateIndex
CREATE INDEX "analytics_events_shop_tool_idx" ON "analytics_events"("shop", "tool");

-- CreateIndex
CREATE INDEX "analytics_events_shop_event_idx" ON "analytics_events"("shop", "event");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");
