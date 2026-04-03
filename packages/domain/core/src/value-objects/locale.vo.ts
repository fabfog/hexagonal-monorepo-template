import { z } from "zod";
import { CountryCode, CountryCodeSchema } from "./country-code.vo";
import { LanguageCode, LanguageCodeSchema } from "./language-code.vo";

export const LocaleSchema = z.object({
  language: LanguageCodeSchema,
  country: CountryCodeSchema,
});

export type LocaleProps = z.infer<typeof LocaleSchema>;

export class Locale {
  private readonly props: LocaleProps;

  constructor(props: LocaleProps) {
    this.props = LocaleSchema.parse(props);
  }

  static fromCountryLanguage(country: CountryCode, language: LanguageCode): Locale {
    return new Locale({
      country: country.value,
      language: language.value,
    });
  }

  toCountryLanguage(): { country: CountryCode; language: LanguageCode } {
    return {
      country: new CountryCode(this.props.country),
      language: new LanguageCode(this.props.language),
    };
  }

  getProps(): Readonly<LocaleProps> {
    return this.props;
  }

  /**
   * IETF locale tag, e.g. `"en-US"`, `"it-IT"`.
   * More often referred as "locale code".
   */
  get code(): string {
    return `${this.props.language}-${this.props.country}`;
  }

  equals(other: Locale): boolean {
    return this.code === other.code;
  }

  toSnapshot(): Readonly<LocaleProps> {
    return this.getProps();
  }
}
