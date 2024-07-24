import {
  ProductVariantWebhookPayloadFragment,
  ProductWebhookPayloadFragment,
} from "../../generated/graphql";

export interface ProductInChannel {
  [channel: string]: boolean;
}

export interface SearchProvider {
  createProduct(product: ProductWebhookPayloadFragment): Promise<void>;
  updateProduct(
    product: ProductWebhookPayloadFragment,
    productInChannel?: ProductInChannel,
  ): Promise<void>;
  deleteProduct(productId: ProductWebhookPayloadFragment): Promise<void>;
  createProductVariant(productVariant: ProductVariantWebhookPayloadFragment): Promise<void>;
  updateProductVariant(
    productVariant: ProductVariantWebhookPayloadFragment,
    productInChannel?: ProductInChannel,
  ): Promise<void>;
  deleteProductVariant(productId: ProductVariantWebhookPayloadFragment): Promise<void>;
  ping(): Promise<void>;
}
