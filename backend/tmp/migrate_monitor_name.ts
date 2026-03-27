import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding "name" column to "Monitor" table...');
  try {
    // Standard PostgreSQL ALTER TABLE
    // We use COALESCE(url, 'New Monitor') as a fallback for existing rows
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "name" VARCHAR(100);
    `);
    
    await prisma.$executeRawUnsafe(`
      UPDATE "Monitor" SET "name" = url WHERE "name" IS NULL;
    `);

    console.log('Migration successful: "name" column added and populated.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
