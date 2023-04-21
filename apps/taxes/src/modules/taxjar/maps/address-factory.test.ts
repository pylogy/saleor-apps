import { describe, expect, it } from "vitest";
import { taxJarAddressFactory } from "./address-factory";

describe("taxJarAddressFactory", () => {
  describe("fromChannelAddress", () => {
    it("returns fields in the expected format", () => {
      const result = taxJarAddressFactory.fromChannelAddress({
        city: "LOS ANGELES",
        country: "US",
        state: "CA",
        street: "123 Palm Grove Ln",
        zip: "90002",
      });

      expect(result).toEqual({
        street: "123 Palm Grove Ln",
        city: "LOS ANGELES",
        state: "CA",
        zip: "90002",
        country: "US",
      });
    });
  });

  describe("fromSaleorAddress", () => {
    it("returns fields in the expected format with streetAddress1", () => {
      const result = taxJarAddressFactory.fromSaleorAddress({
        streetAddress1: "123 Palm Grove Ln",
        streetAddress2: "",
        city: "LOS ANGELES",
        country: {
          code: "US",
        },
        countryArea: "CA",
        postalCode: "90002",
      });

      expect(result).toEqual({
        street: "123 Palm Grove Ln",
        city: "LOS ANGELES",
        state: "CA",
        zip: "90002",
        country: "US",
      });
    });

    it("returns fields in the expected format with streetAddress1 and streetAddress2", () => {
      const result = taxJarAddressFactory.fromSaleorAddress({
        streetAddress1: "123 Palm",
        streetAddress2: "Grove Ln",
        city: "LOS ANGELES",
        country: {
          code: "US",
        },
        countryArea: "CA",
        postalCode: "90002",
      });

      expect(result).toEqual({
        street: "123 Palm Grove Ln",
        city: "LOS ANGELES",
        state: "CA",
        zip: "90002",
        country: "US",
      });
    });
  });
});