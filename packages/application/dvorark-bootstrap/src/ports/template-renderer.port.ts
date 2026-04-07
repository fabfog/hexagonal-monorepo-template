export interface TemplateRendererPort {
  render(template: string, data: Record<string, string>): Promise<string>;
}
