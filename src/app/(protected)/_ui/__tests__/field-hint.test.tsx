import { render, screen } from "@testing-library/react";

import { FieldHint } from "../field-hint";

describe("FieldHint", () => {
  it("rotula a dica estática como Dica, sem atribuir o texto à IA", () => {
    render(<FieldHint>Descreva as etapas do processo.</FieldHint>);
    expect(screen.getByText("Dica:")).toBeInTheDocument();
    expect(screen.getByText(/Descreva as etapas do processo/)).toBeInTheDocument();
    expect(screen.queryByText(/IA/)).not.toBeInTheDocument();
  });
});
