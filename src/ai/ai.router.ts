import { Router } from 'express';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { GenerateSummaryDto } from './dto/generate-summary.dto.js';

export function createAiRouter(aiService: AiService): Router {
  const router = Router();
  const controller = new AiController(aiService);

  router.post('/ai/summary', validateRequest(GenerateSummaryDto), controller.generateSummary);

  return router;
}
