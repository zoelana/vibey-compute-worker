import { Hono } from 'hono';
import { z } from 'zod';
import puppeteer from '@cloudflare/puppeteer';

type Bindings = {
  MYBROWSER: any;
};

const app = new Hono<{ Bindings: Bindings }>();

// Strict API Firewall Boundary
const generatePdfSchema = z.strictObject({
  targetUrl: z.string().url(),
  filename: z.string().optional().default('Document.pdf'),
});

app.post('/api/generate/pdf', async (c) => {
  try {
    // 1. Zod Validation
    const body = await c.req.json();
    const result = generatePdfSchema.safeParse(body);
    
    if (!result.success) {
      return c.json({ error: 'Schema Validation Failed', details: result.error.format() }, 400);
    }
    
    const { targetUrl, filename } = result.data;

    // 2. Browser Verification
    if (!c.env.MYBROWSER) {
      return c.json({ error: 'Browser rendering API is not bound.' }, 500);
    }

    // 3. Headless PDF Generataion
    const browser = await puppeteer.launch(c.env.MYBROWSER);
    const page = await browser.newPage();
    
    await page.emulateMediaType('print');
    
    // Configure network idle to allow Vibey React components to finish rendering
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0cm',
        right: '0cm',
        bottom: '0cm',
        left: '0cm'
      }
    });

    await browser.close();

    // 4. Return secure buffer
    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });

  } catch (error: any) {
    return c.json({ error: 'Internal Server Error', message: error.message }, 500);
  }
});

export default app;
