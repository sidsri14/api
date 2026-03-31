-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "emailVerifyExpiry" DATETIME,
    "passwordResetToken" TEXT,
    "passwordResetExpiry" DATETIME
);
INSERT INTO "new_User" ("createdAt", "email", "id", "password", "plan") SELECT "createdAt", "email", "id", "password", "plan" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
