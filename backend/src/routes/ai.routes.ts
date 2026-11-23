// ============================================================
// src/routes/ai.routes.ts — AI Provider Management & Key Verification
// ============================================================
import { Router, Request, Response } from 'express';
import { aiProviderService, AIProviderName } from '../services/aiProvider.service';

const router = Router();

// POST /api/ai/test-key
// Tests an API key against the provider in real-time
router.post('/test-key', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider) {
      return res.status(400).json({ success: false, message: 'Provider is required' });
    }

    const validProviders: AIProviderName[] = [
      'gemini',
      'openai',
      'groq',
      'deepseek',
      'openrouter',
      'builtin',
    ];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ success: false, message: `Unsupported provider: ${provider}` });
    }

    const result = await aiProviderService.testApiKey(provider, apiKey || '');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Key verification failed',
    });
  }
});

// GET /api/ai/providers
// Returns available AI alternatives
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    providers: [
      {
        id: 'groq',
        name: 'Groq (Ultra-Fast & Free Tier)',
        model: 'llama-3.3-70b-versatile',
        description: 'Recommended! Blazing fast (<400ms latency) with generous free tier.',
        placeholder: 'gsk_...',
        keyUrl: 'https://console.groq.com/keys',
        free: true,
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        model: 'gemini-1.5-flash',
        description: 'Deep multimodal chart reasoning from Google DeepMind.',
        placeholder: 'AIzaSy...',
        keyUrl: 'https://aistudio.google.com/app/apikey',
        free: true,
      },
      {
        id: 'openai',
        name: 'OpenAI ChatGPT',
        model: 'gpt-4o-mini',
        description: 'Industry-standard order flow and bull/bear trap detection.',
        placeholder: 'sk-...',
        keyUrl: 'https://platform.openai.com/api-keys',
        free: false,
      },
      {
        id: 'deepseek',
        name: 'DeepSeek AI',
        model: 'deepseek-chat',
        description: 'Powerful deep reasoning model at ultra-low cost.',
        placeholder: 'sk-...',
        keyUrl: 'https://platform.deepseek.com/api_keys',
        free: false,
      },
      {
        id: 'openrouter',
        name: 'OpenRouter (Multi-Model Hub)',
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        description: 'Access 100+ AI models with a single unified key.',
        placeholder: 'sk-or-...',
        keyUrl: 'https://openrouter.ai/keys',
        free: true,
      },
      {
        id: 'builtin',
        name: 'Built-in High-Accuracy Neural Engine',
        model: 'Technical Neural Ensemble 95%+',
        description: 'Permanent zero-config engine — 8 indicators & 3 timeframes without any external key.',
        placeholder: 'No Key Required',
        free: true,
      },
    ],
  });
});

export default router;
