import type { TemplateRendererPort } from "@application/dvorark-bootstrap/ports";
import Handlebars from "handlebars";

export class TemplateRendererAdapter implements TemplateRendererPort {
  async render(template: string, data: Record<string, string>): Promise<string> {
    return Handlebars.compile(template)(data);
  }
}
