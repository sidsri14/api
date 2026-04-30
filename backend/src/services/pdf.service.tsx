import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { Invoice, InvoiceItem, Client, User } from '@prisma/client';

type InvoiceForPDF = Invoice & { client: Client; user: User; items: InvoiceItem[] };

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyName: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  invoiceLabel: { fontSize: 20, color: '#555' },
  section: { marginBottom: 24 },
  label: { fontSize: 9, color: '#777', marginBottom: 2, textTransform: 'uppercase' },
  value: { fontSize: 11 },
  table: { marginTop: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: 8, borderRadius: 4 },
  tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  col3: { flex: 1, textAlign: 'right' },
  col4: { flex: 1, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  totalRow: { flexDirection: 'row', padding: 8, marginTop: 4 },
  footer: { marginTop: 40, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12, color: '#777', fontSize: 9 },
});

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', MYR: 'RM', JPY: '¥',
};

function formatMoney(cents: number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency + ' ';
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function InvoiceDocument({ invoice }: { invoice: InvoiceForPDF }) {
  const currency = invoice.currency || 'USD';
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{invoice.user.name ?? 'InvoiceFlow'}</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={{ color: '#555', marginTop: 4 }}>{invoice.number}</Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={[styles.section, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <View>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.value}>{invoice.client.name}</Text>
            {invoice.client.company && <Text style={{ color: '#555' }}>{invoice.client.company}</Text>}
            <Text style={{ color: '#555' }}>{invoice.client.email}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Issue Date</Text>
            <Text style={styles.value}>{new Date(invoice.createdAt).toDateString()}</Text>
            <Text style={[styles.label, { marginTop: 8 }]}>Due Date</Text>
            <Text style={[styles.value, styles.bold]}>{new Date(invoice.dueDate).toDateString()}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.value}>{invoice.description}</Text>
        </View>

        {/* Line Items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, styles.bold]}>Item</Text>
            <Text style={[styles.col2, styles.bold]}>Qty</Text>
            <Text style={[styles.col3, styles.bold]}>Unit Price</Text>
            <Text style={[styles.col4, styles.bold]}>Total</Text>
          </View>
          {invoice.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{formatMoney(item.unitCents, currency)}</Text>
              <Text style={styles.col4}>{formatMoney(item.totalCents, currency)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.col1, { flex: 5 }]} />
            <Text style={[styles.col4, styles.bold, { fontSize: 13 }]}>
              {formatMoney(invoice.amount, currency)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business. Please pay by {new Date(invoice.dueDate).toDateString()}.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateInvoicePDF(invoice: InvoiceForPDF): Promise<Buffer> {
  const element = React.createElement(InvoiceDocument, { invoice }) as any;
  return await renderToBuffer(element);
}
