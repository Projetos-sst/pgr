/**
 * Aparência dos componentes embutidos do Clerk, alinhada ao design aprovado.
 *
 * O cartão branco, a borda e a sombra são da nossa moldura (`AuthFrame`), então
 * o Clerk entra **sem** cartão próprio e o conteúdo herda o respiro do cartão do
 * design (a neutralização da superfície fica em `portal.css`, regras `.cl-*`).
 *
 * Os estilos vão como **objetos** CSS-in-JS, não como classes utilitárias: o
 * Clerk v7 injeta o próprio CSS fora das camadas do Tailwind v4, e uma classe
 * em `@layer utilities` perde para ele — era por isso que título, campos e
 * botões ficavam no tamanho padrão do Clerk, pequenos. Objeto entra na mesma
 * folha do Clerk, depois do estilo padrão, e prevalece.
 *
 * Os valores são os tokens da prancha "Design system público": indigo 500
 * `#5B63F5`, tinta `#16171D`, texto 2 `#4A4D5A`, superfície `#FFFFFF`, borda de
 * campo `#E4E2DD`, raio de campo e botão 12px. Os hex são literais de propósito:
 * o `appearance` do Clerk é lido fora da árvore de CSS do portal, onde
 * `var(--…)` do `.pg` não alcança. Não reimplementa autenticação — só cor,
 * fonte, tamanho e raio da superfície do Clerk, pela API oficial.
 */
const FONT = "var(--font-sans), Manrope, 'Segoe UI', system-ui, sans-serif";

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
    fontFamily: FONT,
    fontFamilyButtons: FONT,
    fontSize: "15px",
  },
  options: {
    // A faixa "Development mode" do Clerk ficava cortada no rodapé do cartão
    // e não diz nada ao usuário; o aviso no console continua.
    unsafe_disableDevelopmentModeWarnings: true,
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none", border: "0" },
    card: {
      background: "transparent",
      boxShadow: "none",
      border: "0",
      padding: "0",
      gap: "24px",
      width: "100%",
    },
    header: { gap: "6px" },
    headerTitle: {
      fontSize: "26px",
      lineHeight: 1.2,
      fontWeight: 800,
      letterSpacing: "-0.02em",
    },
    headerSubtitle: { fontSize: "15px", lineHeight: 1.5, color: "#4A4D5A" },
    socialButtonsBlockButton: {
      minHeight: "50px",
      borderRadius: "12px",
      border: "1px solid #DCDAD4",
      boxShadow: "none",
      background: "#FFFFFF",
      color: "#16171D",
    },
    socialButtonsBlockButtonText: { fontSize: "15px", fontWeight: 700 },
    // O selo "Último uso" saía para fora do botão e era cortado pela borda do
    // cartão; a informação não é necessária para entrar.
    lastAuthenticationStrategyBadge: { display: "none" },
    dividerLine: { background: "#E4E2DD" },
    dividerText: { fontSize: "13px", color: "#6A6D79" },
    formFieldLabel: { fontSize: "14px", fontWeight: 700, color: "#16171D" },
    formFieldAction: { fontSize: "14px", fontWeight: 600 },
    formFieldInput: {
      minHeight: "50px",
      borderRadius: "12px",
      fontSize: "15.5px",
      color: "#16171D",
      background: "#FFFFFF",
    },
    formButtonPrimary: {
      minHeight: "50px",
      borderRadius: "12px",
      background: "#5B63F5",
      color: "#FFFFFF",
      fontSize: "15.5px",
      fontWeight: 700,
      textTransform: "none",
      boxShadow: "0 8px 18px -8px rgba(91,99,245,0.65)",
      "&:hover": { background: "#4A51E0" },
    },
    footer: { background: "transparent", border: "0" },
    // Em tela estreita, "Não possui uma conta?" e "Registre-se" quebravam no
    // meio de cada frase; agora cada um fica inteiro e a linha quebra entre eles.
    footerAction: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      columnGap: "4px",
      padding: "4px 0",
      textAlign: "center",
    },
    footerActionText: { fontSize: "14.5px", whiteSpace: "nowrap" },
    footerActionLink: {
      fontSize: "14.5px",
      fontWeight: 700,
      color: "#3E44C9",
      whiteSpace: "nowrap",
    },
    formFieldErrorText: { fontSize: "13.5px", color: "#B42318" },
    identityPreviewText: { fontSize: "14.5px" },
    identityPreviewEditButton: { color: "#3E44C9" },
  },
};
