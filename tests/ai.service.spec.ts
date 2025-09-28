import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AiService } from '../src/ai/ai.service.js';
import { AppError } from '../src/utils/httpError.js';

describe('AiService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when generating a summary without configuration', async () => {
    const service = new AiService(undefined, 'gpt-test');
    await expect(service.generateSummary('text')).rejects.toMatchObject({ statusCode: 500 });
  });

  it('returns the trimmed summary provided by the client', async () => {
    const service = new AiService(undefined, 'gpt-test');
    (service as unknown as { client: { responses: { create: ReturnType<typeof vi.fn> } } }).client = {
      responses: {
        create: vi.fn().mockResolvedValue({ output_text: '  summarized text  ' }),
      },
    };

    const summary = await service.generateSummary('text to summarize');
    expect(summary).toBe('summarized text');
  });

  it('throws when inferring a category without options', async () => {
    const service = new AiService(undefined, 'gpt-test');
    await expect(service.inferCategory({ title: 'A', description: 'B', categories: [] })).rejects.toBeInstanceOf(AppError);
  });

  it('falls back to the best local match when the client fails', async () => {
    const service = new AiService(undefined, 'gpt-test');
    (service as unknown as { client: { responses: { create: ReturnType<typeof vi.fn> } } }).client = {
      responses: {
        create: vi.fn().mockRejectedValue(new Error('network error')),
      },
    };

    const category = await service.inferCategory({
      title: 'Incredible Gadget',
      description: 'Perfect for outdoors',
      categories: ['Gadget', 'Outdoors'],
    });

    expect(category).toBe('Gadget');
  });

  it('parses translation responses removing Markdown fences', async () => {
    const service = new AiService(undefined, 'gpt-test');
    (service as unknown as { client: { responses: { create: ReturnType<typeof vi.fn> } } }).client = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: '```json\n{"title":"Hola","description":"Mundo"}\n```',
        }),
      },
    };

    const translation = await service.translateProductContent({
      title: 'Hello',
      description: 'World',
      targetLanguage: 'es',
    });

    expect(translation).toEqual({ title: 'Hola', description: 'Mundo' });
  });

  it('throws an AppError when translation response cannot be parsed', async () => {
    const service = new AiService(undefined, 'gpt-test');
    (service as unknown as { client: { responses: { create: ReturnType<typeof vi.fn> } } }).client = {
      responses: {
        create: vi.fn().mockResolvedValue({ output_text: 'invalid json' }),
      },
    };

    await expect(
      service.translateProductContent({ title: 'Hi', description: 'there', targetLanguage: 'es' }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});
