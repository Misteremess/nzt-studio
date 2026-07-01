// features/presupuestos/components/budget-pdf-document.tsx
// The professional budget PDF, built with @react-pdf/renderer.
// Rendered client-side on demand (see budget-download-button). Uses the built-in
// Helvetica family (full Latin-1 support, so Spanish accents render correctly)
// and embeds the Hyperfocus logo as a vector path.

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Path,
} from "@react-pdf/renderer";

import { computeTotals, lineTotal, formatEur } from "@/features/presupuestos/lib/calc";
import {
  BRAND_CYAN,
  BRAND_INK,
  HYPERFOCUS_LOGO_PATH,
  SIGNATORY_MAXIMO,
  SIGNATORY_IGNACIO,
} from "@/features/presupuestos/lib/constants";
import type { BudgetDocumentData } from "@/features/presupuestos/types";

const MUTED = "#5B6472";
const HAIRLINE = "#E2E6EC";
const ZEBRA = "#F5F7FA";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 44,
    paddingBottom: 64,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: BRAND_INK,
    lineHeight: 1.4,
  },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 18, letterSpacing: 1 },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  metaBox: { alignItems: "flex-end" },
  metaLabel: { fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: 2, color: BRAND_INK },
  metaNumber: { fontSize: 10, color: BRAND_INK, marginTop: 4 },
  metaLine: { fontSize: 8.5, color: MUTED, marginTop: 2 },

  accent: { height: 3, backgroundColor: BRAND_CYAN, borderRadius: 2, marginTop: 14, marginBottom: 16 },

  // Parties
  parties: { flexDirection: "row", gap: 24, marginBottom: 18 },
  party: { flex: 1 },
  partyLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: BRAND_CYAN,
    marginBottom: 4,
  },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  partyLine: { fontSize: 8.5, color: MUTED, marginTop: 1.5 },

  // Title
  title: { fontFamily: "Helvetica-Bold", fontSize: 13, marginBottom: 4 },
  intro: { fontSize: 9, color: "#3A4250", marginBottom: 16 },

  // Table
  tableHead: {
    flexDirection: "row",
    backgroundColor: BRAND_INK,
    color: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 0.5, color: "#FFFFFF" },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  rowZebra: { backgroundColor: ZEBRA },
  cellConcept: { flex: 1, paddingRight: 8 },
  concept: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  conceptDesc: { fontSize: 8, color: MUTED, marginTop: 1.5 },
  colQty: { width: 42, textAlign: "right" },
  colPrice: { width: 74, textAlign: "right" },
  colAmount: { width: 82, textAlign: "right" },
  cellNum: { fontSize: 9 },

  // Totals
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totals: { width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, color: BRAND_INK },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: BRAND_INK,
    borderRadius: 3,
  },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#FFFFFF" },
  grandValue: { fontFamily: "Helvetica-Bold", fontSize: 13, color: BRAND_CYAN },

  // Sections
  section: { marginTop: 18 },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: BRAND_CYAN,
    marginBottom: 4,
  },
  sectionText: { fontSize: 8.8, color: "#3A4250" },

  // Signature
  signWrap: { marginTop: 28, flexDirection: "row", justifyContent: "flex-end" },
  signBox: { width: 240, alignItems: "flex-start" },
  signLead: { fontSize: 9, color: MUTED, marginBottom: 18 },
  signLine: { borderTopWidth: 1, borderTopColor: BRAND_INK, width: 200, marginBottom: 4 },
  signName: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  signSub: { fontSize: 8, color: MUTED, marginTop: 1 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: MUTED },
});

function formatEsDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

function validUntil(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return formatEsDate(d.toISOString());
}

function Party({ label, lines }: { label: string; lines: { text: string; bold?: boolean }[] }) {
  const visible = lines.filter((l) => l.text.trim() !== "");
  return (
    <View style={styles.party}>
      <Text style={styles.partyLabel}>{label}</Text>
      {visible.map((l, i) => (
        <Text key={i} style={l.bold ? styles.partyName : styles.partyLine}>
          {l.text}
        </Text>
      ))}
    </View>
  );
}

export function BudgetPdfDocument({ data }: { data: BudgetDocumentData }) {
  const totals = computeTotals(data.items, data.taxRate, data.discountRate);
  const { issuer, client } = data;

  const signNames = [
    data.signatories.maximo ? SIGNATORY_MAXIMO : null,
    data.signatories.ignacio ? SIGNATORY_IGNACIO : null,
  ].filter((n): n is string => n !== null);

  const footerContact = [issuer.email, issuer.phone, issuer.web].filter(Boolean).join("   ·   ");

  return (
    <Document title={`${data.number} — ${data.title}`} author={issuer.companyName}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <Svg viewBox="0 0 880 913" style={{ width: 34, height: 35 }}>
                <Path d={HYPERFOCUS_LOGO_PATH} fill={BRAND_INK} fillRule="evenodd" />
              </Svg>
              <View>
                <Text style={styles.wordmark}>{(issuer.companyName || "Hyperfocus").toUpperCase()}</Text>
                {issuer.fiscalName ? <Text style={styles.brandSub}>{issuer.fiscalName}</Text> : null}
              </View>
            </View>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>PRESUPUESTO</Text>
            <Text style={styles.metaNumber}>{data.number}</Text>
            <Text style={styles.metaLine}>Fecha: {formatEsDate(data.issuedAt)}</Text>
            <Text style={styles.metaLine}>
              Válido hasta: {validUntil(data.issuedAt, data.validityDays)}
            </Text>
          </View>
        </View>

        <View style={styles.accent} />

        {/* Parties */}
        <View style={styles.parties}>
          <Party
            label="EMISOR"
            lines={[
              { text: issuer.companyName, bold: true },
              { text: issuer.taxId ? `NIF/CIF: ${issuer.taxId}` : "" },
              { text: issuer.address },
              { text: issuer.email },
              { text: issuer.phone },
            ]}
          />
          <Party
            label="CLIENTE"
            lines={[
              { text: client.name, bold: true },
              { text: client.taxId ? `NIF/CIF: ${client.taxId}` : "" },
              { text: client.address },
              { text: client.email },
              { text: client.phone },
            ]}
          />
        </View>

        {/* Title + intro */}
        <Text style={styles.title}>{data.title}</Text>
        {data.intro ? <Text style={styles.intro}>{data.intro}</Text> : null}

        {/* Items table */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.cellConcept]}>CONCEPTO</Text>
          <Text style={[styles.th, styles.colQty]}>CANT.</Text>
          <Text style={[styles.th, styles.colPrice]}>PRECIO</Text>
          <Text style={[styles.th, styles.colAmount]}>IMPORTE</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={i % 2 === 1 ? [styles.row, styles.rowZebra] : styles.row} wrap={false}>
            <View style={styles.cellConcept}>
              <Text style={styles.concept}>{item.concept}</Text>
              {item.description ? <Text style={styles.conceptDesc}>{item.description}</Text> : null}
            </View>
            <Text style={[styles.cellNum, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.cellNum, styles.colPrice]}>{formatEur(item.unitPrice)}</Text>
            <Text style={[styles.cellNum, styles.colAmount]}>{formatEur(lineTotal(item))}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Base imponible</Text>
              <Text style={styles.totalValue}>{formatEur(totals.subtotal)}</Text>
            </View>
            {totals.discount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Descuento ({data.discountRate}%)</Text>
                <Text style={styles.totalValue}>−{formatEur(totals.discount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA ({data.taxRate}%)</Text>
              <Text style={styles.totalValue}>{formatEur(totals.tax)}</Text>
            </View>
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <Text style={styles.grandValue}>{formatEur(totals.total)}</Text>
            </View>
          </View>
        </View>

        {/* Payment terms */}
        {data.paymentTerms ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CONDICIONES DE PAGO</Text>
            <Text style={styles.sectionText}>{data.paymentTerms}</Text>
            {issuer.iban ? (
              <Text style={[styles.sectionText, { marginTop: 3 }]}>Transferencia a: {issuer.iban}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Notes */}
        {data.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTAS</Text>
            <Text style={styles.sectionText}>{data.notes}</Text>
          </View>
        ) : null}

        {/* Validity note */}
        <View style={styles.section}>
          <Text style={styles.sectionText}>
            Este presupuesto tiene una validez de {data.validityDays} días desde su fecha de emisión.
            Los precios indicados no incluyen el IVA, que se detalla por separado. Documento sin
            valor de factura.
          </Text>
        </View>

        {/* Signature */}
        {signNames.length > 0 ? (
          <View style={styles.signWrap}>
            <View style={styles.signBox}>
              <Text style={styles.signLead}>Atentamente,</Text>
              <View style={styles.signLine} />
              {signNames.map((n, i) => (
                <Text key={i} style={styles.signName}>
                  {n}
                </Text>
              ))}
              <Text style={styles.signSub}>{issuer.companyName}</Text>
            </View>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {issuer.companyName}
            {footerContact ? `   ·   ${footerContact}` : ""}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
