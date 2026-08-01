// Shared branding snippets for print/PDF templates.

import { getBranding } from "@/hooks/useBranding";

export const brandStyles = `
  .brandline { display: flex; align-items: center; gap: 10px; }
  .brandline img.logo { height: 44px; width: auto; max-width: 120px; object-fit: contain; }
`;

/** Logo + school name block used in the print header. */
export function brandBlockHtml() {
  const b = getBranding();
  const name = b.schoolName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const logo = b.logoUrl ? `<img class="logo" src="${b.logoUrl}" alt="" />` : "";
  return `<div class="brandline">${logo}<div class="brand">${name}</div></div>`;
}

export function brandName() {
  return getBranding().schoolName;
}
