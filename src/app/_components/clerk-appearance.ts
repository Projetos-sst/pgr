/**
 * Aparência dos componentes embutidos do Clerk, alinhada ao design aprovado.
 *
 * O cartão branco, a borda e a sombra são da nossa moldura (`AuthFrame`), então
 * o Clerk entra **sem** cartão próprio: `cardBox`/`card` ficam transparentes e
 * sem sombra, e o conteúdo herda o respiro do cartão do design.
 *
 * Os valores são os tokens da prancha "Design system público": indigo 500
 * `#5B63F5`, tinta `#16171D`, texto 2 `#4A4D5A`, superfície `#FFFFFF`, borda de
 * campo `#E4E2DD`, raio de campo e botão 12px. Aqui os hex são literais de
 * propósito: o `appearance` do Clerk é lido fora da árvore de CSS do portal,
 * onde `var(--…)` do `.pg` não alcança. Não reimplementa autenticação — só cor,
 * fonte e raio da superfície do Clerk, pela API oficial.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#5B63F5",
    colorText: "#16171D",
    colorTextSecondary: "#4A4D5A",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#16171D",
    colorDanger: "#B42318",
    colorSuccess: "#0F7A55",
    colorWarning: "#8A5208",
    borderRadius: "12px",
    fontFamily: "var(--font-sans), Manrope, 'Segoe UI', system-ui, sans-serif",
    fontFamilyButtons: "var(--font-sans), Manrope, 'Segoe UI', system-ui, sans-serif",
    fontSize: "15px",
  },
  elements: {
    rootBox: "w-full",
    // A moldura já é o cartão: o Clerk não desenha outro por cima.
    cardBox: "w-full max-w-full shadow-none border-0 bg-transparent",
    card: "bg-transparent shadow-none border-0 p-0 gap-5 w-full",
    header: "gap-1",
    headerTitle: "text-[24px] font-extrabold tracking-[-0.02em]",
    headerSubtitle: "text-[14.5px] leading-relaxed",
    socialButtonsBlockButton:
      "min-h-[48px] rounded-[12px] border border-[#DCDAD4] bg-white text-[#16171D] font-bold text-[15px] normal-case",
    socialButtonsBlockButtonText: "font-bold text-[15px]",
    dividerLine: "bg-[#E4E2DD]",
    dividerText: "text-[13px] text-[#6A6D79]",
    formFieldLabel: "text-[13.5px] font-bold text-[#16171D]",
    formFieldInput:
      "min-h-[48px] rounded-[12px] border border-[#E4E2DD] bg-white text-[15px] text-[#16171D]",
    formButtonPrimary:
      "min-h-[48px] rounded-[12px] bg-[#5B63F5] text-white font-bold text-[15px] normal-case shadow-[0_8px_18px_-8px_rgba(91,99,245,0.65)] hover:bg-[#4A51E0]",
    footerActionLink: "text-[#3E44C9] font-bold",
    footer: "bg-transparent",
    formFieldErrorText: "text-[13px] text-[#B42318]",
    identityPreviewEditButton: "text-[#3E44C9]",
  },
};
