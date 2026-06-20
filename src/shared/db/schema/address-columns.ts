import { text } from "drizzle-orm/pg-core";

export function addressColumns() {
  return {
    zipCode: text("zip_code"),
    street: text("street"),
    number: text("number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    state: text("state"),
  };
}
