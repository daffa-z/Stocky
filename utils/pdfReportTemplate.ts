export const openAndPrintTypewriterReport = ({
  documentTitle,
  reportHeading,
  reportSubheading = "Rincian Transaksi Penjualan",
  generatedAt,
  tableHeaders,
  tableRows,
  summaryLines = [],
  signatureName = "Koperasi",
}: {
  documentTitle: string;
  reportHeading: string;
  reportSubheading?: string;
  generatedAt: string;
  tableHeaders: string[];
  tableRows: string[][];
  summaryLines?: string[];
  signatureName?: string;
}) => {
  const printWindow = window.open("", "_blank", "width=1100,height=750");
  if (!printWindow) {
    return false;
  }

  const headerImageUrl = `${window.location.origin}/pdf-header-template.svg`;

  const headerHtml = tableHeaders
    .map(
      (header, index) =>
        `<th style="padding:10px;border:1px solid #111;text-align:${index === 0 ? "left" : "right"};">${header}</th>`
    )
    .join("");

  const rowsHtml = tableRows
    .map((row) => {
      const rowCells = row
        .map(
          (value, index) =>
            `<td style="padding:8px;border:1px solid #111;text-align:${index === 0 ? "left" : "right"};">${value}</td>`
        )
        .join("");
      return `<tr>${rowCells}</tr>`;
    })
    .join("");

  const summaryHtml = summaryLines.length
    ? `<div style="margin-top: 16px; text-align: right; line-height: 1.6;">${summaryLines.map((line) => `<p style="margin:0;">${line}</p>`).join("")}</div>`
    : "";

  printWindow.document.write(`
    <html>
      <head>
        <title>${documentTitle}</title>
      </head>
      <body style="font-family: 'Courier New', Courier, monospace; padding: 24px; color: #111;">
        <div style="margin-bottom: 12px;">
          <img src="${headerImageUrl}" alt="Header Koperasi" style="width:100%; height:auto; display:block;" />
        </div>
        <h2 style="margin: 0 0 6px; text-align: center;">${reportHeading}</h2>
        <h3 style="margin: 0 0 18px; text-align: center;">${reportSubheading}</h3>
        <p style="margin: 0 0 12px;">Tanggal cetak: ${generatedAt}</p>
        <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        ${summaryHtml}
        <div style="margin-top: 48px; display: flex; justify-content: flex-end;">
          <div style="text-align: center; min-width: 220px;">
            <p style="margin:0;">${new Date().toLocaleDateString("id-ID")}</p>
            <p style="margin:0 0 64px;">Mengetahui,</p>
            <p style="margin:0; font-weight: 700; text-decoration: underline;">${signatureName}</p>
          </div>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
};
