import { Client } from "urql";
import { SettingsManager } from "@saleor/app-sdk/settings-manager";
import { IWebhookActivityTogglerService } from "../domain/WebhookActivityToggler.service";
import { SearchProvider } from "./searchProvider";
import { NextProtectedApiHandler } from "@saleor/app-sdk/handlers/next";
import { AppConfigMetadataManager } from "../modules/configuration/app-config-metadata-manager";
import {
  FetchOwnWebhooksDocument,
  OwnWebhookFragment,
  ProductDataByIdDocument,
  ProductDataFragment,
} from "../../generated/graphql";
import { createLogger } from "@saleor/apps-logger";

type FactoryProps = {
  settingsManagerFactory: (
    client: Pick<Client, "query" | "mutation">,
    appId: string,
  ) => SettingsManager;
  graphqlClientFactory: (saleorApiUrl: string, token: string) => Pick<Client, "query" | "mutation">;
};

const logger = createLogger("productDataHandler");

export type ProductDataResponse = {
  productData?: ProductDataFragment | null;
};

export const productDataFactory =
  ({
    settingsManagerFactory,
    graphqlClientFactory,
  }: FactoryProps): NextProtectedApiHandler<ProductDataResponse> =>
  async (req, res, { authData }) => {
    /**
     * Initialize services
     */
    const client = graphqlClientFactory(authData.saleorApiUrl, authData.token);
    const settingsManager = settingsManagerFactory(client, authData.appId);

    logger.debug("fetched settings");

    try {
      const productData = await client
        .query(ProductDataByIdDocument, { id: authData.appId })
        .toPromise()
        .then((r) => r.data?.product);

      return res.status(200).json({
        productData,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).end();
    }
  };
