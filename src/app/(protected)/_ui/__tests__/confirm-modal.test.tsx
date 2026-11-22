import { render, screen } from "@testing-library/react";

import { ConfirmModal } from "../confirm-modal";

describe("ConfirmModal", () => {
  it.each(["danger", "warning", "primary"] satisfies (
    | "danger"
    | "warning"
    | "primary"
  )[])(
    "variante %s abre com o foco em Cancelar, para Enter não confirmar sem querer",
    (variant) => {
      render(
        <ConfirmModal
          open
          variant={variant}
          title="Excluir"
          description="Não dá para desfazer."
          confirmLabel="Excluir"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
      expect(screen.getByRole("button", { name: "Excluir" })).not.toHaveFocus();
    },
  );
});
