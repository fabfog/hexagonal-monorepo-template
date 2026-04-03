export interface FixtureLocaleProps {
  language: string;
  country: string;
}

export class FixtureLocale {
  private readonly props: FixtureLocaleProps;

  constructor(props: FixtureLocaleProps) {
    this.props = props;
  }

  getProps(): Readonly<FixtureLocaleProps> {
    return this.props;
  }
}
