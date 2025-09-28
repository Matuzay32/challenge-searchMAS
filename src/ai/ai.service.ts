import OpenAI from 'openai';
import { AppError } from '../utils/httpError.js';

interface InferCategoryInput {
  title: string;
  description: string;
  categories: string[];
}

interface TranslateProductInput {
  title: string;
  description: string;
  targetLanguage: string;
}

export class AiService {
  private readonly client: OpenAI | null;

  private readonly model: string;

  constructor(apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini') {
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    this.model = model;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generateSummary(text: string): Promise<string> {
    if (!this.client) {
      throw new AppError(500, 'OpenAI API key is not configured');
    }

    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'Eres un asistente que resume descripciones de productos en un máximo de dos oraciones claras y concisas.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_output_tokens: 120,
      });

      const summary = response.output_text?.trim();
      if (!summary) {
        throw new AppError(502, 'OpenAI did not return a summary');
      }

      return summary;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(502, 'Failed to generate summary with OpenAI', error);
    }
  }

  async inferCategory({ title, description, categories }: InferCategoryInput): Promise<string> {
    if (!categories.length) {
      throw new AppError(400, 'No categories available to infer');
    }

    const fallbackCategory = this.pickBestMatch(`${title} ${description}`, categories) ?? categories[0];

    if (!this.client) {
      return fallbackCategory;
    }

    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'Eres un asistente que selecciona la categoría más adecuada de una lista disponible. Devuelve solo el nombre exacto de la categoría elegida.',
          },
          {
            role: 'user',
            content: `Categorías disponibles: ${categories.join(', ')}\nTítulo: ${title}\nDescripción: ${description}`,
          },
        ],
        max_output_tokens: 40,
      });

      const rawCategory = response.output_text?.trim();
      if (!rawCategory) {
        return fallbackCategory;
      }

      return this.pickBestMatch(rawCategory, categories) ?? fallbackCategory;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      return fallbackCategory;
    }
  }

  async translateProductContent({
    title,
    description,
    targetLanguage,
  }: TranslateProductInput): Promise<{ title: string; description: string }> {
    if (!this.client) {
      throw new AppError(500, 'OpenAI API key is not configured');
    }

    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'Eres un traductor profesional. Devuelves únicamente un objeto JSON con las claves "title" y "description" traducidas al idioma solicitado.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              targetLanguage,
              title,
              description,
            }),
          },
        ],
        max_output_tokens: 400,
      });

      const payload = response.output_text?.trim();
      if (!payload) {
        throw new AppError(502, 'OpenAI did not return a translation');
      }

      const sanitized = payload
        .replace(/^```json\s*/i, '')
        .replace(/```$/i, '')
        .trim();

      const parsed = JSON.parse(sanitized) as { title?: string; description?: string };
      if (!parsed.title || !parsed.description) {
        throw new AppError(502, 'Translation response was incomplete');
      }

      return { title: parsed.title, description: parsed.description };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppError(502, 'Failed to parse translation response', error);
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(502, 'Failed to translate product content with OpenAI', error);
    }
  }

  private pickBestMatch(text: string, categories: string[]): string | undefined {
    const normalizedText = text.toLowerCase().trim();
    const cleaned = normalizedText.replace(/^['"]|['"]$/g, '').trim();
    const directMatch = categories.find((category) => category.toLowerCase() === cleaned);
    if (directMatch) {
      return directMatch;
    }

    return categories.find((category) => cleaned.includes(category.toLowerCase()));
  }
}
