import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// jsPDF's built-in fonts have no ৳ glyph, so the PDF uses "Tk".
const tk = (n) => `Tk ${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const n2 = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export function exportReportPdf(r) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const brand = [15, 118, 110];
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Monthly Report', 40, 50);
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(r.title, 40, 68);
  doc.text(`Generated ${new Date(r.generatedAt).toLocaleString('en-GB')}`, 40, 84);

  const head = { fillColor: brand, textColor: 255, fontStyle: 'bold' };
  const f = r.financial;
  autoTable(doc, {
    startY: 104,
    head: [['Financial summary', 'Amount']],
    body: [
      ['Starting balance', tk(f.startingBalance)],
      ['Carried from last month', tk(f.carryBalance)],
      ['Total deposits', tk(f.deposits)],
      ['Paid by members directly', tk(f.personalPurchases)],
      ['Food expense', tk(f.food)],
      ['Household expense', tk(f.household)],
      ['Utility expense', tk(f.utility)],
      ['Other expense', tk(f.other)],
      ['Total expenses', tk(f.totalExpense)],
      ['Cash in hand', tk(f.cashInHand)],
    ],
    headStyles: head,
    columnStyles: { 1: { halign: 'right' } },
    theme: 'striped',
  });

  const types = Object.entries(r.meals.byType);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 20,
    head: [['Member', ...types.map(([, t]) => t.label), 'Meals', 'Share']],
    body: [...r.meals.members.map((m) => [m.fullName, ...types.map(([k]) => m.mealsByType[k] || 0), n2(m.meals), `${m.mealPercent}%`]), ['Total', ...types.map(([, t]) => t.count), n2(r.meals.totalMeals), '']],
    headStyles: head,
    theme: 'striped',
  });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Meal rate: ${tk(r.meals.mealRate)} per meal  (${tk(r.meals.mealRateExpense)} / ${n2(r.meals.totalMeals)} meals)`, 40, doc.lastAutoTable.finalY + 18);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 32,
    head: [['Member', 'Meals', 'Meal cost', 'Shared', 'Payable', 'Paid', 'Balance']],
    body: r.settlement.members.map((m) => [m.fullName, n2(m.meals), tk(m.mealCost), tk(m.sharedTotal), tk(m.payable), tk(m.totalCredit), m.status === 'due' ? `Due ${tk(m.due)}` : m.status === 'refund' ? `Refund ${tk(m.refund)}` : 'Settled']),
    headStyles: head,
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    theme: 'striped',
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 20,
    head: [['Category', 'Type', 'Amount']],
    body: r.bazar.byCategory.map((c) => [c.category, c.expenseType, tk(c.amount)]),
    headStyles: head,
    columnStyles: { 2: { halign: 'right' } },
    theme: 'striped',
  });

  if (r.bazar.items.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Date', 'Item', 'Category', 'Qty', 'Total', 'Bought by']],
      body: r.bazar.items.map((b) => [b.date, b.itemName, b.category, `${n2(b.quantity)} ${b.unit}`, tk(b.totalPrice), b.purchasedBy]),
      headStyles: head,
      styles: { fontSize: 8 },
      theme: 'striped',
    });
  }
  if (r.expenses.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Date', 'Expense', 'Category', 'Amount', 'Paid by']],
      body: r.expenses.map((e) => [e.date, e.title, e.category, tk(e.amount), e.paidBy]),
      headStyles: head,
      styles: { fontSize: 8 },
      theme: 'striped',
    });
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() - 80, doc.internal.pageSize.getHeight() - 20);
  }
  doc.save(`${r.month.year}-${String(r.month.month).padStart(2, '0')}-report.pdf`);
}
