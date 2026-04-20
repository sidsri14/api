import { prisma } from '../utils/prisma.js';
import type { Client } from '@prisma/client';

export async function listClients(userId: string): Promise<Client[]> {
  return prisma.client.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function createClient(
  userId: string,
  data: { name: string; email: string; phone?: string; company?: string }
): Promise<Client> {
  return prisma.client.create({ data: { ...data, userId } });
}

export async function updateClient(
  userId: string,
  clientId: string,
  data: Partial<{ name: string; email: string; phone: string; company: string }>
): Promise<Client> {
  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) throw Object.assign(new Error('Client not found'), { status: 404 });
  return prisma.client.update({ where: { id: clientId }, data });
}

export async function deleteClient(userId: string, clientId: string): Promise<void> {
  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) throw Object.assign(new Error('Client not found'), { status: 404 });
  await prisma.client.delete({ where: { id: clientId } });
}
