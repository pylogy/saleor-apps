import { NextWebhookApiHandler } from "@saleor/app-sdk/handlers/next";
import {
  ProductDataByIdDocument,
  ProductVariantBackInStock,
} from "../../../../../generated/graphql";
import { WebhookActivityTogglerService } from "../../../../domain/WebhookActivityToggler.service";
import { createLogger } from "../../../../lib/logger";
import { ProductInChannel } from "../../../../lib/searchProvider";
import { webhookProductVariantBackInStock } from "../../../../webhooks/definitions/product-variant-back-in-stock";
import { createWebhookContext } from "../../../../webhooks/webhook-context";
import { withOtel } from "@saleor/apps-otel";

export const config = {
  api: {
    bodyParser: false,
  },
};

const logger = createLogger("webhookProductVariantBackInStockWebhookHandler");

export const handler: NextWebhookApiHandler<ProductVariantBackInStock> = async (
  req,
  res,
  context,
) => {
  const { event, authData } = context;

  logger.debug(
    `New event ${event} (${context.payload?.__typename}) from the ${authData.domain} domain has been received!`,
  );

  const { productVariant } = context.payload;

  if (!productVariant) {
    logger.error("Webhook did not received expected product data in the payload.");
    return res.status(200).end();
  }

  const channels = productVariant.channelListings?.map(({ channel }) => channel.slug) ?? [];

  try {
    const { algoliaClient, apiClient } = await createWebhookContext({ authData });

    let productInChannel = undefined;

    if (channels.length > 0 && productVariant.product.id) {
      const productResponse = await Promise.all(
        channels.map((channel) =>
          apiClient
            .query(ProductDataByIdDocument, { id: productVariant.product.id, channel })
            .toPromise(),
        ),
      );

      productInChannel = productResponse
        .flatMap(({ data }) => (data?.product ? [data.product] : []))
        .reduce((acc, { channel, variants }) => {
          if (!channel) return acc;

          const inChannel = !!variants?.some(({ quantityAvailable }) => !!quantityAvailable);

          return { ...acc, [channel]: inChannel };
        }, {} as ProductInChannel);
    }

    try {
      await algoliaClient.updateProductVariant(productVariant, productInChannel);

      res.status(200).end();
      return;
    } catch (e) {
      logger.info(e, "Algolia updateProductVariant failed. Webhooks will be disabled");

      const webhooksToggler = new WebhookActivityTogglerService(authData.appId, apiClient);

      logger.trace("Will disable webhooks");

      await webhooksToggler.disableOwnWebhooks(
        context.payload.recipient?.webhooks?.map((w) => w.id),
      );

      logger.trace("Webhooks disabling operation finished");

      return res.status(500).send("Operation failed, webhooks are disabled");
    }
  } catch (e) {
    return res.status(400).json({
      message: (e as Error).message,
    });
  }
};

export default withOtel(
  webhookProductVariantBackInStock.createHandler(handler),
  "api/webhooks/saleor/product_variant_back_in_stock",
);
