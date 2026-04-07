import { z } from "zod";

export const DateRangeSchema = z
  .object({
    start: z.date(),
    end: z.date(),
  })
  .refine((d) => d.start <= d.end, {
    message: "DateRange start must be before or equal to end",
    path: ["start"],
  });

export type DateRangeProps = z.infer<typeof DateRangeSchema>;

export class DateRange {
  private readonly props: DateRangeProps;

  constructor(props: DateRangeProps) {
    this.props = DateRangeSchema.parse(props);
  }

  getProps(): Readonly<DateRangeProps> {
    return this.props;
  }

  get start(): Date {
    return this.props.start;
  }

  get end(): Date {
    return this.props.end;
  }

  /** Duration in milliseconds. */
  get durationMs(): number {
    return this.props.end.getTime() - this.props.start.getTime();
  }

  contains(date: Date): boolean {
    return date >= this.props.start && date <= this.props.end;
  }

  equals(other: DateRange): boolean {
    return (
      this.start.getTime() === other.start.getTime() && this.end.getTime() === other.end.getTime()
    );
  }

  toSnapshot(): Readonly<DateRangeProps> {
    return this.getProps();
  }
}
