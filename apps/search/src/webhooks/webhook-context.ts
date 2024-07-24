import { AuthData } from "@saleor/app-sdk/APL";
import { getAlgoliaConfiguration } from "../lib/algolia/getAlgoliaConfiguration";
import { ChannelsDocument, ProductDataByIdDocument } from "../../generated/graphql";
import { AlgoliaSearchProvider } from "../lib/algolia/algoliaSearchProvider";
import { createInstrumentedGraphqlClient } from "../lib/create-instrumented-graphql-client";
import { ProductInChannel } from "../lib/searchProvider";

/**
 * Fetches and creates all shared entities required by webhook to proceed
 */
export const createWebhookContext = async ({
  authData,
  productId,
}: {
  authData: AuthData;
  productId?: string;
}) => {
  const { settings, errors } = await getAlgoliaConfiguration({ authData });
  const apiClient = createInstrumentedGraphqlClient({
    saleorApiUrl: authData.saleorApiUrl,
    token: authData.token,
  });
  const { data: channelsData } = await apiClient.query(ChannelsDocument, {}).toPromise();
  const channels = channelsData?.channels || [];

  if (!settings || errors) {
    let errorMessage = "Error fetching settings";

    if (errors && errors.length > 0 && errors[0].message) {
      errorMessage = errors[0].message;
    }

    throw new Error(errorMessage);
  }

  if (!settings.appConfig) {
    throw new Error("App not configured");
  }

  const algoliaClient = new AlgoliaSearchProvider({
    appId: settings.appConfig?.appId,
    apiKey: settings.appConfig?.secretKey,
    indexNamePrefix: settings.appConfig?.indexNamePrefix,
    channels,
    enabledKeys: settings.fieldsMapping.enabledAlgoliaFields,
  });

  let productInChannel = undefined;

  if (productId) {
    const productResponse = await Promise.all(
      channels.map(({ slug }) =>
        apiClient.query(ProductDataByIdDocument, { id: productId, channel: slug }).toPromise(),
      ),
    );

    productInChannel = productResponse
      .flatMap(({ data }) => (data?.product ? [data.product] : []))
      .reduce((acc, { channel, variants }) => {
        if (!channel) {
          return acc;
        }

        const productInCurrentChannel = !!variants?.some(
          ({ quantityAvailable }) => !!quantityAvailable,
        );

        return { ...acc, [channel]: productInCurrentChannel };
      }, {} as ProductInChannel);
  }

  return {
    apiClient,
    channels,
    settings,
    algoliaClient,
    productInChannel,
  };
};
