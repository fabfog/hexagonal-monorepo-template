import { FixtureLocale } from "../value-objects/fixture-locale.vo";
import { TicketId } from "../value-objects/ticket-id.vo";

export interface TicketProps {
  id: TicketId;
  title: string;
  count: number;
  locale: FixtureLocale;
}

export class TicketEntity {
  private readonly _id: TicketId;
  private readonly _props: { title: string; count: number; locale: FixtureLocale };

  constructor({ id, ...data }: TicketProps) {
    this._id = id;
    this._props = data;
  }

  toSnapshot(): Readonly<TicketProps> {
    return Object.freeze({
      id: this._id,
      ...this._props,
    });
  }
}
