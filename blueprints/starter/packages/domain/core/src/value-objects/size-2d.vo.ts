import { z } from "zod";

/** Two-dimensional size with positive integer dimensions (pixels, points, cells, etc.). */
export const Size2DSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type Size2DProps = z.infer<typeof Size2DSchema>;

export class Size2D {
  private readonly props: Size2DProps;

  constructor(props: Size2DProps) {
    this.props = Size2DSchema.parse(props);
  }

  getProps(): Readonly<Size2DProps> {
    return this.props;
  }

  get width(): number {
    return this.props.width;
  }

  get height(): number {
    return this.props.height;
  }

  get aspectRatio(): number {
    return this.props.width / this.props.height;
  }

  equals(other: Size2D): boolean {
    return this.props.height === other.props.height && this.props.width === other.props.width;
  }

  toSnapshot(): Readonly<Size2DProps> {
    return this.getProps();
  }
}
