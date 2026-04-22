/// <reference types="bun-types" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testInvoiceFlow() {
  console.log('--- Testing Invoice Creation Flow ---');
  
  // 1. Setup mock user
  let user = await prisma.user.findFirst({ where: { email: 'e2e-test@example.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'e2e-test@example.com',
        name: 'E2E Tester',
        plan: 'pro'
      }
    });
    console.log(`Created test user: ${user.email}`);
  }

  // 2. Create a Client (upsert to allow repeated runs without unique-constraint violations)
  const client = await prisma.client.upsert({
    where: { userId_email: { userId: user.id, email: 'client@testcorp.com' } },
    create: { userId: user.id, name: 'Test Client Corp', email: 'client@testcorp.com', company: 'TestCorp Industries' },
    update: {},
  });
  console.log(`Created test client: ${client.name} (${client.id})`);

  // 3. Create an Invoice
  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client.id,
      number: 'INV-' + Date.now(),
      amount: 150000, // $1500.00
      currency: 'INR',
      description: 'Consulting Services - Phase 1',
      clientEmail: client.email,
      dueDate: new Date(Date.now() + 7 * 24 * 3600000), // 7 days from now
      status: 'DRAFT'
    }
  });
  console.log(`Created test invoice: ${invoice.number} (${invoice.id})`);

  // 4. Verify DB state
  const foundInvoice = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    include: { client: true }
  });

  if (foundInvoice && foundInvoice.amount === 150000 && foundInvoice.client.name === 'Test Client Corp') {
    console.log('✅ Invoice logic verified successfully');
  } else {
    console.error('❌ Invoice logic verification failed');
    process.exit(1);
  }

  // 5. Cleanup
  await prisma.invoice.delete({ where: { id: invoice.id } });
  await prisma.client.delete({ where: { id: client.id } });
  console.log('Cleaned up test client and invoice.');
}

async function runTests() {
  try {
    await testInvoiceFlow();
    console.log('\nAll project logic tests passed!');
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
