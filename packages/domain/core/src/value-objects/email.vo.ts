import { z } from "zod";

export const EmailSchema = z.string().email().toLowerCase();

export type EmailInput = z.infer<typeof EmailSchema>;

export class Email {
  private readonly _value: string;

  constructor(input: EmailInput) {
    this._value = EmailSchema.parse(input);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}
