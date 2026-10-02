/**
 * Contrato entre o GERADOR do template (`scripts/pgr-docx`) e o RUNTIME que o preenche:
 * onde o `.docx` mora no repositório e o nome (`docPr name`) da imagem placeholder do
 * logo nos cabeçalhos, trocada pelo logo da empresa depois da renderização.
 */
export const PGR_DOCX_TEMPLATE_FILE = "templates/pgr/pgr-template.docx";
export const PGR_DOCX_LOGO_PLACEHOLDER = "pgr-company-logo";
