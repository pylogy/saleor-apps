import { NextWebhookApiHandler } from "@saleor/app-sdk/handlers/next";
import { ProductDataByIdDocument, ProductUpdated } from "../../../../../generated/graphql";
import { WebhookActivityTogglerService } from "../../../../domain/WebhookActivityToggler.service";
import { createLogger } from "../../../../lib/logger";
import { ProductInChannel } from "../../../../lib/searchProvider";
import { webhookProductUpdated } from "../../../../webhooks/definitions/product-updated";
import { createWebhookContext } from "../../../../webhooks/webhook-context";
import { withOtel } from "@saleor/apps-otel";

export const config = {
  api: {
    bodyParser: false,
  },
};

const logger = createLogger("webhookProductUpdatedWebhookHandler");

export const handler: NextWebhookApiHandler<ProductUpdated> = async (req, res, context) => {
  const { event, authData } = context;

  logger.debug(
    `New event ${event} (${context.payload?.__typename}) from the ${authData.domain} domain has been received!`,
  );

  const { product } = context.payload;

  if (!product) {
    logger.error("Webhook did not received expected product data in the payload.");
    return res.status(200).end();
  }

  const channels = product.channelListings?.map(({ channel }) => channel.slug) ?? [];

  try {
    const { algoliaClient, apiClient } = await createWebhookContext({ authData });

    let productInChannel = undefined;

    if (channels.length > 0 && product.id) {
      const productResponse = await Promise.all(
        channels.map((channel) =>
          apiClient.query(ProductDataByIdDocument, { id: product.id, channel }).toPromise(),
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
      await algoliaClient.updateProduct(product, productInChannel);

      res.status(200).end();
      return;
    } catch (e) {
      logger.info(e, "Algolia updateProduct failed. Webhooks will be disabled");

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
  webhookProductUpdated.createHandler(handler),
  "api/webhooks/saleor/product_updated",
);
