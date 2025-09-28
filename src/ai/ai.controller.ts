import type { NextFunction, Request, Response } from 'express';
import { AiService } from './ai.service.js';
import { GenerateSummaryDto } from './dto/generate-summary.dto.js';

export class AiController {
  constructor(private readonly aiService: AiService) {}

  generateSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as GenerateSummaryDto;
      const summary = await this.aiService.generateSummary(body.text);
      res.json({ summary });
    } catch (error) {
      next(error);
    }
  };
}
