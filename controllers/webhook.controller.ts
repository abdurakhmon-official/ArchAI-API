import { Req, Res } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { BodyParams, HeaderParams } from '@tsed/platform-params';
import { Post, Summary } from '@tsed/schema';
import type { Request, Response } from 'express';
import { ClickRequestSchema, PaymeRequestSchema } from '@/inputs/billing.input';
import { ClickService, CLICK_ERROR } from '@/services/click.service';
import type { ClickResponse } from '@/types/click.types';
import { PaymeError, PaymeService, PAYME_ERROR } from '@/services/payme.service';
import { StripeService } from '@/services/stripe.service';

@Controller('/webhook')
export class WebhookController {
  @Inject()
  private payme!: PaymeService;

  @Inject()
  private click!: ClickService;

  @Inject()
  private stripe!: StripeService;

  @Post('/payme')
  async paymeWebhook(
    @HeaderParams('authorization') authorization: string,
    @BodyParams() body: unknown,
  ) {
    const request = body as { id?: number | string };

    try {
      this.payme.authorize(authorization);

      const parsed = PaymeRequestSchema.parse(body);
      const result = await this.payme.handle(parsed.method, parsed.params);

      return { jsonrpc: '2.0', id: parsed.id ?? request.id ?? 0, result };
    } catch (error) {
      if (error instanceof PaymeError) {
        return {
          jsonrpc: '2.0',
          id: request.id ?? 0,
          error: {
            code: error.code,
            message: { uz: error.message, ru: error.message, en: error.message },
            ...(error.data ? { data: error.data } : {}),
          },
        };
      }

      console.error('[webhook:payme]', error);

      return {
        jsonrpc: '2.0',
        id: request.id ?? 0,
        error: {
          code: PAYME_ERROR.TRANSPORT,
          message: { uz: 'Ichki xato', ru: 'Внутренняя ошибка', en: 'Internal error' },
        },
      };
    }
  }

  @Post('/click')
  @Summary('Click Prepare / Complete')
  async clickWebhook(@BodyParams() body: unknown): Promise<ClickResponse> {
    try {
      const request = ClickRequestSchema.parse(body);
      return await this.click.handle(request);
    } catch (error) {
      console.error('[webhook:click]', error);

      const payload = (body ?? {}) as Record<string, string>;

      return {
        click_trans_id: payload.click_trans_id ?? '',
        merchant_trans_id: payload.merchant_trans_id ?? '',
        error: CLICK_ERROR.ERROR_IN_REQUEST,
        error_note: 'Error in request from click',
      };
    }
  }

  @Post('/stripe')
  @Summary('Stripe webhook')
  async stripeWebhook(
    @Req() request: Request,
    @HeaderParams('stripe-signature') signature: string,
    @Res() response: Response,
  ) {
    try {
      const raw = Buffer.isBuffer(request.body) ? request.body : Buffer.from('');
      const result = await this.stripe.handleWebhook(raw, signature);

      return result;
    } catch (error) {
      console.error('[webhook:stripe]', (error as Error).message);
      response.status(400);

      return { received: false, error: (error as Error).message };
    }
  }
}
