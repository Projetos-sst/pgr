import { Button } from "../../../_ui/button";
import { SelectField, TextField } from "../../../_ui/form";
import { ListToolbar } from "../../../_ui/list";
import { SERVICE_LABELS, STATUS_LABELS } from "./format";

const SERVICE_OPTIONS = ["pgr", "medicine", "pro"].map((value) => ({
  value,
  label: SERVICE_LABELS[value],
}));

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function SubscriptionFilters({
  filters,
}: {
  filters: Record<string, string | undefined>;
}) {
  return (
    <form action="/admin-global/subscriptions" method="get" aria-label="Filtros">
      <ListToolbar>
        <TextField
          label="Escritório (org_id)"
          name="orgId"
          defaultValue={filters.orgId}
          isMono
        />
        <TextField
          label="Empresa (id)"
          name="companyId"
          defaultValue={filters.companyId}
          isMono
        />
        <SelectField
          label="Serviço"
          name="service"
          defaultValue={filters.service}
          options={SERVICE_OPTIONS}
          emptyLabel="Todos"
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={filters.status}
          options={STATUS_OPTIONS}
          emptyLabel="Todos"
        />
        <TextField
          label="Período de"
          name="from"
          type="date"
          defaultValue={filters.from}
        />
        <TextField label="Período até" name="to" type="date" defaultValue={filters.to} />
        <TextField
          label="Identificador do provedor"
          name="search"
          defaultValue={filters.search}
          isMono
        />
        <Button type="submit" label="Filtrar" />
      </ListToolbar>
    </form>
  );
}
